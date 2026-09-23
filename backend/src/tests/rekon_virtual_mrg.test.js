/**
 * Unit Tests: Rekon Virtual MRG — processSingleStore outcome & logging
 *
 * Pola sama dengan penyesuaian: jika table pendukung (DT_/PR_/RMB_ per hari)
 * tidak ada / query harian gagal → screening DIBATALKAN (tanpa update DB),
 * data toko lama dibiarkan apa adanya, dan rekap_remote mendapat log jelas:
 *   - SYNCED              → data disinkronkan (prune obsolete + bulkCreate)
 *   - NO_DATA             → semua query sukses tapi 0 baris → record lama dibersihkan
 *   - DATA_TABLES_MISSING → screening dibatalkan, tanpa update DB
 *   - ERROR               → exception, tanpa update DB
 *
 * Run with: npm test -- --testPathPattern=rekon_virtual_mrg
 */

// ─── Mock all external deps BEFORE any imports ────────────────

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// Config (used by model files; uses import.meta which breaks in Jest)
jest.mock("../config/index.js", () => ({
  __esModule: true,
  default: { resilientDb: { getDatabase: async () => null } },
}));

jest.mock("../config/db_store.js", () => ({
  __esModule: true,
  default: { createDbStore: jest.fn(async () => null) },
}));

jest.mock("../models/saldovirtual.model.js", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(async () => []),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(async () => 0),
    bulkCreate: jest.fn(async () => []),
  },
}));

jest.mock("../modules/store/storeService.js", () => ({
  __esModule: true,
  default: {
    ensureInitialized: jest.fn(async () => {}),
    getStoresByBranch: jest.fn(async () => []),
    getStoreIPHost: jest.fn(async () => ({ branch: "G033", dbHost: "127.0.0.1" })),
    stores: [],
  },
}));

jest.mock("../modules/rekap_remote/rekap_remote.service.js", () => ({
  __esModule: true,
  default: { addToTemp: jest.fn(), saveLogsToDatabase: jest.fn() },
}));

jest.mock("../modules/note_categories/noteCategories.service.js", () => ({
  __esModule: true,
  default: { getAll: jest.fn(async () => ({ data: [] })) },
}));

jest.mock("../modules/notes/notes.service.js", () => ({
  __esModule: true,
  default: { getAll: jest.fn(async () => []) },
}));

jest.mock("../modules/progress/progress.service.js", () => ({
  __esModule: true,
  default: {
    startProgress: jest.fn(),
    updateProgress: jest.fn(),
    completeProgress: jest.fn(),
    failProgress: jest.fn(),
    isAborted: jest.fn(() => false),
    addProcessingStore: jest.fn(),
    removeProcessingStore: jest.fn(),
    clearProcessingStores: jest.fn(),
  },
}));

jest.mock("../utils/screeningGuard.js", () => ({
  __esModule: true,
  default: { isSuccessToday: jest.fn(async () => ({ screened: false, reason: "no_data", updtime: null })) },
}));

jest.mock("../services/wrc.service.js", () => ({
  __esModule: true,
  default: class WrcBulananService {
    async getConnWRC() {
      return { host: "mock-wrc" };
    }
  },
}));

jest.mock("mysql2/promise", () => ({
  __esModule: true,
  default: { createConnection: jest.fn() },
}));

jest.mock("p-limit", () => ({
  __esModule: true,
  default: jest.fn(() => async fn => {
    return await fn();
  }),
}));

// ─── Imports (service UNDER TEST + mocked deps) ───────────────

import mysql from "mysql2/promise";
import SaldoVirtual from "../models/saldovirtual.model.js";
import RekapRemoteService from "../modules/rekap_remote/rekap_remote.service.js";
import rekonVirtualService from "../modules/rekon_virtual_mrg/rekon_virtual_mrg.service.js";

const KDTK = "T1234";
const CAB = "G033";
const STORE = { storeCode: KDTK, cab: CAB };
// Bulan lampau → endDay = 31 hari (deterministik, bukan bulan berjalan)
const YEAR = "2025";
const MONTH = "01";

const virtualRow = {
  CABANG: CAB,
  SHOP: KDTK,
  TANGGAL: "2025-01-02",
  PRDCD: "P0001",
  SINGKATAN: "ITEM TES",
  ACOST: 1000,
  PRICE: 1500,
  QTY_MSTRAN: 10,
  QTY_MTRAN: 4,
  SEL: 6,
};

/**
 * Setup mock WRC connection.
 * @param {Object} opts
 *   rows      - rows yang dikembalikan tiap query harian (default: 0 baris/sukses)
 *   failDates - daftar substring tanggal (YYMMDD) yang query-nya REJECT
 */
function mockWrcConnection(opts = {}) {
  const { rows = [], failDates = [] } = opts;
  const conn = { query: jest.fn(), end: jest.fn() };
  conn.query.mockImplementation(({ sql }) => {
    const failed = failDates.find(d => sql.includes(d));
    if (failed) {
      return Promise.reject(new Error(`Table 'wrc.DT_${failed}' doesn't exist`));
    }
    return Promise.resolve([rows.map(r => ({ ...r }))]);
  });
  mysql.createConnection.mockResolvedValue(conn);
  return conn;
}

function lastRekapLog() {
  const calls = RekapRemoteService.addToTemp.mock.calls;
  return calls.length ? calls[calls.length - 1] : null;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ─────────────────────────────────────────────────────

describe("processSingleStore — outcome & rekap_remote logging", () => {
  test("SYNCED: semua query sukses + ada baris → bulkCreate, tanpa delete, log jelas", async () => {
    const conn = mockWrcConnection({ rows: [virtualRow] });
    SaldoVirtual.findAll.mockResolvedValue([]); // tidak ada record lama → tanpa obsolete

    const result = await rekonVirtualService.processSingleStore(STORE, YEAR, MONTH);

    expect(result.success).toBe(true);
    expect(result.cancelled).toBe(false);
    expect(result.outcome).toBe("SYNCED");
    expect(result.newRecords).toHaveLength(31); // mock: 1 row sukses per hari × 31 hari

    expect(conn.query).toHaveBeenCalledTimes(31); // Januari = 31 hari
    expect(SaldoVirtual.bulkCreate).toHaveBeenCalledTimes(1);
    expect(SaldoVirtual.destroy).not.toHaveBeenCalled();
    expect(conn.end).toHaveBeenCalled();

    const log = lastRekapLog();
    expect(log).toEqual([
      CAB,
      KDTK,
      "rekon_virtual_mrg",
      `[${KDTK}] SYNCED`,
      expect.stringContaining("disinkronkan"),
    ]);
    expect(log[4]).toContain("31 hari");
  });

  test("NO_DATA: semua query sukses tapi 0 baris → record lama dibersihkan, log jelas", async () => {
    mockWrcConnection({ rows: [] });
    SaldoVirtual.destroy.mockResolvedValue(5); // deleteStorePeriod menghapus 5 record

    const result = await rekonVirtualService.processSingleStore(STORE, YEAR, MONTH);

    expect(result.success).toBe(true);
    expect(result.cancelled).toBe(false);
    expect(result.outcome).toBe("NO_DATA");
    expect(SaldoVirtual.destroy).toHaveBeenCalledTimes(1); // via deleteStorePeriod
    expect(SaldoVirtual.bulkCreate).not.toHaveBeenCalled();

    const log = lastRekapLog();
    expect(log[3]).toBe(`[${KDTK}] NO_DATA`);
    expect(log[4]).toContain("0 baris");
    expect(log[4]).toContain("5 record lama dibersihkan");
  });

  test("DATA_TABLES_MISSING: 1 dari 31 query gagal → screening DIBATALKAN, tanpa update DB", async () => {
    const conn = mockWrcConnection({ rows: [virtualRow], failDates: ["250105"] });

    const result = await rekonVirtualService.processSingleStore(STORE, YEAR, MONTH);

    // Dibatalkan — bukan sukses, bukan error
    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(result.outcome).toBe("DATA_TABLES_MISSING");

    // KUNCI FIX: tidak ada tulis/hapus DB apa pun saat data pendukung tidak lengkap
    expect(SaldoVirtual.destroy).not.toHaveBeenCalled();
    expect(SaldoVirtual.bulkCreate).not.toHaveBeenCalled();
    expect(SaldoVirtual.findAll).not.toHaveBeenCalled();
    expect(conn.end).toHaveBeenCalled();

    const log = lastRekapLog();
    expect(log[3]).toBe(`[${KDTK}] DATA_TABLES_MISSING`);
    expect(log[4]).toContain("DIBATALKAN");
    expect(log[4]).toContain("1/31");
    expect(log[4]).toContain("Tanpa update DB");
  });

  test("log final tetap ditulis walau suppressIntermediateLogs=true (combined screening)", async () => {
    mockWrcConnection({ rows: [virtualRow] });
    SaldoVirtual.findAll.mockResolvedValue([]);

    await rekonVirtualService.processSingleStore(STORE, YEAR, MONTH, null, {
      suppressIntermediateLogs: true,
    });

    expect(RekapRemoteService.addToTemp).toHaveBeenCalledTimes(1);
    expect(lastRekapLog()[3]).toBe(`[${KDTK}] SYNCED`);
  });

  test("ERROR: query melempar error sinkron → success=false, tanpa update DB, log ERROR", async () => {
    const conn = { query: jest.fn(() => {
      throw new Error("boom");
    }), end: jest.fn() };
    mysql.createConnection.mockResolvedValue(conn);

    const result = await rekonVirtualService.processSingleStore(STORE, YEAR, MONTH);

    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(false);
    expect(result.outcome).toBeNull();
    expect(SaldoVirtual.destroy).not.toHaveBeenCalled();
    expect(SaldoVirtual.bulkCreate).not.toHaveBeenCalled();

    const log = lastRekapLog();
    expect(log[3]).toBe(`[${KDTK}] ERROR`);
    expect(log[4]).toContain("boom");
  });

  test("koneksi WRC gagal dibuka → log status ERROR, tanpa update DB", async () => {
    mysql.createConnection.mockResolvedValue(null);

    const result = await rekonVirtualService.processSingleStore(STORE, YEAR, MONTH);

    expect(result.success).toBe(false);
    expect(SaldoVirtual.destroy).not.toHaveBeenCalled();
    expect(SaldoVirtual.bulkCreate).not.toHaveBeenCalled();

    const log = lastRekapLog();
    expect(log[3]).toBe(`[${KDTK}] ERROR`);
    expect(log[4]).toContain("Gagal membuka koneksi");
  });
});
