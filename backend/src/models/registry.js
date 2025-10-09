/**
 * Database Model Registry - Centralized model management
 * This module provides a DRY and modular approach to manage Sequelize models
 * with automatic table creation and synchronization
 */
import logger from "../config/logger.js";

class ModelRegistry {
  constructor() {
    this.models = new Map();
    this.initializedModels = new Set();
  }

  /**
   * Register a model with the registry
   * @param {string} name - Model name
   * @param {Function} getModelFunction - Function that returns the model
   * @param {Object} options - Model options
   */
  register(name, getModelFunction, options = {}) {
    this.models.set(name, {
      getModel: getModelFunction,
      options: {
        autoSync: true,
        priority: 0,
        ...options,
      },
    });

    logger.info(`Model '${name}' registered in registry`);
  }

  /**
   * Initialize a specific model
   * @param {string} name - Model name
   */
  async initializeModel(name) {
    if (this.initializedModels.has(name)) {
      return;
    }

    const modelInfo = this.models.get(name);
    if (!modelInfo) {
      throw new Error(`Model '${name}' not found in registry`);
    }

    try {
      // Initialize the model (this will create the table if it doesn't exist)
      await modelInfo.getModel();
      this.initializedModels.add(name);
      logger.info(`Model '${name}' initialized successfully`);
    } catch (error) {
      logger.error(`Failed to initialize model '${name}': ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize all registered models
   * @param {Object} sequelize - Sequelize instance
   */
  async initializeAllModels(sequelize) {
    if (!sequelize) {
      logger.warn("No Sequelize instance available, skipping model initialization");
      return;
    }

    logger.info("Initializing all registered models...");

    // Sort models by priority (higher priority first)
    const sortedModels = Array.from(this.models.entries()).sort(
      ([, a], [, b]) => b.options.priority - a.options.priority
    );

    const results = {
      success: [],
      failed: [],
    };

    for (const [name, modelInfo] of sortedModels) {
      if (!modelInfo.options.autoSync) {
        logger.info(`Skipping model '${name}' (autoSync disabled)`);
        continue;
      }

      try {
        await this.initializeModel(name);
        results.success.push(name);
      } catch (error) {
        logger.error(`Failed to initialize model '${name}': ${error.message}`);
        results.failed.push({ name, error: error.message });
      }
    }

    logger.info(`Model initialization complete: ${results.success.length} success, ${results.failed.length} failed`);

    if (results.failed.length > 0) {
      logger.warn("Failed models:", results.failed.map(f => f.name).join(", "));
    }

    return results;
  }

  /**
   * Get a model by name
   * @param {string} name - Model name
   */
  async getModel(name) {
    const modelInfo = this.models.get(name);
    if (!modelInfo) {
      throw new Error(`Model '${name}' not found in registry`);
    }

    // Initialize the model if not already done
    if (!this.initializedModels.has(name)) {
      await this.initializeModel(name);
    }

    return await modelInfo.getModel();
  }

  /**
   * Get all registered model names
   */
  getRegisteredModels() {
    return Array.from(this.models.keys());
  }

  /**
   * Check if a model is registered
   * @param {string} name - Model name
   */
  isRegistered(name) {
    return this.models.has(name);
  }

  /**
   * Clear the registry (useful for testing)
   */
  clear() {
    this.models.clear();
    this.initializedModels.clear();
    logger.info("Model registry cleared");
  }
}

// Create singleton instance
const modelRegistry = new ModelRegistry();

export default modelRegistry;
