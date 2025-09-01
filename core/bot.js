/**
 * Core bot setup and event handling
 */
const { SpecialCommandHandler } = require('../workflow/specialCommands');
// SimplePlanGenerator importunu kaldır!
const { Events } = require('discord.js');
const { LLMService } = require('../ai/llmservice');
const { PlanGenerator } = require('../ai/planGenerator');
const { WorkflowEngine } = require('../workflow/workflowEngine');
const { loadExtensions } = require('../extensions/extensionLoader');
const i18n = require('../config/i18n');
const { DynamicHandler } = require('./dynamicHandler');

async function setupBot(client, config, logger, eventBus) {
  // Initialize LLM service
  const specialCommandHandler = new SpecialCommandHandler(client, logger);
  
  const dynamicHandler = new DynamicHandler(client, logger);
  const llm = new LLMService(config.LLM_API_URL, config.LLM_MODEL, logger);
  
  // Initialize workflow engine
  const workflowEngine = new WorkflowEngine(client, logger, eventBus, config);
  
  // Set dynamicHandler on the workflowEngine for advanced commands
  workflowEngine.dynamicHandler = dynamicHandler;
  
  // Initialize plan generator
  const planGenerator = new PlanGenerator(llm, workflowEngine, logger, config);
  
  // Load extensions
  if (config.EXTENSIONS_ENABLED) {
    await loadExtensions(client, eventBus, logger, config);
  }
  
  // Set up ready event
  client.once(Events.ClientReady, () => {
    logger.info(`Logged in as ${client.user.tag}`);
    client.user.setActivity(`${config.PREFIX} help`);
  });
  
  // Message handler
  client.on(Events.MessageCreate, async (message) => {
    try {
      // Ignore bot messages
      if (message.author.bot) return;
      
      // Check if the message mentions the bot or starts with the prefix
      const mentionRegex = new RegExp(`<@!?${client.user.id}>`);
      const isMentioned = mentionRegex.test(message.content);
      const isPrefix = message.content.toLowerCase().startsWith(config.PREFIX.toLowerCase());
      
      if (!isMentioned && !isPrefix) return;
      
      // Get the user input (remove mention or prefix)
      let userInput = message.content;
      if (isPrefix) {
        userInput = message.content.slice(config.PREFIX.toLowerCase().length).trim();
      } else if (isMentioned) {
        userInput = message.content.replace(mentionRegex, '').trim();
      }
      
      if (!userInput) return;
      
      // Send typing indicator
      await message.channel.sendTyping().catch(() => {});
      
      // Önce özel komutları dene
      const handled = await specialCommandHandler.handleCommand(message, userInput);
      if (handled) return;
      
      // Generate plan
      logger.info(`Generating plan for input: ${userInput}`);
      const plan = await planGenerator.generatePlan(message, userInput);
      
      // Check if we received a valid plan
      if (!plan || !plan.steps || !Array.isArray(plan.steps)) {
        await message.reply('❌ Üzgünüm, komutu anlamadım. Lütfen tekrar deneyin.');
        return;
      }
      
      // Check if plan requires approval
      if (plan.requiresApproval && 
          !(config.AUTO_APPROVE_ADMINS && 
            message.member?.permissions.has('ADMINISTRATOR'))) {
        // Show plan and request approval
        await requestPlanApproval(message, plan, async () => {
          await executeApprovedPlan(message, plan, workflowEngine, dynamicHandler, logger);
        });
      } else {
        // Execute plan immediately
        await executeApprovedPlan(message, plan, workflowEngine, dynamicHandler, logger);
      }
    } catch (error) {
      logger.error('Error processing message:', error);
      try {
        await message.reply('❌ Bir hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
      } catch (replyError) {
        logger.error('Failed to send error message:', replyError);
      }
    }
  });
  
  // Interaction handler (for buttons, menus, etc.)
  client.on(Events.InteractionCreate, async (interaction) => {
    eventBus.emit('interaction', { interaction });
  });
  
  // Return the initialized client
  return client;
}

async function requestPlanApproval(message, plan, onApproved) {
  const lang = 'en'; // Could be customized per guild
  
  // Format the plan for display
  let planDisplay = "```json\n";
  planDisplay += JSON.stringify(plan, null, 2);
  planDisplay += "\n```";
  
  // Send approval message
  const approvalMessage = await message.reply({
    content: i18n.translate('approvePlan', lang) + "\n" + planDisplay + "\n" + 
             i18n.translate('approvePlanPrompt', lang, { emoji: '✅', seconds: '30' }),
  });
  
  // Add reaction for approval
  await approvalMessage.react('✅');
  await approvalMessage.react('❌');
  
  // Create collector for reactions
  const filter = (reaction, user) => {
    return ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id;
  };
  
  // Wait for reaction
  try {
    const collected = await approvalMessage.awaitReactions({ 
      filter, 
      max: 1, 
      time: 30000, 
      errors: ['time'] 
    });
    
    const reaction = collected.first();
    
    if (reaction.emoji.name === '✅') {
      await approvalMessage.reply(i18n.translate('planApproved', lang));
      await onApproved();
    } else {
      await approvalMessage.reply(i18n.translate('planRejected', lang));
    }
  } catch (error) {
    await approvalMessage.reply(i18n.translate('planExpired', lang));
  }
}

async function executeApprovedPlan(message, plan, workflowEngine, dynamicHandler, logger) {
  try {
    // İlk olarak dinamik işleme için adımları kontrol et
    let usedDynamicHandler = false;
    const dynamicResults = [];
    
    // Config nesnesine koruma ekle
    const config = {}; // Varsayılan boş config
    
    // Admin kontrolü
    const isAdmin = message.member?.permissions.has('ADMINISTRATOR');
    
    // Plan adımlarını doğrudan işle (workflowEngine kullanmadan)
    if (plan.steps && Array.isArray(plan.steps)) {
      for (const step of plan.steps) {
        // Sadece discord.request tool'ları için kontrol et
        if (step.tool === 'discord.request') {
          try {
            logger.info(`Trying dynamic handler for action: ${step.params?.action || 'unknown'}`);
            const result = await dynamicHandler.executeAction(message, step.params || {});
            
            if (result && result.success) {
              dynamicResults.push({ 
                stepId: step.id || 'unknown', 
                success: true, 
                action: step.params?.action || 'unknown'
              });
              usedDynamicHandler = true;
              
              // Başarı mesajı ekle (isteğe bağlı)
              if (config.VERBOSE_EXECUTION) {
                await message.channel.send(`✅ Eylem başarılı: ${step.params?.action || 'unknown'}`).catch(() => {});
              }
            } else {
              dynamicResults.push({ 
                stepId: step.id || 'unknown', 
                success: false, 
                error: result?.error || 'Bilinmeyen hata',
                action: step.params?.action || 'unknown'
              });
              
              // Hata mesajı
              await message.channel.send(`❌ Eylem başarısız: ${result?.error || 'Bilinmeyen hata'}`).catch(() => {});
            }
          } catch (error) {
            logger.error(`Dynamic handler error for ${step.params?.action || 'unknown'}:`, error);
            dynamicResults.push({ 
              stepId: step.id || 'unknown', 
              success: false, 
              error: error.message || 'Exception occurred',
              action: step.params?.action || 'unknown'
            });
            
            // Hata mesajı
            await message.channel.send(`❌ İşlem hatası: ${error.message || 'Bilinmeyen hata'}`).catch(() => {});
          }
        }
      }
    }
    
    // Eğer tüm adımlar dinamik işleyici tarafından ele alındıysa
    if (usedDynamicHandler && dynamicResults.length > 0) {
      const successCount = dynamicResults.filter(r => r.success).length;
      const totalCount = dynamicResults.length;
      
      if (successCount === totalCount) {
        await message.reply(`✅ Tüm eylemler (${successCount}) başarıyla yürütüldü.`).catch(() => {});
      } else {
        const failCount = totalCount - successCount;
        await message.reply(`⚠️ ${successCount} eylem başarılı, ${failCount} eylem başarısız oldu.`).catch(() => {});
      }
      return;
    }
    
    // Hiç adım işlenmediyse kullanıcıyı bilgilendir
    if (dynamicResults.length === 0) {
      await message.reply('❌ Komut işlenemedi. Lütfen daha açık bir şekilde ifade edin.').catch(() => {});
    }
  } catch (error) {
    logger.error('Plan execution error:', error);
    try {
      // Try to send error as a new message
      await message.channel.send(`❌ Bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`).catch(() => {});
    } catch (sendError) {
      logger.error('Failed to send error notification:', sendError);
    }
  }
}

module.exports = { setupBot };