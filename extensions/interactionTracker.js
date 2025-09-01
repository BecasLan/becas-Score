/**
 * @name InteractionTracker
 * @description Tracks and handles Discord interactions (buttons, select menus, etc.)
 * @version 1.0
 */
class Extension {
  constructor(client, eventBus, memory) {
    this.name = 'InteractionTracker';
    this.version = '1.0';
    this.description = 'Tracks and handles Discord interactions';
    
    this.client = client;
    this.eventBus = eventBus;
    this.memory = memory;
    this.interactions = new Map();
    this.timeouts = [];
    
    // Cleanup interval (every hour)
    this.registerTimeout(() => this.cleanupExpiredHandlers(), 60 * 60 * 1000);
  }
  
  /**
   * Initialize the extension
   */
  initialize() {
    console.log('[InteractionTracker] Extension initialized');
    
    // Register event listener for incoming interactions
    this.eventBus.addListener('interaction', async (data) => {
      if (data.interaction && data.interaction.isMessageComponent()) {
        return await this.handleInteraction(data.interaction);
      }
      return false;
    }, { extensionId: 'interaction-tracker', priority: 10 });
    
    // Register event listener for registering interaction handlers
    this.eventBus.addListener('registerInteraction', async (data) => {
      if (data.customId && data.handler) {
        return await this.registerInteractionHandler(
          data.customId, 
          data.handler, 
          data.expiration,
          data.metadata
        );
      }
      return false;
    }, { extensionId: 'interaction-tracker' });
  }
  
  /**
   * Register an interaction handler
   * @param {string} customId - Custom ID for the interaction
   * @param {Function|Object} handler - Handler function or object
   * @param {number} expiration - Expiration time in milliseconds
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} - Registration result
   */
  async registerInteractionHandler(customId, handler, expiration = 3600000, metadata = {}) {
    try {
      // Generate a unique ID if pattern is used
      const isPattern = customId.includes('*');
      const id = isPattern ? `pattern_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` : customId;
      
      // Store the handler
      this.interactions.set(id, {
        id,
        customId,
        isPattern,
        pattern: isPattern ? new RegExp(`^${customId.replace(/\*/g, '(.+)')}$`) : null,
        handler,
        expiration: expiration ? Date.now() + expiration : null,
        metadata
      });
      
      console.log(`[InteractionTracker] Registered handler for ${isPattern ? 'pattern' : 'customId'} "${customId}"`);
      
      return {
        success: true,
        id,
        expiration: expiration ? new Date(Date.now() + expiration).toISOString() : null
      };
    } catch (error) {
      console.error('[InteractionTracker] Error registering interaction handler:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Handle an interaction
   * @param {Interaction} interaction - Discord interaction
   * @returns {Promise<boolean>} - Whether the interaction was handled
   */
  async handleInteraction(interaction) {
    try {
      const { customId } = interaction;
      
      // First try direct match
      if (this.interactions.has(customId)) {
        const handler = this.interactions.get(customId);
        
        // Check if expired
        if (handler.expiration && handler.expiration < Date.now()) {
          this.interactions.delete(customId);
          return false;
        }
        
        // Execute handler
        await this.executeHandler(handler, interaction);
        return true;
      }
      
      // Then try pattern matching
      for (const [id, handler] of this.interactions.entries()) {
        if (handler.isPattern && handler.pattern.test(customId)) {
          // Check if expired
          if (handler.expiration && handler.expiration < Date.now()) {
            this.interactions.delete(id);
            continue;
          }
          
          // Extract matches
          const matches = customId.match(handler.pattern);
          const groups = matches ? matches.slice(1) : [];
          
          // Execute handler with matches
          await this.executeHandler(handler, interaction, groups);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('[InteractionTracker] Error handling interaction:', error);
      return false;
    }
  }
  
  /**
   * Execute an interaction handler
   * @param {Object} handler - Handler object
   * @param {Interaction} interaction - Discord interaction
   * @param {Array} groups - Pattern match groups
   */
  async executeHandler(handler, interaction, groups = []) {
    try {
      if (typeof handler.handler === 'function') {
        // Call function directly
        await handler.handler(interaction, groups, handler.metadata);
      } else if (typeof handler.handler === 'object') {
        // Use handler object with specific methods for button, select, etc.
        if (interaction.isButton() && typeof handler.handler.button === 'function') {
          await handler.handler.button(interaction, groups, handler.metadata);
        } else if (interaction.isStringSelectMenu() && typeof handler.handler.select === 'function') {
          await handler.handler.select(interaction, groups, handler.metadata);
        } else if (interaction.isUserSelectMenu() && typeof handler.handler.userSelect === 'function') {
          await handler.handler.userSelect(interaction, groups, handler.metadata);
        } else if (interaction.isRoleSelectMenu() && typeof handler.handler.roleSelect === 'function') {
          await handler.handler.roleSelect(interaction, groups, handler.metadata);
        } else if (interaction.isChannelSelectMenu() && typeof handler.handler.channelSelect === 'function') {
          await handler.handler.channelSelect(interaction, groups, handler.metadata);
        } else if (interaction.isModalSubmit() && typeof handler.handler.modal === 'function') {
          await handler.handler.modal(interaction, groups, handler.metadata);
        } else if (typeof handler.handler.default === 'function') {
          await handler.handler.default(interaction, groups, handler.metadata);
        }
      }
    } catch (error) {
      console.error('[InteractionTracker] Error executing handler:', error);
      
      // Try to respond with an error if interaction hasn't been replied to
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ 
            content: 'An error occurred while processing this interaction.', 
            ephemeral: true 
          });
        } else if (interaction.deferred && !interaction.replied) {
          await interaction.editReply({ 
            content: 'An error occurred while processing this interaction.' 
          });
        }
      } catch (replyError) {
        // Ignore errors from trying to reply
      }
    }
  }
  
  /**
   * Clean up expired interaction handlers
   */
  cleanupExpiredHandlers() {
    const now = Date.now();
    let count = 0;
    
    for (const [id, handler] of this.interactions.entries()) {
      if (handler.expiration && handler.expiration < now) {
        this.interactions.delete(id);
        count++;
      }
    }
    
    if (count > 0) {
      console.log(`[InteractionTracker] Cleaned up ${count} expired interaction handlers`);
    }
  }
  
  /**
   * Register a timeout
   * @param {Function} callback - Callback function
   * @param {number} ms - Timeout in milliseconds
   */
  registerTimeout(callback, ms) {
    const timeoutId = setTimeout(() => {
      callback();
      const index = this.timeouts.indexOf(timeoutId);
      if (index !== -1) this.timeouts.splice(index, 1);
    }, ms);
    
    this.timeouts.push(timeoutId);
    return timeoutId;
  }
  
  /**
   * Clean up when extension is unloaded
   */
  cleanup() {
    // Clear all timeouts
    for (const timeoutId of this.timeouts) {
      clearTimeout(timeoutId);
    }
    this.timeouts = [];
    
    console.log('[InteractionTracker] Extension cleaned up');
  }
}

module.exports = Extension;