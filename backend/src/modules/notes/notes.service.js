/**
 * Notes Service Layer
 * - Reads from JSON with TTL caching
 * - Syncs JSON with DB on changes
 */
import fs from "fs";
import path from "path";
import NotesModel from "../../models/notes.model.js";
import config from "./notes.config.js";
import sysConfig from "../../config/index.js";
import logger from "../../config/logger.js";
import UserService from "../user/user.service.js";

const userService = new UserService();

class NotesService {
  constructor() {
    this.cache = null;
    this.cacheTimer = null;
    this.lastLoaded = 0;

    this.userMap = null;
    this.userMapLoadedAt = 0;
    this.userMapTTL = 10 * 60 * 1000; // 10 menit
    this.userMapPromise = null;
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

  async ensureUserMap() {
    const now = Date.now();
    if (this.userMap && now - this.userMapLoadedAt < this.userMapTTL) {
      return this.userMap;
    }

    if (this.userMapPromise) {
      return await this.userMapPromise;
    }

    this.userMapPromise = (async () => {
      try {
        const users = await userService.getAllUsers();
        this.userMap = new Map(users.map(u => [u.username, u.fullName]));
        this.userMapLoadedAt = Date.now();
      } catch (err) {
        logger.warn(`[Notes] Failed to fetch users for map: ${err.message}`);
        if (!this.userMap) this.userMap = new Map();
      } finally {
        this.userMapPromise = null;
      }
      return this.userMap;
    })();

    return await this.userMapPromise;
  }

  /** Get all notes (cached) */
  async getAll() {
    const notes = await this.readJson();
    const userMap = await this.ensureUserMap();

    // Enrich each note
    return notes.map(note => ({
      ...note,
      fullName: userMap.get(note.pic) || null,
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

  /** 
   * Fallback to legacy notes table when note is not found in new system
   * Returns an array of notes mapped to the new format, containing legacyIdNote to help matching
   */
  async getLegacyNotesFallback(tableName, idNotesArray) {
    if (!idNotesArray || idNotesArray.length === 0) return [];
    
    try {
      let sequelize = await sysConfig.resilientDb.getDatabase();
      
      if (!sequelize) {
        try {
          logger.info(`[NotesService] Database offline, attempting to reconnect...`);
          sequelize = await sysConfig.resilientDb.forceReconnect();
        } catch (e) {
          logger.warn(`[NotesService] Database reconnect failed: ${e.message}`);
          return [];
        }
      }

      if (!sequelize) return [];

      const userMap = await this.ensureUserMap();

      const query = `
        SELECT CABANG, IDNOTE, TABLE_RELATION, NOTE_EDP, username, UPDTIME 
        FROM web_reporting.note_fuedp 
        WHERE TABLE_RELATION = :tableName 
        AND IDNOTE IN (:idNotes)
      `;
      
      const [results] = await sequelize.query(query, {
        replacements: { tableName, idNotes: idNotesArray },
      });

      return results.map(row => {
        return {
          legacyIdNote: row.IDNOTE,
          unixKey: row.IDNOTE, // provide fallback just in case
          noteText: row.NOTE_EDP || "",
          pic: row.username || "",
          fullName: row.username ? (userMap.get(row.username) || null) : null,
          updated_at: row.UPDTIME || null
        };
      });
    } catch (error) {
      logger.error(`[NotesService] Error fetching legacy notes fallback: ${error.message}`);
      return []; // Return empty array on failure so it doesn't break the main flow
    }
  }
}

export default new NotesService();
