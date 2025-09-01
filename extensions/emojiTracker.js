/**
 * @name EmojiTracker
 * @description Tracks emoji usage by users and sends notifications
 * @version 1.0
 */
class Extension {
  constructor(client, eventBus, memory) {
    this.name = 'EmojiTracker';
    this.version = '1.0';
    this.description = 'Tracks emoji usage by users and sends notifications';
    
    this.client = client;
    this.eventBus = eventBus;
    this.memory = memory;
    this.trackers = new Map();
    this.timeouts = [];
  }
  
  initialize() {
    console.log('[EmojiTracker] Extension initialized');
    
    // Register command listener
    this.eventBus.addListener("command", async (data) => {
      if (!data.userInput) return false;
      
      const input = data.userInput.toLowerCase();
      
      if ((input.includes("emoji") || input.includes("emojis")) && 
          (input.includes("say") || input.includes("izle") || input.includes("track"))) {
        return await this.handleTrackCommand(data.message, data.userInput);
      }
      
      return false;
    }, { extensionId: "emoji-tracker" });
    
    // Message listener for all messages
    this.eventBus.addListener("messageCreate", async (message) => {
      if (message.author.bot) return;
      
      // Check active trackers
      for (const [userId, tracker] of this.trackers.entries()) {
        if (message.author.id === userId) {
          this.processMessage(message, tracker);
        }
      }
    }, { extensionId: "emoji-tracker" });
    
    return true;
  }
  
  async handleTrackCommand(message, userInput) {
    try {
      // Extract user ID from mentions
      const mentionRegex = /<@!?(\d+)>/;
      const mentionMatch = userInput.match(mentionRegex);
      
      if (!mentionMatch) {
        await message.reply("❌ Lütfen izlenecek kullanıcıyı etiketleyin.");
        return true;
      }
      
      const userId = mentionMatch[1];
      
      // Extract duration (default: 6 hours)
      let duration = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
      const timeRegex = /(\d+)\s*(saat|hour|h)/i;
      const timeMatch = userInput.match(timeRegex);
      
      if (timeMatch) {
        duration = parseInt(timeMatch[1]) * 60 * 60 * 1000; // Convert to milliseconds
      }
      
      // Extract threshold (default: 50)
      let threshold = 50;
      const thresholdRegex = /(\d+)['']?den fazla/i;
      const thresholdMatch = userInput.match(thresholdRegex);
      
      if (thresholdMatch) {
        threshold = parseInt(thresholdMatch[1]);
      }
      
      // Extract target channel
      let targetChannelId = null;
      const channelRegex = /<#(\d+)>/;
      const channelMatch = userInput.match(channelRegex);
      
      if (channelMatch) {
        targetChannelId = channelMatch[1];
      } else if (userInput.includes("general")) {
        // Try to find general channel
        const generalChannel = message.guild.channels.cache.find(
          c => c.name.toLowerCase().includes("general") && c.isTextBased()
        );
        if (generalChannel) {
          targetChannelId = generalChannel.id;
        }
      }
      
      if (!targetChannelId) {
        targetChannelId = message.channel.id; // Default to current channel
      }
      
      // Create tracker
      const user = await this.client.users.fetch(userId).catch(() => null);
      
      if (!user) {
        await message.reply("❌ Kullanıcı bulunamadı.");
        return true;
      }
      
      // Create and store tracker
      this.trackers.set(userId, {
        userId,
        username: user.username,
        threshold,
        targetChannelId,
        startTime: Date.now(),
        endTime: Date.now() + duration,
        emojiCount: 0,
        messages: 0
      });
      
      // Set timeout to end tracking
      const timeoutId = setTimeout(() => {
        this.endTracking(userId);
      }, duration);
      
      this.timeouts.push(timeoutId);
      
      // Confirmation message
      await message.reply(`✅ ${user.username} kullanıcısının emoji kullanımı ${duration / (60 * 60 * 1000)} saat boyunca izlenecek. ${threshold} emojiden fazla kullanırsa bildirim gönderilecek.`);
      
      return true;
    } catch (error) {
      console.error('[EmojiTracker] Error handling command:', error);
      await message.reply("❌ Komut işlenirken bir hata oluştu.").catch(() => {});
      return true;
    }
  }
  
  processMessage(message, tracker) {
    try {
      // Extract emojis from message
      const emojiRegex = /<a?:[^:]+:\d+>|(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
      const emojis = message.content.match(emojiRegex) || [];
      
      // Update counter
      tracker.emojiCount += emojis.length;
      tracker.messages += 1;
      
      console.log(`[EmojiTracker] ${tracker.username} used ${emojis.length} emojis (total: ${tracker.emojiCount}/${tracker.threshold})`);
      
      // Check threshold
      if (tracker.emojiCount >= tracker.threshold) {
        this.sendNotification(tracker);
        this.endTracking(tracker.userId);
      }
    } catch (error) {
      console.error('[EmojiTracker] Error processing message:', error);
    }
  }
  
  async sendNotification(tracker) {
    try {
      const channel = await this.client.channels.fetch(tracker.targetChannelId).catch(() => null);
      
      if (!channel) {
        console.error(`[EmojiTracker] Target channel ${tracker.targetChannelId} not found`);
        return;
      }
      
      await channel.send(`📊 **${tracker.username}** bugün ${tracker.emojiCount} emoji kullandı! (${tracker.messages} mesajda)`);
    } catch (error) {
      console.error('[EmojiTracker] Error sending notification:', error);
    }
  }
  
  endTracking(userId) {
    if (this.trackers.has(userId)) {
      const tracker = this.trackers.get(userId);
      console.log(`[EmojiTracker] Ending tracking for ${tracker.username}. Final count: ${tracker.emojiCount} emojis`);
      this.trackers.delete(userId);
    }
  }
  
  cleanup() {
    // Clear all timeouts
    for (const timeoutId of this.timeouts) {
      clearTimeout(timeoutId);
    }
    this.timeouts = [];
    
    console.log('[EmojiTracker] Extension cleaned up');
  }
}

module.exports = Extension;