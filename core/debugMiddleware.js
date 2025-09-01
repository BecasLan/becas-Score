/**
 * Debug Middleware - Komut işleme sürecinde her adımı izler
 */
class DebugMiddleware {
  constructor(client, logger) {
    this.client = client;
    this.logger = logger;
    this.debugMode = true;
  }
  
  /**
   * Tüm komut işleme sürecini izler
   */
  setupCommandDebugging(eventBus) {
    // Orjinal emit metodunu saklayın
    const originalEmit = eventBus.emit;
    
    // Emit metodunu override edin
    eventBus.emit = function(event, ...args) {
      console.log(`[DEBUG] EventBus emitting: ${event}`);
      return originalEmit.call(this, event, ...args);
    };
    
    // Komut olayını yakalayın
    eventBus.on('command', async (commandData) => {
      console.log(`[DEBUG] Command received: ${commandData.userInput}`);
      
      try {
        // Komut öncesi loglama
        this.logger.debug(`Processing command: ${commandData.userInput}`);
        
        // Diğer işleyicilerin çalışmasına izin verin, bu sadece izleyici
        return false;
      } catch (error) {
        console.error('[DEBUG] Error in command debugging:', error);
        return false;
      }
    });
    
    // Komut tamamlandı olayını yakalayın
    eventBus.on('commandComplete', (data) => {
      console.log(`[DEBUG] Command completed: ${data.success ? 'SUCCESS' : 'FAILED'}`);
    });
    
    // Komut başarısız olayını yakalayın
    eventBus.on('commandError', (data) => {
      console.error(`[DEBUG] Command error: ${data.error.message}`);
      console.error(data.error);
    });
  }
}

module.exports = { DebugMiddleware };