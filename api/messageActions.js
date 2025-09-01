/**
 * Message-related Discord API actions
 */
const { splitMessage } = require('../utils/stringUtils');

class MessageActions {
  constructor(client, logger) {
    this.client = client;
    this.logger = logger;
  }
  
  /**
   * Send a message
   * @param {Object} params - Action parameters
   * @param {TextChannel} channel - Discord channel
   * @returns {Promise<Object>} - Action result
   */
  async create(params, channel) {
    const { content, embeds, components } = params;
    
    if (!content && (!embeds || embeds.length === 0)) {
      return { success: false, error: "No content or embeds provided" };
    }
    
    try {
      // Split long messages
      if (content && content.length > 2000) {
        const chunks = splitMessage(content);
        const sentMessages = [];
        
        for (const chunk of chunks) {
          const sent = await channel.send({ content: chunk });
          sentMessages.push(sent.id);
        }
        
        return {
          success: true,
          messageIds: sentMessages,
          chunked: sentMessages.length > 1
        };
      }
      
      // Send normal message
      const message = await channel.send({
        content,
        embeds,
        components
      });
      
      return {
        success: true,
        messageId: message.id
      };
    } catch (error) {
      this.logger.error("Error in message create:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Delete a message
   * @param {Object} params - Action parameters
   * @param {TextChannel} channel - Discord channel
   * @returns {Promise<Object>} - Action result
   */
  async delete(params, channel) {
    const { messageId } = params;
    
    if (!messageId) return { success: false, error: "messageId missing" };
    
    try {
      const message = await channel.messages.fetch(messageId).catch(() => null);
      
      if (!message) {
        return { success: false, error: "Message not found", messageId };
      }
      
      await message.delete();
      return {
        success: true,
        messageId
      };
    } catch (error) {
      this.logger.error("Error in message delete:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Edit a message
   * @param {Object} params - Action parameters
   * @param {TextChannel} channel - Discord channel
   * @returns {Promise<Object>} - Action result
   */
  async edit(params, channel) {
    const { messageId, content, embeds, components } = params;
    
    if (!messageId) return { success: false, error: "messageId missing" };
    if (!content && (!embeds || embeds.length === 0)) {
      return { success: false, error: "No content or embeds provided" };
    }
    
    try {
      const message = await channel.messages.fetch(messageId).catch(() => null);
      
      if (!message) {
        return { success: false, error: "Message not found", messageId };
      }
      
      // Can only edit bot's own messages
      if (message.author.id !== this.client.user.id) {
        return { success: false, error: "Can only edit bot's own messages" };
      }
      
      await message.edit({
        content,
        embeds,
        components
      });
      
      return {
        success: true,
        messageId
      };
    } catch (error) {
      this.logger.error("Error in message edit:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * React to a message
   * @param {Object} params - Action parameters
   * @param {TextChannel} channel - Discord channel
   * @returns {Promise<Object>} - Action result
   */
  async react(params, channel) {
    const { messageId, emoji } = params;
    
    if (!messageId) return { success: false, error: "messageId missing" };
    if (!emoji) return { success: false, error: "emoji missing" };
    
    try {
      const message = await channel.messages.fetch(messageId).catch(() => null);
      
      if (!message) {
        return { success: false, error: "Message not found", messageId };
      }
      
      await message.react(emoji);
      return {
        success: true,
        messageId,
        emoji
      };
    } catch (error) {
      this.logger.error("Error in message react:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Pin a message
   * @param {Object} params - Action parameters
   * @param {TextChannel} channel - Discord channel
   * @returns {Promise<Object>} - Action result
   */
  async pin(params, channel) {
    const { messageId } = params;
    
    if (!messageId) return { success: false, error: "messageId missing" };
    
    try {
      const message = await channel.messages.fetch(messageId).catch(() => null);
      
      if (!message) {
        return { success: false, error: "Message not found", messageId };
      }
      
      await message.pin();
      return {
        success: true,
        messageId
      };
    } catch (error) {
      this.logger.error("Error in message pin:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Unpin a message
   * @param {Object} params - Action parameters
   * @param {TextChannel} channel - Discord channel
   * @returns {Promise<Object>} - Action result
   */
  async unpin(params, channel) {
    const { messageId } = params;
    
    if (!messageId) return { success: false, error: "messageId missing" };
    
    try {
      const message = await channel.messages.fetch(messageId).catch(() => null);
      
      if (!message) {
        return { success: false, error: "Message not found", messageId };
      }
      
      await message.unpin();
      return {
        success: true,
        messageId
      };
    } catch (error) {
      this.logger.error("Error in message unpin:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { MessageActions };