/**
 * Dynamic Action Handler
 * Dynamically executes Discord API requests with automatic action correction
 * @version 2.0.0
 */
const { PermissionsBitField } = require('discord.js');
const path = require('path');
const fs = require('fs').promises;

class DynamicHandler {
  /**
   * @param {Client} client - Discord client
   * @param {Object} logger - Logger
   */
  constructor(client, logger) {
    this.client = client;
    this.logger = logger;
    
    // API mappings - link actions to Discord.js methods
    this.actionMappings = {
      // Message operations
      'message.create': this._sendMessage.bind(this),
      'message.edit': this._editMessage.bind(this),
      'message.delete': this._deleteMessage.bind(this),
      'message.react': this._reactToMessage.bind(this),
      'message.pin': this._pinMessage.bind(this),
      'message.unpin': this._unpinMessage.bind(this),
      
      // Channel operations
      'channel.create': this._createChannel.bind(this),
      'channel.delete': this._deleteChannel.bind(this),
      'channel.purge': this._purgeChannel.bind(this),
      'channel.lock': this._lockChannel.bind(this),
      'channel.unlock': this._unlockChannel.bind(this),
      
      // Member operations
      'member.timeout': this._timeoutMember.bind(this),
      'member.kick': this._kickMember.bind(this),
      'member.ban': this._banMember.bind(this),
      'member.unban': this._unbanMember.bind(this),
      'member.setNickname': this._setMemberNickname.bind(this), // Newly added
      
      // Role operations
      'role.add': this._addRole.bind(this),
      'role.remove': this._removeRole.bind(this)
    };
    
    // Action Alias System - to correct wrong action names from LLM
    this.actionAliases = {
      // Member action aliases
      'member.edit': 'member.setNickname',
      'member.update': 'member.setNickname',
      'member.nickname': 'member.setNickname',
      'member.nick': 'member.setNickname',
      'member.rename': 'member.setNickname',
      'member.changenick': 'member.setNickname',
      'member.modifyNickname': 'member.setNickname',
      'member.mute': 'member.timeout',
      'member.silence': 'member.timeout',
      
      // Message action aliases
      'message.send': 'message.create',
      'message.write': 'message.create',
      'message.post': 'message.create',
      
      // Channel action aliases
      'channel.clean': 'channel.purge',
      'channel.clear': 'channel.purge',
      'message.purge': 'channel.purge',
      'message.clear': 'channel.purge',
      
      // Role action aliases
      'role.give': 'role.add',
      'role.assign': 'role.add',
      'role.revoke': 'role.remove',
      'role.take': 'role.remove'
    };
    
    // Counter for dynamic extensions
    this.dynamicExtensionCount = 0;
    
    // Command patterns for recognition and processing
    this.commandPatterns = [
      {
        name: 'countAndTimeout',
        regex: /(.*?)\s+name\s+has\s+(?:how many|what number of)\s+letters.*?(?:timeout|mute)/i,
        handler: this._handleCountAndTimeoutPattern.bind(this)
      },
      {
        name: 'repeatMessage',
        regex: /(.+)\s+(?:repeat|say)\s+(\d+)(?:\s+times?)?/i,
        handler: this._handleRepeatMessagePattern.bind(this)
      }
    ];
  }
  
  /**
   * Execute an action
   * @param {Message} message - Discord message
   * @param {Object} params - Action parameters
   * @returns {Promise<Object>} - Operation result
   */
  async executeAction(message, params) {
    try {
      // Parameter validation
      if (!params || !params.action) {
        return { success: false, error: 'Missing action parameter' };
      }
      
      // First, check for known patterns and handle them
      for (const pattern of this.commandPatterns) {
        if (message.content && pattern.regex.test(message.content)) {
          this.logger.info(`Special command pattern matched: ${pattern.name}`);
          return await pattern.handler(message, params);
        }
      }
      
      // Look up the action - direct match first
      let handler = this.actionMappings[params.action];
      let actionUsed = params.action;
      
      // If not found, check aliases
      if (!handler && this.actionAliases[params.action.toLowerCase()]) {
        const correctAction = this.actionAliases[params.action.toLowerCase()];
        handler = this.actionMappings[correctAction];
        actionUsed = correctAction;
        
        if (handler) {
          this.logger.info(`Action corrected: ${params.action} -> ${correctAction}`);
          // Inform user but don't wait for message to send
          setTimeout(() => {
            message.channel.send(`ℹ️ Using '${correctAction}' instead of '${params.action}'.`)
              .catch(() => {}); // Ignore errors
          }, 100);
        }
      }
      
      // If still no handler, find most similar action
      if (!handler) {
        const similarAction = this._findSimilarAction(params.action);
        
        if (similarAction) {
          handler = this.actionMappings[similarAction];
          actionUsed = similarAction;
          
          if (handler) {
            this.logger.info(`Action similarity match: ${params.action} -> ${similarAction}`);
            // Inform user but don't wait
            setTimeout(() => {
              message.channel.send(`ℹ️ Action '${params.action}' not found. Using '${similarAction}' instead.`)
                .catch(() => {}); // Ignore errors
            }, 100);
          }
        }
      }
      
      // If still no handler, create dynamic extension
      if (!handler) {
        this.logger.warn(`Action '${params.action}' not found. Creating dynamic extension...`);
        return await this._createDynamicExtension(message, params);
      }
      
      // Execute the action
      const result = await handler(message, params);
      return { success: true, result, actionUsed };
    } catch (error) {
      this.logger.error(`Action execution error (${params?.action || 'unknown'}):`, error);
      return { 
        success: false, 
        error: error.message || 'Unknown error',
        errorCode: error.code
      };
    }
  }
  
  /**
   * Find the most similar action
   * @param {string} invalidAction - Invalid action name
   * @returns {string|null} - Similar action name
   */
  _findSimilarAction(invalidAction) {
    // Normalize
    const normalizedInvalid = invalidAction.toLowerCase();
    
    // Similarity threshold
    const SIMILARITY_THRESHOLD = 0.6;
    
    // All valid actions
    const validActions = Object.keys(this.actionMappings);
    
    let bestMatch = null;
    let bestScore = 0;
    
    // Check category first
    if (normalizedInvalid.includes('.')) {
      const [category] = normalizedInvalid.split('.');
      
      // Find actions in same category
      const sameCategory = validActions.filter(action => action.startsWith(category + '.'));
      
      if (sameCategory.length > 0) {
        // Calculate similarity for each action
        for (const action of sameCategory) {
          const score = this._calculateSimilarity(normalizedInvalid, action.toLowerCase());
          if (score > bestScore) {
            bestScore = score;
            bestMatch = action;
          }
        }
        
        // Return if above threshold
        if (bestScore >= SIMILARITY_THRESHOLD) {
          return bestMatch;
        }
        
        // Return first action in category
        return sameCategory[0];
      }
    }
    
    // If no category match, find most similar across all actions
    for (const action of validActions) {
      const score = this._calculateSimilarity(normalizedInvalid, action.toLowerCase());
      if (score > bestScore) {
        bestScore = score;
        bestMatch = action;
      }
    }
    
    // Return if above threshold
    if (bestScore >= SIMILARITY_THRESHOLD) {
      return bestMatch;
    }
    
    return null;
  }
  
  /**
   * Calculate similarity between two strings (based on Levenshtein distance)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity score (0-1)
   */
  _calculateSimilarity(str1, str2) {
    const distance = this._levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
  }
  
  /**
   * Calculate Levenshtein distance
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {number} - Edit distance
   */
  _levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i-1) === a.charAt(j-1)) {
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i-1][j-1] + 1, // substitution
            matrix[i][j-1] + 1,   // insertion
            matrix[i-1][j] + 1    // deletion
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }
  
  /**
   * Change a member's nickname
   * @param {Message} message - Discord message
   * @param {Object} params - Parameters
   * @private
   */
  async _setMemberNickname(message, params) {
    if (!message.guild) {
      throw new Error('This action can only be used in servers');
    }
    
    // Get user ID parameter
    const userId = params.userId || 
                  (message.mentions.users.first() ? message.mentions.users.first().id : null);
    
    // Get nickname parameter - CHECK ALL POSSIBLE FIELDS
    let nickname = null;
    
    // Check all possible parameter names
    const possibleParamNames = ['nickname', 'nick', 'name', 'content', 'value', 'to', 'newNickname'];
    
    for (const paramName of possibleParamNames) {
      if (params[paramName] !== undefined) {
        nickname = params[paramName];
        break;
      }
    }
    
    // If still not found, analyze message content
    if (nickname === null) {
      // Format: "nickname to something" or "change something"
      const nicknameMatch = message.content.match(/(?:nickname|name)\s+(?:to|as|change)\s+["']?([^"']+)["']?/i);
      if (nicknameMatch) {
        nickname = nicknameMatch[1];
      } else {
        // "to something" format
        const toMatch = message.content.match(/\s+to\s+["']?([^"']+)["']?/i);
        if (toMatch) {
          nickname = toMatch[1];
        }
      }
    }
    
    // Log
    this.logger.info(`Nickname change request: userID=${userId}, nickname=${nickname}`);
    this.logger.info(`Original parameters:`, params);
    
    if (!userId) {
      throw new Error('Missing user ID parameter');
    }
    
    if (!nickname && nickname !== '') {
      throw new Error('Missing new nickname parameter, please specify (e.g., nickname="New Name")');
    }
    
    // Find member
    const member = await message.guild.members.fetch(userId);
    if (!member) {
      throw new Error('User not found');
    }
    
    // Check permissions
    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
      throw new Error('Bot lacks permission to change nicknames');
    }
    
    const reason = params.reason || 'Changed via bot command';
    
    try {
      // Change nickname
      await member.setNickname(nickname, reason);
      
      // Success message
      await message.channel.send(`✅ Changed <@${userId}>'s nickname to "${nickname}".`);
      
      return {
        nicknameChanged: true,
        user: member.user.tag,
        nickname: nickname
      };
    } catch (error) {
      // More descriptive error
      this.logger.error('Nickname change error:', error);
      throw new Error(`Failed to change nickname: ${error.message}`);
    }
  }
  
  // [Other existing methods continue - I'm keeping them]
  async _sendMessage(message, params) {
    const channel = params.channelId 
      ? await this.client.channels.fetch(params.channelId).catch(() => message.channel)
      : message.channel;
      
    if (!channel) {
      throw new Error('Channel not found');
    }
    
    return await channel.send(params.content || "Empty message");
  }
  
  async _editMessage(message, params) {
    const targetMessage = params.messageId
      ? await message.channel.messages.fetch(params.messageId)
      : message;
      
    if (!targetMessage) {
      throw new Error('Message to edit not found');
    }
    
    return await targetMessage.edit(params.content);
  }
  
  async _deleteMessage(message, params) {
    const targetMessage = params.messageId
      ? await message.channel.messages.fetch(params.messageId)
      : message;
      
    if (!targetMessage) {
      throw new Error('Message to delete not found');
    }
    
    return await targetMessage.delete();
  }
  
  async _reactToMessage(message, params) {
    const targetMessage = params.messageId
      ? await message.channel.messages.fetch(params.messageId)
      : message;
      
    if (!targetMessage) {
      throw new Error('Message to react to not found');
    }
    
    if (!params.emoji) {
      throw new Error('Missing emoji parameter');
    }
    
    return await targetMessage.react(params.emoji);
  }
  
  async _pinMessage(message, params) {
    const targetMessage = params.messageId
      ? await message.channel.messages.fetch(params.messageId)
      : message;
      
    if (!targetMessage) {
      throw new Error('Message to pin not found');
    }
    
    return await targetMessage.pin();
  }
  
  async _unpinMessage(message, params) {
    const targetMessage = params.messageId
      ? await message.channel.messages.fetch(params.messageId)
      : message;
      
    if (!targetMessage) {
      throw new Error('Message to unpin not found');
    }
    
    return await targetMessage.unpin();
  }
  
  async _createChannel(message, params) {
    if (!message.guild) {
      throw new Error('This action can only be used in servers');
    }
    
    if (!params.name) {
      throw new Error('Missing channel name parameter');
    }
    
    // Channel type
    let type = 0; // GUILD_TEXT
    if (params.type) {
      switch(params.type.toLowerCase()) {
        case 'text': type = 0; break;      // GUILD_TEXT
        case 'voice': type = 2; break;     // GUILD_VOICE
        case 'category': type = 4; break;  // GUILD_CATEGORY
        case 'announcement': type = 5; break; // GUILD_ANNOUNCEMENT
        case 'forum': type = 15; break;    // GUILD_FORUM
      }
    }
    
    const options = {
      type: type,
      topic: params.topic,
      nsfw: params.nsfw,
      parent: params.parentId
    };
    
    // Discord.js v14 uses channels.create
    return await message.guild.channels.create({
      name: params.name,
      ...options
    });
  }
  
  async _deleteChannel(message, params) {
    if (!message.guild) {
      throw new Error('This action can only be used in servers');
    }
    
    const channelId = params.channelId || message.channel.id;
    const channel = await message.guild.channels.fetch(channelId);
    
    if (!channel) {
      throw new Error('Channel to delete not found');
    }
    
    return await channel.delete(params.reason || 'Deleted by bot');
  }
  
  async _purgeChannel(message, params) {
    const channel = params.channelId
      ? await this.client.channels.fetch(params.channelId)
      : message.channel;
      
    if (!channel) {
      throw new Error('Channel not found');
    }
    
    // Limit check
    const limit = Math.min(Math.max(parseInt(params.limit) || 10, 1), 100);
    
    // Purge messages from a specific user
    if (params.userId) {
      const messages = await channel.messages.fetch({ limit: 100 });
      const userMessages = messages.filter(msg => msg.author.id === params.userId);
      const toDelete = userMessages.first(limit);
      
      if (toDelete.length === 0) {
        throw new Error('No messages found to delete');
      }
      
      // Two-week check for bulk delete
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const recentMessages = toDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo);
      
      if (recentMessages.length > 1) {
        await channel.bulkDelete(recentMessages);
      }
      
      // Delete old messages individually
      const oldMessages = toDelete.filter(msg => msg.createdTimestamp <= twoWeeksAgo);
      for (const msg of oldMessages) {
        await msg.delete().catch(() => {});
      }
      
      return { deleted: toDelete.length };
    } else {
      // Purge all messages
      const deleted = await channel.bulkDelete(limit);
      return { deleted: deleted.size };
    }
  }
  
  async _lockChannel(message, params) {
    const channel = params.channelId
      ? await this.client.channels.fetch(params.channelId)
      : message.channel;
      
    if (!channel) {
      throw new Error('Channel not found');
    }
    
    await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: false
    });
    
    return { locked: true, channel: channel.name };
  }
  
  async _unlockChannel(message, params) {
    const channel = params.channelId
      ? await this.client.channels.fetch(params.channelId)
      : message.channel;
      
    if (!channel) {
      throw new Error('Channel not found');
    }
    
    await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: null
    });
    
    return { unlocked: true, channel: channel.name };
  }
  
  async _timeoutMember(message, params) {
    if (!message.guild) {
      throw new Error('This action can only be used in servers');
    }
    
    if (!params.userId) {
      throw new Error('Missing user ID parameter');
    }
    
    const member = await message.guild.members.fetch(params.userId);
    if (!member) {
      throw new Error('User not found');
    }
    
    // Duration (in milliseconds)
    const duration = Math.max(0, parseInt(params.duration) || 0) * 1000;
    const reason = params.reason || 'Timeout applied';
    
    await member.timeout(duration, reason);
    
    return {
      timedOut: true,
      user: member.user.tag,
      duration: duration,
      reason: reason
    };
  }
  
  async _kickMember(message, params) {
    if (!message.guild) {
      throw new Error('This action can only be used in servers');
    }
    
    if (!params.userId) {
      throw new Error('Missing user ID parameter');
    }
    
    const member = await message.guild.members.fetch(params.userId);
    if (!member) {
      throw new Error('User not found');
    }
    
    const reason = params.reason || 'Kicked from server';
    
    await member.kick(reason);
    
    return {
      kicked: true,
      user: member.user.tag,
      reason: reason
    };
  }
  
  async _banMember(message, params) {
    if (!message.guild) {
      throw new Error('This action can only be used in servers');
    }
    
    if (!params.userId) {
      throw new Error('Missing user ID parameter');
    }
    
    const reason = params.reason || 'Banned from server';
    const deleteMessageDays = Math.min(Math.max(parseInt(params.deleteMessageDays) || 0, 0), 7);
    
    await message.guild.members.ban(params.userId, {
      reason: reason,
      deleteMessageDays: deleteMessageDays
    });
    
    // Try to get user info
    let userTag = params.userId;
    try {
      const user = await this.client.users.fetch(params.userId);
      userTag = user.tag;
    } catch (error) {
      // Use ID if user not found
    }
    
    return {
      banned: true,
      user: userTag,
      reason: reason,
      deleteMessageDays: deleteMessageDays
    };
  }
  
  async _unbanMember(message, params) {
    if (!message.guild) {
      throw new Error('This action can only be used in servers');
    }
    
    if (!params.userId) {
      throw new Error('Missing user ID parameter');
    }
    
    const reason = params.reason || 'Ban removed';
    
    await message.guild.bans.remove(params.userId, reason);
    
    // Try to get user info
    let userTag = params.userId;
    try {
      const user = await this.client.users.fetch(params.userId);
      userTag = user.tag;
    } catch (error) {
      // Use ID if user not found
    }
    
    return {
      unbanned: true,
      user: userTag,
      reason: reason
    };
  }
  
  async _addRole(message, params) {
    if (!message.guild) {
      throw new Error('This action can only be used in servers');
    }
    
    if (!params.userId) {
      throw new Error('Missing user ID parameter');
    }
    
    // Find role by ID or name
    let role;
    if (params.roleId) {
      role = await message.guild.roles.fetch(params.roleId);
    } else if (params.roleName) {
      role = message.guild.roles.cache.find(r => r.name.toLowerCase() === params.roleName.toLowerCase());
    } else {
      throw new Error('Missing role ID or role name parameter');
    }
    
    if (!role) {
      throw new Error('Role not found');
    }
    
    const member = await message.guild.members.fetch(params.userId);
    if (!member) {
      throw new Error('User not found');
    }
    
    await member.roles.add(role);
    
    return {
      roleAdded: true,
      user: member.user.tag,
      role: role.name
    };
  }
  
  async _removeRole(message, params) {
    if (!message.guild) {
      throw new Error('This action can only be used in servers');
    }
    
    if (!params.userId) {
      throw new Error('Missing user ID parameter');
    }
    
    // Find role by ID or name
    let role;
    if (params.roleId) {
      role = await message.guild.roles.fetch(params.roleId);
    } else if (params.roleName) {
      role = message.guild.roles.cache.find(r => r.name.toLowerCase() === params.roleName.toLowerCase());
    } else {
      throw new Error('Missing role ID or role name parameter');
    }
    
    if (!role) {
      throw new Error('Role not found');
    }
    
    const member = await message.guild.members.fetch(params.userId);
    if (!member) {
      throw new Error('User not found');
    }
    
    await member.roles.remove(role);
    
    return {
      roleRemoved: true,
      user: member.user.tag,
      role: role.name
    };
  }
  
  /**
   * Create dynamic extension for complex request
   * @param {Message} message - Discord message
   * @param {Object} params - Request parameters
   * @private
   */
  async _createDynamicExtension(message, params) {
    try {
      // Parameter to process
      const userInput = message.content;
      
      // Inform user that bot is creating a new extension
      await message.channel.send('🧠 This is not a standard action. Analyzing...');
      
      // Extension ID
      const extensionId = `dynamic_ext_${++this.dynamicExtensionCount}`;
      
      // Detect possible extension types
      let extensionType = 'unknown';
      let extensionResponse = '';
      
      // Count letters and timeout example
      if (userInput.match(/name\s+(?:has|contains)\s+(?:how many|what number of)\s+letters/i) && 
          userInput.match(/(?:timeout|mute)/i)) {
        extensionType = 'countAndTimeout';
        extensionResponse = await this._handleCountAndTimeoutPattern(message, params);
        return extensionResponse;
      }
      
      // Message repetition example
      const repeatMatch = userInput.match(/(.+)\s+(?:repeat|say)\s+(\d+)(?:\s+times?)?/i);
      if (repeatMatch) {
        extensionType = 'repeatMessage';
        extensionResponse = await this._handleRepeatMessagePattern(message, params);
        return extensionResponse;
      }
      
      // Message filtering and editing example
      if (userInput.match(/(?:message|messages).*?(?:filter).*?(?:edit|replace)/i)) {
        extensionType = 'filterMessages';
        await message.channel.send('📝 Detected message filtering and editing request...');
        
        return {
          success: true,
          result: await this._createGenericResponse(message, `Custom filtering operation for command: ${params.action}`)
        };
      }
      
      // If nothing detected, return a general response
      await message.channel.send('❓ Command not understood. Please be more specific.');
      
      return {
        success: false,
        error: `Could not recognize action '${params.action}' and custom command analysis failed.`,
        suggestion: 'Please use one of the supported actions: ' + Object.keys(this.actionMappings).join(', ')
      };
    } catch (error) {
      this.logger.error('Dynamic extension creation error:', error);
      return {
        success: false,
        error: `Error creating dynamic extension: ${error.message}`
      };
    }
  }
  
  /**
   * Handle "How many letters in name, timeout that much" pattern
   * @param {Message} message - Discord message
   * @param {Object} params - Request parameters
   * @private
   */
  async _handleCountAndTimeoutPattern(message, params) {
    try {
      // Find the mentioned user
      const mentionedUser = message.mentions.users.first();
      
      if (!mentionedUser) {
        await message.channel.send('❌ You need to mention a user for this command.');
        return { success: false, error: 'No user mention found' };
      }
      
      // Determine name variables
      let nameToCount = '';
      
      // Process based on which name to count
      if (message.content.includes('server name')) {
        nameToCount = mentionedUser.username;
      } else if (message.content.includes('nickname')) {
        const member = await message.guild.members.fetch(mentionedUser.id);
        nameToCount = member.nickname || member.user.username;
      } else {
        // Default to username
        nameToCount = mentionedUser.username;
      }
      
      // Remove spaces if specified
      if (message.content.includes('without spaces')) {
        nameToCount = nameToCount.replace(/\s+/g, '');
      }
      
      // Get letter count
      const letterCount = nameToCount.length;
      
      // Determine timeout duration (seconds, minutes etc)
      let timeoutDuration = letterCount;
      let timeUnit = 'seconds';
      
      if (message.content.includes('minute')) {
        timeoutDuration = letterCount * 60; // In minutes
        timeUnit = 'minutes';
      } else if (message.content.includes('hour')) {
        timeoutDuration = letterCount * 3600; // In hours
        timeUnit = 'hours';
      }
      
      // Apply timeout
      const member = await message.guild.members.fetch(mentionedUser.id);
      await member.timeout(timeoutDuration * 1000, 'Timeout based on name length');
      
      // Report result
      await message.channel.send(
        `✅ ${mentionedUser.toString()} has **${letterCount}** letters in their name. ` + 
        `Applied timeout for **${letterCount} ${timeUnit}**.`
      );
      
      return {
        success: true,
        result: {
          user: mentionedUser.tag,
          letterCount: letterCount,
          timeoutDuration: timeoutDuration,
          timeUnit: timeUnit
        }
      };
    } catch (error) {
      this.logger.error('Letter counting timeout error:', error);
      await message.channel.send(`❌ Error during operation: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Handle "Repeat X message Y times" pattern
   * @param {Message} message - Discord message
   * @param {Object} params - Request parameters
   * @private
   */
  async _handleRepeatMessagePattern(message, params) {
    try {
      // Extract content and repeat count with regex
      const match = message.content.match(/(.+)\s+(?:repeat|say)\s+(\d+)(?:\s+times?)?/i);
      
      if (!match) {
        await message.channel.send('❌ Could not understand the command. Example: "Hello repeat 3 times"');
        return { success: false, error: 'Command format not recognized' };
      }
      
      // Get content and repeat count
      let content = match[1].trim();
      const repeatCount = parseInt(match[2]);
      
      // Check maximum repeat count
      const maxRepeat = 10;
      const actualRepeatCount = Math.min(repeatCount, maxRepeat);
      
      if (repeatCount > maxRepeat) {
        await message.channel.send(`⚠️ I can only repeat up to ${maxRepeat} times. Will repeat ${maxRepeat} times.`);
      }
      
      // If "becas repeat" or bot mention, remove from content
      content = content.replace(/^(?:becas|<@!?\d+>)\s+/i, '');
      
      // Repeat message the specified number of times
      for (let i = 0; i < actualRepeatCount; i++) {
        // Should it be numbered?
        const numberedContent = message.content.includes('number') ?
          `${i+1}. ${content}` : content;
        
        await message.channel.send(numberedContent);
        
        // Short delay to prevent spam
        if (i < actualRepeatCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      return {
        success: true,
        result: {
          content: content,
          repeatCount: actualRepeatCount,
          numbered: message.content.includes('number')
        }
      };
    } catch (error) {
      this.logger.error('Message repetition error:', error);
      await message.channel.send(`❌ Error during operation: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Create generic response
   * @param {Message} message - Discord message
   * @param {string} content - Response content
   * @private
   */
  async _createGenericResponse(message, content) {
    await message.channel.send(content);
    return { message: content };
  }
}

module.exports = { DynamicHandler };