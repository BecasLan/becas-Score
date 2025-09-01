/**
 * Action Handler - Handles Discord-specific actions
 */
class ActionHandler {
   constructor(client, logger, workflowEngine) {
    this.client = client;
    this.logger = logger;
    this.workflowEngine = workflowEngine;
    // Map action names to handler methods
    this.actionHandlers = {
      // Mesaj eylemleri
      "message.create": this.createMessage.bind(this),
      "message.delete": this.deleteMessage.bind(this),
      "message.react": this.reactToMessage.bind(this),
      "message.pin": this.pinMessage.bind(this),
      "message.unpin": this.unpinMessage.bind(this),
      "message.send": this.createMessage.bind(this), // Alternatif
      
      // Üye eylemleri
      "member.timeout": this.timeoutMember.bind(this),
      "member.kick": this.kickMember.bind(this),
      "member.ban": this.banMember.bind(this),
      "member.unban": this.unbanMember.bind(this),
      
      // Rol eylemleri
      "role.add": this.addRole.bind(this),
      "role.remove": this.removeRole.bind(this),
      "member.roles.add": this.addRole.bind(this),     // Alternatif
      "member.roles.remove": this.removeRole.bind(this), // Alternatif
      "member.role.add": this.addRole.bind(this),      // Alternatif
      "member.role.remove": this.removeRole.bind(this), // Alternatif
      "roles.add": this.addRole.bind(this),            // Alternatif
      "roles.remove": this.removeRole.bind(this),      // Alternatif
      
      // Kanal eylemleri
      "channel.create": this.createChannel.bind(this),
      "channel.delete": this.deleteChannel.bind(this),
      "channel.purge": this.purgeMessages.bind(this),
      "channel.messages.purge": this.purgeMessages.bind(this), // Alternatif
      "messages.delete": this.purgeMessages.bind(this)        // Alternatif
    };
  }
   async callAction(action, message, params) {
    const handler = this.actionHandlers[action];
    if (!handler) {
      this.logger.error(`Unsupported action: ${action}`);
      return { success: false, error: `Unsupported action: ${action}` };
    }
    
    return await handler(message, params);
  }
  /**
   * Create a message
   * @param {Message} message - Original message
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - Result
   */
  async createMessage(message, params) {
    try {
      const { content, channelId } = params;
      
      if (!content) {
        return { success: false, error: 'Content is required' };
      }
      
      // Get target channel
      const channel = channelId ? 
        await this.client.channels.fetch(channelId).catch(() => message.channel) : 
        message.channel;
      
      if (!channel) {
        return { success: false, error: 'Channel not found' };
      }
      
      // Send message
      const sentMessage = await channel.send(content);
      
      return {
        success: true,
        messageId: sentMessage.id
      };
    } catch (error) {
      this.logger.error('Error creating message:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Delete a message
   * @param {Message} message - Original message
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - Result
   */
  async deleteMessage(message, params) {
    try {
      const { messageId, channelId } = params;
      
      if (!messageId) {
        return { success: false, error: 'Message ID is required' };
      }
      
      // Get target channel
      const channel = channelId ? 
        await this.client.channels.fetch(channelId).catch(() => message.channel) : 
        message.channel;
      
      if (!channel) {
        return { success: false, error: 'Channel not found' };
      }
      
      // Delete message
      const targetMessage = await channel.messages.fetch(messageId);
      await targetMessage.delete();
      
      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting message:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * React to a message
   * @param {Message} message - Original message
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - Result
   */
  async reactToMessage(message, params) {
    try {
      const { messageId, emoji, channelId } = params;
      
      if (!messageId || !emoji) {
        return { success: false, error: 'Message ID and emoji are required' };
      }
      
      // Get target channel
      const channel = channelId ? 
        await this.client.channels.fetch(channelId).catch(() => message.channel) : 
        message.channel;
      
      if (!channel) {
        return { success: false, error: 'Channel not found' };
      }
      
      // React to message
      const targetMessage = await channel.messages.fetch(messageId);
      await targetMessage.react(emoji);
      
      return { success: true };
    } catch (error) {
      this.logger.error('Error reacting to message:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Timeout a member
   * @param {Message} message - Original message
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - Result
   */
  async timeoutMember(message, params) {
    try {
      const { userId, duration, reason } = params;
      
      if (!userId) {
        return { success: false, error: 'User ID is required' };
      }
      
      // Get guild and member
      const guild = message.guild;
      if (!guild) {
        return { success: false, error: 'Cannot timeout in DMs' };
      }
      
      // Get target member
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return { success: false, error: 'Member not found' };
      }
      
      // Timeout the member (or remove timeout if duration is 0)
      if (duration > 0) {
        await member.timeout(duration * 1000, reason || 'Timed out by admin command');
      } else {
        await member.timeout(null, reason || 'Timeout removed by admin command');
      }
      
      return { success: true };
    } catch (error) {
      this.logger.error('Error timing out member:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Kick a member
   * @param {Message} message - Original message
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - Result
   */
  async kickMember(message, params) {
    try {
      const { userId, reason } = params;
      
      if (!userId) {
        return { success: false, error: 'User ID is required' };
      }
      
      // Get guild and member
      const guild = message.guild;
      if (!guild) {
        return { success: false, error: 'Cannot kick in DMs' };
      }
      
      // Get target member
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return { success: false, error: 'Member not found' };
      }
      
      // Kick the member
      await member.kick(reason || 'Kicked by admin command');
      
      return { success: true };
    } catch (error) {
      this.logger.error('Error kicking member:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Ban a member
   * @param {Message} message - Original message
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - Result
   */
  async banMember(message, params) {
    try {
      const { userId, reason, deleteMessageDays = 0 } = params;
      
      if (!userId) {
        return { success: false, error: 'User ID is required' };
      }
      
      // Get guild
      const guild = message.guild;
      if (!guild) {
        return { success: false, error: 'Cannot ban in DMs' };
      }
      
      // Ban the user
      await guild.members.ban(userId, {
        reason: reason || 'Banned by admin command',
        deleteMessageSeconds: deleteMessageDays * 86400 // Convert days to seconds
      });
      
      return { success: true };
    } catch (error) {
      this.logger.error('Error banning member:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Add a role to a member
   * @param {Message} message - Original message
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - Result
   */
  async addRole(message, params) {
    try {
      const { userId, roleId, reason } = params;
      
      if (!userId || !roleId) {
        return { success: false, error: 'User ID and role ID are required' };
      }
      
      // Get guild and member
      const guild = message.guild;
      if (!guild) {
        return { success: false, error: 'Cannot add roles in DMs' };
      }
      
      // Get target member and role
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return { success: false, error: 'Member not found' };
      }
      
      const role = await guild.roles.fetch(roleId).catch(() => null);
      if (!role) {
        return { success: false, error: 'Role not found' };
      }
      
      // Add the role
      await member.roles.add(role, reason || 'Role added by admin command');
      
      return { success: true };
    } catch (error) {
      this.logger.error('Error adding role:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Remove a role from a member
   * @param {Message} message - Original message
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - Result
   */
  async removeRole(message, params) {
    try {
      const { userId, roleId, reason } = params;
      
      if (!userId || !roleId) {
        return { success: false, error: 'User ID and role ID are required' };
      }
      
      // Get guild and member
      const guild = message.guild;
      if (!guild) {
        return { success: false, error: 'Cannot remove roles in DMs' };
      }
      
      // Get target member and role
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return { success: false, error: 'Member not found' };
      }
      
      const role = await guild.roles.fetch(roleId).catch(() => null);
      if (!role) {
        return { success: false, error: 'Role not found' };
      }
      
      // Remove the role
      await member.roles.remove(role, reason || 'Role removed by admin command');
      
      return { success: true };
    } catch (error) {
      this.logger.error('Error removing role:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Create a channel
   * @param {Message} message - Original message
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - Result
   */
  async createChannel(message, params) {
    try {
      const { name, type = 'GUILD_TEXT', parentId, reason } = params;
      
      if (!name) {
        return { success: false, error: 'Channel name is required' };
      }
      
      // Get guild
      const guild = message.guild;
      if (!guild) {
        return { success: false, error: 'Cannot create channels in DMs' };
      }
      
      // Create channel options
      const options = {
        type,
        reason: reason || 'Channel created by admin command'
      };
      
      if (parentId) {
        options.parent = parentId;
      }
      
      // Create the channel
      const channel = await guild.channels.create(name, options);
      
      return {
        success: true,
        channelId: channel.id
      };
    } catch (error) {
      this.logger.error('Error creating channel:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Delete a channel
   * @param {Message} message - Original message
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - Result
   */
  async deleteChannel(message, params) {
    try {
      const { channelId, reason } = params;
      
      if (!channelId) {
        return { success: false, error: 'Channel ID is required' };
      }
      
      // Get guild
      const guild = message.guild;
      if (!guild) {
        return { success: false, error: 'Cannot delete channels in DMs' };
      }
      
      // Get target channel
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        return { success: false, error: 'Channel not found' };
      }
      
      // Delete the channel
      await channel.delete(reason || 'Channel deleted by admin command');
      
      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting channel:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Purge messages from a channel
   * @param {Message} message - Original message
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - Result
   */
  async purgeMessages(message, params) {
    try {
      // Use the workflowEngine's purgeMessages method
      const result = await this.workflowEngine.purgeMessages(message, params);
      
      if (result.success) {
        let responseText = `✅ ${result.deletedCount} mesaj silindi.`;
        
        // Add user context if it was a user-filtered delete
        if (result.userFiltered && params.userId) {
          try {
            const user = await this.client.users.fetch(params.userId);
            responseText = `✅ ${user.username} kullanıcısına ait ${result.deletedCount} mesaj silindi.`;
          } catch (e) {
            responseText = `✅ Belirtilen kullanıcıya ait ${result.deletedCount} mesaj silindi.`;
          }
        }
        
        await message.channel.send(responseText);
        return { success: true };
      } else {
        await message.channel.send(`❌ ${result.error || 'Mesajlar silinemedi.'}`);
        return { success: false, error: result.error };
      }
    } catch (error) {
      this.logger.error('Error executing channel purge:', error);
      await message.channel.send(`❌ Bir hata oluştu: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { ActionHandler };