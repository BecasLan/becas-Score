/**
 * Moderasyon İşleyici Extension
 * Discord sunucusunda moderasyon komutlarını işler
 */

class ModerationHandler {
  constructor(client, eventBus, logger) {
    this.client = client;
    this.eventBus = eventBus;
    this.logger = logger;
    
    this.name = "ModerationHandler";
    this.description = "Discord sunucusunda moderasyon komutlarını işler";
    
    // Moderasyon kayıtları için veritabanı
    this.moderationLogs = new Map();
    
    this.logger.info('[ModerationHandler] Extension initialized');
    
    // Komut işleme
    if (this.eventBus && typeof this.eventBus.on === 'function') {
      this._registerListeners();
    } else {
      // Alternatif event dinleme mekanizması
      this.logger.info('[ModerationHandler] Using alternative event system');
      this._registerAlternativeListeners();
    }
  }
  /**
   * Event listener'ları kaydeder
   */
  _registerListeners() {
    // Moderasyon komutlarını dinle
    this.eventBus.on('command', async (data) => {
      const { message, userInput } = data;
      
      // Timeout/susturma komutu
      if (/timeout|sustur|mute/i.test(userInput)) {
        return await this._handleTimeoutCommand(message, userInput);
      }
      
      // Ban komutu
      if (/ban|yasakla/i.test(userInput)) {
        return await this._handleBanCommand(message, userInput);
      }
      
      // Kick komutu
      if (/kick|at/i.test(userInput)) {
        return await this._handleKickCommand(message, userInput);
      }
      
      // Uyarı komutu
      if (/warn|uyar/i.test(userInput)) {
        return await this._handleWarnCommand(message, userInput);
      }
      
      // Moderasyon loglarını görüntüleme
      if (/modlogs|moderasyon\s+log|mod\s+log/i.test(userInput)) {
        return await this._showModLogs(message, userInput);
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
      
      // Timeout/susturma komutu
      if (/timeout|sustur|mute/i.test(userInput)) {
        await this._handleTimeoutCommand(message, userInput);
      }
      // Ban komutu
      else if (/ban|yasakla/i.test(userInput)) {
        await this._handleBanCommand(message, userInput);
      }
      // Kick komutu
      else if (/kick|at/i.test(userInput)) {
        await this._handleKickCommand(message, userInput);
      }
      // Uyarı komutu
      else if (/warn|uyar/i.test(userInput)) {
        await this._handleWarnCommand(message, userInput);
      }
      // Moderasyon loglarını görüntüleme
      else if (/modlogs|moderasyon\s+log|mod\s+log/i.test(userInput)) {
        await this._showModLogs(message, userInput);
      }
    });
    
    this.logger.info('[ModerationHandler] Registered alternative listeners');
  }
  
  /**
   * Timeout/susturma komutunu işler
   * @param {Message} message - Discord mesajı
   * @param {string} userInput - Kullanıcı girdisi
   */
  async _handleTimeoutCommand(message, userInput) {
    try {
      // Yetki kontrolü
      if (!message.member.permissions.has('MODERATE_MEMBERS')) {
        await message.reply('❌ Bu komutu kullanma yetkiniz yok.');
        return true;
      }
      
      // Kullanıcı ve süre analizi
      const mentionedUser = message.mentions.members?.first();
      if (!mentionedUser) {
        await message.reply('❌ Susturmak istediğiniz kullanıcıyı etiketlemelisiniz.');
        return true;
      }
      
      // Süre analizi
      const timeMatch = userInput.match(/(\d+)\s*(dakika|dk|minute|min|saat|hour|gün|day)/i);
      if (!timeMatch) {
        await message.reply('❌ Geçerli bir süre belirtmelisiniz (örn: 10 dakika, 1 saat, 3 gün).');
        return true;
      }
      
      const timeValue = parseInt(timeMatch[1]);
      const timeUnit = timeMatch[2].toLowerCase();
      
      let durationMs = 0;
      if (/dakika|dk|minute|min/.test(timeUnit)) {
        durationMs = timeValue * 60 * 1000;
      } else if (/saat|hour/.test(timeUnit)) {
        durationMs = timeValue * 60 * 60 * 1000;
      } else if (/gün|day/.test(timeUnit)) {
        durationMs = timeValue * 24 * 60 * 60 * 1000;
      }
      
      // Süre kontrolü
      if (durationMs <= 0 || durationMs > 28 * 24 * 60 * 60 * 1000) {
        await message.reply('❌ Susturma süresi 1 dakika ile 28 gün arasında olmalıdır.');
        return true;
      }
      
      // Sebep analizi
      let reason = 'Sebep belirtilmedi';
      const reasonMatch = userInput.match(/(?:sebep|reason|için):\s*["']?(.*?)["']?(?:\s|$)/i);
      if (reasonMatch) {
        reason = reasonMatch[1].trim();
      }
      
      // Timeout uygula
      await mentionedUser.timeout(durationMs, reason);
      
      // Moderasyon loguna kaydet
      this._logModeration('timeout', message.author.id, mentionedUser.id, reason, durationMs);
      
      // Kullanıcıya bildir
      const formattedDuration = this._formatDuration(durationMs);
      await message.reply(`✅ ${mentionedUser.toString()} kullanıcısı ${formattedDuration} süreyle susturuldu. Sebep: ${reason}`);
      
      return true;
    } catch (error) {
      this.logger.error('Timeout command error:', error);
      await message.reply('❌ Susturma işlemi sırasında bir hata oluştu.');
      return true;
    }
  }
  
  /**
   * Ban komutunu işler
   * @param {Message} message - Discord mesajı
   * @param {string} userInput - Kullanıcı girdisi
   */
  async _handleBanCommand(message, userInput) {
    try {
      // Yetki kontrolü
      if (!message.member.permissions.has('BAN_MEMBERS')) {
        await message.reply('❌ Bu komutu kullanma yetkiniz yok.');
        return true;
      }
      
      // Kullanıcı ve süre analizi
      const mentionedUser = message.mentions.members?.first();
      if (!mentionedUser) {
        await message.reply('❌ Yasaklamak istediğiniz kullanıcıyı etiketlemelisiniz.');
        return true;
      }
      
      // Sebep analizi
      let reason = 'Sebep belirtilmedi';
      const reasonMatch = userInput.match(/(?:sebep|reason|için):\s*["']?(.*?)["']?(?:\s|$)/i);
      if (reasonMatch) {
        reason = reasonMatch[1].trim();
      }
      
      // Mesaj silme günü analizi (varsa)
      let deleteMessageDays = 0;
      const deleteMatch = userInput.match(/(\d+)\s*(?:gün|day)\s*(?:mesaj|message)/i);
      if (deleteMatch) {
        deleteMessageDays = Math.min(7, parseInt(deleteMatch[1]));
      }
      
      // Ban uygula
      await mentionedUser.ban({ 
        reason: reason,
        days: deleteMessageDays
      });
      
      // Moderasyon loguna kaydet
      this._logModeration('ban', message.author.id, mentionedUser.id, reason);
      
      // Kullanıcıya bildir
      await message.reply(`✅ ${mentionedUser.toString()} kullanıcısı yasaklandı. Sebep: ${reason}`);
      
      return true;
    } catch (error) {
      this.logger.error('Ban command error:', error);
      await message.reply('❌ Yasaklama işlemi sırasında bir hata oluştu.');
      return true;
    }
  }
  
  /**
   * Kick komutunu işler
   * @param {Message} message - Discord mesajı
   * @param {string} userInput - Kullanıcı girdisi
   */
  async _handleKickCommand(message, userInput) {
    try {
      // Yetki kontrolü
      if (!message.member.permissions.has('KICK_MEMBERS')) {
        await message.reply('❌ Bu komutu kullanma yetkiniz yok.');
        return true;
      }
      
      // Kullanıcı analizi
      const mentionedUser = message.mentions.members?.first();
      if (!mentionedUser) {
        await message.reply('❌ Sunucudan atmak istediğiniz kullanıcıyı etiketlemelisiniz.');
        return true;
      }
      
      // Sebep analizi
      let reason = 'Sebep belirtilmedi';
      const reasonMatch = userInput.match(/(?:sebep|reason|için):\s*["']?(.*?)["']?(?:\s|$)/i);
      if (reasonMatch) {
        reason = reasonMatch[1].trim();
      }
      
      // Kick uygula
      await mentionedUser.kick(reason);
      
      // Moderasyon loguna kaydet
      this._logModeration('kick', message.author.id, mentionedUser.id, reason);
      
      // Kullanıcıya bildir
      await message.reply(`✅ ${mentionedUser.toString()} kullanıcısı sunucudan atıldı. Sebep: ${reason}`);
      
      return true;
    } catch (error) {
      this.logger.error('Kick command error:', error);
      await message.reply('❌ Sunucudan atma işlemi sırasında bir hata oluştu.');
      return true;
    }
  }
  
  /**
   * Uyarı komutunu işler
   * @param {Message} message - Discord mesajı
   * @param {string} userInput - Kullanıcı girdisi
   */
  async _handleWarnCommand(message, userInput) {
    try {
      // Yetki kontrolü
      if (!message.member.permissions.has('MODERATE_MEMBERS')) {
        await message.reply('❌ Bu komutu kullanma yetkiniz yok.');
        return true;
      }
      
      // Kullanıcı analizi
      const mentionedUser = message.mentions.members?.first();
      if (!mentionedUser) {
        await message.reply('❌ Uyarmak istediğiniz kullanıcıyı etiketlemelisiniz.');
        return true;
      }
      
      // Sebep analizi
      let reason = 'Sebep belirtilmedi';
      const reasonMatch = userInput.match(/(?:sebep|reason|için):\s*["']?(.*?)["']?(?:\s|$)/i);
      if (reasonMatch) {
        reason = reasonMatch[1].trim();
      }
      
      // Moderasyon loguna kaydet
      this._logModeration('warn', message.author.id, mentionedUser.id, reason);
      
      // Kullanıcıya bildir
      await message.reply(`⚠️ ${mentionedUser.toString()} kullanıcısı uyarıldı. Sebep: ${reason}`);
      
      // Kullanıcıya DM gönder
      try {
        await mentionedUser.send(`⚠️ **${message.guild.name}** sunucusunda uyarı aldınız!\n**Sebep:** ${reason}\n**Moderatör:** ${message.author.tag}`);
      } catch (dmError) {
        this.logger.warn('Could not send DM to warned user');
      }
      
      return true;
    } catch (error) {
      this.logger.error('Warn command error:', error);
      await message.reply('❌ Uyarı işlemi sırasında bir hata oluştu.');
      return true;
    }
  }
  
  /**
   * Moderasyon loglarını gösterir
   * @param {Message} message - Discord mesajı
   * @param {string} userInput - Kullanıcı girdisi
   */
  async _showModLogs(message, userInput) {
    try {
      // Yetki kontrolü
      if (!message.member.permissions.has('MODERATE_MEMBERS')) {
        await message.reply('❌ Bu komutu kullanma yetkiniz yok.');
        return true;
      }
      
      const guildId = message.guild.id;
      
      // Kullanıcı filtreleme
      let targetUserId = null;
      if (message.mentions.users.size > 0) {
        targetUserId = message.mentions.users.first().id;
      }
      
      // Log türü filtreleme
      let actionType = null;
      if (/ban|yasakla/i.test(userInput)) actionType = 'ban';
      if (/kick|at/i.test(userInput)) actionType = 'kick';
      if (/timeout|sustur|mute/i.test(userInput)) actionType = 'timeout';
      if (/warn|uyar/i.test(userInput)) actionType = 'warn';
      
      // Guild logs
      if (!this.moderationLogs.has(guildId)) {
        await message.reply('📋 Bu sunucuda henüz moderasyon logu bulunmuyor.');
        return true;
      }
      
      const guildLogs = this.moderationLogs.get(guildId);
      
      // Filtreleme
      let filteredLogs = [...guildLogs];
      if (targetUserId) {
        filteredLogs = filteredLogs.filter(log => log.targetId === targetUserId);
      }
      if (actionType) {
        filteredLogs = filteredLogs.filter(log => log.action === actionType);
      }
      
      // Son 10 log
      filteredLogs = filteredLogs.slice(-10);
      
      if (filteredLogs.length === 0) {
        await message.reply('📋 Belirtilen kriterlere uygun moderasyon logu bulunamadı.');
        return true;
      }
      
      // Log mesajı oluştur
      let logText = '📋 **Moderasyon Logları**\n\n';
      
      for (const log of filteredLogs) {
        const moderator = await this.client.users.fetch(log.moderatorId).catch(() => ({ tag: 'Bilinmeyen Moderatör' }));
        const target = await this.client.users.fetch(log.targetId).catch(() => ({ tag: 'Bilinmeyen Kullanıcı' }));
        
        let actionText = '';
        switch(log.action) {
          case 'ban': actionText = '🔨 Yasaklama'; break;
          case 'kick': actionText = '👢 Atma'; break;
          case 'timeout': actionText = '⏳ Susturma'; break;
          case 'warn': actionText = '⚠️ Uyarı'; break;
          default: actionText = log.action;
        }
        
        logText += `**${actionText}**\n`;
        logText += `**Kullanıcı:** ${target.tag}\n`;
        logText += `**Moderatör:** ${moderator.tag}\n`;
        logText += `**Sebep:** ${log.reason}\n`;
        
        if (log.duration) {
          logText += `**Süre:** ${this._formatDuration(log.duration)}\n`;
        }
        
        logText += `**Tarih:** <t:${Math.floor(log.timestamp / 1000)}:F>\n\n`;
      }
      
      await message.reply(logText);
      return true;
    } catch (error) {
      this.logger.error('Modlogs command error:', error);
      await message.reply('❌ Moderasyon logları gösterilirken bir hata oluştu.');
      return true;
    }
  }
  
  /**
   * Moderasyon işlemini loglar
   * @param {string} action - İşlem türü (ban, kick, timeout, warn)
   * @param {string} moderatorId - Moderatör ID
   * @param {string} targetId - Hedef kullanıcı ID
   * @param {string} reason - Sebep
   * @param {number} duration - Süre (ms, opsiyonel)
   */
  _logModeration(action, moderatorId, targetId, reason, duration = null) {
    const guildId = this.client.guilds.cache.find(g => 
      g.members.cache.has(targetId) || g.members.cache.has(moderatorId)
    )?.id;
    
    if (!guildId) return;
    
    // Guild log listesini oluştur
    if (!this.moderationLogs.has(guildId)) {
      this.moderationLogs.set(guildId, []);
    }
    
    // Log ekle
    this.moderationLogs.get(guildId).push({
      action,
      moderatorId,
      targetId,
      reason,
      duration,
      timestamp: Date.now()
    });
    
    // Son 100 log tut
    const logs = this.moderationLogs.get(guildId);
    if (logs.length > 100) {
      this.moderationLogs.set(guildId, logs.slice(-100));
    }
  }
  
  /**
   * Süreyi okunabilir formata çevirir
   * @param {number} ms - Milisaniye cinsinden süre
   * @returns {string} - Formatlanmış süre
   */
  _formatDuration(ms) {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    
    const parts = [];
    if (days > 0) parts.push(`${days} gün`);
    if (hours > 0) parts.push(`${hours} saat`);
    if (minutes > 0) parts.push(`${minutes} dakika`);
    
    return parts.join(' ');
  }
}

module.exports = {
  name: 'ModerationHandler',
  description: 'Discord sunucusunda moderasyon komutlarını işler',
  version: '1.0',
  initialize: async (client, eventBus, logger) => {
    return new ModerationHandler(client, eventBus, logger);
  }
};