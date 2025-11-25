import fs from "fs/promises";
import path from "path";
import logger from "../../../config/logger.js";
import config from "../prep_closing.config.js";

// Import validators
import * as wrcValidator from "../validators/wrc.validator.js";
import * as systemValidator from "../validators/system.validator.js";
import * as databaseValidator from "../validators/database.validator.js";
import * as saldoValidator from "../validators/saldo.validator.js";

class RuleEngine {
  constructor() {
    this.rules = [];
    this.categories = {};
    this.severityLevels = {};
    this.operators = {};
    this.initialized = false;
    this.lastLoaded = null;
    this.ttlMs = 5 * 60 * 1000; // 5 menit

    // Map validator functions by category
    this.validators = {
      wrc_data: wrcValidator,
      system_config: systemValidator,
      database: databaseValidator,
      saldo: saldoValidator,
      inventory: systemValidator, // Reuse system validator
      data_integrity: systemValidator,
      tax: systemValidator,
    };
  }

  /**
   * Load rules from JSON file
   */
  async loadRules() {
    try {
      const rulesPath = path.resolve(config.rulesPath);
      const data = await fs.readFile(rulesPath, "utf8");
      const rulesData = JSON.parse(data);

      this.rules = rulesData.rules.filter(r => r.enabled);
      this.categories = rulesData.categories;
      this.severityLevels = rulesData.severityLevels;
      this.operators = rulesData.operators;

      this.initialized = true;
      this.lastLoaded = Date.now();
      logger.info(`[RuleEngine] Loaded ${this.rules.length} enabled rules`);
    } catch (error) {
      logger.error(`[RuleEngine] Failed to load rules: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensure rules are loaded
   */
  async ensureInitialized() {
    const now = Date.now();
    const expired = !this.lastLoaded || now - this.lastLoaded > this.ttlMs;

    if (!this.initialized || expired) {
      await this.loadRules();
      this.lastLoaded = now;
    }
  }

  /**
   * Execute all rules for a store
   * @param {Object} storeConnection - Store database connection
   * @param {Object} context - Execution context (cab, kdtk, periode, etc.)
   * @returns {Promise<Object>} Execution results
   */
  async executeRules(storeConnection, context) {
    await this.ensureInitialized();

    const results = {
      totalRules: this.rules.length,
      passedRules: 0,
      failedRules: 0,
      criticalIssues: 0,
      issues: [],
      isReady: false,
    };

    // Sort rules by priority
    const sortedRules = [...this.rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      try {
        const result = await this.executeRule(rule, storeConnection, context);

        if (result.passed) {
          results.passedRules++;
        } else {
          results.failedRules++;

          if (rule.severity === "critical") {
            results.criticalIssues++;
          }

          results.issues.push({
            ruleKey: rule.key,
            ruleName: rule.name,
            category: rule.category,
            severity: rule.severity,
            message: result.message,
            expected: result.expected,
            actual: result.actual,
            delta: result.delta,
            ui: rule.ui,
            metadata: rule.metadata,
          });
        }
      } catch (error) {
        logger.error(`[RuleEngine] Error executing rule ${rule.key}: ${error.message}`);

        // Treat errors as critical failures
        results.failedRules++;
        results.criticalIssues++;

        results.issues.push({
          ruleKey: rule.key,
          ruleName: rule.name,
          category: rule.category,
          severity: "critical",
          message: `Error: ${error.message}`,
          actual: "ERROR",
          ui: rule.ui,
        });
      }
    }

    // Determine if store is ready (no critical issues)
    results.isReady = results.criticalIssues === 0;

    return results;
  }

  /**
   * Execute single rule
   */
  async executeRule(rule, storeConnection, context) {
    const validator = this.validators[rule.category];
    if (!validator) {
      throw new Error(`No validator found for category: ${rule.category}`);
    }

    // Get the validator function for this rule
    const validatorFn = validator[rule.key];
    if (!validatorFn) {
      throw new Error(`No validator function found for rule: ${rule.key}`);
    }

    // Execute validator
    return await validatorFn(storeConnection, context, rule);
  }

  /**
   * Get rules by category
   */
  getRulesByCategory(category) {
    return this.rules.filter(r => r.category === category);
  }

  /**
   * Get rules by severity
   */
  getRulesBySeverity(severity) {
    return this.rules.filter(r => r.severity === severity);
  }

  /**
   * Get rule by key
   */
  getRuleByKey(key) {
    return this.rules.find(r => r.key === key);
  }

  /**
   * Get all categories
   */
  getCategories() {
    return this.categories;
  }

  /**
   * Get all severity levels
   */
  getSeverityLevels() {
    return this.severityLevels;
  }
}

export default new RuleEngine();
