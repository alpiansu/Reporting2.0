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
import UserService from "../user/user.service.js";

const userService = new UserService();

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
    const notes = await this.readJson();
    // Ambil semua user dari user service
    const users = await userService.getAllUsers();

    // Bikin map username -> fullName biar akses cepat
    const userMap = new Map(users.map(u => [u.username, u.fullName]));

    // Enrich each note
    return notes.map(note => ({
      ...note,
      fullName: userMap.get(note.pic) || null, // jika user tidak ditemukan -> null
    }));
  }

  /** Get single note by key */
  async getByKey(unixKey, tableName) {
    const notes = await this.getAll();
    return notes.find(n => n.unixKey === unixKey && n.tableName === tableName) || null;
  }

  /** Create or update a note */
  async upsert(payload) {
    // Validate required fields
    if (!payload.unixKey || !payload.pic || !payload.tableName) {
      throw new Error("unixKey, tableName, and pic are required");
    }

    // Check if note already exists
    let existing = await NotesModel.findOne({
      where: { unixKey: payload.unixKey, tableName: payload.tableName },
    });

    if (existing) {
      // Update existing note
      await existing.update({
        noteText: payload.noteText,
        pic: payload.pic,
        categoryId: payload.categoryId || null,
      });
    } else {
      // Create new note
      existing = await NotesModel.create({
        ...payload,
      });
    }

    // Sync JSON with DB
    const all = await NotesModel.findAll();
    await this.writeJson(all.map(n => n.toJSON()));

    return existing;
  }

  /** Delete note by unixKey */
  async removeByKey(tableName, unixKey) {
    const existing = await NotesModel.findOne({ where: { tableName, unixKey } });
    if (!existing) return false;

    await existing.destroy();

    const all = await NotesModel.findAll();
    await this.writeJson(all.map(n => n.toJSON()));

    return true;
  }
}

export default new NotesService();
