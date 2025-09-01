/**
 * Bot configuration
 */
require('dotenv').config();

module.exports = {
  // Bot configuration
  TOKEN: process.env.DISCORD_TOKEN,
  PREFIX: process.env.PREFIX || "becas",
  CLIENT_ID: process.env.CLIENT_ID,
  
  // LLM configuration
  LLM_API_URL: process.env.LLM_API_URL || "http://localhost:11434/v1",
  LLM_MODEL: process.env.LLM_MODEL || "llama3.1:8b-instruct-q4_K_M",
  
  // Admin settings
  ADMIN_USERS: (process.env.ADMIN_USERS || "").split(","),
  GLOBAL_ADMINS: (process.env.GLOBAL_ADMINS || "").split(","),
  
  // Behavior settings
  AUTO_APPROVE_ADMINS: process.env.AUTO_APPROVE_ADMINS === "true",
  EXTENSIONS_ENABLED: process.env.EXTENSIONS_ENABLED !== "false",
  COMMAND_TIMEOUT: parseInt(process.env.COMMAND_TIMEOUT || "30000"),
  
  // Logging settings
  LOGGING: {
    LEVEL: process.env.LOG_LEVEL || "info",
    FILE_ENABLED: process.env.LOG_TO_FILE === "true",
    FILE_PATH: process.env.LOG_FILE_PATH || "../logs/becas.log",
    CONSOLE_ENABLED: process.env.LOG_TO_CONSOLE !== "false",
  },
  
  // Extension settings
  EXTENSION_DIR: process.env.EXTENSION_DIR || "../extensions",
  MAX_EXTENSION_MEMORY: parseInt(process.env.MAX_EXTENSION_MEMORY || "10485760"),
  
  // Workflow settings
  MAX_WORKFLOW_STEPS: parseInt(process.env.MAX_WORKFLOW_STEPS || "10"),
  ALLOWED_ACTIONS: [
    "message.create",
    "message.delete",
    "message.edit",
    "message.react",
    "message.pin",
    "message.unpin",
    "member.timeout",
    "member.kick",
    "member.ban",
    "member.unban",
    "role.add",
    "role.remove",
    "role.create",
    "role.delete",
    "channel.create",
    "channel.delete",
    "channel.edit",
    "channel.purge",
    "nickname.set",
    "server.settings",
    "voice.disconnect",
    "voice.move",
    "voice.mute",
    "voice.unmute",
      'message.create',
  
  'member.roles.add',     // role.add için alternatif
  'member.roles.remove',  // role.remove için alternatif
  'member.role.add',      // role.add için alternatif
  'member.role.remove',   // role.remove için alternatif
  'roles.add',            // role.add için alternatif
  'roles.remove',         // role.remove için alternatif
  'message.send',         // message.create için alternatif
  'channel.messages.purge', // channel.purge için alternatif
  'messages.delete'  ,     // channel.purge için alternatif
 

  
 
  

  'channel.lock',
  'channel.unlock'
  ],
  
  // Database settings (optional)
  DATABASE: {
    ENABLED: process.env.DB_ENABLED === "true",
    URL: process.env.DB_URL || "sqlite:./data/becas.db",
  },
};