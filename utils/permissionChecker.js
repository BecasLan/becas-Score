/**
 * Permission checker utility
 */
const { PermissionsBitField } = require('discord.js');

/**
 * Check if a member has the required permissions
 * @param {GuildMember} member - Discord guild member
 * @param {Array} permissions - Array of permission flags
 * @returns {Object} - Permission check result
 */
function checkPermissions(member, permissions) {
  if (!member || !permissions || !Array.isArray(permissions)) {
    return {
      hasPermission: false,
      missingPermissions: ['Invalid input']
    };
  }
  
  const missingPermissions = [];
  
  for (const permission of permissions) {
    if (!member.permissions.has(permission)) {
      missingPermissions.push(getPermissionName(permission));
    }
  }
  
  return {
    hasPermission: missingPermissions.length === 0,
    missingPermissions
  };
}

/**
 * Get human-readable permission name
 * @param {bigint} permission - Permission flag
 * @returns {string} - Permission name
 */
function getPermissionName(permission) {
  // Convert permission flag to name
  for (const [name, value] of Object.entries(PermissionsBitField.Flags)) {
    if (value === permission) {
      return name.replace(/([A-Z])/g, ' $1').trim();
    }
  }
  
  return 'Unknown Permission';
}

module.exports = {
  checkPermissions,
  getPermissionName
};