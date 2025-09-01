const { Configuration, OpenAIApi } = require("openai");

class IntentAnalyzer {
  constructor(config, logger) {
    this.logger = logger;
    
    // OpenAI yapılandırması (veya tercih ettiğiniz LLM)
    if (config.OPENAI_API_KEY) {
      const configuration = new Configuration({
        apiKey: config.OPENAI_API_KEY,
      });
      this.openai = new OpenAIApi(configuration);
    }
  }
  
  /**
   * Komut amacını ve parametrelerini analiz eder
   * @param {string} userInput - Kullanıcı komutu
   * @returns {Promise<Object>} - Komut amacı ve parametreler
   */
  async analyzeIntent(userInput) {
    try {
      // Basit regex ile önişleme - mesaj sayma
      if (/son\s+(\d+)\s+mesaj.*karakter\s+say[iıs]/i.test(userInput)) {
        const match = userInput.match(/son\s+(\d+)\s+mesaj/i);
        const count = match ? parseInt(match[1]) : 10;
        
        return {
          intent: "countCharacters",
          confidence: 0.95,
          params: {
            messageCount: count
          }
        };
      }
      
      // Daha karmaşık işlemler için LLM kullan
      if (this.openai) {
        const response = await this.openai.createChatCompletion({
          model: "llama3.1:8b-instruct-q4_K_M",
          messages: [
            {
              role: "system",
              content: `Extract the intent and parameters from the Discord bot command. 
              Return ONLY a JSON object with the following structure:
              {
                "intent": "intentName",
                "confidence": 0.0-1.0,
                "params": {
                  // All relevant parameters
                }
              }
              
              Available intents: 
              - "countCharacters": Count characters in messages
              - "timeout": Timeout a user
              - "deleteMessages": Delete messages
              - "sendMessage": Send a message
              - "watchMessages": Monitor messages
              - "unknown": Unknown intent`
            },
            {
              role: "user",
              content: userInput
            }
          ],
          temperature: 0
        });
        
        const content = response.data.choices[0].message.content;
        try {
          return JSON.parse(content);
        } catch (e) {
          this.logger.error("Failed to parse LLM response", e);
        }
      }
      
      // Fallback basit anahtar kelime analizi
      if (userInput.includes("karakter") && userInput.includes("mesaj")) {
        return {
          intent: "countCharacters",
          confidence: 0.7,
          params: {
            messageCount: 10 // Varsayılan değer
          }
        };
      }
      
      return {
        intent: "unknown",
        confidence: 0.1,
        params: {}
      };
    } catch (error) {
      this.logger.error("Intent analysis failed", error);
      return {
        intent: "unknown",
        confidence: 0,
        params: {},
        error: error.message
      };
    }
  }
}

module.exports = { IntentAnalyzer };