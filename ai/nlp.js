/**
 * Natural Language Processing for BecasBot
 * Provides intent detection and entity extraction from natural language
 */
class NLP {
  constructor(llm) {
    this.llm = llm;
  }
  
  /**
   * Extract entities from natural language text
   * @param {string} text - Input text
   * @param {string} commandType - Type of command
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Extracted entities
   */
  async extractEntities(text, commandType, context = {}) {
    try {
      const prompt = this._buildEntityExtractionPrompt(text, commandType, context);
      
      const response = await this.llm.createChatCompletion({
        messages: [
          { 
            role: "system", 
            content: "You are an AI assistant that extracts structured information from natural language commands." 
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      
      // Parse the response
      const content = response.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      console.error('Error extracting entities:', error);
      return {};
    }
  }
  
  /**
   * Build a prompt for entity extraction
   * @param {string} text - Input text
   * @param {string} commandType - Type of command
   * @param {Object} context - Additional context
   * @returns {string} Prompt for the LLM
   * @private
   */
  _buildEntityExtractionPrompt(text, commandType, context) {
    switch(commandType) {
      case 'deletion':
        return this._buildDeletionEntityPrompt(text, context);
      // Add more cases for other command types
      default:
        return `Extract entities from: "${text}"\n\nReturn as JSON.`;
    }
  }
  
  /**
   * Build a prompt for deletion command entity extraction
   * @param {string} text - Input text
   * @param {Object} context - Additional context
   * @returns {string} Prompt for the LLM
   * @private
   */
  _buildDeletionEntityPrompt(text, context) {
    return `
Extract information from this message deletion command: "${text}"

Context:
${JSON.stringify(context, null, 2)}

Extract the following entities:
1. userTarget - who to delete messages from (null if not specified)
2. messageCount - how many messages to delete (default: 10)
3. channel - which channel to delete from (default: current)
4. timeframe - any time restrictions (e.g. "older than 2 hours")

Return ONLY a JSON object with these fields. For example:
{
  "userTarget": {"id": "123456789", "username": "johndoe"},
  "messageCount": 15,
  "channel": {"id": "987654321", "name": "general"},
  "timeframe": {"olderThan": 2}
}

If any field is not specified, return null for that field or use the default value.
`;
  }
}

module.exports = { NLP };