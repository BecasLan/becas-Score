/**
 * EventBus - Central event management system
 */
class EventBus {
  constructor(logger) {
    this.listeners = new Map();
    this.logger = logger;
    this.nextId = 1;
  }
  
  /**
   * Add an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @param {Object} options - Options (priority, extensionId, etc)
   * @returns {string} - Listener ID
   */
  addListener(event, callback, options = {}) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    const id = `${event}_${this.nextId++}`;
    const priority = options.priority || 0;
    const extensionId = options.extensionId || null;
    
    this.listeners.get(event).push({
      id,
      callback,
      priority,
      extensionId,
      options
    });
    
    // Sort by priority (highest first)
    this.listeners.get(event).sort((a, b) => b.priority - a.priority);
    
    return id;
  }
  
  /**
   * Remove a listener by ID
   * @param {string} id - Listener ID
   * @returns {boolean} - Whether the listener was removed
   */
  removeListener(id) {
    for (const [event, listeners] of this.listeners.entries()) {
      const index = listeners.findIndex(listener => listener.id === id);
      if (index !== -1) {
        listeners.splice(index, 1);
        return true;
      }
    }
    return false;
  }
  
  /**
   * Remove all listeners for an extension
   * @param {string} extensionId - Extension ID
   * @returns {number} - Number of listeners removed
   */
  removeExtensionListeners(extensionId) {
    let count = 0;
    
    for (const [event, listeners] of this.listeners.entries()) {
      const initialLength = listeners.length;
      const filtered = listeners.filter(listener => listener.extensionId !== extensionId);
      this.listeners.set(event, filtered);
      count += initialLength - filtered.length;
    }
    
    return count;
  }
  
  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @returns {Promise<boolean>} - Whether the event was handled
   */
  async emit(event, data) {
    if (!this.listeners.has(event)) return false;
    
    const listeners = this.listeners.get(event);
    if (listeners.length === 0) return false;
    
    let handled = false;
    
    for (const listener of listeners) {
      try {
        const result = await listener.callback(data);
        if (result === true) {
          handled = true;
          if (listener.options.exclusive) break;
        }
      } catch (error) {
        this.logger.error(`Error in event listener (${event}):`, error);
      }
    }
    
    return handled;
  }
  
  /**
   * List all active listeners
   * @returns {Object} - Map of events to listener counts
   */
  listListeners() {
    const result = {};
    
    for (const [event, listeners] of this.listeners.entries()) {
      result[event] = listeners.length;
    }
    
    return result;
  }
}

function initEventBus(logger) {
  return new EventBus(logger);
}

module.exports = { EventBus, initEventBus };