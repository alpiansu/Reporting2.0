/**
 * Service untuk mengelola store interfence configs (encrypted)
 */
import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import { encrypt, decrypt, fingerprint, loadStoreInterfenceConfigs } from "../../utils/crypto.utils.js";

const CONFIG_PATH = path.join(process.cwd(), "data", "store_interfence_configs.json");

class StoreConfigService {
  constructor() {
    this.passphrase = process.env.STORE_CONFIG_KEY;
  }

  /**
   * Pastikan passphrase tersedia
   */
  _ensurePassphrase() {
    if (!this.passphrase) {
      throw new Error("STORE_CONFIG_KEY not set in .env");
    }
  }

  /**
   * Baca file JSON mentah (belum decrypt)
   */
  async _readRaw() {
    try {
      const raw = await fs.readFile(CONFIG_PATH, "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === "ENOENT") {
        return { version: 1, keyFingerprint: "", configs: [] };
      }
      throw error;
    }
  }

  /**
   * Tulis file JSON
   */
  async _writeRaw(data) {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(data, null, 2));
  }

  /**
   * Get semua configs (password sudah di-decrypt)
   */
  async getAll() {
    this._ensurePassphrase();
    const data = await this._readRaw();

    // Verifikasi fingerprint
    const currentFingerprint = fingerprint(this.passphrase);
    if (data.keyFingerprint && data.keyFingerprint !== currentFingerprint) {
      throw new Error(
        "Encryption key mismatch. Jalankan: node scripts/re-encrypt-store-configs.js"
      );
    }

    return data.configs.map((config, index) => ({
      id: index,
      user: config.user,
      password: decrypt(config.password, this.passphrase),
    }));
  }

  /**
   * Get config by ID
   */
  async getById(id) {
    const configs = await this.getAll();
    const config = configs.find((c) => c.id === id);
    if (!config) {
      throw new Error("Config tidak ditemukan");
    }
    return config;
  }

  /**
   * Tambah config baru
   */
  async create(userData) {
    this._ensurePassphrase();
    const data = await this._readRaw();

    // Validasi input
    if (!userData.user || !userData.password) {
      throw new Error("User dan password diperlukan");
    }

    // Tambah config baru
    const newConfig = {
      user: userData.user,
      password: encrypt(userData.password, this.passphrase),
    };

    data.configs.push(newConfig);

    // Update fingerprint
    data.keyFingerprint = fingerprint(this.passphrase);

    await this._writeRaw(data);

    logger.info(`[StoreConfig] Config baru ditambahkan: user=${userData.user}`);
    return { id: data.configs.length - 1, user: userData.user };
  }

  /**
   * Update config yang sudah ada
   */
  async update(id, userData) {
    this._ensurePassphrase();
    const data = await this._readRaw();

    if (id < 0 || id >= data.configs.length) {
      throw new Error("Config tidak ditemukan");
    }

    // Update fields
    if (userData.user) {
      data.configs[id].user = userData.user;
    }
    if (userData.password) {
      data.configs[id].password = encrypt(userData.password, this.passphrase);
    }

    // Update fingerprint
    data.keyFingerprint = fingerprint(this.passphrase);

    await this._writeRaw(data);

    logger.info(`[StoreConfig] Config #${id} diperbarui: user=${data.configs[id].user}`);
    return { id, user: data.configs[id].user };
  }

  /**
   * Hapus config
   */
  async delete(id) {
    this._ensurePassphrase();
    const data = await this._readRaw();

    if (id < 0 || id >= data.configs.length) {
      throw new Error("Config tidak ditemukan");
    }

    const deleted = data.configs.splice(id, 1)[0];

    // Update fingerprint
    data.keyFingerprint = fingerprint(this.passphrase);

    await this._writeRaw(data);

    logger.info(`[StoreConfig] Config #${id} dihapus: user=${deleted.user}`);
    return { id, user: deleted.user };
  }
}

export default StoreConfigService;
