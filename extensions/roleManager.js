/**
 * Rol Yönetimi Extension'ı
 */
class RoleManager {
  constructor(client, eventBus, logger) {
    this.client = client;
    this.logger = logger;
    this.name = "RoleManager";
    
    this.logger.info('[RoleManager] Extension initialized');
    
    // Discord mesajlarını dinle
    this.client.on('messageCreate', async (message) => {
      // Bot mesajlarını ve kendi mesajlarını yoksay
      if (message.author.bot || !message.guild) return;
      
      // Bot mention edilmiş mi kontrol et
      if (!message.content.includes(`<@${this.client.user.id}>`) && 
          !message.content.includes(`@${this.client.user.username}`)) return;
      
      const userInput = message.content;
      
      // Rol komutu mu kontrol et
      if (/rol[üeu]|role/i.test(userInput)) {
        await this.handleRoleCommand(message, userInput);
      }
    });
  }
  
  /**
   * Rol komutlarını işler
   * @param {Message} message - Discord mesajı
   * @param {string} userInput - Kullanıcı girdisi
   */
  async handleRoleCommand(message, userInput) {
    try {
      // Yetki kontrolü
      if (!message.member.permissions.has('MANAGE_ROLES')) {
        await message.reply('❌ Bu komutu kullanma yetkiniz yok.');
        return;
      }
      
      // Kullanıcı analizi
      const mentionedUser = message.mentions.members?.first();
      if (!mentionedUser) {
        await message.reply('❌ Rol verilecek kullanıcıyı etiketlemelisiniz.');
        return;
      }
      
      // Rol adı analizi
      let roleName = '';
      
      // Tırnak içindeki rol adını ara
      const quoteMatch = userInput.match(/["']([^"']+)["']/);
      if (quoteMatch) {
        roleName = quoteMatch[1];
      } else {
        // "rol" veya "rolü" kelimesinden sonraki rol adını ara
        const roleMatch = userInput.match(/rol[üeu]\s+(?:ver|give|add|ekle|remove|delete|sil|kaldır)\s+([^\s<@]+)/i);
        if (roleMatch) {
          roleName = roleMatch[1];
        }
      }
      
      if (!roleName) {
        await message.reply('❌ Lütfen bir rol adı belirtin.');
        return;
      }
      
      // Rolü bul
      const role = message.guild.roles.cache.find(r => 
        r.name.toLowerCase() === roleName.toLowerCase()
      );
      
      if (!role) {
        await message.reply(`❌ "${roleName}" adında bir rol bulunamadı.`);
        return;
      }
      
      // Ekleme mi silme mi yapılacak
      const isAddAction = /ver|give|add|ekle/i.test(userInput);
      const isRemoveAction = /remove|delete|sil|kaldır/i.test(userInput);
      
      // Varsayılan olarak ekleme işlemi yap
      const action = isRemoveAction ? 'remove' : 'add';
      
      // Yetki kontrolü
      if (role.position >= message.member.roles.highest.position) {
        await message.reply('❌ Bu rolü yönetme yetkiniz yok.');
        return;
      }
      
      // Rolü ekle veya kaldır
      if (action === 'add') {
        await mentionedUser.roles.add(role);
        await message.reply(`✅ ${mentionedUser.user.tag} kullanıcısına "${role.name}" rolü verildi.`);
      } else {
        await mentionedUser.roles.remove(role);
        await message.reply(`✅ ${mentionedUser.user.tag} kullanıcısından "${role.name}" rolü kaldırıldı.`);
      }
    } catch (error) {
      this.logger.error('Role management error:', error);
      await message.reply('❌ Rol yönetimi sırasında bir hata oluştu.');
    }
  }
}

module.exports = RoleManager;