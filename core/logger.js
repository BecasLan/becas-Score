/**
 * Logger system
 */
const winston = require('winston');
const { format, transports } = winston;
const path = require('path');
const fs = require('fs');

function setupLogger(config) {
  // Create logs directory if it doesn't exist
  if (config.FILE_ENABLED) {
    const logDir = path.dirname(config.FILE_PATH);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }
  
  // Define log format
  const logFormat = format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ level, message, timestamp, ...rest }) => {
      const restString = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
      return `${timestamp} [${level.toUpperCase()}]: ${message}${restString}`;
    })
  );
  
  // Define transports
  const logTransports = [];
  
  if (config.CONSOLE_ENABLED) {
    logTransports.push(
      new transports.Console({
        format: format.combine(
          format.colorize(),
          logFormat
        )
      })
    );
  }
  
  if (config.FILE_ENABLED) {
    logTransports.push(
      new transports.File({
        filename: config.FILE_PATH,
        format: logFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        tailable: true
      })
    );
  }
  
  // Create logger
  const logger = winston.createLogger({
    level: config.LEVEL || 'info',
    levels: winston.config.npm.levels,
    format: logFormat,
    transports: logTransports
  });
  
  return logger;
}

module.exports = { setupLogger };