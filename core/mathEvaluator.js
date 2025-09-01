/**
 * Simple math expression evaluator for commands
 */
class MathEvaluator {
  /**
   * Process a command and evaluate any math expressions
   * @param {string} command - Command text
   * @returns {string} - Command with math expressions evaluated
   */
  static processCommand(command) {
    if (!command) return command;
    
    // Match math expressions like "calc 2+2" or "hesapla 5*3"
    const mathRegex = /\b(?:calc|calculate|hesapla|hesap)\s+([0-9+\-*/().^\s]+)/i;
    const match = command.match(mathRegex);
    
    if (match) {
      try {
        const expression = match[1].trim();
        // Use a safer evaluation method
        const result = this.evaluateMathExpression(expression);
        
        // Replace the math expression with its result
        return command.replace(match[0], `${match[0]} = ${result}`);
      } catch (error) {
        // If evaluation fails, leave the command as is
        return command;
      }
    }
    
    return command;
  }
  
  /**
   * Safely evaluate a math expression
   * @param {string} expression - Math expression to evaluate
   * @returns {number} - Result
   */
  static evaluateMathExpression(expression) {
    // Only allow safe math operations
    const sanitized = expression.replace(/[^0-9+\-*/().^\s]/g, '');
    
    // Use Function instead of eval for a slightly safer context
    // Still has risks but better than direct eval
    try {
      // Replace ^ with ** for exponentiation
      const prepared = sanitized.replace(/\^/g, '**');
      
      // Use Function constructor to evaluate the expression in a limited scope
      const result = new Function(`return ${prepared}`)();
      
      // Format the result (handle long decimals)
      if (Number.isInteger(result)) {
        return result;
      } else {
        return parseFloat(result.toFixed(4));
      }
    } catch (error) {
      throw new Error(`Invalid math expression: ${expression}`);
    }
  }
}

module.exports = { MathEvaluator };