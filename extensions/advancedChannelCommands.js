/**
 * Gelişmiş Kanal Komutları Extension
 */
class AdvancedChannelCommands {
  constructor(client, eventBus, logger) {
    this.client = client;
    this.eventBus = eventBus; 
    this.logger = logger;
    
    this.name = "AdvancedChannelCommands";
    this.description = "Gelişmiş kanal yönetim komutlarını ekler";
    
    this.logger.info('[AdvancedChannelCommands] Extension initialized');
    
    // Komut işleme
    if (this.eventBus && typeof this.eventBus.on === 'function') {
      this._registerListeners();
    } else {
      // Alternatif event dinleme mekanizması
      this.logger.info('[AdvancedChannelCommands] Using alternative event system');
      this._registerAlternativeListeners();
    }
  }
  
  /**
   * Event listener'ları kaydeder
   */
   _registerListeners() {
    // Event dinleme işlemleri...
    this.logger.info('[AdvancedChannelCommands] Registered standard listeners');
  
    // Kanal komutlarını dinle
    this.eventBus.on('command', async ({ message, userInput }) => {
      // Kanal oluşturma
      if (/kanal\s+(?:oluştur|yarat|ekle|create)/i.test(userInput)) {
        return await this._handleCreateChannelCommand(message, userInput);
      }
      
      // Kanal silme
      if (/kanal\s+(?:sil|kaldır|delete)/i.test(userInput)) {
        return await this._handleDeleteChannelCommand(message, userInput);
      }
      
      // Kanal düzenleme
      if (/kanal\s+(?:düzenle|edit)/i.test(userInput)) {
        return await this._handleEditChannelCommand(message, userInput);
      }
      
      // Kategori oluşturma
      if (/kategori\s+(?:oluştur|yarat|ekle|create)/i.test(userInput)) {
        return await this._handleCreateCategoryCommand(message, userInput);
      }
      
      return false;
    });
    
  }
   _registerAlternativeListeners() {
    // Direkt client events ile çalışma
    this.client.on('messageCreate', async (message) => {
      // Bot mesajlarını ve kendi mesajlarını yoksay
      if (message.author.bot || !message.guild) return;
      
      // Komutları yakala
      if (!message.content.includes('@' + this.client.user.username)) return;
      
      const userInput = message.content;
      
      // Kanal oluşturma
      if (/kanal\s+(?:oluştur|yarat|ekle|create)/i.test(userInput)) {
        await this._handleCreateChannelCommand(message, userInput);
      }
      // Kanal silme
      else if (/kanal\s+(?:sil|kaldır|delete)/i.test(userInput)) {
        await this._handleDeleteChannelCommand(message, userInput);
      }
      // Kanal düzenleme
      else if (/kanal\s+(?:düzenle|edit)/i.test(userInput)) {
        await this._handleEditChannelCommand(message, userInput);
      }
      // Kategori oluşturma
      else if (/kategori\s+(?:oluştur|yarat|ekle|create)/i.test(userInput)) {
        await this._handleCreateCategoryCommand(message, userInput);
      }
    });
    
    this.logger.info('[AdvancedChannelCommands] Registered alternative listeners');
  }
  /**
   * Kanal oluşturma komutunu işler
   */
  async _handleCreateChannelCommand(message, userInput) {
    try {
      // Yetki kontrolü
      if (!message.member.permissions.has('MANAGE_CHANNELS')) {
        await message.reply('❌ Bu komutu kullanma yetkiniz yok.');
        return true;
      }
      
      // Kanal adı analizi
      const nameMatch = userInput.match(/["']([^"']+)["']|(\S+)/i);
      if (!nameMatch) {
        await message.reply('❌ Lütfen oluşturulacak kanalın adını belirtin.');
        return true;
      }
      
      const channelName = (nameMatch[1] || nameMatch[2]).toLowerCase();
      
      // Kanal türü analizi
      let channelType = 'GUILD_TEXT'; // Varsayılan metin kanalı
      if (/ses|voice/i.test(userInput)) {
        channelType = 'GUILD_VOICE';
      } else if (/duyuru|announcement|news/i.test(userInput)) {
        channelType = 'GUILD_NEWS';
      } else if (/forum/i.test(userInput)) {
        channelType = 'GUILD_FORUM';
      }
      
      // Kategori analizi
      let parent = null;
      const categoryMatch = userInput.match(/(?:kategori|category):\s*["']?([^"']+)["']?/i);
      if (categoryMatch) {
        const categoryName = categoryMatch[1].toLowerCase();
        parent = message.guild.channels.cache.find(
          c => c.type === 'GUILD_CATEGORY' && c.name.toLowerCase() === categoryName
        );
      }
      
      // Kanal açıklaması
      let topic = null;
      const topicMatch = userInput.match(/(?:açıklama|konu|topic|description):\s*["']([^"']+)["']/i);
      if (topicMatch) {
        topic = topicMatch[1];
      }
      
      // NSFW kontrolü
      const nsfw = /nsfw/i.test(userInput);
      
      // Kanal oluştur
      const channelOptions = {
        type: channelType,
        topic: topic,
        nsfw: nsfw
      };
      
      if (parent) {
        channelOptions.parent = parent;
      }
      
      const newChannel = await message.guild.channels.create(channelName, channelOptions);
      
      // Başarı mesajı
      let successMsg = `✅ ${newChannel.toString()} kanalı oluşturuldu.`;
      if (parent) {
        successMsg += ` (Kategori: ${parent.name})`;
      }
      await message.reply(successMsg);
      
      return true;
    } catch (error) {
      this.logger.error('Create channel error:', error);
      await message.reply('❌ Kanal oluşturulurken bir hata oluştu.');
      return true;
    }
  }
  
  /**
   * Kanal silme komutunu işler
   */
  async _handleDeleteChannelCommand(message, userInput) {
    try {
      // Yetki kontrolü
      if (!message.member.permissions.has('MANAGE_CHANNELS')) {
        await message.reply('❌ Bu komutu kullanma yetkiniz yok.');
        return true;
      }
      
      // Kanal analizi
      let targetChannel = null;
      
      // Etiketlenen kanal kontrolü
      if (message.mentions.channels.size > 0) {
        targetChannel = message.mentions.channels.first();
      } else {
        // Kanal adı kontrolü
        const nameMatch = userInput.match(/["']([^"']+)["']|(\S+)$/i);
        if (nameMatch) {
          const channelName = (nameMatch[1] || nameMatch[2]).toLowerCase();
          targetChannel = message.guild.channels.cache.find(
            c => c.name.toLowerCase() === channelName
          );
        }
      }
      
      if (!targetChannel) {
        await message.reply('❌ Silinecek kanalı belirtin veya etiketleyin.');
        return true;
      }
      
      // Mevcut kanalı silme durumu kontrolü
      if (targetChannel.id === message.channel.id) {
        await message.reply('⚠️ Dikkat: Şu an içinde bulunduğunuz kanalı silmeye çalışıyorsunuz.');
        
        // Onay sorgusu
        const filter = m => m.author.id === message.author.id;
        await message.reply('Devam etmek istiyorsanız "onaylıyorum" yazın. İptal etmek için 30 saniye bekleyin.');
        
        try {
          const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
          const response = collected.first();
          
          if (response.content.toLowerCase() !== 'onaylıyorum') {
            await message.reply('❌ Kanal silme işlemi iptal edildi.');
            return true;
          }
        } catch (err) {
          await message.reply('❌ Zaman aşımı: Kanal silme işlemi iptal edildi.');
          return true;
        }
      }
      
      // Kanalı sil
      const channelName = targetChannel.name;
      await targetChannel.delete();
      
      // Başarı mesajı (eğer silinen kanal, mevcut kanal değilse)
      if (targetChannel.id !== message.channel.id) {
        await message.reply(`✅ "${channelName}" kanalı başarıyla silindi.`);
      }
      
      return true;
    } catch (error) {
      this.logger.error('Delete channel error:', error);
      await message.reply('❌ Kanal silinirken bir hata oluştu.');
      return true;
    }
  }
  
  /**
   * Kanal düzenleme komutunu işler
   */
  async _handleEditChannelCommand(message, userInput) {
    try {
      // Yetki kontrolü
      if (!message.member.permissions.has('MANAGE_CHANNELS')) {
        await message.reply('❌ Bu komutu kullanma yetkiniz yok.');
        return true;
      }
      
      // Kanal analizi
      let targetChannel = null;
      
      // Etiketlenen kanal kontrolü
      if (message.mentions.channels.size > 0) {
        targetChannel = message.mentions.channels.first();
      } else {
        await message.reply('❌ Düzenlenecek kanalı etiketlemeniz gerekiyor.');
        return true;
      }
      
      // Değiştirilecek özellikleri belirle
      const updates = {};
      
      // İsim değişikliği
      const nameMatch = userInput.match(/(?:isim|name|ad):\s*["']([^"']+)["']/i);
      if (nameMatch) {
        updates.name = nameMatch[1];
      }
      
      // Konu değişikliği
      const topicMatch = userInput.match(/(?:konu|açıklama|topic|description):\s*["']([^"']+)["']/i);
      if (topicMatch) {
        updates.topic = topicMatch[1];
      }
      
      // NSFW değişikliği
      if (/nsfw:\s*(evet|hayır|yes|no|true|false|açık|kapalı|on|off)/i.test(userInput)) {
        const nsfwValue = userInput.match(/nsfw:\s*(evet|hayır|yes|no|true|false|açık|kapalı|on|off)/i)[1].toLowerCase();
        updates.nsfw = ['evet', 'yes', 'true', 'açık', 'on'].includes(nsfwValue);
      }
      
      // Yavaş mod değişikliği
      const slowmodeMatch = userInput.match(/(?:yavaş\s*mod|slow\s*mode|rate\s*limit):\s*(\d+)/i);
      if (slowmodeMatch) {
        updates.rateLimitPerUser = parseInt(slowmodeMatch[1]);
      }
      
      // Kategori değişikliği
      const categoryMatch = userInput.match(/(?:kategori|category):\s*["']([^"']+)["']/i);
      if (categoryMatch) {
        const categoryName = categoryMatch[1].toLowerCase();
        const category = message.guild.channels.cache.find(
          c => c.type === 'GUILD_CATEGORY' && c.name.toLowerCase() === categoryName
        );
        
        if (category) {
          updates.parent = category.id;
        } else {
          await message.reply(`⚠️ "${categoryName}" adında bir kategori bulunamadı.`);
        }
      }
      
      // En az bir değişiklik olmalı
      if (Object.keys(updates).length === 0) {
        await message.reply('❌ Değiştirilecek en az bir özellik belirtmelisiniz (isim, konu, nsfw, yavaş mod, kategori).');
        return true;
      }
      
      // Kanalı güncelle
      await targetChannel.edit(updates);
      
      // Başarı mesajı
      await message.reply(`✅ ${targetChannel.toString()} kanalı başarıyla güncellendi.`);
      
      return true;
    } catch (error) {
      this.logger.error('Edit channel error:', error);
      await message.reply('❌ Kanal düzenlenirken bir hata oluştu.');
      return true;
    }
  }
  
  /**
   * Kategori oluşturma komutunu işler
   */
  async _handleCreateCategoryCommand(message, userInput) {
    try {
      // Yetki kontrolü
      if (!message.member.permissions.has('MANAGE_CHANNELS')) {
        await message.reply('❌ Bu komutu kullanma yetkiniz yok.');
        return true;
      }
      
      // Kategori adı analizi
      const nameMatch = userInput.match(/["']([^"']+)["']|(\S+)$/i);
      if (!nameMatch) {
        await message.reply('❌ Lütfen oluşturulacak kategorinin adını belirtin.');
        return true;
      }
      
      const categoryName = nameMatch[1] || nameMatch[2];
      
      // Kategori oluştur
      const newCategory = await message.guild.channels.create(categoryName, {
        type: 'GUILD_CATEGORY'
      });
      
      // Başarı mesajı
      await message.reply(`✅ "${newCategory.name}" kategorisi başarıyla oluşturuldu.`);
      
      return true;
    } catch (error) {
      this.logger.error('Create category error:', error);
      await message.reply('❌ Kategori oluşturulurken bir hata oluştu.');
      return true;
    }
  }
}

module.exports = {
  name: 'AdvancedChannelCommands',
  description: 'Gelişmiş kanal yönetim komutlarını ekler',
  version: '1.0',
  initialize: async (client, eventBus, logger) => {
    return new AdvancedChannelCommands(client, eventBus, logger);
  }
};