const { IntentAnalyzer } = require('./intentAnalyzer');
const { MessageCommands } = require('../commands/messageCommands');

class CommandProcessor {
  constructor(client, config, logger) {
    this.client = client;
    this.config = config;
    this.logger = logger;
    
    // Alt sistemleri başlat
    this.intentAnalyzer = new IntentAnalyzer(config, logger);
    this.messageCommands = new MessageCommands(client, logger);
  }
  
  /**
   * Kullanıcı komutunu işle
   */
  async processCommand(message, userInput) {
    try {
      // Komutu analiz et
      const intent = await this.intentAnalyzer.analyzeIntent(userInput);
      this.logger.info(`Command intent: ${intent.intent} (${intent.confidence})`);
      
      // Intent'e göre doğru işleyiciye yönlendir
      switch (intent.intent) {
        case "countCharacters":
          return await this.messageCommands.countCharacters(message, intent.params);
        
        // Diğer intent'leri ekleyin...
        
        default:
          await message.reply("Bu komutu anlayamadım. Daha açık ifade edebilir misiniz?");
          return { success: false, error: "Unknown command" };
      }
    } catch (error) {
      this.logger.error("Command processing failed", error);
      await message.reply(`❌ Komut işlenirken bir hata oluştu: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { CommandProcessor };