/**
 * LLM Service - Ollama v1 API Integration
 * @module ai/llmservice
 * @description Handles interaction with Ollama API (OpenAI compatible /v1 endpoint)
 * @version 2.0.1
 */
const fetch = require('node-fetch');

class LLMService {
  /**
   * Create a new LLM service
   * @param {string} apiUrl - API endpoint URL (should be http://localhost:11434/v1)
   * @param {string} model - Model name (e.g. llama3.1:8b-instruct-q4_K_M)
   * @param {Object} logger - Logger instance
   */
  constructor(apiUrl, model, logger) {
    this.apiUrl = apiUrl || process.env.LLM_API_URL || 'http://localhost:11434/v1';
    this.model = model || process.env.LLM_MODEL || 'llama3.1:8b-instruct-q4_K_M';
    this.logger = logger;
    
    // Default configuration
    this.temperature = 0.3; // Düşürüldü: 0.7 -> 0.3 (daha tutarlı JSON için)
    this.maxTokens = 2048;
    this.topP = 0.9; // Düşürüldü: 1.0 -> 0.9 (daha tutarlı JSON için)
    this.timeout = 60000; // 60 seconds
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
    
    // Flag to control fallback behavior
    this.useFallbackOnError = true;
    
    // JSON düzeltme bayrağı
    this.fixJsonInResponse = true;
    
    // Cache for expensive operations
    this._cache = new Map();
    this._cacheLifetime = 3600000; // 1 hour in milliseconds
    
    this.logger.info(`LLM Service initialized with model: ${this.model}`);
    this.logger.info(`Using API at: ${this.apiUrl}`);
    
    // Verify API availability on startup
    this._checkApiAvailability();
  }

  /**
   * Check if the API is available
   * @private
   */
  async _checkApiAvailability() {
    try {
      const response = await fetch(`${this.apiUrl}/models`, {
        method: 'GET',
        timeout: 5000
      }).catch(err => {
        this.logger.warn(`Failed to connect to API: ${err.message}`);
        return { ok: false };
      });
      
      if (!response.ok) {
        this.logger.warn(`API not available. Will use fallback mode for requests.`);
        return;
      }
      
      const data = await response.json();
      
      // Check if our model is in the list
      if (data.data && Array.isArray(data.data)) {
        const modelFound = data.data.some(m => m.id === this.model);
        if (!modelFound) {
          this.logger.warn(`Model ${this.model} not found in available models.`);
        } else {
          this.logger.info(`Model ${this.model} is available.`);
        }
      }
    } catch (error) {
      this.logger.warn(`Error checking API availability: ${error.message}`);
    }
  }

  /**
   * Generate a response using the LLM API
   * @param {string} systemPrompt - System instructions
   * @param {string} userPrompt - User query
   * @returns {Promise<string>} - Generated response
   */
  async generateResponse(systemPrompt, userPrompt) {
    this.logger.info(`Generating LLM response for prompt: ${userPrompt.substring(0, 50)}...`);
    
    // JSON formatını garanti altına almak için sistem promptuna ekleme
    const jsonEnhancedSystemPrompt = this._addJsonFormatInstructions(systemPrompt);
    
    // JSON üretilmesini garanti etmek için userPrompt'u güçlendir
    const enhancedUserPrompt = this._enhanceUserPromptForJson(userPrompt);
    
    let attemptCount = 0;
    let lastError = null;
      console.log("\n===== OLLAMA REQUEST DEBUG =====");
  console.log("API URL:", this.apiUrl);
  console.log("Model:", this.model);
  console.log("Sistem prompt (ilk 50 karakter):", systemPrompt.substring(0, 50));
  console.log("User prompt (ilk 50 karakter):", userPrompt.substring(0, 50));
    while (attemptCount < this.retryAttempts) {
      try {
        // Prepare messages format for the API
        const messages = [
          { role: 'system', content: jsonEnhancedSystemPrompt },
          { role: 'user', content: enhancedUserPrompt }
        ];
        
        // Make API request
        const endpoint = `${this.apiUrl}/chat/completions`;
        this.logger.info(`Sending request to: ${endpoint}`);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this.model,
            messages: messages,
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            top_p: this.topP,
            response_format: { type: "json_object" } // Ekstra JSON format zorlaması
          }),
          timeout: this.timeout
        });
        
        // Check for successful response
        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`API returned error ${response.status}: ${errorBody}`);
        }
        
        // Parse JSON response
        const data = await response.json();
        
        // Extract the message content from the response
        const content = data.choices && data.choices[0] && 
                        data.choices[0].message && 
                        data.choices[0].message.content;
        
        if (!content) {
          throw new Error('Invalid or empty response from API');
        }
        
        let finalContent = content;
        
        // JSON düzeltmesi uygula
        if (this.fixJsonInResponse) {
          finalContent = this._fixJsonFormat(content);
          
          // Debug için JSON düzeltmesinden önce ve sonra log'a kaydet
          if (finalContent !== content) {
            this.logger.debug('Original JSON response:', content.substring(0, 200));
            this.logger.debug('Fixed JSON response:', finalContent.substring(0, 200));
          }
        }
        
        this.logger.info(`LLM response generated successfully (${finalContent.length} chars)`);
        return finalContent;
        
      } catch (error) {
        lastError = error;
        this.logger.warn(`LLM API attempt ${attemptCount+1} failed: ${error.message}`);
        attemptCount++;
        
        // Wait before retry
        if (attemptCount < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          this.retryDelay *= 2; // Exponential backoff
        }
      }
    }
    
    // If we get here, all attempts failed
    this.logger.error(`All ${this.retryAttempts} LLM API attempts failed`, lastError);
       console.log("Sending request to Ollama...");
      
      // API isteği yapıldıktan sonra
      console.log("Ollama response received, status:", response.status);
      console.log("Response headers:", response.headers);
      
      // Yanıt içeriğini debug et
      console.log("Response content preview:", content.substring(0, 100));
      console.log("===== END DEBUG =====\n");
    // Provide fallback response when API fails
    if (this.useFallbackOnError) {
      this.logger.warn('Using fallback LLM response due to API failure');
      return this._generateFallbackResponse(userPrompt);
    }
    
    throw new Error(`Failed to generate LLM response after ${this.retryAttempts} attempts: ${lastError.message}`);
  }
  
  /**
   * Enhance system prompt with JSON formatting instructions
   * @param {string} systemPrompt - Original system prompt
   * @returns {string} - Enhanced system prompt
   * @private
   */
  _addJsonFormatInstructions(systemPrompt) {
    const jsonInstructions = `
IMPORTANT: Your response MUST be valid JSON. Follow these strict rules:
1. Use double quotes for all strings and property names
2. Include commas between all array elements and object properties
3. Properly close all brackets and braces
4. Ensure all property keys are quoted
5. DO NOT include any text outside the JSON structure
6. DO NOT use markdown code blocks or annotations

Example of VALID JSON structure:
{
  "steps": [
    {
      "tool": "discord.request",
      "params": {
        "action": "message.create",
        "content": "Hello world"
      },
      "id": "s1"
    }
  ],
  "meta": {"strategy": "sequential"}
}`;

    // Sistem promptunun başına JSON talimatlarını ekle
    return jsonInstructions + '\n\n' + systemPrompt;
  }
  
  /**
   * Enhance user prompt to ensure JSON output
   * @param {string} userPrompt - Original user prompt
   * @returns {string} - Enhanced user prompt
   * @private
   */
  _enhanceUserPromptForJson(userPrompt) {
    const jsonPrefix = "[RESPOND ONLY WITH VALID JSON] ";
    const jsonSuffix = "\n\nRemember to ONLY respond with VALID JSON.";
    
    return jsonPrefix + userPrompt + jsonSuffix;
  }
  
  /**
   * Fix common JSON issues in LLM responses
   * @param {string} content - Original LLM response
   * @returns {string} - Fixed JSON string
   * @private
   */
  _fixJsonFormat(content) {
    try {
      // JSON bloğunu çıkarma denemeleri
      let jsonContent = content;
      
      // JSON blok işaretlerini temizle
      jsonContent = jsonContent.replace(/```json\s*/g, '');
      jsonContent = jsonContent.replace(/```\s*/g, '');
      
      // Yalnızca JSON içeriğini almak için ilk { ile başlayan ve son } ile biten kısmı seç
      const jsonStartIndex = jsonContent.indexOf('{');
      const jsonEndIndex = jsonContent.lastIndexOf('}');
      
      if (jsonStartIndex >= 0 && jsonEndIndex >= 0 && jsonEndIndex > jsonStartIndex) {
        jsonContent = jsonContent.substring(jsonStartIndex, jsonEndIndex + 1);
      }
      
      // Standart düzeltmeler
      jsonContent = jsonContent.replace(/'/g, '"'); // Tek tırnakları çift tırnağa çevir
      jsonContent = jsonContent.replace(/,(\s*[}\]])/g, '$1'); // Sondaki virgülleri temizle
      
      // Özellik isimlerini düzelt (tırnak içine al)
      jsonContent = jsonContent.replace(/(\w+):/g, (match, p1) => {
        // Zaten tırnak içindeyse dokunma
        if (p1.startsWith('"') || p1.endsWith('"')) return match;
        return `"${p1}":`;
      });
      
      // Kritik düzeltme: Nesne özelliklerinde eksik virgülleri ekle
      jsonContent = jsonContent.replace(/}(\s*){/g, '},\n{');
      
      // Kritik düzeltme: Dizi elemanları arasında eksik virgülleri ekle (en yaygın sorun)
      jsonContent = jsonContent.replace(/}(\s*)"/g, '},\n"');
      jsonContent = jsonContent.replace(/"\s*{/g, '",\n{');
      jsonContent = jsonContent.replace(/}\s*{/g, '},\n{');
      
      // Array içerisindeki öğelerin virgül ile ayrılması
      jsonContent = jsonContent.replace(/}(\s*){/g, '},\n{');
      
      // Nesne içindeki eksik virgülleri hizalama
      const lines = jsonContent.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        const nextLine = lines[i + 1].trim();
        
        // Eğer bir satır ":" içeriyorsa ve bir sonraki satırda da ":" varsa
        // ve bu satır virgülle bitmiyorsa, virgül ekle
        if (line.includes(':') && nextLine.includes(':') && 
            !line.endsWith(',') && !line.endsWith('{') && !line.endsWith('[')) {
          lines[i] = line + ',';
        }
        
        // Eğer bir satır "}" ile bitiyorsa ve bir sonraki satır "{" ile başlıyorsa
        // ve virgülle bitmiyorsa, virgül ekle
        if ((line.endsWith('}') || line.endsWith('"') || line.endsWith("'")) && 
            (nextLine.startsWith('{') || nextLine.startsWith('"') || nextLine.startsWith("'")) && 
            !line.endsWith(',')) {
          lines[i] = line + ',';
        }
      }
      jsonContent = lines.join('\n');
      
      // Parantezleri dengele
      const openBraces = (jsonContent.match(/{/g) || []).length;
      const closeBraces = (jsonContent.match(/}/g) || []).length;
      for (let i = 0; i < openBraces - closeBraces; i++) {
        jsonContent += '}';
      }
      
      const openBrackets = (jsonContent.match(/\[/g) || []).length;
      const closeBrackets = (jsonContent.match(/\]/g) || []).length;
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        jsonContent += ']';
      }
      
      // Son kontrol: JSON parse edilebiliyor mu?
      try {
        JSON.parse(jsonContent);
      } catch (parseError) {
        // Parse edilemiyorsa son bir deneme daha yap
        this.logger.warn(`JSON fix still unparseable: ${parseError.message}`);
        
        // Kritik özellikler var mı kontrol et
        if (jsonContent.includes('"steps"') && !jsonContent.includes('"steps": [') && !jsonContent.includes('"steps":[]')) {
          jsonContent = jsonContent.replace(/"steps"\s*:/, '"steps": [');
          if (!jsonContent.includes('"steps": []') && !jsonContent.includes(']}')) {
            jsonContent = jsonContent.replace(/}\s*$/, ']}');
          }
        }
      }
      
      return jsonContent;
    } catch (error) {
      this.logger.error('Error fixing JSON format:', error);
      return content; // Orijinal içeriği dön
    }
  }
  
  /**
   * Generate a fallback response when API is unavailable
   * @param {string} userPrompt - User prompt
   * @returns {string} - JSON response
   * @private
   */
  _generateFallbackResponse(userPrompt) {
    // Simple logic to generate different responses based on prompt
    const lowerPrompt = userPrompt.toLowerCase();
    
    // Handle message writing commands with support for "write X times" pattern
    if (lowerPrompt.includes('write') || lowerPrompt.includes('send') || lowerPrompt.includes('yaz')) {
      return this._processWriteCommand(userPrompt);
    }
    
    // Handle timeout commands
    if (lowerPrompt.includes('timeout') || lowerPrompt.includes('mute') || lowerPrompt.includes('sustur')) {
      return this._processTimeoutCommand(userPrompt);
    }
    
    // Handle purge/clear commands
    if (lowerPrompt.includes('purge') || lowerPrompt.includes('clear') || 
        lowerPrompt.includes('delete') || lowerPrompt.includes('sil') || 
        lowerPrompt.includes('temizle')) {
      return this._processPurgeCommand(userPrompt);  
    }
    
    // Handle ban commands
    if (lowerPrompt.includes('ban') || lowerPrompt.includes('yasak')) {
      return this._processBanCommand(userPrompt);
    }
    
    // Handle kick commands
    if (lowerPrompt.includes('kick') || lowerPrompt.includes('at')) {
      return this._processKickCommand(userPrompt);
    }
    
    // Handle role commands
    if (lowerPrompt.includes('role') || lowerPrompt.includes('rol')) {
      return this._processRoleCommand(userPrompt);
    }
    
    // Handle channel commands
    if (lowerPrompt.includes('channel') || lowerPrompt.includes('kanal')) {
      return this._processChannelCommand(userPrompt);
    }
    
    // Handle nickname commands (added)
    if (lowerPrompt.includes('nickname') || lowerPrompt.includes('nick') || lowerPrompt.includes('isim')) {
      return this._processNicknameCommand(userPrompt);
    }
    
    // Handle repeat commands (added)
    if (lowerPrompt.includes('repeat') || lowerPrompt.includes('tekrarla')) {
      return this._processRepeatCommand(userPrompt);
    }
    
    // Default response for unknown commands
    return JSON.stringify({
      steps: [
        {
          tool: "discord.request",
          params: {
            action: "message.create",
            content: "API şu anda kullanılamıyor. Komutunuzu işlemek için daha açık ifadeler kullanın veya Ollama servisinin çalıştığından emin olun."
          },
          id: "s1"
        }
      ],
      meta: { strategy: "sequential" }
    });
  }

  /**
   * Process nickname command (new)
   * @param {string} userPrompt - User prompt 
   * @returns {string} - JSON response
   * @private
   */
  _processNicknameCommand(userPrompt) {
    // Extract user ID
    const userIdMatch = userPrompt.match(/<@!?(\d+)>/);
    const userId = userIdMatch ? userIdMatch[1] : "USER_ID_REQUIRED";
    
    // Extract nickname
    let nickname = "New Nickname";
    const nicknameMatch = userPrompt.match(/["']([^"']+)["']/);
    if (nicknameMatch) nickname = nicknameMatch[1];
    
    // "to X" pattern
    if (!nicknameMatch) {
      const toMatch = userPrompt.match(/to\s+(\S+)/i);
      if (toMatch) nickname = toMatch[1];
    }
    
    return JSON.stringify({
      steps: [
        {
          tool: "discord.request",
          params: {
            action: "member.setNickname",
            userId: userId,
            nickname: nickname,
            reason: "Changed via bot command"
          },
          id: "s1"
        },
        {
          tool: "discord.request",
          params: {
            action: "message.create",
            content: `✅ <@${userId}>'in takma adı "${nickname}" olarak değiştirildi.`
          },
          id: "s2"
        }
      ],
      meta: { strategy: "sequential" }
    });
  }

  /**
   * Process repeat command (new)
   * @param {string} userPrompt - User prompt
   * @returns {string} - JSON response
   * @private
   */
  _processRepeatCommand(userPrompt) {
    // Extract message to repeat
    let message = "Repeat message";
    const messageMatch = userPrompt.match(/["']([^"']+)["']/);
    if (messageMatch) message = messageMatch[1];
    
    // Extract count
    let count = 3;
    const countMatch = userPrompt.match(/(\d+)(?:\s*times|\s*kez)/i);
    if (countMatch) count = Math.min(parseInt(countMatch[1], 10), 10); // Limit to 10
    
    // Check for numbering
    const shouldNumber = userPrompt.match(/number|numara|sayı/i);
    
    // Generate steps
    const steps = [];
    for (let i = 0; i < count; i++) {
      steps.push({
        tool: "discord.request",
        params: {
          action: "message.create",
          content: shouldNumber ? `${i+1}. ${message}` : message
        },
        id: `s${i+1}`
      });
    }
    
    return JSON.stringify({
      steps: steps,
      meta: { strategy: "sequential" }
    });
  }
  
  /**
   * Process write command specifics
   * @param {string} userPrompt - User prompt
   * @returns {string} - JSON response
   * @private
   */
  _processWriteCommand(userPrompt) {
    // Extract message content
    let content = "Merhaba!";
    const contentMatch = userPrompt.match(/["']([^"']+)["']/);
    if (contentMatch) content = contentMatch[1];
    
    // Check for repeat count
    const repeatMatch = userPrompt.match(/(\d+)\s*(?:times|kez|defa)/i);
    const repeat = repeatMatch ? Math.min(parseInt(repeatMatch[1]), 5) : 1;
    
    // Check if we need to mention someone
    const mentionMatch = userPrompt.match(/<@!?(\d+)>/);
    const mention = mentionMatch ? `<@${mentionMatch[1]}> ` : '';
    
    // Check for numbered output
    const shouldNumber = userPrompt.toLowerCase().includes('number') || 
                        userPrompt.toLowerCase().includes('numara') || 
                        userPrompt.toLowerCase().includes('sayı');
    
    // Check for increment pattern
    const isIncrementing = userPrompt.toLowerCase().includes('increment');
    
    // Generate steps for each repetition
    const steps = [];
    for (let i = 0; i < repeat; i++) {
      // Add numbers if requested
      let numberedContent = content;
      
      if (shouldNumber || isIncrementing) {
        if (isIncrementing) {
          numberedContent = `${mention}${content} ${i+1}`;
        } else {
          numberedContent = `${i+1}. ${mention}${content}`;
        }
      } else {
        numberedContent = `${mention}${content}`;
      }
      
      steps.push({
        tool: "discord.request",
        params: {
          action: "message.create",
          content: numberedContent
        },
        id: `s${i+1}`
      });
    }
    
    return JSON.stringify({
      steps: steps,
      meta: { strategy: "sequential" }
    });
  }
  
  /**
   * Process timeout command
   * @param {string} userPrompt - User prompt
   * @returns {string} - JSON response
   * @private
   */
  _processTimeoutCommand(userPrompt) {
    // Extract user to timeout
    const userIdMatch = userPrompt.match(/<@!?(\d+)>/);
    const userId = userIdMatch ? userIdMatch[1] : "USER_ID_REQUIRED";
    
    // Extract duration
    let duration = 300; // Default 5 minutes
    const minuteMatch = userPrompt.match(/(\d+)\s*(?:minute|dakika|min|dk)/i);
    if (minuteMatch) duration = parseInt(minuteMatch[1]) * 60;
    
    const hourMatch = userPrompt.match(/(\d+)\s*(?:hour|saat|h)/i);
    if (hourMatch) duration = parseInt(hourMatch[1]) * 3600;
    
    const dayMatch = userPrompt.match(/(\d+)\s*(?:day|gün|d)/i);
    if (dayMatch) duration = parseInt(dayMatch[1]) * 86400;
    
    // Extract reason if present
    let reason = "Requested through bot command";
    const reasonMatch = userPrompt.match(/reason[: ]+"([^"]+)"/i);
    if (reasonMatch) reason = reasonMatch[1];
    
    return JSON.stringify({
      steps: [
        {
          tool: "discord.request",
          params: {
            action: "member.timeout",
            userId: userId,
            duration: duration,
            reason: reason
          },
          id: "s1"
        },
        {
          tool: "discord.request",
          params: {
            action: "message.create",
            content: `✅ Kullanıcı <@${userId}> ${formatDuration(duration)} süreyle susturuldu.`
          },
          id: "s2"
        }
      ],
      meta: { strategy: "sequential" }
    });
  }
  
  /**
   * Process purge command
   * @param {string} userPrompt - User prompt 
   * @returns {string} - JSON response
   * @private
   */
  _processPurgeCommand(userPrompt) {
    // Extract count
    const countMatch = userPrompt.match(/(\d+)\s*(?:message|mesaj|msg)/i);
    const count = countMatch ? Math.min(parseInt(countMatch[1]), 100) : 10;
    
    // Extract user
    const userIdMatch = userPrompt.match(/<@!?(\d+)>/);
    const userId = userIdMatch ? userIdMatch[1] : null;
    
    const steps = [
      {
        tool: "discord.request",
        params: {
          action: "channel.purge",
          limit: count,
          ...(userId && { userId: userId })
        },
        id: "s1"
      },
      {
        tool: "discord.request",
        params: {
          action: "message.create",
          content: userId ? 
            `✅ ${count} mesaj <@${userId}> kullanıcısından temizlendi.` : 
            `✅ ${count} mesaj temizlendi.`
        },
        id: "s2"
      }
    ];
    
    return JSON.stringify({
      steps: steps,
      meta: { strategy: "sequential" }
    });
  }
  
  /**
   * Process ban command
   * @param {string} userPrompt - User prompt
   * @returns {string} - JSON response
   * @private
   */
  _processBanCommand(userPrompt) {
    // Extract user to ban
    const userIdMatch = userPrompt.match(/<@!?(\d+)>/);
    const userId = userIdMatch ? userIdMatch[1] : "USER_ID_REQUIRED";
    
    // Extract reason if present
    let reason = "Banned through bot command";
    const reasonMatch = userPrompt.match(/reason[: ]+"([^"]+)"/i);
    if (reasonMatch) reason = reasonMatch[1];
    
    // Extract delete message days
    let deleteMessageDays = 0;
    const daysMatch = userPrompt.match(/delete[: ]+(\d+)/i);
    if (daysMatch) deleteMessageDays = Math.min(parseInt(daysMatch[1]), 7);
    
    return JSON.stringify({
      steps: [
        {
          tool: "discord.request",
          params: {
            action: "member.ban",
            userId: userId,
            reason: reason,
            deleteMessageDays: deleteMessageDays
          },
          id: "s1"
        },
        {
          tool: "discord.request",
          params: {
            action: "message.create",
            content: `✅ Kullanıcı <@${userId}> sunucudan yasaklandı.`
          },
          id: "s2"
        }
      ],
      meta: { strategy: "sequential" },
      requiresApproval: true
    });
  }
  
  /**
   * Process kick command
   * @param {string} userPrompt - User prompt
   * @returns {string} - JSON response
   * @private
   */
  _processKickCommand(userPrompt) {
    // Extract user to kick
    const userIdMatch = userPrompt.match(/<@!?(\d+)>/);
    const userId = userIdMatch ? userIdMatch[1] : "USER_ID_REQUIRED";
    
    // Extract reason if present
    let reason = "Kicked through bot command";
    const reasonMatch = userPrompt.match(/reason[: ]+"([^"]+)"/i);
    if (reasonMatch) reason = reasonMatch[1];
    
    return JSON.stringify({
      steps: [
        {
          tool: "discord.request",
          params: {
            action: "member.kick",
            userId: userId,
            reason: reason
          },
          id: "s1"
        },
        {
          tool: "discord.request",
          params: {
            action: "message.create",
            content: `✅ Kullanıcı <@${userId}> sunucudan atıldı.`
          },
          id: "s2"
        }
      ],
      meta: { strategy: "sequential" },
      requiresApproval: true
    });
  }
  
  /**
   * Process role command
   * @param {string} userPrompt - User prompt
   * @returns {string} - JSON response
   * @private
   */
  _processRoleCommand(userPrompt) {
    // Check if add or remove
    const isAdd = userPrompt.match(/\b(add|ver|ekle)\b/i) !== null;
    const action = isAdd ? "role.add" : "role.remove";
    
    // Extract user
    const userIdMatch = userPrompt.match(/<@!?(\d+)>/);
    const userId = userIdMatch ? userIdMatch[1] : "USER_ID_REQUIRED";
    
    // Extract role - either by mention or by name
    let roleName = "RoleName";
    let roleId = null;
    
    const roleIdMatch = userPrompt.match(/<@&(\d+)>/);
    if (roleIdMatch) {
      roleId = roleIdMatch[1];
    } else {
      // Try to extract name
      const roleNameMatch = userPrompt.match(/role[: ]+"([^"]+)"/i);
      if (roleNameMatch) roleName = roleNameMatch[1];
    }
    
    return JSON.stringify({
      steps: [
        {
          tool: "discord.request",
          params: {
            action: action,
            userId: userId,
            ...(roleId ? { roleId } : { roleName })
          },
          id: "s1"
        },
        {
          tool: "discord.request",
          params: {
            action: "message.create",
            content: isAdd ? 
              `✅ <@${userId}> kullanıcısına ${roleId ? `<@&${roleId}>` : `"${roleName}"`} rolü verildi.` : 
              `✅ <@${userId}> kullanıcısından ${roleId ? `<@&${roleId}>` : `"${roleName}"`} rolü alındı.`
          },
          id: "s2"
        }
      ],
      meta: { strategy: "sequential" }
    });
  }
  
  /**
   * Process channel command
   * @param {string} userPrompt - User prompt
   * @returns {string} - JSON response
   * @private
   */
  _processChannelCommand(userPrompt) {
    // Determine action type
    const isCreate = userPrompt.match(/\b(create|oluştur|add|ekle)\b/i) !== null;
    const isDelete = userPrompt.match(/\b(delete|sil|remove|kaldır)\b/i) !== null;
    const isPurge = userPrompt.match(/\b(purge|temizle|clear)\b/i) !== null;
    
    if (isPurge) {
      return this._processPurgeCommand(userPrompt);
    }
    
    if (isCreate) {
      // Extract channel name
      let channelName = "new-channel";
      const nameMatch = userPrompt.match(/name[: ]+"([^"]+)"/i);
      if (nameMatch) channelName = nameMatch[1];
      
      // Extract channel type
      let channelType = "GUILD_TEXT";
      if (userPrompt.match(/\b(voice|ses)\b/i)) {
        channelType = "GUILD_VOICE";
      }
      
      return JSON.stringify({
        steps: [
          {
            tool: "discord.request",
            params: {
              action: "channel.create",
              name: channelName,
              type: channelType
            },
            id: "s1"
          },
          {
            tool: "discord.request",
            params: {
              action: "message.create",
              content: `✅ "${channelName}" kanalı oluşturuldu.`
            },
            id: "s2"
          }
        ],
        meta: { strategy: "sequential" }
      });
    }
    
    if (isDelete) {
      // Extract channel
      let channelId = null;
      const channelIdMatch = userPrompt.match(/<#(\d+)>/);
      if (channelIdMatch) {
        channelId = channelIdMatch[1];
      }
      
      return JSON.stringify({
        steps: [
          {
            tool: "discord.request",
            params: {
              action: "channel.delete",
              channelId: channelId
            },
            id: "s1"
          },
          {
            tool: "discord.request",
            params: {
              action: "message.create",
              content: `✅ Kanal silindi.`
            },
            id: "s2"
          }
        ],
        meta: { strategy: "sequential" },
        requiresApproval: true
      });
    }
    
    // Default channel action
    return JSON.stringify({
      steps: [
        {
          tool: "discord.request",
          params: {
            action: "message.create",
            content: "❓ Kanal komutu için lütfen create veya delete belirtin."
          },
          id: "s1"
        }
      ],
      meta: { strategy: "sequential" }
    });
  }
  
  /**
   * Set configuration parameters
   * @param {Object} config - Configuration object
   */
  setConfig(config) {
    if (config.temperature !== undefined) this.temperature = config.temperature;
    if (config.maxTokens !== undefined) this.maxTokens = config.maxTokens;
    if (config.topP !== undefined) this.topP = config.topP;
    if (config.timeout !== undefined) this.timeout = config.timeout;
    if (config.retryAttempts !== undefined) this.retryAttempts = config.retryAttempts;
    if (config.retryDelay !== undefined) this.retryDelay = config.retryDelay;
    if (config.useFallbackOnError !== undefined) this.useFallbackOnError = config.useFallbackOnError;
    if (config.fixJsonInResponse !== undefined) this.fixJsonInResponse = config.fixJsonInResponse;
    
    this.logger.info('LLM Service configuration updated');
  }
  
  /**
   * Reset the service cache
   */
  resetCache() {
    this._cache.clear();
    this.logger.info('LLM Service cache cleared');
  }
}

// Helper function for duration formatting
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} saniye`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dakika`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} saat`;
  return `${Math.floor(seconds / 86400)} gün`;
}

module.exports = { LLMService };