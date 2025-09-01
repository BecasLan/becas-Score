/**
 * BecasBot - Discord Automation Bot
 * Main entry point
 */
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const path = require('path');
require('dotenv').config();
const config = require('./config/config');
const { setupLogger } = require('./core/logger');
const { initEventBus } = require('./core/eventBus');
const { setupBot } = require('./core/bot');

// Initialize the logger
const logger = setupLogger(config.LOGGING);

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Initialize the event bus
const eventBus = initEventBus(logger);

// Fix the extension directory path
if (!config.EXTENSION_DIR) {
  config.EXTENSION_DIR = path.join(__dirname, 'extensions');
  logger.info(`Set extension directory to: ${config.EXTENSION_DIR}`);
}

// Initialize the bot
setupBot(client, config, logger, eventBus).then(() => {
  // Login to Discord
  logger.info('Attempting to log in to Discord...');
  client.login(config.TOKEN).catch(err => {
    logger.fatal("Failed to log in to Discord:", err);
    process.exit(1);
  });
}).catch(err => {
  logger.fatal("Failed to initialize bot:", err);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Shutting down...');
  client.destroy();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  // Continue running - the bot should be resilient
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection:', reason);
  // Continue running - the bot should be resilient
});