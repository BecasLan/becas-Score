/**
 * Channel-related Discord API actions
 */
const { ChannelType } = require('discord.js');

class ChannelActions {
  constructor(client, logger) {
    this.client = client;
    this.logger = logger;
  }
  
  /**
   * Create a channel
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async create(params, guild) {
    const { name, type = 'GUILD_TEXT', categoryId, topic, nsfw, reason } = params;
    
    if (!name) return { success: false, error: "name missing" };
    
    try {
      // Convert string type to numeric type
      let channelType = ChannelType.GuildText; // Default
      
      if (type === 'GUILD_VOICE' || type === 'voice') {
        channelType = ChannelType.GuildVoice;
      } else if (type === 'GUILD_CATEGORY' || type === 'category') {
        channelType = ChannelType.GuildCategory;
      } else if (type === 'GUILD_NEWS' || type === 'news') {
        channelType = ChannelType.GuildAnnouncement;
      } else if (type === 'GUILD_STAGE_VOICE' || type === 'stage') {
        channelType = ChannelType.GuildStageVoice;
      } else if (type === 'GUILD_FORUM' || type === 'forum') {
        channelType = ChannelType.GuildForum;
      }
      
      // Prepare channel options
      const options = {
        name,
        type: channelType,
        reason: reason || "Channel created by BecasBot"
      };
      
      // Add optional properties
      if (topic) options.topic = topic;
      if (nsfw !== undefined) options.nsfw = nsfw;
      
      // Add parent category if specified
      if (categoryId) {
        const category = await guild.channels.fetch(categoryId).catch(() => null);
        if (category && category.type === ChannelType.GuildCategory) {
          options.parent = category.id;
        } else {
          return { success: false, error: "Category not found or not a category" };
        }
      }
      
      // Create the channel
      const channel = await guild.channels.create(options);
      
      return {
        success: true,
        channelId: channel.id,
        name: channel.name,
        type: channel.type
      };
    } catch (error) {
      this.logger.error("Error creating channel:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Delete a channel
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async delete(params, guild) {
    const { channelId, reason } = params;
    
    if (!channelId) return { success: false, error: "channelId missing" };
    
    try {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      
      if (!channel) {
        return { success: false, error: "Channel not found", channelId };
      }
      
      const channelName = channel.name;
      await channel.delete(reason || "Channel deleted by BecasBot");
      
      return {
        success: true,
        channelId,
        name: channelName
      };
    } catch (error) {
      this.logger.error("Error deleting channel:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Edit a channel
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async edit(params, guild) {
    const { channelId, name, topic, nsfw, rateLimitPerUser, bitrate, userLimit, reason } = params;
    
    if (!channelId) return { success: false, error: "channelId missing" };
    
    try {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      
      if (!channel) {
        return { success: false, error: "Channel not found", channelId };
      }
      
      // Prepare edit options
      const options = { reason: reason || "Channel edited by BecasBot" };
      
      // Add specified properties only
      if (name !== undefined) options.name = name;
      if (topic !== undefined) options.topic = topic;
      if (nsfw !== undefined) options.nsfw = nsfw;
      if (rateLimitPerUser !== undefined) options.rateLimitPerUser = rateLimitPerUser;
      if (bitrate !== undefined && channel.type === ChannelType.GuildVoice) options.bitrate = bitrate;
      if (userLimit !== undefined && channel.type === ChannelType.GuildVoice) options.userLimit = userLimit;
      
      // Check if there are any changes
      if (Object.keys(options).length === 1 && options.reason) {
        return { success: false, error: "No changes specified" };
      }
      
      // Edit the channel
      await channel.edit(options);
      
      return {
        success: true,
        channelId,
        name: channel.name
      };
    } catch (error) {
      this.logger.error("Error editing channel:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Purge messages from a channel
   * @param {Object} params - Action parameters
   * @param {TextChannel} channel - Discord channel
   * @returns {Promise<Object>} - Action result
   */
  async purge(params, channel) {
    const { limit, filter, reason } = params;
    
    if (!limit || limit <= 0 || limit > 100) {
      return { success: false, error: "Invalid limit (must be 1-100)" };
    }
    
    try {
      if (!channel.isTextBased()) {
        return { success: false, error: "Channel is not text-based" };
      }
      
      // Fetch messages to delete
      const messages = await channel.messages.fetch({ limit });
      
      // Apply filter if provided
      let messagesToDelete = messages;
      if (filter) {
        switch (filter.type) {
          case 'user':
            messagesToDelete = messages.filter(m => m.author.id === filter.value);
            break;
          case 'bot':
            messagesToDelete = messages.filter(m => m.author.bot);
            break;
          case 'content':
            messagesToDelete = messages.filter(m => m.content.includes(filter.value));
            break;
        }
      }
      
      // Filter out messages older than 14 days
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const recentMessages = messagesToDelete.filter(m => m.createdTimestamp > twoWeeksAgo);
      
      // Delete messages
      const deleted = await channel.bulkDelete(recentMessages, true);
      
      return {
        success: true,
        count: deleted.size,
        filtered: messagesToDelete.size !== messages.size,
        tooOld: messagesToDelete.size - recentMessages.size
      };
    } catch (error) {
      this.logger.error("Error purging channel:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Set channel permissions for a role or user
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async setPermissions(params, guild) {
    const { channelId, targetId, targetType, allow, deny, reason } = params;
    
    if (!channelId) return { success: false, error: "channelId missing" };
    if (!targetId) return { success: false, error: "targetId missing" };
    if (!targetType) return { success: false, error: "targetType missing" };
    
    try {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      
      if (!channel) {
        return { success: false, error: "Channel not found", channelId };
      }
      
      // Get the target (role or member)
      let target;
      if (targetType === 'role') {
        target = await guild.roles.fetch(targetId).catch(() => null);
        if (!target) {
          return { success: false, error: "Role not found", targetId };
        }
      } else if (targetType === 'user') {
        target = await guild.members.fetch(targetId).catch(() => null);
        if (!target) {
          return { success: false, error: "User not found", targetId };
        }
      } else {
        return { success: false, error: "Invalid targetType (must be 'role' or 'user')" };
      }
      
      // Set permissions
      await channel.permissionOverwrites.edit(target, {
        ...(allow ? JSON.parse(allow) : {}),
        ...(deny ? JSON.parse(deny) : {})
      }, { reason: reason || "Permissions updated by BecasBot" });
      
      return {
        success: true,
        channelId,
        targetId,
        targetType
      };
    } catch (error) {
      this.logger.error("Error setting channel permissions:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { ChannelActions };