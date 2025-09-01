/**
 * User-related Discord API actions
 */
const { PermissionFlagsBits } = require('discord.js');
const { formatDuration } = require('../utils/timeUtils');

class UserActions {
  constructor(client, logger) {
    this.client = client;
    this.logger = logger;
  }
  
  /**
   * Timeout a member
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async timeout(params, guild) {
    const { userId, duration, reason } = params;
    
    if (!userId) return { success: false, error: "userId missing" };
    if (duration === undefined) return { success: false, error: "duration missing" };
    
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      
      if (!member) {
        return { success: false, error: "User not found", userId };
      }
      
      if (!member.moderatable) {
        return { 
          success: false, 
          error: "This user cannot be timed out due to permissions", 
          userId 
        };
      }
      
      // Handle timeout removal (duration = 0)
      if (duration === 0) {
        await member.timeout(null, reason || "Timeout removed");
        return { 
          success: true, 
          userId, 
          username: member.user.tag,
          action: 'timeout_removed' 
        };
      } else {
        await member.timeout(duration * 1000, reason || "Timed out");
        return { 
          success: true, 
          userId, 
          duration, 
          username: member.user.tag,
          formattedDuration: formatDuration(duration)
        };
      }
    } catch (error) {
      this.logger.error("Error in timeout:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Kick a member
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async kick(params, guild) {
    const { userId, reason } = params;
    
    if (!userId) return { success: false, error: "userId missing" };
    
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      
      if (!member) {
        return { success: false, error: "User not found", userId };
      }
      
      if (!member.kickable) {
        return { 
          success: false, 
          error: "This user cannot be kicked due to permissions", 
          userId 
        };
      }
      
      await member.kick(reason || "Kicked");
      return { 
        success: true, 
        userId, 
        username: member.user.tag
      };
    } catch (error) {
      this.logger.error("Error in kick:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Ban a member
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async ban(params, guild) {
    const { userId, reason, deleteMessageSeconds } = params;
    
    if (!userId) return { success: false, error: "userId missing" };
    
    try {
      await guild.members.ban(userId, {
        reason: reason || "Banned",
        deleteMessageSeconds: deleteMessageSeconds || 0
      });
      
      return { 
        success: true, 
        userId
      };
    } catch (error) {
      this.logger.error("Error in ban:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Unban a user
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async unban(params, guild) {
    const { userId, reason } = params;
    
    if (!userId) return { success: false, error: "userId missing" };
    
    try {
      await guild.bans.remove(userId, reason || "Unbanned");
      return { success: true, userId };
    } catch (error) {
      this.logger.error("Error in unban:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Set a user's nickname
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async setNickname(params, guild) {
    const { userId, nickname, reason } = params;
    
    if (!userId) return { success: false, error: "userId missing" };
    
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      
      if (!member) {
        return { success: false, error: "User not found", userId };
      }
      
      await member.setNickname(nickname || null, reason || "Nickname changed");
      return { 
        success: true, 
        userId, 
        nickname, 
        username: member.user.tag
      };
    } catch (error) {
      this.logger.error("Error in setNickname:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { UserActions };