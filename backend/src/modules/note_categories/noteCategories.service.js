/**
 * Service layer for managing Note Categories
 */
import fs from "fs";
import path from "path";
import NoteCategories from "./noteCategories.model.js";
import config from "./noteCategories.config.js";
import logger from "../../config/logger.js";

class NoteCategoriesService {
  constructor() {
    this.cache = null;
    this.cacheTimer = null;
    this.lastLoaded = 0;
  }

  // Helper: ensure JSON file exists
  async ensureJsonFile() {
    const dir = path.dirname(config.jsonPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(config.jsonPath)) fs.writeFileSync(config.jsonPath, "[]");
  }

  // Helper: read JSON with TTL caching
  async readJson(force = false) {
    const now = Date.now();
    if (!force && this.cache && now - this.lastLoaded < config.cacheTTL) {
      return this.cache;
    }

    await this.ensureJsonFile();
    const raw = fs.readFileSync(config.jsonPath, "utf-8");
    this.cache = JSON.parse(raw || "[]");
    this.lastLoaded = now;

    // Auto-clear cache after TTL
    clearTimeout(this.cacheTimer);
    this.cacheTimer = setTimeout(() => {
      this.cache = null;
    }, config.cacheTTL);

    return this.cache;
  }

  // Helper: write JSON
  async writeJson(data) {
    await this.ensureJsonFile();
    fs.writeFileSync(config.jsonPath, JSON.stringify(data, null, 2));
    this.cache = null;
    this.lastLoaded = 0;
    logger.info("[NoteCategories] JSON updated.");
  }

  // -----------------------
  // CRUD Operations
  // -----------------------

  async getAll(options = {}) {
    const data = await this.readJson();

    // Apply search filter if provided
    let filteredData = data;
    if (options.searchQuery) {
      const query = options.searchQuery.toLowerCase();
      filteredData = data.filter(
        item =>
          item.name.toLowerCase().includes(query) ||
          (item.description && item.description.toLowerCase().includes(query)) ||
          item.moduleName.toLowerCase().includes(query)
      );
    }

    // Apply sorting if provided
    if (options.sortColumn) {
      filteredData = [...filteredData].sort((a, b) => {
        const aVal = a[options.sortColumn];
        const bVal = b[options.sortColumn];

        if (aVal < bVal) return options.sortOrder === "desc" ? 1 : -1;
        if (aVal > bVal) return options.sortOrder === "desc" ? -1 : 1;
        return 0;
      });
    }

    // Apply pagination if provided
    let paginatedData = filteredData;
    const total = filteredData.length;
    let totalPages = 1;

    if (options.page && options.limit) {
      const page = parseInt(options.page);
      const limit = parseInt(options.limit);
      const startIndex = (page - 1) * limit;
      paginatedData = filteredData.slice(startIndex, startIndex + limit);
      totalPages = Math.ceil(total / limit);
    }

    // Return consistent format
    return {
      data: paginatedData,
      total,
      page: options.page ? parseInt(options.page) : 1,
      limit: options.limit ? parseInt(options.limit) : total,
      totalPages,
    };
  }

  async getById(id) {
    const data = await this.readJson();
    return data.find(c => c.id === Number(id)) || null;
  }

  async getByModule(body) {
    const { moduleName } = body;
    const data = await this.readJson();
    return data.filter(c => c.moduleName === moduleName);
  }

  async create(payload) {
    const model = await NoteCategories.create(payload);
    const all = await NoteCategories.findAll();
    await this.writeJson(all.map(i => i.toJSON()));
    return model;
  }

  async update(id, payload) {
    const category = await NoteCategories.findByPk(id);
    if (!category) throw new Error("Category not found");

    await category.update(payload);
    const all = await NoteCategories.findAll();
    await this.writeJson(all.map(i => i.toJSON()));
    return category;
  }

  async remove(id) {
    const category = await NoteCategories.findByPk(id);
    if (!category) throw new Error("Category not found");

    await category.destroy();
    const all = await NoteCategories.findAll();
    await this.writeJson(all.map(i => i.toJSON()));
    return true;
  }
}

export default new NoteCategoriesService();
