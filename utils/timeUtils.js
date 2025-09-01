/**
 * Time utility functions
 */

/**
 * Format a duration in seconds to a human-readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration
 */
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  const days = Math.floor(seconds / 86400);
  return `${days} day${days !== 1 ? 's' : ''}`;
}

/**
 * Parse a human-readable time string into seconds
 * @param {string} timeString - Time string (e.g., "5m", "1h", "2d")
 * @returns {number} - Duration in seconds
 */
function parseTimeString(timeString) {
  if (!timeString || typeof timeString !== 'string') return 0;
  
  const match = timeString.match(/^(\d+)([smhdw])$/i);
  if (!match) return 0;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    case 'w': return value * 60 * 60 * 24 * 7;
    default: return 0;
  }
}

/**
 * Get a timestamp for a specific time from now
 * @param {number} seconds - Seconds from now
 * @returns {number} - Unix timestamp in seconds
 */
function getTimestampFromNow(seconds) {
  return Math.floor(Date.now() / 1000) + seconds;
}

module.exports = {
  formatDuration,
  parseTimeString,
  getTimestampFromNow
};