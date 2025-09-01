/**
 * Mesaj işleme komutları
 */
class MessageCommands {
  constructor(client, logger) {
    this.client = client;
    this.logger = logger;
  }
  
  /**
   * Son X mesajdaki toplam karakter sayısını hesapla
   */
  async countCharacters(message, params) {
    try {
      const messageCount = params.messageCount || 10;
      
      // Mesajları getir
      const messages = await message.channel.messages.fetch({ limit: messageCount + 1 });
      
      // Mesajı gönderen kullanıcının mesajlarını filtrele (komutu gönderen kullanıcı)
      const userMessages = messages.filter(msg => 
        msg.author.id === message.author.id && msg.id !== message.id
      );
      
      // Karakter sayısını hesapla
      let totalCharacters = 0;
      let processedMessages = 0;
      
      userMessages.forEach(msg => {
        if (processedMessages < messageCount) {
          totalCharacters += msg.content.length;
          processedMessages++;
        }
      });
      
      // Sonucu gönder
      await message.reply(`Son ${processedMessages} mesajınızda toplam ${totalCharacters} karakter bulunuyor.`);
      
      return {
        success: true,
        characterCount: totalCharacters,
        messageCount: processedMessages
      };
    } catch (error) {
      this.logger.error("Character counting failed", error);
      await message.reply(`❌ Hata: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { MessageCommands };