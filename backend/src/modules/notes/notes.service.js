/**
 * Notes Service Layer
 * - Reads from JSON with TTL caching
 * - Syncs JSON with DB on changes
 */
import fs from "fs";
import path from "path";
import NotesModel from "../../models/notes.model.js";
import config from "./notes.config.js";
import logger from "../../config/logger.js";

class NotesService {
  constructor() {
    this.cache = null;
    this.cacheTimer = null;
    this.lastLoaded = 0;
  }

  /** Ensure JSON file exists */
  async ensureJsonFile() {
    const dir = path.dirname(config.jsonPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(config.jsonPath)) fs.writeFileSync(config.jsonPath, "[]");
  }

  /** Read JSON with TTL caching */
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

  /** Write data to JSON & reset cache */
  async writeJson(data) {
    await this.ensureJsonFile();
    fs.writeFileSync(config.jsonPath, JSON.stringify(data, null, 2));
    this.cache = null;
    this.lastLoaded = 0;
    logger.info("[Notes] JSON synced and cache cleared.");
  }

  // -----------------------------------------------------
  // CORE OPERATIONS
  // -----------------------------------------------------

  /** Get all notes (cached) */
  async getAll() {
    return this.readJson();
  }

  /** Delete note by unixKey */
  async remove(unixKey) {
    const existing = await NotesModel.findByPk(unixKey);
    if (!existing) throw new Error("Note not found");

    await existing.destroy();

    // Sync JSON with DB
    const all = await NotesModel.findAll();
    await this.writeJson(all.map(n => n.toJSON()));

    return true;
  }
}

export default new NotesService();
