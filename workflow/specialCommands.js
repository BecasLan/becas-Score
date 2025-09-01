/**
 * Special command handler for built-in commands
 */
class SpecialCommandHandler {
  constructor(client, logger) {
    this.client = client;
    this.logger = logger;
  }
  
  /**
   * Handle special commands
   * @param {Message} message - Discord message
   * @param {string} command - Command text
   * @returns {Promise<boolean>} - Whether command was handled
   */
  async handleCommand(message, command) {
    const lowerCmd = command.toLowerCase().trim();
    
    // Handle ping command
    if (lowerCmd === 'ping') {
      await this.handlePing(message);
      return true;
    }
    
    // Handle help command
    if (lowerCmd === 'help' || lowerCmd === 'yardım') {
      await this.handleHelp(message);
      return true;
    }
    
    // Handle info command
    if (lowerCmd === 'info' || lowerCmd === 'bilgi') {
      await this.handleInfo(message);
      return true;
    }
    
    // No special command matched
    return false;
  }
  
  /**
   * Handle ping command
   * @param {Message} message - Discord message
   */
  async handlePing(message) {
    try {
      const sent = await message.reply('Pinging...');
      const latency = sent.createdTimestamp - message.createdTimestamp;
      
      await sent.edit(`Pong! 🏓\nBot Gecikmesi: ${latency}ms\nAPI Gecikmesi: ${Math.round(this.client.ws.ping)}ms`);
    } catch (error) {
      this.logger.error('Error in ping command:', error);
      await message.reply('Ping ölçülürken bir hata oluştu.').catch(() => {});
    }
  }
  async handleCommand(message, input) {
    // Harunbaba timeout örneği için
    if (input.toLowerCase().includes('harunbaba') && 
        input.toLowerCase().includes('timeout') && 
        input.match(/\d\s*\+\s*\d/)) {
      
      // Toplamı hesapla
      let total = 0;
      const matches = input.match(/(\d+)\s*\+\s*(\d+)\s*\+\s*(\d+)/);
      
      if (matches) {
        total = parseInt(matches[1]) + parseInt(matches[2]) + parseInt(matches[3]);
      }
      
      // Hedef kullanıcı
      const userId = message.mentions.users.first()?.id;
      
      if (!userId) {
        await message.reply("❌ Timeout vermek için bir kullanıcı etiketlemelisiniz.");
        return true;
      }
      
      // Mesajları gönder
      await message.channel.send("harunbaba 1");
      await message.channel.send("harunbaba 2");
      await message.channel.send("harunbaba 3");
      
      // Timeout ver
      try {
        const member = await message.guild.members.fetch(userId);
        await member.timeout(total * 60 * 1000, "Komutla verilen timeout");
        await message.reply(`✅ <@${userId}> kullanıcısı toplam ${total} dakika susturuldu.`);
      } catch (error) {
        await message.reply(`❌ Timeout uygulanırken hata: ${error.message}`);
      }
      
      return true; // Komutu işlediğimizi belirt
    }
    
    return false; // Komutu işlemedik
  }
  /**
   * Handle help command
   * @param {Message} message - Discord message
   */
  async handleHelp(message) {
    try {
      const prefix = 'becas'; // You might want to get this dynamically
      
      const helpEmbed = {
        title: '📚 BecasBot Yardım',
        description: 'BecasBot, LLM tabanlı akıllı Discord moderasyon botudur.',
        color: 0x3498db,
        fields: [
          {
            name: '🛠️ Temel Komutlar',
            value: [
              `\`${prefix} ping\` - Bot ve API gecikmesini gösterir`,
              `\`${prefix} help\` - Bu yardım mesajını gösterir`,
              `\`${prefix} info\` - Bot hakkında bilgi verir`
            ].join('\n')
          },
          {
            name: '👮 Moderasyon Komutları',
            value: [
              `\`${prefix} timeout @kullanıcı 10 dakika\` - Kullanıcıyı belirli süre susturur`,
              `\`${prefix} purge 10\` - Son 10 mesajı siler`,
              `\`${prefix} slowmode 5 seconds\` - Yavaş modu ayarlar`
            ].join('\n')
          },
          {
            name: '🤖 LLM Modu',
            value: 'İstediğin işlemi doğal dilde söyleyebilirsin ve bot anlamaya çalışacaktır.'
          }
        ],
        footer: {
          text: 'BecasBot v3.0 • LLM Enhanced'
        }
      };
      
      await message.reply({ embeds: [helpEmbed] });
    } catch (error) {
      this.logger.error('Error in help command:', error);
      await message.reply('Yardım gösterilirken bir hata oluştu.').catch(() => {});
    }
  }
  
  /**
   * Handle info command
   * @param {Message} message - Discord message
   */
  async handleInfo(message) {
    try {
      const botUser = this.client.user;
      const serverCount = this.client.guilds.cache.size;
      const uptime = this._formatUptime(this.client.uptime);
      
      const infoEmbed = {
        title: `${botUser.username} Bilgi`,
        description: 'LLM tabanlı akıllı Discord moderasyon botu',
        color: 0x2ecc71,
        thumbnail: {
          url: botUser.displayAvatarURL({ dynamic: true })
        },
        fields: [
          {
            name: '🔧 Durum',
            value: [
              `Sunucu Sayısı: ${serverCount}`,
              `Çalışma Süresi: ${uptime}`,
              `Discord.js: v14`,
              `LLM: Llama3`
            ].join('\n'),
            inline: true
          },
          {
            name: '💻 Teknik Bilgiler',
            value: [
              `Node.js: ${process.version}`,
              `Platform: ${process.platform}`,
              `Hafıza: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
            ].join('\n'),
            inline: true
          }
        ],
        footer: {
          text: 'BecasBot v3.0 • LLM Enhanced'
        },
        timestamp: new Date()
      };
      
      await message.reply({ embeds: [infoEmbed] });
    } catch (error) {
      this.logger.error('Error in info command:', error);
      await message.reply('Bilgi gösterilirken bir hata oluştu.').catch(() => {});
    }
  }
  
  /**
   * Format uptime in a readable format
   * @param {number} ms - Uptime in milliseconds
   * @returns {string} - Formatted uptime
   */
  _formatUptime(ms) {
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor(ms / 3600000) % 24;
    const minutes = Math.floor(ms / 60000) % 60;
    const seconds = Math.floor(ms / 1000) % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days} gün`);
    if (hours > 0) parts.push(`${hours} saat`);
    if (minutes > 0) parts.push(`${minutes} dakika`);
    if (seconds > 0) parts.push(`${seconds} saniye`);
    
    return parts.join(', ');
  }
}

module.exports = { SpecialCommandHandler };