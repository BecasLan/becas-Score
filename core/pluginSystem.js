const fs = require('fs').promises;
const path = require('path');

class PluginSystem {
  constructor(client, eventBus, logger) {
    this.client = client;
    this.eventBus = eventBus;
    this.logger = logger;
    this.plugins = new Map();
    this.pluginDir = path.join(process.cwd(), 'plugins');
  }
  
  /**
   * Plugin sistemini başlatır
   */
  async initialize() {
    // Plugin dizinini oluştur (yoksa)
    await fs.mkdir(this.pluginDir, { recursive: true }).catch(() => {});
    
    // Plugin yükleme işlemini başlat
    await this.loadAllPlugins();
    
    // Dosya değişikliklerini izle (hot reload için)
    this.watchPluginDirectory();
    
    // Plugin komutlarını ekle
    this.registerPluginCommands();
    
    return this;
  }
  
  /**
   * Tüm pluginleri yükler
   */
  async loadAllPlugins() {
    try {
      // Plugin dosyalarını al
      const files = await fs.readdir(this.pluginDir);
      const pluginFiles = files.filter(file => file.endsWith('.js'));
      
      this.logger.info(`Found ${pluginFiles.length} plugin files`);
      
      // Her plugin'i yükle
      for (const file of pluginFiles) {
        await this.loadPlugin(file);
      }
    } catch (error) {
      this.logger.error('Plugin loading error:', error);
    }
  }
  
  /**
   * Tek bir plugin'i yükler
   */
  async loadPlugin(filename) {
    try {
      const pluginPath = path.join(this.pluginDir, filename);
      
      // Önbelleği temizle (hot reload için)
      delete require.cache[require.resolve(pluginPath)];
      
      // Plugin'i import et
      const pluginModule = require(pluginPath);
      
      // Plugin bilgilerini kontrol et
      if (!pluginModule.name) {
        throw new Error(`Plugin ${filename} must export a 'name' property`);
      }
      
      // Plugin'i başlat
      const plugin = await pluginModule.initialize?.(this.client, this.eventBus, this.logger) || pluginModule;
      
      // Plugin'i kaydet
      this.plugins.set(pluginModule.name, {
        instance: plugin,
        module: pluginModule,
        filename,
        loadedAt: Date.now()
      });
      
      this.logger.info(`Loaded plugin: ${pluginModule.name} v${pluginModule.version || '1.0'}`);
      this.eventBus.emit('pluginLoaded', { name: pluginModule.name, plugin });
      
      return true;
    } catch (error) {
      this.logger.error(`Error loading plugin ${filename}:`, error);
      return false;
    }
  }
  
  /**
   * Plugin dizinindeki değişiklikleri izler
   */
  watchPluginDirectory() {
    // Node.js FileSystemWatcher kullanımı
    const { watch } = require('fs');
    const watcher = watch(this.pluginDir, { recursive: false });
    
    watcher.on('change', async (eventType, filename) => {
      if (filename && filename.endsWith('.js')) {
        this.logger.info(`Plugin file changed: ${filename}, reloading...`);
        await this.loadPlugin(filename);
      }
    });
    
    // Plugin oluşturma olayını izle
    watcher.on('rename', async (eventType, filename) => {
      if (filename && filename.endsWith('.js')) {
        this.logger.info(`New plugin detected: ${filename}, loading...`);
        await this.loadPlugin(filename);
      }
    });
  }
  
  /**
   * Plugin komutlarını kaydeder
   */
  registerPluginCommands() {
    this.eventBus.on('command', async ({ message, userInput }) => {
      // Plugin yönetimi komutları
      if (userInput.toLowerCase().startsWith('plugin ') || 
          userInput.toLowerCase().startsWith('plugins')) {
        
        return await this.handlePluginCommand(message, userInput);
      }
      
      return false;
    });
  }
  
  /**
   * Plugin yönetimi komutlarını işler
   */
  async handlePluginCommand(message, command) {
    // Admin kontrolü
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      await message.reply('❌ Bu komutu kullanma izniniz yok.');
      return true;
    }
    
    const args = command.split(' ').filter(Boolean);
    
    // Plugin listesi
    if (args[0] === 'plugins' || (args[0] === 'plugin' && args[1] === 'list')) {
      const pluginList = Array.from(this.plugins.values()).map(p => 
        `- **${p.module.name}** v${p.module.version || '1.0'}: ${p.module.description || 'No description'}`
      ).join('\n');
      
      await message.reply(`📦 Yüklü Pluginler (${this.plugins.size}):\n${pluginList || 'Hiç plugin yüklenmemiş.'}`);
      return true;
    }
    
    // Plugin yeniden yükleme
    if (args[0] === 'plugin' && args[1] === 'reload' && args[2]) {
      const pluginName = args[2];
      const plugin = this.plugins.get(pluginName);
      
      if (!plugin) {
        await message.reply(`❌ "${pluginName}" adlı plugin bulunamadı.`);
        return true;
      }
      
      await this.loadPlugin(plugin.filename);
      await message.reply(`✅ ${pluginName} plugin'i yeniden yüklendi.`);
      return true;
    }
    
    // Yeni plugin oluşturma
    if (args[0] === 'plugin' && args[1] === 'create' && args[2]) {
      const pluginName = args[2];
      const filename = `${pluginName}.js`;
      const pluginPath = path.join(this.pluginDir, filename);
      
      // Dosya var mı kontrol et
      try {
        await fs.access(pluginPath);
        await message.reply(`❌ "${filename}" adlı plugin dosyası zaten var.`);
        return true;
      } catch {
        // Dosya yok, devam et
      }
      
      // Plugin template
      const template = `/**
 * ${pluginName} - Yeni plugin
 */

class ${pluginName}Plugin {
  constructor(client, logger) {
    this.client = client;
    this.logger = logger;
  }
  
  async handleCommand(message, command) {
    // Buraya komut işleme mantığını ekleyin
    if (command.toLowerCase().includes('${pluginName.toLowerCase()}')) {
      await message.reply('✅ ${pluginName} plugin komutu çalıştırıldı!');
      return true;
    }
    
    return false; // Komut işlenmedi
  }
}

module.exports = {
  name: '${pluginName}',
  version: '1.0',
  description: 'Yeni eklenen ${pluginName} plugin',
  initialize: async (client, eventBus, logger) => {
    const plugin = new ${pluginName}Plugin(client, logger);
    
    // Event listener ekle
    eventBus.on('command', async ({ message, userInput }) => {
      return await plugin.handleCommand(message, userInput);
    });
    
    logger.info('[${pluginName}] Plugin initialized');
    return plugin;
  }
};`;
      
      // Plugin dosyasını oluştur
      await fs.writeFile(pluginPath, template, 'utf8');
      
      await message.reply(`✅ "${pluginName}" adlı yeni plugin oluşturuldu! Şimdi yükleniyor...`);
      
      // Yeni plugin'i yükle
      await this.loadPlugin(filename);
      return true;
    }
    
    // Yardım metni
    if (args[0] === 'plugin' && (!args[1] || args[1] === 'help')) {
      const helpText = `
**Plugin Komutları:**
\`\`\`
plugins - Tüm pluginleri listele
plugin reload [isim] - Bir plugin'i yeniden yükle
plugin create [isim] - Yeni bir plugin oluştur
plugin help - Bu yardım mesajını göster
\`\`\``;
      
      await message.reply(helpText);
      return true;
    }
    
    return false;
  }
}

module.exports = { PluginSystem };