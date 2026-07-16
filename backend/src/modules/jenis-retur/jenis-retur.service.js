import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";

const DEFAULT_DATA = [
  { kode: "01", label: "Retur Proforma" },
  { kode: "02", label: "Rusak/Kadaluarsa-ex pengiriman" },
  { kode: "03", label: "Retur Rusak" },
  { kode: "04", label: "Retur Baik" },
  { kode: "05", label: "Retur Toko Tutup" },
];

class JenisReturService {
  constructor() {
    this.filePath = path.join(process.cwd(), "data/jenis_retur.json");
    this.data = [];
    this.initialized = false;
  }

  async initialize() {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      this.data = JSON.parse(raw);
    } catch (error) {
      if (error.code === "ENOENT" || error instanceof SyntaxError) {
        this.data = [...DEFAULT_DATA];
        await this.saveToFile();
      } else {
        throw error;
      }
    }
    this.initialized = true;
    logger.info(`[jenis-retur] Loaded ${this.data.length} items`);
  }

  async ensureInitialized() {
    if (!this.initialized) await this.initialize();
  }

  async saveToFile() {
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
  }

  async getAll() {
    await this.ensureInitialized();
    return this.data;
  }

  async getByKode(kode) {
    await this.ensureInitialized();
    return this.data.find((item) => item.kode === kode) || null;
  }

  async create({ kode, label }) {
    await this.ensureInitialized();
    if (!kode || !label) throw new Error("kode and label are required");
    if (this.data.find((item) => item.kode === kode)) {
      throw new Error(`Kode ${kode} already exists`);
    }
    this.data.push({ kode, label });
    await this.saveToFile();
    return { kode, label };
  }

  async update(kode, { label }) {
    await this.ensureInitialized();
    const item = this.data.find((item) => item.kode === kode);
    if (!item) return null;
    if (label !== undefined) item.label = label;
    await this.saveToFile();
    return item;
  }

  async remove(kode) {
    await this.ensureInitialized();
    const idx = this.data.findIndex((item) => item.kode === kode);
    if (idx === -1) return false;
    this.data.splice(idx, 1);
    await this.saveToFile();
    return true;
  }
}

export default new JenisReturService();
