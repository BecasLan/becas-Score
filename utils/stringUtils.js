/**
 * String utility functions
 */

/**
 * Splits a long message into multiple chunks that Discord can handle
 * @param {string} content - The message content to split
 * @param {number} maxLength - Maximum length per chunk (default: 1900)
 * @returns {string[]} Array of message chunks
 */
function splitMessage(content, maxLength = 1900) {
  // If content is not a string or is empty, return an empty array
  if (!content || typeof content !== 'string') {
    return ['Error: No content to send'];
  }
  
  // If content is short enough, return it as is
  if (content.length <= maxLength) {
    return [content];
  }
  
  const chunks = [];
  let currentChunk = '';
  
  // Split by newlines first to maintain formatting
  const lines = content.split('\n');
  
  for (const line of lines) {
    // If a single line is longer than maxLength, split it by characters
    if (line.length > maxLength) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // Split the long line into pieces
      for (let i = 0; i < line.length; i += maxLength) {
        const piece = line.substring(i, i + maxLength);
        chunks.push(piece);
      }
    } 
    // Otherwise, check if adding this line would exceed the limit
    else if (currentChunk.length + line.length + 1 > maxLength) {
      chunks.push(currentChunk);
      currentChunk = line;
    } 
    // Add line to current chunk
    else {
      currentChunk += (currentChunk.length > 0 ? '\n' : '') + line;
    }
  }
  
  // Add the last chunk if it's not empty
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Truncate a string to a maximum length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add if truncated (default: '...')
 * @returns {string} - Truncated string
 */
function truncate(str, maxLength, suffix = '...') {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

module.exports = {
  splitMessage,
  truncate
};