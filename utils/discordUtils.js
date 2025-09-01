/**
 * Discord utility functions for handling mentions, roles, etc.
 */

/**
 * Extract mentions from a message or text
 * @param {Message|string} source - Discord message object or text string
 * @returns {Array<string>} - Array of user IDs mentioned
 */
function extractMentions(source) {
  const mentions = [];
  
  // If source is a Message object with mentions
  if (typeof source === 'object' && source?.mentions?.users) {
    // Extract from Discord.js Message object
    source.mentions.users.forEach(user => {
      mentions.push(user.id);
    });
  } 
  // If source is a string or doesn't have mentions object
  else if (source) {
    // String can be either Message.content or direct input
    const text = typeof source === 'object' ? source.content || '' : String(source);
    
    // Extract user mentions using regex
    const mentionRegex = /<@!?(\d+)>/g;
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
  }
  
  return mentions;
}

/**
 * Extract role mentions from a message or text
 * @param {Message|string} source - Discord message object or text string
 * @returns {Array<string>} - Array of role IDs mentioned
 */
function extractRoles(source) {
  const roles = [];
  
  // If source is a Message object with mentions
  if (typeof source === 'object' && source?.mentions?.roles) {
    // Extract from Discord.js Message object
    source.mentions.roles.forEach(role => {
      roles.push(role.id);
    });
  } 
  // If source is a string or doesn't have mentions object
  else if (source) {
    // String can be either Message.content or direct input
    const text = typeof source === 'object' ? source.content || '' : String(source);
    
    // Extract role mentions using regex
    const roleRegex = /<@&(\d+)>/g;
    let match;
    
    while ((match = roleRegex.exec(text)) !== null) {
      roles.push(match[1]);
    }
  }
  
  return roles;
}

/**
 * Extract channel mentions from a message or text
 * @param {Message|string} source - Discord message object or text string
 * @returns {Array<string>} - Array of channel IDs mentioned
 */
function extractChannelMentions(source) {
  const channels = [];
  
  // If source is a Message object with mentions
  if (typeof source === 'object' && source?.mentions?.channels) {
    // Extract from Discord.js Message object
    source.mentions.channels.forEach(channel => {
      channels.push(channel.id);
    });
  } 
  // If source is a string or doesn't have mentions object
  else if (source) {
    // String can be either Message.content or direct input
    const text = typeof source === 'object' ? source.content || '' : String(source);
    
    // Extract channel mentions using regex
    const channelRegex = /<#(\d+)>/g;
    let match;
    
    while ((match = channelRegex.exec(text)) !== null) {
      channels.push(match[1]);
    }
  }
  
  return channels;
}

/**
 * Get user ID from a mention string
 * @param {string} mention - Mention string (<@123456789>)
 * @returns {string|null} - User ID or null if invalid
 */
function getUserIdFromMention(mention) {
  if (!mention || typeof mention !== 'string') return null;
  
  const matches = mention.match(/^<@!?(\d+)>$/);
  return matches ? matches[1] : null;
}

/**
 * Format a user mention from ID
 * @param {string} userId - User ID
 * @returns {string} - Formatted mention
 */
function formatUserMention(userId) {
  return `<@${userId}>`;
}

module.exports = {
  extractMentions,
  extractRoles,
  extractChannelMentions,
  getUserIdFromMention,
  formatUserMention
};