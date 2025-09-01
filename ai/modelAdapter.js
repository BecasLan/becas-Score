/**
 * Model Adaptör Sınıfı
 * Farklı modellere göre prompt'ları optimize eder
 */
class ModelAdapter {
  constructor(modelName, logger) {
    this.modelName = modelName;
    this.logger = logger;
    this.modelType = this._detectModelType(modelName);
    
    this.logger.info(`Model adaptör başlatıldı: ${modelName} (tip: ${this.modelType})`);
  }
  
  /**
   * Model tipini tespit et
   * @param {string} modelName - Model adı
   * @returns {string} - Model tipi (llama, gpt, mistral, vb.)
   */
  _detectModelType(modelName) {
    const lowerName = modelName.toLowerCase();
    
    if (lowerName.includes('llama')) return 'llama';
    if (lowerName.includes('gpt')) return 'gpt';
    if (lowerName.includes('mistral')) return 'mistral';
    if (lowerName.includes('claude')) return 'claude';
    
    return 'unknown';
  }
  
  /**
   * Model için uygun sistem promptunu oluştur
   * @param {string} basePrompt - Temel sistem promptu
   * @returns {string} - Optimize edilmiş sistem promptu
   */
  optimizeSystemPrompt(basePrompt) {
    // Temel model tipine göre prompt eklentileri
    const modelSpecificInstructions = {
      llama: `
CRITICAL FOR LLAMA MODELS: 
- ONLY OUTPUT RAW JSON
- NO TEXT BEFORE OR AFTER THE JSON
- NO MARKDOWN CODE BLOCKS OR BACKTICKS
- EVERY ARRAY ELEMENT NEEDS A COMMA (except the last one)
- EVERY OBJECT PROPERTY NEEDS A COMMA (except the last one)

Example of CORRECT array format with commas:
"steps": [
  {"id": "s1", "tool": "discord.request"},
  {"id": "s2", "tool": "discord.request"}
]

Example of INCORRECT array format without commas (DO NOT DO THIS):
"steps": [
  {"id": "s1", "tool": "discord.request"}
  {"id": "s2", "tool": "discord.request"}
]`,
      
      gpt: `
GUIDELINES FOR GPT MODELS:
- Output valid JSON only
- Avoid any text explanations`,
      
      mistral: `
GUIDELINES FOR MISTRAL MODELS:
- Output valid JSON only 
- No markdown formatting`,
      
      claude: `
GUIDELINES FOR CLAUDE MODELS:
- Output valid JSON only
- No explanations needed`,
      
      unknown: `
CRITICAL JSON GUIDELINES:
- Output valid JSON only with no text before or after
- Ensure all JSON syntax is valid with proper commas`
    };
    
    // Model tipine göre uygun talimatları ekle
    return `${basePrompt}\n\n${modelSpecificInstructions[this.modelType]}`;
  }
  
  /**
   * Model için user promptunu optimize et
   * @param {string} userPrompt - Kullanıcı promptu
   * @returns {string} - Optimize edilmiş kullanıcı promptu
   */
  optimizeUserPrompt(userPrompt) {
    // Tüm modellere uygun bazı yönergeler ekle
    return `${userPrompt}\n\nREMEMBER: Respond with VALID JSON ONLY. No explanations or markdown formatting.`;
  }
  
  /**
   * LLM isteği için API parametrelerini optimize et
   * @param {Object} baseParams - Temel API parametreleri
   * @returns {Object} - Optimize edilmiş API parametreleri
   */
  optimizeApiParams(baseParams) {
    // Model tipine göre özel parametreler
    const optimizedParams = {...baseParams};
    
    switch (this.modelType) {
      case 'llama':
        // Llama için daha düşük sıcaklık, daha tutarlı yanıtlar
        optimizedParams.temperature = 0.1;
        optimizedParams.top_p = 0.9;
        break;
        
      case 'gpt':
        // GPT için response_format parametresi ekle
        optimizedParams.response_format = { type: "json_object" };
        break;
        
      case 'mistral':
        // Mistral için ayarlar
        optimizedParams.temperature = 0.2;
        break;
    }
    
    return optimizedParams;
  }
}

module.exports = { ModelAdapter };