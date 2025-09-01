/**
 * Advanced Command Parser for BecasBot
 * Uses intent detection to understand complex natural language commands
 */
const { NLP } = require('../ai/nlp');

class CommandParser {
  constructor(logger, llm) {
    this.logger = logger;
    this.llm = llm;
    this.nlp = new NLP(llm);
    
    // Command patterns for better detection
    this.commandPatterns = {
      deletion: {
        intents: ['delete', 'remove', 'clear', 'sil', 'temizle', 'kaldır'],
        extractors: {
          userTarget: this._extractUserTarget.bind(this),
          messageCount: this._extractMessageCount.bind(this),
          channel: this._extractChannel.bind(this),
          timeframe: this._extractTimeframe.bind(this)
        }
      },
      // Add other command types here (moderation, monitoring, etc.)
    };
  }
  
  /**
   * Parse a command and extract the intent and parameters
   * @param {Message} message - Discord message
   * @param {string} input - Command input text
   * @returns {Promise<Object>} Parsed command details
   */
  async parseCommand(message, input) {
    try {
      // Detect basic command type
      const commandType = this._detectCommandType(input);
      
      if (!commandType) {
        return { 
          success: false, 
          error: "Couldn't determine command type"
        };
      }
      
      // Extract command parameters based on type
      const params = await this._extractParameters(commandType, input, message);
      
      return {
        success: true,
        commandType,
        params
      };
    } catch (error) {
      this.logger.error('Error parsing command:', error);
      return {
        success: false,
        error: 'Failed to parse command: ' + error.message
      };
    }
  }
  
  /**
   * Detect the type of command from input text
   * @param {string} input - Command input text
   * @returns {string|null} Command type or null if not detected
   * @private
   */
  _detectCommandType(input) {
    const lowercaseInput = input.toLowerCase();
    
    // Check each command pattern
    for (const [type, pattern] of Object.entries(this.commandPatterns)) {
      if (pattern.intents.some(intent => lowercaseInput.includes(intent))) {
        return type;
      }
    }
    
    return null;
  }
  
  /**
   * Extract command parameters based on command type
   * @param {string} type - Command type
   * @param {string} input - Command input text
   * @param {Message} message - Discord message
   * @returns {Promise<Object>} Extracted parameters
   * @private
   */
  async _extractParameters(type, input, message) {
    const pattern = this.commandPatterns[type];
    const params = {};
    
    if (!pattern || !pattern.extractors) {
      return params;
    }
    
    // Apply each extractor
    for (const [key, extractor] of Object.entries(pattern.extractors)) {
      params[key] = await extractor(input, message);
    }
    
    // For complex parsing that needs AI assistance
    if (Object.keys(params).length === 0 || !params.userTarget && !params.messageCount) {
      // Use LLM to extract parameters if regular expressions failed
      return await this._extractParametersWithAI(type, input, message);
    }
    
    return params;
  }
  
  /**
   * Extract parameters using AI for complex commands
   * @param {string} type - Command type
   * @param {string} input - Command input text
   * @param {Message} message - Discord message
   * @returns {Promise<Object>} Extracted parameters
   * @private
   */
  async _extractParametersWithAI(type, input, message) {
    try {
      const result = await this.nlp.extractEntities(input, type, {
        mentionedUsers: Array.from(message.mentions?.users?.values() || [])
          .map(u => ({ id: u.id, username: u.username })),
        currentChannel: {
          id: message.channel?.id,
          name: message.channel?.name
        }
      });
      
      return result;
    } catch (error) {
      this.logger.error('Error extracting parameters with AI:', error);
      return {}; // Return empty params on error
    }
  }
  
  /**
   * Extract user target from command
   * @param {string} input - Command input
   * @param {Message} message - Discord message
   * @returns {Object|null} User target info
   * @private
   */
  async _extractUserTarget(input, message) {
    // First check for user mentions
    const mentionedUser = message.mentions?.users?.first();
    if (mentionedUser) {
      return {
        id: mentionedUser.id,
        username: mentionedUser.username
      };
    }
    
    // Check for keywords indicating "from user" or "user's messages"
    const userKeywords = [
      'from', 'by', 'user', 'kullanıcı', 'kişi',
      'from user', 'kullanıcıdan', 'kişiden'
    ];
    
    const lowercaseInput = input.toLowerCase();
    if (userKeywords.some(keyword => lowercaseInput.includes(keyword))) {
      // Try to extract username without mention
      // This is a simplified approach - for a full solution, we would need an AI-based entity extractor
      const usernameRegex = new RegExp(
        `(${userKeywords.join('|')})\\s+([\\w\\d.]+)`, 'i'
      );
      const match = lowercaseInput.match(usernameRegex);
      
      if (match && match[2]) {
        // Try to find user by username
        return {
          username: match[2],
          needsResolution: true // Flag that we need to resolve this to an ID
        };
      }
    }
    
    return null;
  }
  
  /**
   * Extract message count from command
   * @param {string} input - Command input
   * @returns {number|null} Message count
   * @private
   */
  _extractMessageCount(input) {
    // Match patterns like "10 messages", "11 mesaj", "last 5"
    const countRegex = /(\d+)(?:\s+(?:messages?|mesaj|tane))?/i;
    const match = input.match(countRegex);
    
    if (match && match[1]) {
      const count = parseInt(match[1], 10);
      return isNaN(count) ? 10 : Math.min(Math.max(count, 1), 100);
    }
    
    return 10; // Default value
  }
  
  /**
   * Extract channel from command
   * @param {string} input - Command input
   * @param {Message} message - Discord message
   * @returns {Object|null} Channel info
   * @private
   */
  _extractChannel(input, message) {
    // Check for channel mentions
    const mentionedChannel = message.mentions?.channels?.first();
    if (mentionedChannel) {
      return {
        id: mentionedChannel.id,
        name: mentionedChannel.name
      };
    }
    
    // Check for "this channel", "here", "bu kanal", etc.
    const thisChannelKeywords = [
      'this channel', 'here', 'this', 'current channel',
      'bu kanal', 'burada', 'şurada', 'bu'
    ];
    
    const lowercaseInput = input.toLowerCase();
    if (thisChannelKeywords.some(keyword => lowercaseInput.includes(keyword))) {
      return {
        id: message.channel.id,
        name: message.channel.name,
        isCurrentChannel: true
      };
    }
    
    // Default to current channel
    return {
      id: message.channel.id,
      name: message.channel.name,
      isCurrentChannel: true
    };
  }
  
  /**
   * Extract timeframe from command
   * @param {string} input - Command input
   * @returns {Object|null} Timeframe info
   * @private
   */
  _extractTimeframe(input) {
    // Match patterns like "from last hour", "in past 2 days"
    const timeframeRegex = /(?:from|in|past|son|geçen)\s+(\d+)?\s*(hour|day|week|minute|saat|gün|hafta|dakika)s?/i;
    const match = input.match(timeframeRegex);
    
    if (match) {
      const amount = match[1] ? parseInt(match[1], 10) : 1;
      const unit = match[2].toLowerCase();
      
      // Convert to hours
      let hours = amount;
      if (unit === 'minute' || unit === 'dakika') {
        hours = amount / 60;
      } else if (unit === 'day' || unit === 'gün') {
        hours = amount * 24;
      } else if (unit === 'week' || unit === 'hafta') {
        hours = amount * 24 * 7;
      }
      
      return { hours };
    }
    
    return null;
  }
}

module.exports = { CommandParser };