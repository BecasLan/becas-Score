/**
 * Voice-related Discord API actions
 */

class VoiceActions {
  constructor(client, logger) {
    this.client = client;
    this.logger = logger;
  }
  
  /**
   * Disconnect a user from voice
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async disconnect(params, guild) {
    const { userId, reason } = params;
    
    if (!userId) return { success: false, error: "userId missing" };
    
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      
      if (!member) {
        return { success: false, error: "User not found", userId };
      }
      
      if (!member.voice.channel) {
        return { success: false, error: "User is not in a voice channel", userId };
      }
      
      await member.voice.disconnect(reason || "Disconnected by BecasBot");
      
      return {
        success: true,
        userId,
        username: member.user.tag
      };
    } catch (error) {
      this.logger.error("Error disconnecting user from voice:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Move a user to another voice channel
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async move(params, guild) {
    const { userId, channelId, reason } = params;
    
    if (!userId) return { success: false, error: "userId missing" };
    if (!channelId) return { success: false, error: "channelId missing" };
    
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      
      if (!member) {
        return { success: false, error: "User not found", userId };
      }
      
      if (!member.voice.channel) {
        return { success: false, error: "User is not in a voice channel", userId };
      }
      
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      
      if (!channel) {
        return { success: false, error: "Channel not found", channelId };
      }
      
      if (!channel.isVoiceBased()) {
        return { success: false, error: "Destination is not a voice channel", channelId };
      }
      
      await member.voice.setChannel(channel, reason || "Moved by BecasBot");
      
      return {
        success: true,
        userId,
        channelId,
        username: member.user.tag,
        channelName: channel.name
      };
    } catch (error) {
      this.logger.error("Error moving user to voice channel:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Server mute a user in voice
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async mute(params, guild) {
    const { userId, reason } = params;
    
    if (!userId) return { success: false, error: "userId missing" };
    
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      
      if (!member) {
        return { success: false, error: "User not found", userId };
      }
      
      if (!member.voice.channel) {
        return { success: false, error: "User is not in a voice channel", userId };
      }
      
      await member.voice.setMute(true, reason || "Muted by BecasBot");
      
      return {
        success: true,
        userId,
        username: member.user.tag
      };
    } catch (error) {
      this.logger.error("Error muting user in voice:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Server unmute a user in voice
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async unmute(params, guild) {
    const { userId, reason } = params;
    
    if (!userId) return { success: false, error: "userId missing" };
    
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      
      if (!member) {
        return { success: false, error: "User not found", userId };
      }
      
      if (!member.voice.channel) {
        return { success: false, error: "User is not in a voice channel", userId };
      }
      
      await member.voice.setMute(false, reason || "Unmuted by BecasBot");
      
      return {
        success: true,
        userId,
        username: member.user.tag
      };
    } catch (error) {
      this.logger.error("Error unmuting user in voice:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Server deafen a user in voice
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async deafen(params, guild) {
    const { userId, reason } = params;
    
    if (!userId) return { success: false, error: "userId missing" };
    
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      
      if (!member) {
        return { success: false, error: "User not found", userId };
      }
      
      if (!member.voice.channel) {
        return { success: false, error: "User is not in a voice channel", userId };
      }
      
      await member.voice.setDeaf(true, reason || "Deafened by BecasBot");
      
      return {
        success: true,
        userId,
        username: member.user.tag
      };
    } catch (error) {
      this.logger.error("Error deafening user in voice:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Server undeafen a user in voice
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async undeafen(params, guild) {
    const { userId, reason } = params;
    
    if (!userId) return { success: false, error: "userId missing" };
    
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      
      if (!member) {
        return { success: false, error: "User not found", userId };
      }
      
      if (!member.voice.channel) {
        return { success: false, error: "User is not in a voice channel", userId };
      }
      
      await member.voice.setDeaf(false, reason || "Undeafened by BecasBot");
      
      return {
        success: true,
        userId,
        username: member.user.tag
      };
    } catch (error) {
      this.logger.error("Error undeafening user in voice:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get all users in voice channels
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async getVoiceUsers(params, guild) {
    try {
      // Get all voice channels
      const voiceChannels = guild.channels.cache.filter(channel => 
        channel.isVoiceBased()
      );
      
      // Get users in each voice channel
      const voiceUsers = [];
      
      for (const [id, channel] of voiceChannels) {
        const members = channel.members.map(member => ({
          id: member.id,
          username: member.user.tag,
          nickname: member.nickname,
          isMuted: member.voice.mute,
          isDeafened: member.voice.deaf,
          isSelfMuted: member.voice.selfMute,
          isSelfDeafened: member.voice.selfDeaf,
          isStreaming: member.voice.streaming,
          isVideoOn: member.voice.selfVideo
        }));
        
        if (members.length > 0) {
          voiceUsers.push({
            channelId: id,
            channelName: channel.name,
            members
          });
        }
      }
      
      return {
        success: true,
        channels: voiceUsers
      };
    } catch (error) {
      this.logger.error("Error getting voice users:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { VoiceActions };