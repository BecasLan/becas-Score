/**
 * Role-related Discord API actions
 */
const { PermissionsBitField } = require('discord.js');

class RoleActions {
  constructor(client, logger) {
    this.client = client;
    this.logger = logger;
  }
  
  /**
   * Create a role
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async create(params, guild) {
    const { name, color, hoist, mentionable, permissions, position, reason } = params;
    
    if (!name) return { success: false, error: "name missing" };
    
    try {
      // Prepare role options
      const options = {
        name,
        reason: reason || "Role created by BecasBot"
      };
      
      // Add optional properties
      if (color) options.color = color;
      if (hoist !== undefined) options.hoist = hoist;
      if (mentionable !== undefined) options.mentionable = mentionable;
      
      // Handle permissions
      if (permissions) {
        try {
          if (typeof permissions === 'string') {
            options.permissions = PermissionsBitField.resolve(JSON.parse(permissions));
          } else if (Array.isArray(permissions)) {
            options.permissions = new PermissionsBitField(permissions).valueOf();
          }
        } catch (error) {
          this.logger.error("Error parsing permissions:", error);
          // Continue without permissions if there's an error
        }
      }
      
      // Create the role
      const role = await guild.roles.create(options);
      
      // Set position if specified (separate operation)
      if (position !== undefined && Number.isInteger(position)) {
        await role.setPosition(position);
      }
      
      return {
        success: true,
        roleId: role.id,
        name: role.name,
        color: role.hexColor
      };
    } catch (error) {
      this.logger.error("Error creating role:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Delete a role
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async delete(params, guild) {
    const { roleId, reason } = params;
    
    if (!roleId) return { success: false, error: "roleId missing" };
    
    try {
      const role = await guild.roles.fetch(roleId).catch(() => null);
      
      if (!role) {
        return { success: false, error: "Role not found", roleId };
      }
      
      const roleName = role.name;
      await role.delete(reason || "Role deleted by BecasBot");
      
      return {
        success: true,
        roleId,
        name: roleName
      };
    } catch (error) {
      this.logger.error("Error deleting role:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Edit a role
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async edit(params, guild) {
    const { roleId, name, color, hoist, mentionable, permissions, position, reason } = params;
    
    if (!roleId) return { success: false, error: "roleId missing" };
    
    try {
      const role = await guild.roles.fetch(roleId).catch(() => null);
      
      if (!role) {
        return { success: false, error: "Role not found", roleId };
      }
      
      // Prepare edit options
      const options = { reason: reason || "Role edited by BecasBot" };
      
      // Add specified properties only
      if (name !== undefined) options.name = name;
      if (color !== undefined) options.color = color;
      if (hoist !== undefined) options.hoist = hoist;
      if (mentionable !== undefined) options.mentionable = mentionable;
      
      // Handle permissions
      if (permissions) {
        try {
          if (typeof permissions === 'string') {
            options.permissions = PermissionsBitField.resolve(JSON.parse(permissions));
          } else if (Array.isArray(permissions)) {
            options.permissions = new PermissionsBitField(permissions).valueOf();
          }
        } catch (error) {
          this.logger.error("Error parsing permissions:", error);
          // Continue without changing permissions if there's an error
        }
      }
      
      // Check if there are any changes
      if (Object.keys(options).length === 1 && options.reason) {
        return { success: false, error: "No changes specified" };
      }
      
      // Edit the role
      await role.edit(options);
      
      // Set position if specified (separate operation)
      if (position !== undefined && Number.isInteger(position)) {
        await role.setPosition(position);
      }
      
      return {
        success: true,
        roleId,
        name: role.name,
        color: role.hexColor
      };
    } catch (error) {
      this.logger.error("Error editing role:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Add a role to a member
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async add(params, guild) {
    const { userId, roleId, reason } = params;
    
    if (!userId) return { success: false, error: "userId missing" };
    if (!roleId) return { success: false, error: "roleId missing" };
    
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      
      if (!member) {
        return { success: false, error: "User not found", userId };
      }
      
      const role = await guild.roles.fetch(roleId).catch(() => null);
      
      if (!role) {
        return { success: false, error: "Role not found", roleId };
      }
      
      await member.roles.add(role, reason || "Role added by BecasBot");
      
      return {
        success: true,
        userId,
        roleId,
        username: member.user.tag,
        roleName: role.name
      };
    } catch (error) {
      this.logger.error("Error adding role to member:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Remove a role from a member
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async remove(params, guild) {
    const { userId, roleId, reason } = params;
    
    if (!userId) return { success: false, error: "userId missing" };
    if (!roleId) return { success: false, error: "roleId missing" };
    
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      
      if (!member) {
        return { success: false, error: "User not found", userId };
      }
      
      const role = await guild.roles.fetch(roleId).catch(() => null);
      
      if (!role) {
        return { success: false, error: "Role not found", roleId };
      }
      
      await member.roles.remove(role, reason || "Role removed by BecasBot");
      
      return {
        success: true,
        userId,
        roleId,
        username: member.user.tag,
        roleName: role.name
      };
    } catch (error) {
      this.logger.error("Error removing role from member:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get all roles in a guild
   * @param {Object} params - Action parameters
   * @param {Guild} guild - Discord guild
   * @returns {Promise<Object>} - Action result
   */
  async list(params, guild) {
    try {
      await guild.roles.fetch();
      
      const roles = guild.roles.cache
        .filter(role => role.id !== guild.id) // Filter out @everyone role
        .sort((a, b) => b.position - a.position) // Sort by position
        .map(role => ({
          id: role.id,
          name: role.name,
          color: role.hexColor,
          position: role.position,
          hoist: role.hoist,
          mentionable: role.mentionable
        }));
      
      return {
        success: true,
        roles
      };
    } catch (error) {
      this.logger.error("Error listing roles:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { RoleActions };