/**
 * Extension yükleyici modülü
 */
const fs = require('fs');
const path = require('path');

/**
 * Extension'ları yükler
 * @param {Client} client - Discord client
 * @param {EventEmitter} eventBus - Event bus
 * @param {Object} logger - Logger
 * @returns {Promise<Object>} - Yüklenen extension'lar
 */
async function loadExtensions(client, eventBus, logger) {
  const extensions = {};
  const extensionsDir = path.resolve('./extensions');
  
  logger.info(`Extensions directory: ${extensionsDir}`);
  
  try {
    const files = fs.readdirSync(extensionsDir);
    
    for (const file of files) {
      if (file.endsWith('.js') && file !== 'extensionLoader.js') {
        try {
          const extensionPath = path.join(extensionsDir, file);
          logger.info(`Loading extension from ${extensionPath}`);
          
          // Require ile extension'ı yükle
          let Extension = require(extensionPath);
          
          // Nesne formatı kontrolü
          if (typeof Extension === 'object' && Extension.initialize) {
            try {
              logger.info(`Initializing extension: ${Extension.name}`);
              const instance = await Extension.initialize(client, eventBus, logger);
              extensions[Extension.name] = instance;
              logger.info(`Loaded extension: ${Extension.name} v${Extension.version || '1.0'}`);
            } catch (error) {
              logger.error(`Error loading extension ${file}:`, error);
            }
          }
          // Constructor kontrolü
          else if (typeof Extension === 'function') {
            logger.info(`Loading legacy extension: ${file}`);
            try {
              const instance = new Extension(client, eventBus, logger);
              const name = instance.name || file.replace('.js', '');
              extensions[name] = instance;
              logger.info(`Loaded legacy extension: ${name}`);
            } catch (error) {
              logger.error(`Error loading extension ${file}:`, error);
            }
          }
          else {
            logger.warn(`Invalid extension format: ${file}`);
          }
        } catch (error) {
          logger.error(`Error loading extension ${file}:`, error);
        }
      }
    }
    
    return extensions;
  } catch (error) {
    logger.error('Failed to load extensions:', error);
    throw error;
  }
}

module.exports = { loadExtensions };