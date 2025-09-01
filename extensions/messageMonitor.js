/**
 * @name MessageMonitor
 * @description Monitors user messages and performs actions when conditions are met
 * @version 1.0
 */
class Extension {
  constructor(client, eventBus, memory) {
    this.name = 'MessageMonitor';
    this.version = '1.0';
    this.description = 'Monitors user messages and performs actions when conditions are met';
    
    this.client = client;
    this.eventBus = eventBus;
    this.memory = memory;
    this.state = {
      active: false, // Changed to false initially
      targetUserId: null,
      targetUsername: null,
      messageCount: 0,
      maxMessages: 10,
      triggerWords: [],
      guildId: null,
      channelId: null,
      action: null,
      actionParams: {},
      messages: []
    };
    this.listeners = [];
    this.timeouts = [];
  }
  
  // Fix the initialize method to handle empty or undefined parameters
  initialize(options = {}) {
    console.log('[MessageMonitor] Extension initialized');
    
    // Only setup monitoring if specific parameters are provided
    if (options.targetUserId) {
      const {
        targetUserId, 
        triggerWords = [], 
        maxMessages = 10, 
        action = "timeout", 
        actionDuration = 300, 
        guildId, 
        channelId
      } = options;
      
      this.state.active = true;
      this.state.targetUserId = targetUserId;
      this.state.triggerWords = Array.isArray(triggerWords) ? triggerWords : [triggerWords];
      this.state.maxMessages = maxMessages;
      this.state.action = action;
      this.state.guildId = guildId;
      this.state.channelId = channelId;
      
      if (action === "timeout") {
        this.state.actionParams = {
          duration: actionDuration,
          reason: "Triggered by monitored word"
        };
      }
      
      // Set up monitoring
      this.setupMonitoring();
      
      console.log(`[MessageMonitor] Started monitoring user ${targetUserId} for trigger words: ${this.state.triggerWords.join(', ')}`);
    } else {
      // Register command listener for starting monitoring
      this.registerCommandListener();
    }
    
    // Auto-cleanup after 1 hour to prevent zombie monitors
    this.registerTimeout(() => {
      if (this.state.active) {
        console.log(`[MessageMonitor] Maximum time reached (1 hour), shutting down`);
        this.cleanup();
      }
    }, 3600000);
    
    return true;
  }
  
  // New method to set up monitoring
  setupMonitoring() {
    if (!this.state.targetUserId) return;
    
    // Register message listener
    const listenerId = this.eventBus.addListener("messageCreate", async (message) => {
      try {
        // Skip bot messages and messages not from the target user
        if (message.author.bot || message.author.id !== this.state.targetUserId) return;
        
        // Skip messages from other guilds if guild is specified
        if (this.state.guildId && message.guild?.id !== this.state.guildId) return;
        
        // Skip messages from other channels if channel is specified
        if (this.state.channelId && message.channel.id !== this.state.channelId) return;
        
        // Store user name for reference
        if (!this.state.targetUsername) {
          this.state.targetUsername = message.author.username;
        }
        
        // Track message
        this.state.messageCount++;
        this.state.messages.push({
          content: message.content,
          timestamp: Date.now()
        });
        
        console.log(`[MessageMonitor] Message ${this.state.messageCount}/${this.state.maxMessages} from ${this.state.targetUsername}: ${message.content}`);
        
        // Check for trigger words
        const lowerContent = message.content.toLowerCase();
        const triggeredWord = this.state.triggerWords.find(word => 
          lowerContent.includes(word.toLowerCase())
        );
        
        if (triggeredWord) {
          console.log(`[MessageMonitor] Trigger word detected: ${triggeredWord}`);
          
          // Execute action
          if (this.state.action === "timeout") {
            try {
              const member = await message.guild.members.fetch(this.state.targetUserId);
              if (member) {
                await member.timeout(
                  this.state.actionParams.duration * 1000, 
                  this.state.actionParams.reason
                );
                
                await message.channel.send(
                  `Timed out ${member.user.tag} for ${this.state.actionParams.duration} seconds because they said "${triggeredWord}"`
                );
              }
            } catch (error) {
              console.error(`[MessageMonitor] Error timing out user:`, error);
              await message.channel.send(`Failed to timeout user: ${error.message}`).catch(() => {});
            }
            
            // End monitoring after action is taken
            this.cleanup();
          }
        }
        
        // End monitoring if we've reached max messages
        if (this.state.messageCount >= this.state.maxMessages) {
          console.log(`[MessageMonitor] Reached max message count (${this.state.maxMessages}), shutting down`);
          this.cleanup();
        }
        
      } catch (error) {
        console.error(`[MessageMonitor] Error processing message:`, error);
      }
    }, { extensionId: "message-monitor" });
    
    this.listeners.push(listenerId);
  }
  
  // New method to register command listener
  registerCommandListener() {
    const commandListenerId = this.eventBus.addListener("command", async (data) => {
      if (!data.userInput) return false;
      
      const input = data.userInput.toLowerCase();
      if (input.includes("izle") || input.includes("monitor") || input.includes("watch")) {
        // Extract user ID from mentions
        const mentionRegex = /<@!?(\d+)>/g;
        const mentions = [];
        let match;
        while ((match = mentionRegex.exec(data.userInput)) !== null) {
          mentions.push(match[1]);
        }
        
        if (mentions.length > 0) {
          // Extract trigger words
          const triggerRegex = /(?:if|when).*?(?:say|yazarsa|derse|söylerse)[^\w]*(["']?)(.*?)\1/i;
          const triggerMatch = data.userInput.match(triggerRegex);
          const triggerWord = triggerMatch ? triggerMatch[2] : null;
          
          if (triggerWord) {
            const options = {
              targetUserId: mentions[0],
              triggerWords: [triggerWord],
              maxMessages: 50,
              action: "timeout",
              actionDuration: 300,
              guildId: data.message.guild?.id,
              channelId: null // Monitor in all channels
            };
            
            // Start monitoring
            this.initialize(options);
            
            // Reply to the user
            await data.message.reply(`Now monitoring <@${mentions[0]}> for the word "${triggerWord}". Will timeout if detected.`);
            return true;
          }
        }
      }
      
      return false;
    }, { extensionId: "message-monitor" });
    
    this.listeners.push(commandListenerId);
  }
  
  registerTimeout(callback, ms) {
    const timeoutId = setTimeout(() => {
      callback();
      const index = this.timeouts.indexOf(timeoutId);
      if (index !== -1) this.timeouts.splice(index, 1);
    }, ms);
    
    this.timeouts.push(timeoutId);
    return timeoutId;
  }
  
  cleanup() {
    // Unregister all listeners
    for (const id of this.listeners) {
      this.eventBus.removeListener(id);
    }
    this.listeners = [];
    
    // Clear all timeouts
    for (const id of this.timeouts) {
      clearTimeout(id);
    }
    this.timeouts = [];
    
    this.state.active = false;
    console.log(`[MessageMonitor] Monitoring stopped for ${this.state.targetUsername || this.state.targetUserId}`);
  }
}

module.exports = Extension;