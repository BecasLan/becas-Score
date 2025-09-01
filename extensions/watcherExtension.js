/**
 * Watcher Extension - Discord mesajlarını izleyen eklenti
 */
const { EmbedBuilder } = require('discord.js');

class WatcherExtension {
  constructor(client, eventBus, logger) {
    this.client = client;
    this.eventBus = eventBus;
    this.logger = logger;
    this.activeWatchers = new Map();
    this.results = new Map();
  }

  /**
   * İzleme komutlarını işler
   * @param {Message} message - Discord mesajı
   * @param {string} command - Kullanıcının komutu
   * @returns {Promise<boolean>} - Komut işlendiyse true
   */
  async handleCommand(message, command) {
    if (command.toLowerCase().includes('watch') && 
        command.toLowerCase().includes('message')) {
      
      // Hedef kullanıcıyı bul
      const userId = message.mentions.users.first()?.id;
      if (!userId) {
        await message.reply("İzlenecek kullanıcı bulunamadı. Bir kullanıcı etiketleyin.");
        return true;
      }
      
      // Matematiksel formül var mı kontrol et
      const hasFormula = command.includes('calculate') || 
                          command.includes('character count') ||
                          command.includes('word count');
      
      if (hasFormula) {
        await this.setupWatcher(message, userId, command);
        return true;
      }
    }
    return false;
  }

  /**
   * Yeni bir izleme görevi oluşturur
   * @param {Message} message - Discord mesajı
   * @param {string} userId - İzlenecek kullanıcı ID'si
   * @param {string} command - Komut metni
   */
  async setupWatcher(message, userId, command) {
    const watcherId = `watch_${userId}_${Date.now()}`;
    const authorId = message.author.id;
    const channelId = message.channel.id;
    
    // Sonuç eşik değerlerini kontrol et
    const dmThreshold = command.match(/result\s*>\s*(\d+),\s*DM/i);
    const timeoutThreshold = command.match(/result\s*>\s*(\d+),\s*timeout/i);
    
    const dmLimit = dmThreshold ? parseInt(dmThreshold[1]) : 0;
    const timeoutLimit = timeoutThreshold ? parseInt(timeoutThreshold[1]) : 0;
    
    // Watcher nesnesi oluştur
    const watcher = {
      id: watcherId,
      userId: userId,
      authorId: authorId,
      channelId: channelId,
      guildId: message.guild.id,
      dmLimit: dmLimit,
      timeoutLimit: timeoutLimit,
      results: [],
      startTime: Date.now(),
      isHourlyEnabled: command.toLowerCase().includes('every hour')
    };
    
    // Message event listener oluştur
    const messageListener = async (newMessage) => {
      if (newMessage.author.id !== userId) return;
      
      try {
        // Mesaj analizi yap
        const charCount = newMessage.content.length;
        const wordCount = newMessage.content.split(/\s+/).filter(Boolean).length;
        
        // Formül: (karakter sayısı × 2) + (kelime sayısı^2)
        const result = (charCount * 2) + Math.pow(wordCount, 2);
        
        // Sonucu kaydet
        watcher.results.push({
          messageId: newMessage.id,
          result: result,
          timestamp: Date.now()
        });
        
        // Eşik kontrolleri
        if (result > watcher.timeoutLimit && watcher.timeoutLimit > 0) {
          const timeoutDuration = Math.floor(result / 10);
          const member = await message.guild.members.fetch(userId);
          await member.timeout(timeoutDuration * 1000, `Matematiksel limit aşıldı: ${result}`);
          await message.channel.send(`⚠️ Matematiksel limit aşıldı: ${result}. <@${userId}> ${timeoutDuration} saniye susturuldu.`);
        }
        else if (result > watcher.dmLimit && watcher.dmLimit > 0) {
          const author = await this.client.users.fetch(authorId);
          author.send(`📊 <@${userId}> kullanıcısının mesajı için sonuç: ${result}`).catch(() => {});
        }
        
        this.logger.info(`Watcher ${watcherId} result for message ${newMessage.id}: ${result}`);
      } catch (error) {
        this.logger.error(`Watcher error: ${error.message}`);
      }
    };
    
    // Hourly embed
    let hourlyInterval = null;
    if (watcher.isHourlyEnabled) {
      hourlyInterval = setInterval(async () => {
        try {
          if (watcher.results.length === 0) return;
          
          // Ortalama hesapla
          const sum = watcher.results.reduce((acc, item) => acc + item.result, 0);
          const average = Math.round((sum / watcher.results.length) * 100) / 100;
          
          // Embed oluştur
          const embed = new EmbedBuilder()
            .setTitle("Hourly Analysis")
            .setColor('#0099ff')
            .setDescription(`<@${userId}> için son saat analizi`)
            .addFields(
              { name: 'Mesaj Sayısı', value: `${watcher.results.length}`, inline: true },
              { name: 'Ortalama Sonuç', value: `${average}`, inline: true },
              { name: 'En Yüksek Sonuç', value: `${Math.max(...watcher.results.map(r => r.result))}`, inline: true }
            )
            .setTimestamp();
          
          // Genel kanala gönder
          const generalChannel = message.guild.channels.cache.find(
            ch => ch.name === 'general' || ch.name === 'genel'
          );
          
          if (generalChannel) {
            await generalChannel.send({ embeds: [embed] });
          } else {
            await message.channel.send({ embeds: [embed] });
          }
          
          // Sonuçları sıfırla
          watcher.results = [];
        } catch (error) {
          this.logger.error(`Hourly report error: ${error.message}`);
        }
      }, 60 * 60 * 1000); // Her saat (60 * 60 * 1000 ms)
    }
    
    // 24 saat sonra durdur
    const duration = 24 * 60 * 60 * 1000; // 24 saat
    const timeout = setTimeout(() => {
      this.stopWatcher(watcherId);
      message.channel.send(`✅ <@${userId}> için izleme 24 saat sonunda tamamlandı.`).catch(() => {});
    }, duration);
    
    // Listener'ı kaydet
    this.client.on('messageCreate', messageListener);
    
    // Watcher'ı depola
    this.activeWatchers.set(watcherId, {
      watcher,
      messageListener,
      hourlyInterval,
      timeout
    });
    
    await message.reply(`✅ <@${userId}> kullanıcısı için mesaj izleme başlatıldı! 24 saat boyunca aktif olacak.`);
    return true;
  }
  
  /**
   * Bir izleme görevini durdurur
   * @param {string} watcherId - İzleme görevi ID'si
   */
  stopWatcher(watcherId) {
    const watcherData = this.activeWatchers.get(watcherId);
    if (!watcherData) return;
    
    // Event listener'ı kaldır
    this.client.removeListener('messageCreate', watcherData.messageListener);
    
    // Interval ve timeout'u temizle
    if (watcherData.hourlyInterval) {
      clearInterval(watcherData.hourlyInterval);
    }
    
    if (watcherData.timeout) {
      clearTimeout(watcherData.timeout);
    }
    
    // Kaydı sil
    this.activeWatchers.delete(watcherId);
    this.logger.info(`Watcher ${watcherId} stopped`);
  }
}

module.exports = WatcherExtension;