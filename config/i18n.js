/**
 * Internationalization module
 */
const fs = require('fs');
const path = require('path');

class I18nService {
  constructor(defaultLang = 'en') {
    this.defaultLang = defaultLang;
    this.translations = {};
    this.loadTranslations();
  }
  
  loadTranslations() {
    const localesDir = path.join(__dirname, '../locales');
    
    try {
      if (!fs.existsSync(localesDir)) {
        fs.mkdirSync(localesDir, { recursive: true });
      }
      
      // Default English translations if no files are found
      const defaultTranslations = {
        welcome: "Hello! I'm BecasBot, ready to help!",
        error: "An error occurred: {error}",
        unknownCommand: "I don't understand that command. Try {prefix} help for a list of commands.",
        permissionDenied: "You don't have permission to use this command.",
        operationCompleted: "Operation completed successfully! Executed {steps} steps with {success} successful actions.",
        operationFailed: "Operation failed: {error}",
        invalidUser: "Could not find user {user}.",
        timeoutSuccess: "Successfully timed out {user} for {duration}.",
        timeoutRemoved: "Timeout removed from {user}.",
        roleAdded: "Role {role} added to {user}.",
        roleRemoved: "Role {role} removed from {user}.",
        channelCreated: "Channel {channel} created successfully.",
        channelDeleted: "Channel {channel} deleted successfully.",
        messagesPurged: "Successfully purged {count} messages.",
        userBanned: "User {user} has been banned. Reason: {reason}",
        userUnbanned: "User {user} has been unbanned.",
        userKicked: "User {user} has been kicked. Reason: {reason}",
        nicknameSet: "Changed {user}'s nickname to {nickname}.",
        nicknameReset: "Reset {user}'s nickname.",
        serverSettingsUpdated: "Server settings updated.",
        voiceDisconnected: "Disconnected {user} from voice.",
        voiceMoved: "Moved {user} to {channel}.",
        voiceMuted: "Server muted {user}.",
        voiceUnmuted: "Server unmuted {user}.",
        approvePlan: "This operation requires approval. Here's the plan:",
        approvePlanPrompt: "React with {emoji} within {seconds} seconds to confirm.",
        planApproved: "Plan approved, executing...",
        planRejected: "Plan rejected.",
        planExpired: "Plan approval timed out.",
        extensionLoaded: "Extension {name} loaded successfully.",
        extensionError: "Extension {name} encountered an error: {error}",
        monitoringStarted: "Now monitoring {user} for {trigger}.",
        monitoringTriggered: "Monitoring triggered for {user}. Action taken: {action}",
        monitoringEnded: "Monitoring ended for {user}.",
      };
      
      // Try to load translation files
      const files = fs.readdirSync(localesDir).filter(file => file.endsWith('.json'));
      
      if (files.length === 0) {
        // Create default English translation file
        fs.writeFileSync(
          path.join(localesDir, 'en.json'), 
          JSON.stringify(defaultTranslations, null, 2)
        );
        this.translations.en = defaultTranslations;
      } else {
        // Load all translation files
        for (const file of files) {
          const lang = file.replace('.json', '');
          const content = fs.readFileSync(path.join(localesDir, file), 'utf8');
          this.translations[lang] = JSON.parse(content);
        }
      }
    } catch (error) {
      console.error("Error loading translations:", error);
      // Fallback to default translations in memory
      this.translations.en = defaultTranslations;
    }
  }
  
  translate(key, lang = this.defaultLang, replacements = {}) {
    // Get the translation for the key and language
    const langData = this.translations[lang] || this.translations[this.defaultLang];
    let text = langData?.[key] || this.translations.en?.[key] || key;
    
    // Replace placeholders with actual values
    for (const [placeholder, value] of Object.entries(replacements)) {
      text = text.replace(new RegExp(`{${placeholder}}`, 'g'), value);
    }
    
    return text;
  }
  
  getAvailableLanguages() {
    return Object.keys(this.translations);
  }
}

module.exports = new I18nService();