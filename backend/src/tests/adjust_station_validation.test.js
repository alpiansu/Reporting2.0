/**
 * Unit Test: Validasi station master toko pada proses export CSV BC Khusus (Adjust)
 */

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() },
}));

jest.mock("../modules/progress/progress.service.js", () => ({
  __esModule: true,
  default: {
    startProgress: jest.fn().mockResolvedValue(true),
    updateProgress: jest.fn().mockResolvedValue(true),
    completeProgress: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock("p-limit", () => ({
  __esModule: true,
  default: () => fn => fn(),
}));

jest.mock("../modules/adjust/adjust_post_action.service.js", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("../modules/adjust/hist_adjust_staging.service.js", () => ({
  __esModule: true,
  default: {
    writeStaging: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock("../models/hist_adjust.model.js", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("../modules/store/storeService.js", () => ({
  __esModule: true,
  default: {
    getStoresByCodes: jest.fn(),
  },
}));

import adjustService from "../modules/adjust/adjust.service.js";
import storeService from "../modules/store/storeService.js";

describe("Adjust Service — Validasi Station Export CSV BC Khusus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createCsvBuffer = (rows) => {
    const header = "KDTK,PRDCD,QTY_ADJ,KETER,TGL_SELISIH\n";
    const body = rows.map(r => `${r.kdtk},${r.prdcd},${r.qty_adj},${r.keter},${r.tgl_selisih}`).join("\n");
    return Buffer.from(header + body);
  };

  test("Gagal jika ada toko dengan station '00' (batal export & sertakan info baris)", async () => {
    const csvBuffer = createCsvBuffer([
      { kdtk: "TW06", prdcd: "1001", qty_adj: "2", keter: "Selisih", tgl_selisih: "2026-10-01" },
      { kdtk: "TW06", prdcd: "1002", qty_adj: "-1", keter: "Rusak", tgl_selisih: "2026-10-01" },
      { kdtk: "T123", prdcd: "2001", qty_adj: "1", keter: "Lebih", tgl_selisih: "2026-10-01" },
    ]);

    storeService.getStoresByCodes.mockResolvedValue([
      { storeCode: "TW06", storeName: "H NAWI RAYA 2", station: "00", branch: "G107" },
      { storeCode: "T123", storeName: "TOKO CONTOH", station: "01", branch: "G107" },
    ]);

    await expect(
      adjustService.processCsvAdjustGenerate(csvBuffer, "testuser", "Test User"),
    ).rejects.toThrow("Validasi data toko gagal");

    try {
      await adjustService.processCsvAdjustGenerate(csvBuffer, "testuser", "Test User");
    } catch (err) {
      expect(err.errorType).toBe("VALIDATION_STATION_FAILED");
      expect(err.invalidStores).toHaveLength(1);
      expect(err.invalidStores[0].storeCode).toBe("TW06");
      expect(err.invalidStores[0].rows).toEqual([2, 3]); // baris 2 & 3 di file CSV
      expect(err.invalidStores[0].currentStation).toBe("00");
    }
  });

  test("Gagal jika ada toko dengan station bukan 2 digit angka (misal '1' atau 'INDUK')", async () => {
    const csvBuffer = createCsvBuffer([
      { kdtk: "FMKH", prdcd: "3001", qty_adj: "1", keter: "Selisih", tgl_selisih: "2026-10-01" },
    ]);

    storeService.getStoresByCodes.mockResolvedValue([
      { storeCode: "FMKH", storeName: "TOKO FMKH", station: "INDUK", branch: "G026" },
    ]);

    try {
      await adjustService.processCsvAdjustGenerate(csvBuffer, "testuser", "Test User");
      throw new Error("Should have thrown error");
    } catch (err) {
      expect(err.errorType).toBe("VALIDATION_STATION_FAILED");
      expect(err.invalidStores[0].storeCode).toBe("FMKH");
      expect(err.invalidStores[0].currentStation).toBe("INDUK");
    }
  });

  test("Gagal jika toko di CSV tidak ditemukan di master INDUK", async () => {
    const csvBuffer = createCsvBuffer([
      { kdtk: "T999", prdcd: "9001", qty_adj: "1", keter: "Selisih", tgl_selisih: "2026-10-01" },
    ]);

    storeService.getStoresByCodes.mockResolvedValue([]); // toko tidak ada

    try {
      await adjustService.processCsvAdjustGenerate(csvBuffer, "testuser", "Test User");
      throw new Error("Should have thrown error");
    } catch (err) {
      expect(err.errorType).toBe("VALIDATION_STATION_FAILED");
      expect(err.invalidStores[0].storeCode).toBe("T999");
      expect(err.invalidStores[0].errorType).toBe("NOT_FOUND");
    }
  });

  test("Berhasil generate file CSV BC Khusus jika seluruh toko memiliki station 2 digit valid (contoh '01', '05')", async () => {
    const csvBuffer = createCsvBuffer([
      { kdtk: "TW06", prdcd: "1001", qty_adj: "2", keter: "Selisih", tgl_selisih: "2026-10-01" },
      { kdtk: "T63Y", prdcd: "2001", qty_adj: "1", keter: "Lebih", tgl_selisih: "2026-10-01" },
    ]);

    storeService.getStoresByCodes.mockResolvedValue([
      { storeCode: "TW06", storeName: "H NAWI RAYA 2", station: "01", branch: "G107" },
      { storeCode: "T63Y", storeName: "ALTERNATIF SENTUL", station: "05", branch: "G113" },
    ]);

    const result = await adjustService.processCsvAdjustGenerate(csvBuffer, "testuser", "Test User");
    expect(result).toBeDefined();
    expect(result.csvContent).toContain("G107|TW06|01|");
    expect(result.csvContent).toContain("G113|T63Y|05|");
    expect(result.successStores).toBe(2);
  });
});
