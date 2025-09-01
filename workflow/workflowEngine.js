/**
 * Workflow Engine - Executes workflows and action sequences
 */
const { Collection } = require('discord.js');

class WorkflowEngine {
  constructor(client, logger, actionHandler) {
    this.client = client;
    this.logger = logger;
    this.actionHandler = actionHandler;
    this.activeWorkflows = new Map();
  }
  
  /**
   * Execute a workflow plan
   * @param {Object} plan - Workflow plan
   * @param {Message} message - Original message that triggered the workflow
   * @returns {Promise<Object>} - Result of execution
   */
  // executeAction fonksiyonunda bu değişiklikleri yapın
async executeAction(step, message) {
    if (step.params && step.params.action) {
    // Format düzeltmeleri
    const actionMappings = {
      'member.roles.remove': 'role.remove',
      'member.roles.add': 'role.add',
      'member.role.remove': 'role.remove',
      'member.role.add': 'role.add',
      'roles.remove': 'role.remove',
      'roles.add': 'role.add',
      'message.send': 'message.create',
      'channel.messages.purge': 'channel.purge',
      'messages.delete': 'channel.purge'
    };
    
    // Bilinen yanlış formatları düzelt
    if (actionMappings[step.params.action]) {
      console.log(`⚠️ Action format düzeltiliyor: ${step.params.action} → ${actionMappings[step.params.action]}`);
      step.params.action = actionMappings[step.params.action];
    }
  }
  const { action } = step.params;
  
  // Admin kullanıcı kontrolü
  const isAdminUser = message.member?.permissions.has('ADMINISTRATOR');
  
  // Action formatını kontrol et
  const isValidActionFormat = /^[a-z]+\.[a-z]+$/.test(action);
  
  // Güvenlik kontrolü
  if (!isValidActionFormat) {
    return {
      success: false,
      error: `Invalid action format: '${action}'`
    };
  }
  
  // Admin kullanıcılar için daha esnek izinler
  if (isAdminUser) {
    // Sadece temel format kontrolü yap, actionlar için liste kontrolü yapma
    this.logger.info(`Admin user executing action: ${action}`);
  }
  else if (!this.allowedActions?.includes(action)) {
    // Admin olmayan kullanıcılar için izin kontrolü
    return {
      success: false,
      error: `Action '${action}' is not allowed for non-admin users`
    };
  }
  
  // Role işlemleri için özel kontroller
  if (action === 'role.add' || action === 'role.remove') {
    // roleId kontrolü
    if (!step.params.roleId) {
      // Rol ismine göre roleId bulma girişimi
      if (step.params.roleName) {
        const role = message.guild.roles.cache.find(
          r => r.name.toLowerCase() === step.params.roleName.toLowerCase()
        );
        
        if (role) {
          step.params.roleId = role.id;
        } else {
          return {
            success: false, 
            error: `Role named "${step.params.roleName}" not found`
          };
        }
      } else {
        return {
          success: false,
          error: `Missing roleId in ${action} step`
        };
      }
    }
    
    // userId kontrolü
    if (!step.params.userId) {
      // "me", "myself", "kendime" gibi ifadeleri kontrol et
      if (message.content.match(/\b(bana|kendime|me|myself|kendi|self)\b/i)) {
        step.params.userId = message.author.id;
      } 
      // "all" veya "tüm" ifadesini kontrol et (özel durum)
      else if (message.content.match(/\b(all|tüm|herkes)\b/i) && message.mentions.users.size > 0) {
        step.params.userId = message.mentions.users.first().id;
      }
      else {
        return {
          success: false,
          error: `Missing userId in ${action} step`
        };
      }
    }
  }

  // Diğer mevcut switch case yapınız devam eder...
  switch (action) {
    // Message actions
    case 'message.create':
      return await this.sendMessage(message, step.params);
    // Diğer case'ler...
    
    // Bilinmeyen action için fallback
    default:
      // Admin kullanıcılar için dinamik method çağırma girişimi
      if (isAdminUser) {
        try {
          const [category, method] = action.split('.');
          const handlerName = `${method}${category.charAt(0).toUpperCase() + category.slice(1)}`;
          
          if (typeof this[handlerName] === 'function') {
            return await this[handlerName](message, step.params);
          }
          
          throw new Error(`Unsupported action: ${action}`);
        } catch (error) {
          return {
            success: false,
            error: `Failed to execute '${action}': ${error.message}`
          };
        }
      }
      
      return {
        success: false,
        error: `Unknown action: ${action}`
      };
  }
}
  async executeWorkflow(plan, message) {
    if (!plan || !plan.steps || !Array.isArray(plan.steps)) {
      return { success: false, error: 'Invalid workflow plan' };
    }
    
    const workflowId = `wf_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Store workflow info
    this.activeWorkflows.set(workflowId, {
      id: workflowId,
      plan,
      message,
      startTime: Date.now(),
      status: 'running',
      results: []
    });
    
    try {
      // Execute steps based on strategy
      const strategy = plan.meta?.strategy || 'sequential';
      
      let results;
      if (strategy === 'sequential') {
        results = await this._executeSequential(plan.steps, message, workflowId);
      } else if (strategy === 'parallel') {
        results = await this._executeParallel(plan.steps, message, workflowId);
      } else {
        throw new Error(`Unknown execution strategy: ${strategy}`);
      }
      
      // Update workflow status
      const workflow = this.activeWorkflows.get(workflowId);
      workflow.status = 'completed';
      workflow.endTime = Date.now();
      workflow.results = results;
      
      return {
        success: true,
        workflowId,
        results
      };
    } catch (error) {
      // Update workflow status on failure
      const workflow = this.activeWorkflows.get(workflowId);
      if (workflow) {
        workflow.status = 'failed';
        workflow.endTime = Date.now();
        workflow.error = error.message;
      }
      
      this.logger.error(`Workflow execution failed (${workflowId}):`, error);
      
      return {
        success: false,
        workflowId,
        error: error.message
      };
    }
  }
  
  /**
   * Execute steps sequentially
   * @param {Array} steps - Workflow steps
   * @param {Message} message - Original message
   * @param {string} workflowId - ID of the workflow
   * @returns {Promise<Array>} - Results of each step
   * @private
   */
  async _executeSequential(steps, message, workflowId) {
    const results = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      try {
        // Execute step
        const result = await this._executeStep(step, message);
        results.push({
          stepId: step.id,
          success: result.success,
          result
        });
        
        // Update workflow
        const workflow = this.activeWorkflows.get(workflowId);
        if (workflow) {
          workflow.currentStep = i + 1;
          workflow.results = results;
        }
        
        // Stop execution if step failed and it's critical
        if (!result.success && step.critical) {
          throw new Error(`Critical step ${step.id} failed: ${result.error}`);
        }
      } catch (error) {
        this.logger.error(`Step execution failed (${step.id}):`, error);
        results.push({
          stepId: step.id,
          success: false,
          error: error.message
        });
        
        // Stop if this is a critical step
        if (step.critical) {
          throw error;
        }
      }
    }
    
    return results;
  }
  
  /**
   * Execute steps in parallel
   * @param {Array} steps - Workflow steps
   * @param {Message} message - Original message
   * @param {string} workflowId - ID of the workflow
   * @returns {Promise<Array>} - Results of each step
   * @private
   */
  async _executeParallel(steps, message, workflowId) {
    const stepPromises = steps.map(step => {
      return this._executeStep(step, message)
        .then(result => ({
          stepId: step.id,
          success: result.success,
          result
        }))
        .catch(error => ({
          stepId: step.id,
          success: false,
          error: error.message
        }));
    });
    
    return Promise.all(stepPromises);
  }
  
  /**
   * Execute a single workflow step
   * @param {Object} step - Step to execute
   * @param {Message} message - Original message
   * @returns {Promise<Object>} - Result of the step
   * @private
   */
  async _executeStep(step, message) {
    if (!step || !step.params || !step.params.action) {
      throw new Error('Invalid step configuration');
    }
    
    // Execute based on tool type
    switch (step.tool) {
      case 'discord.request':
        return await this._executeDiscordRequest(step.params, message);
      default:
        throw new Error(`Unknown tool: ${step.tool}`);
    }
  }
  
  /**
   * Execute a Discord request
   * @param {Object} params - Request parameters
   * @param {Message} message - Original message
   * @returns {Promise<Object>} - Result of the request
   * @private
   */
  async _executeDiscordRequest(params, message) {
  const { action } = params;
  
  // Action handler kontrolü
  if (this.actionHandler && typeof this.actionHandler.callAction === 'function') {
    return await this.actionHandler.callAction(action, message, params);
  }
  
  // Geriye dönük uyumluluk için
  if (!this.actionHandler || !this.actionHandler[action]) {
    throw new Error(`Unsupported action: ${action}`);
  }
  
  // Eski yöntemle eylemi çalıştır
  return await this.actionHandler[action](message, params);
}
  /**
 * Purge messages from a channel
 * @param {Message} message - Original message
 * @param {Object} params - Action parameters
 * @returns {Promise<Object>} - Action result
 */
async purgeChannel(message, params) {
  const { limit, channelId, userId } = params;
  
  if (!limit || limit <= 0 || limit > 100) {
    return { success: false, error: "Invalid limit (must be 1-100)" };
  }
  
  try {
    const channel = channelId
      ? await message.guild.channels.fetch(channelId).catch(() => null)
      : message.channel;
      
    if (!channel || !channel.isTextBased()) {
      return { success: false, error: "Channel not found or not text-based" };
    }
    
    // ÖNEMLİ DEĞİŞİKLİK: Daha fazla mesaj çekelim (100)
    await message.channel.send(`🔍 Son 100 mesaj içinden <@${userId}> kişisine ait mesajlar aranıyor...`);
    
    // Daha fazla mesaj çek
    const fetchedMessages = await channel.messages.fetch({ limit: 100 });
    
    // Debug amaçlı konsola yazdır
    console.log(`Toplam ${fetchedMessages.size} mesaj bulundu.`);
    
    // Kullanıcı filtresi uygula
    let messagesToDelete;
    if (userId) {
      // Kullanıcı mesajlarını filtrele
      messagesToDelete = fetchedMessages.filter(m => m.author.id === userId);
      console.log(`${userId} ID'li kullanıcıya ait ${messagesToDelete.size} mesaj bulundu.`);
      
      // Hiç mesaj bulunamadıysa, bildir
      if (messagesToDelete.size === 0) {
        await message.channel.send(`❌ <@${userId}> kullanıcısına ait son 100 mesaj içinde silinecek mesaj bulunamadı.`);
        return { 
          success: false, 
          error: "No messages found from that user in the recent history."
        };
      }
      
      // Kullanıcının son X mesajını al (limit kadar)
      messagesToDelete = messagesToDelete.first(limit);
    } else {
      // Sadece limit kadar mesaj al
      messagesToDelete = fetchedMessages.first(limit);
    }
    
    // Silinen mesaj sayısını kontrol et
    if (!messagesToDelete || messagesToDelete.length === 0) {
      await message.channel.send(`❌ Silinecek mesaj bulunamadı.`);
      return { success: false, error: "No messages to delete" };
    }
    
    // Bu mesajları sil
    await message.channel.send(`🗑️ ${messagesToDelete.length} mesaj siliniyor...`);
    
    try {
      // Mesajları sil
      const deleted = await channel.bulkDelete(messagesToDelete, true);
      
      // Başarı mesajı
      await message.channel.send(`✅ ${deleted.size} mesaj başarıyla silindi.`);
      
      return { 
        success: true, 
        count: deleted.size,
        userId: userId || null,
        message: `Deleted ${deleted.size} messages`
      };
    } catch (deleteError) {
      // Silme hatası (örn. 14 günden eski mesajlar)
      if (deleteError.message.includes('14 days')) {
        await message.channel.send(`❌ 14 günden eski mesajlar toplu olarak silinemez.`);
        return { success: false, error: 'Cannot delete messages older than 14 days.' };
      }
      
      await message.channel.send(`❌ Mesaj silme sırasında hata: ${deleteError.message}`);
      throw deleteError;
    }
  } catch (error) {
    console.error("Purge error:", error);
    await message.channel.send(`❌ Hata: ${error.message}`);
    return { success: false, error: error.message };
  }
}
  /**
   * Purge messages with user filtering
   * @param {Message} message - Original message
   * @param {Object} params - Parameters for purging
   * @returns {Promise<Object>} Operation result
   */
  async purgeMessages(message, params) {
    try {
      const { limit = 10, userId } = params;
      const numericLimit = parseInt(limit, 10);
      
      if (isNaN(numericLimit) || numericLimit < 1 || numericLimit > 100) {
        return {
          success: false,
          error: `Invalid limit (must be 1-100)`
        };
      }
      
      // Fetch messages to filter
      const messages = await message.channel.messages.fetch({ limit: 100 });
      
      // Apply user filter if userId specified
      let messagesToDelete;
      if (userId) {
        // Only get messages from the specified user
        messagesToDelete = messages.filter(msg => msg.author.id === userId).first(numericLimit);
        
        if (messagesToDelete.length === 0) {
          return {
            success: false,
            error: `No messages found from that user.`
          };
        }
      } else {
        // Get messages without user filtering
        messagesToDelete = messages.first(numericLimit);
      }
      
      // Convert to array for bulkDelete
      const messageArray = Array.from(messagesToDelete);
      
      // Delete messages
      const result = await message.channel.bulkDelete(messageArray, true)
        .catch(error => {
          if (error.message.includes('14 days')) {
            throw new Error('Cannot delete messages older than 14 days.');
          }
          throw error;
        });
      
      return {
        success: true,
        deletedCount: result.size,
        userFiltered: userId ? true : false
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get status of a workflow
   * @param {string} workflowId - ID of the workflow
   * @returns {Object|null} - Workflow status or null if not found
   */
  getWorkflowStatus(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    
    if (!workflow) {
      return null;
    }
    
    return {
      id: workflow.id,
      status: workflow.status,
      startTime: workflow.startTime,
      endTime: workflow.endTime,
      currentStep: workflow.currentStep,
      totalSteps: workflow.plan.steps.length
    };
  }
}

module.exports = { WorkflowEngine };