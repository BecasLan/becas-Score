/**
 * Server-related Discord API actions
 */
const { 
  GuildVerificationLevel, 
  GuildExplicitContentFilter, 
  GuildDefaultMessageNotifications 
} = require('discord.js');

class ServerActions {
  constructor(client, logger) {
    this.client = client;
    this.logger = logger;
  }
  
  /**
   * Update server settings
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async updateSettings(params, guild) {
    const { 
      name, 
      icon, 
      verificationLevel, 
      explicitContentFilter, 
      defaultMessageNotifications,
      systemChannel,
      rulesChannel,
      publicUpdatesChannel,
      description,
      reason
    } = params;
    
    try {
      // Prepare edit options
      const options = { reason: reason || "Server settings updated by BecasBot" };
      
      // Add specified properties only
      if (name !== undefined) options.name = name;
      if (icon !== undefined) options.icon = icon;
      if (description !== undefined) options.description = description;
      
      // Handle verification level
      if (verificationLevel !== undefined) {
        // Convert string to enum value
        if (typeof verificationLevel === 'string') {
          const level = verificationLevel.toUpperCase();
          if (GuildVerificationLevel[level] !== undefined) {
            options.verificationLevel = GuildVerificationLevel[level];
          }
        } else if (Number.isInteger(verificationLevel) && 
                  verificationLevel >= 0 && 
                  verificationLevel <= 4) {
          options.verificationLevel = verificationLevel;
        }
      }
      
      // Handle explicit content filter
      if (explicitContentFilter !== undefined) {
        // Convert string to enum value
        if (typeof explicitContentFilter === 'string') {
          const filter = explicitContentFilter.toUpperCase().replace(/ /g, '_');
          if (GuildExplicitContentFilter[filter] !== undefined) {
            options.explicitContentFilter = GuildExplicitContentFilter[filter];
          }
        } else if (Number.isInteger(explicitContentFilter) && 
                  explicitContentFilter >= 0 && 
                  explicitContentFilter <= 2) {
          options.explicitContentFilter = explicitContentFilter;
        }
      }
      
      // Handle default message notifications
      if (defaultMessageNotifications !== undefined) {
        // Convert string to enum value
        if (typeof defaultMessageNotifications === 'string') {
          const notifications = defaultMessageNotifications.toUpperCase().replace(/ /g, '_');
          if (GuildDefaultMessageNotifications[notifications] !== undefined) {
            options.defaultMessageNotifications = GuildDefaultMessageNotifications[notifications];
          }
        } else if (Number.isInteger(defaultMessageNotifications) && 
                  defaultMessageNotifications >= 0 && 
                  defaultMessageNotifications <= 1) {
          options.defaultMessageNotifications = defaultMessageNotifications;
        }
      }
      
      // Handle system channel
      if (systemChannel !== undefined) {
        if (systemChannel === null) {
          options.systemChannel = null;
        } else {
          const channel = await guild.channels.fetch(systemChannel).catch(() => null);
          if (channel && channel.isTextBased()) {
            options.systemChannel = channel.id;
          }
        }
      }
      
      // Handle rules channel
      if (rulesChannel !== undefined) {
        if (rulesChannel === null) {
          options.rulesChannel = null;
        } else {
          const channel = await guild.channels.fetch(rulesChannel).catch(() => null);
          if (channel && channel.isTextBased()) {
            options.rulesChannel = channel.id;
          }
        }
      }
      
      // Handle public updates channel
      if (publicUpdatesChannel !== undefined) {
        if (publicUpdatesChannel === null) {
          options.publicUpdatesChannel = null;
        } else {
          const channel = await guild.channels.fetch(publicUpdatesChannel).catch(() => null);
          if (channel && channel.isTextBased()) {
            options.publicUpdatesChannel = channel.id;
          }
        }
      }
      
      // Check if there are any changes
      if (Object.keys(options).length === 1 && options.reason) {
        return { success: false, error: "No changes specified" };
      }
      
      // Update server settings
      await guild.edit(options);
      
      return {
        success: true,
        guildId: guild.id,
        name: guild.name
      };
    } catch (error) {
      this.logger.error("Error updating server settings:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get server information
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async getInfo(params, guild) {
    try {
      // Ensure guild is fetched with latest data
      await guild.fetch();
      
      // Get member count stats
      const totalMembers = guild.memberCount;
      const botCount = guild.members.cache.filter(member => member.user.bot).size;
      const humanCount = totalMembers - botCount;
      
      // Get channel stats
      const channelStats = {
        total: guild.channels.cache.size,
        text: guild.channels.cache.filter(c => c.isTextBased() && !c.isThread()).size,
        voice: guild.channels.cache.filter(c => c.isVoiceBased()).size,
        category: guild.channels.cache.filter(c => c.type === 4).size,
        announcement: guild.channels.cache.filter(c => c.type === 5).size,
        stage: guild.channels.cache.filter(c => c.type === 13).size,
        forum: guild.channels.cache.filter(c => c.type === 15).size,
      };
      
      // Compile server info
      const serverInfo = {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ dynamic: true }),
        owner: guild.ownerId,
        createdAt: guild.createdAt.toISOString(),
        memberCount: {
          total: totalMembers,
          humans: humanCount,
          bots: botCount
        },
        boostLevel: guild.premiumTier,
        boostCount: guild.premiumSubscriptionCount,
        verificationLevel: guild.verificationLevel,
        explicitContentFilter: guild.explicitContentFilter,
        defaultMessageNotifications: guild.defaultMessageNotifications,
        systemChannelId: guild.systemChannelId,
        rulesChannelId: guild.rulesChannelId,
        channels: channelStats,
        roles: guild.roles.cache.size - 1, // Exclude @everyone
        emojis: guild.emojis.cache.size,
        stickers: guild.stickers?.cache.size || 0,
        features: guild.features
      };
      
      return {
        success: true,
        server: serverInfo
      };
    } catch (error) {
      this.logger.error("Error getting server info:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Create a server invite
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async createInvite(params, guild) {
    const { channelId, maxAge = 86400, maxUses = 0, temporary = false, unique = true, reason } = params;
    
    if (!channelId) return { success: false, error: "channelId missing" };
    
    try {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      
      if (!channel) {
        return { success: false, error: "Channel not found", channelId };
      }
      
      // Check if channel supports invites
      if (!channel.isTextBased() && !channel.isVoiceBased()) {
        return { success: false, error: "Channel does not support invites" };
      }
      
      // Create invite
      const invite = await channel.createInvite({
        maxAge,
        maxUses,
        temporary,
        unique,
        reason: reason || "Invite created by BecasBot"
      });
      
      return {
        success: true,
        code: invite.code,
        url: invite.url,
        channelId: channel.id,
        maxAge,
        maxUses
      };
    } catch (error) {
      this.logger.error("Error creating invite:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get all server invites
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async getInvites(params, guild) {
    try {
      const invites = await guild.invites.fetch();
      
      const inviteList = invites.map(invite => ({
        code: invite.code,
        url: invite.url,
        channel: {
          id: invite.channel?.id,
          name: invite.channel?.name
        },
        inviter: invite.inviter ? {
          id: invite.inviter.id,
          tag: invite.inviter.tag
        } : null,
        uses: invite.uses,
        maxUses: invite.maxUses,
        maxAge: invite.maxAge,
        temporary: invite.temporary,
        createdAt: invite.createdAt.toISOString()
      }));
      
      return {
        success: true,
        invites: inviteList
      };
    } catch (error) {
      this.logger.error("Error getting server invites:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { ServerActions };