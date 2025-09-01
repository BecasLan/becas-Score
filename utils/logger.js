/**
 * Logger utility for BecasBot
 * @module utils/logger
 */
const winston = require('winston');
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'becas-bot' },
  transports: []
});

// Add file transport if enabled
if (process.env.LOG_TO_FILE === 'true') {
  logger.add(new winston.transports.File({ 
    filename: process.env.LOG_FILE_PATH || './logs/becas.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

// Add console transport if enabled
if (process.env.LOG_TO_CONSOLE === 'true') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`)
    )
  }));
}

// Add missing methods to ensure compatibility
logger.fatal = logger.fatal || function(message, meta) {
  logger.error(`[FATAL] ${message}`, meta);
};

module.exports = logger;