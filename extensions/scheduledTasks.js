/**
 * @name ScheduledTasks
 * @description Manages scheduled tasks and runs them at specified times
 * @version 1.0
 */
class Extension {
  constructor(client, eventBus, memory) {
    this.name = 'ScheduledTasks';
    this.version = '1.0';
    this.description = 'Manages scheduled tasks and runs them at specified times';
    
    this.client = client;
    this.eventBus = eventBus;
    this.memory = memory;
    this.tasks = new Map();
    this.intervals = [];
    this.timeouts = [];
    
    // Task cleanup interval (every 15 minutes)
    this.registerInterval(() => this.cleanupTasks(), 15 * 60 * 1000);
  }
  
  /**
   * Initialize the extension
   */
  initialize() {
    console.log('[ScheduledTasks] Extension initialized');
    
    // Add event listener for scheduling tasks
    this.eventBus.addListener('scheduleTask', async (data) => {
      if (data.task) {
        return await this.scheduleTask(data.task);
      }
      return false;
    }, { extensionId: 'scheduled-tasks' });
    
    // Add event listener for canceling tasks
    this.eventBus.addListener('cancelTask', async (data) => {
      if (data.taskId) {
        return await this.cancelTask(data.taskId);
      }
      return false;
    }, { extensionId: 'scheduled-tasks' });
    
    // Add event listener for listing tasks
    this.eventBus.addListener('listTasks', async () => {
      return {
        tasks: this.getTaskList()
      };
    }, { extensionId: 'scheduled-tasks' });
    
    // Load tasks from memory if available
    this.loadTasks();
  }
  
  /**
   * Load tasks from memory
   */
  async loadTasks() {
    try {
      if (this.memory) {
        const savedTasks = await this.memory.get('scheduled-tasks');
        if (savedTasks && Array.isArray(savedTasks)) {
          for (const task of savedTasks) {
            if (task.executeAt && task.executeAt > Date.now()) {
              this.scheduleTask(task);
            }
          }
          console.log(`[ScheduledTasks] Loaded ${savedTasks.length} tasks from memory`);
        }
      }
    } catch (error) {
      console.error('[ScheduledTasks] Error loading tasks:', error);
    }
  }
  
  /**
   * Save tasks to memory
   */
  async saveTasks() {
    try {
      if (this.memory) {
        const tasks = Array.from(this.tasks.values()).map(task => ({
          id: task.id,
          name: task.name,
          channelId: task.channelId,
          guildId: task.guildId,
          executeAt: task.executeAt,
          action: task.action,
          parameters: task.parameters,
          repeat: task.repeat,
          interval: task.interval,
          createdAt: task.createdAt,
          createdBy: task.createdBy
        }));
        
        await this.memory.set('scheduled-tasks', tasks);
        console.log(`[ScheduledTasks] Saved ${tasks.length} tasks to memory`);
      }
    } catch (error) {
      console.error('[ScheduledTasks] Error saving tasks:', error);
    }
  }
  
  /**
   * Schedule a task
   * @param {Object} task - Task to schedule
   * @returns {Promise<Object>} - Scheduled task info
   */
  async scheduleTask(task) {
    try {
      if (!task.id) {
        task.id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }
      
      if (!task.executeAt) {
        return { success: false, error: 'No execution time specified' };
      }
      
      // If executeAt is a string, parse it as a date
      if (typeof task.executeAt === 'string') {
        task.executeAt = new Date(task.executeAt).getTime();
      }
      
      // Validate execution time
      if (isNaN(task.executeAt) || task.executeAt < Date.now()) {
        return { success: false, error: 'Invalid execution time' };
      }
      
      // Add additional metadata
      task.createdAt = task.createdAt || Date.now();
      
      // Store the task
      this.tasks.set(task.id, task);
      
      // Schedule the task execution
      const delay = task.executeAt - Date.now();
      const timeoutId = setTimeout(() => this.executeTask(task.id), delay);
      this.timeouts.push(timeoutId);
      
      // Save tasks to memory
      await this.saveTasks();
      
      console.log(`[ScheduledTasks] Scheduled task ${task.id} to execute in ${delay / 1000} seconds`);
      
      return {
        success: true,
        taskId: task.id,
        executeAt: new Date(task.executeAt).toISOString(),
        delay: delay / 1000
      };
    } catch (error) {
      console.error('[ScheduledTasks] Error scheduling task:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Execute a scheduled task
   * @param {string} taskId - Task ID
   */
  async executeTask(taskId) {
    try {
      const task = this.tasks.get(taskId);
      if (!task) return;
      
      console.log(`[ScheduledTasks] Executing task ${taskId}`);
      
      // Get the target channel
      let channel = null;
      if (task.channelId) {
        channel = await this.client.channels.fetch(task.channelId).catch(() => null);
      }
      
      if (!channel && task.guildId) {
        // If channel not found but guild is specified, try to find system channel
        const guild = await this.client.guilds.fetch(task.guildId).catch(() => null);
        if (guild && guild.systemChannel) {
          channel = guild.systemChannel;
        }
      }
      
      // Execute the task based on action
      if (task.action === 'message') {
        if (channel && channel.isTextBased() && task.parameters?.content) {
          await channel.send(task.parameters.content);
        }
      } else if (task.action === 'workflow') {
        // Execute a workflow
        if (task.parameters?.workflowId) {
          this.eventBus.emit('executeWorkflow', {
            workflowId: task.parameters.workflowId,
            channelId: task.channelId,
            guildId: task.guildId
          });
        }
      } else {
        // Generic action execution
        this.eventBus.emit('executeAction', {
          action: task.action,
          parameters: task.parameters,
          channelId: task.channelId,
          guildId: task.guildId
        });
      }
      
      // Handle repeating tasks
      if (task.repeat && task.interval) {
        // Schedule the next execution
        const nextExecuteAt = Date.now() + task.interval;
        const newTask = {
          ...task,
          executeAt: nextExecuteAt
        };
        
        // Re-schedule
        await this.scheduleTask(newTask);
      } else {
        // Remove the task
        this.tasks.delete(taskId);
        await this.saveTasks();
      }
    } catch (error) {
      console.error(`[ScheduledTasks] Error executing task ${taskId}:`, error);
    }
  }
  
  /**
   * Cancel a scheduled task
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} - Cancellation result
   */
  async cancelTask(taskId) {
    try {
      if (!this.tasks.has(taskId)) {
        return { success: false, error: 'Task not found' };
      }
      
      // Remove the task
      this.tasks.delete(taskId);
      
      // Save tasks to memory
      await this.saveTasks();
      
      console.log(`[ScheduledTasks] Cancelled task ${taskId}`);
      
      return {
        success: true,
        taskId
      };
    } catch (error) {
      console.error('[ScheduledTasks] Error cancelling task:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get a list of all scheduled tasks
   * @returns {Array} - List of tasks
   */
  getTaskList() {
    return Array.from(this.tasks.values()).map(task => ({
      id: task.id,
      name: task.name,
      executeAt: new Date(task.executeAt).toISOString(),
      action: task.action,
      repeat: task.repeat,
      interval: task.interval ? task.interval / 1000 : null,
      createdAt: new Date(task.createdAt).toISOString()
    }));
  }
  
  /**
   * Clean up expired tasks
   */
  cleanupTasks() {
    const now = Date.now();
    let count = 0;
    
    for (const [id, task] of this.tasks.entries()) {
      if (!task.repeat && task.executeAt < now) {
        this.tasks.delete(id);
        count++;
      }
    }
    
    if (count > 0) {
      console.log(`[ScheduledTasks] Cleaned up ${count} expired tasks`);
      this.saveTasks();
    }
  }
  
  /**
   * Register an interval
   * @param {Function} callback - Callback function
   * @param {number} ms - Interval in milliseconds
   */
  registerInterval(callback, ms) {
    const intervalId = setInterval(callback, ms);
    this.intervals.push(intervalId);
    return intervalId;
  }
  
  /**
   * Clean up when extension is unloaded
   */
  cleanup() {
    // Clear all intervals
    for (const intervalId of this.intervals) {
      clearInterval(intervalId);
    }
    
    // Clear all timeouts
    for (const timeoutId of this.timeouts) {
      clearTimeout(timeoutId);
    }
    
    console.log('[ScheduledTasks] Extension cleaned up');
  }
}

module.exports = Extension;