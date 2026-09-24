/**
 * Unit Tests: Penyesuaian Module — processSingleStore outcome & logging
 *
 * Fokus pada fix issue "toko hilang dari list padahal nilai penyesuaian di DB masih tinggi":
 *   - SESUAI > threshold            → EXCEEDED      (summary RECID='*', tetap di list)
 *   - SESUAI dalam rentang          → BELOW_THRESHOLD (resolve)
 *   - SESUAI NULL (data ST tak ada) → DATA_MISSING   (TIDAK di-resolve, tetap di list)
 *   - Query gagal                   → ERROR          (tidak di-resolve)
 * Plus: log rekap_remote per toko harus jelas (status token + detail nilai).
 *
 * Run with: npm test -- --testPathPattern=penyesuaian
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

jest.mock("../modules/penyesuaian/penyesuaian.model.js", () => ({
  __esModule: true,
  default: {
    getModel: jest.fn(async () => null),
    findOne: jest.fn(),
    destroy: jest.fn(),
    bulkCreate: jest.fn(),
    upsert: jest.fn(),
    startScreeningSession: jest.fn(async () => "session-test"),
    bulkCreateStaging: jest.fn(),
    mergeStagingToMain: jest.fn(),
    cleanupScreeningSession: jest.fn(),
    mergeStagingAndCleanup: jest.fn(),
  },
}));

jest.mock("../modules/penyesuaian/penyesuaian_summary.model.js", () => ({
  __esModule: true,
  default: {
    getModel: jest.fn(async () => null),
    findOne: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(async () => []),
  },
}));

jest.mock("../modules/store/storeService.js", () => ({
  __esModule: true,
  default: {
    ensureInitialized: jest.fn(async () => {}),
    getStoreByCode: jest.fn(async () => ({ branch: "G033", cab: "G033", storeName: "Toko Test" })),
    getStoresByBranch: jest.fn(async () => []),
    stores: [],
  },
}));

jest.mock("../modules/rekap_remote/rekap_remote.service.js", () => ({
  __esModule: true,
  default: { addToTemp: jest.fn(), saveLogsToDatabase: jest.fn() },
}));

jest.mock("../modules/notes/notes.service.js", () => ({
  __esModule: true,
  default: { getAll: jest.fn(async () => []), getLegacyNotesFallback: jest.fn(async () => []) },
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

jest.mock("../services/storeInspector.service.js", () => ({
  __esModule: true,
  default: { inspect: jest.fn(async () => ({ acostAnalysis: { cause: "none", changes: [] } })) },
}));

jest.mock("../modules/user/user.service.js", () => ({ __esModule: true, default: {} }));

jest.mock("../utils/index.js", () => ({
  __esModule: true,
  fileUtils: { readFileWithRetry: jest.fn(), writeAtomicWithRetry: jest.fn() },
}));

jest.mock("../utils/screeningGuard.js", () => ({
  __esModule: true,
  default: { isSuccessToday: jest.fn(async () => ({ screened: false, reason: "no_data", updtime: null })) },
}));

jest.mock("../modules/notifications/notifications.service.js", () => ({
  __esModule: true,
  default: { create: jest.fn(), findByMetadata: jest.fn(async () => []) },
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
import RekapRemoteService from "../modules/rekap_remote/rekap_remote.service.js";
import SesuaiToko from "../modules/penyesuaian/penyesuaian.model.js";
import SesuaiTokoSummary from "../modules/penyesuaian/penyesuaian_summary.model.js";
import penyesuaianConfig from "../modules/penyesuaian/penyesuaian.config.js";
import penyesuaianService from "../modules/penyesuaian/penyesuaian.service.js";

const KDTK = "T1234";
const CAB = "G033";
const PERIODE = "2607";
const STORE = { storeCode: KDTK, cab: CAB };

const THRESHOLD = penyesuaianConfig.sesuaiThreshold; // 500000

/**
 * Setup mock WRC connection.
 * @param {Object} opts
 *   filterRows - rows yang dikembalikan query filterWrc (1 row, SESUAI bisa null)
 *   stCount    - hasil COUNT(*) st (untuk query countStRows); default 0
 *   failFilter - jika true, query filter melempar error
 *   failCount  - jika true, query countStRows melempar error
 */
function mockWrcConnection(opts = {}) {
  const { filterRows = [], stCount = 0, failFilter = false, failCount = false } = opts;
  const conn = { query: jest.fn(), end: jest.fn() };
  conn.query.mockImplementation(async ({ sql }) => {
    if (sql.includes("COUNT(*)")) {
      if (failCount) throw new Error("count query failed");
      return [[{ cnt: stCount }]];
    }
    if (failFilter) throw new Error("Table 'wt_260701' doesn't exist");
    return [filterRows];
  });
  mysql.createConnection.mockResolvedValue(conn);
  return conn;
}

const sesuaiRow = value => ({
  CABANG: CAB,
  PERIODE: PERIODE,
  KDTK,
  SESUAI: value,
  UPDTIME: new Date(),
  RECID: "*",
});

/** Ambil panggilan terakhir addToTemp(cab, kdtk, moduleName, status, message) */
function lastRekapLog() {
  const calls = RekapRemoteService.addToTemp.mock.calls;
  return calls.length ? calls[calls.length - 1] : null;
}

/** Satu baris hasil query fullDetailWrc (field sesuai kebutuhan normalisasi) */
const detailRow = prdcd => ({
  CABANG: CAB,
  PERIODE,
  KDTK,
  PRDCD: prdcd,
  SINGKATAN: `Item ${prdcd}`,
  RECID_PRODMAST: "*",
  PTAG: "A",
  sesuai: 600000,
});

/**
 * Mock koneksi WRC untuk query DETAIL (fullDetailWrc).
 * Query yang sql-nya mengandung st_<lastday> bisa dipaksa gagal per-lastday
 * (mensimulasikan tabel sumber belum ada di WRC).
 */
function mockDetailWrc({ rows = [], failLastdays = [], failAll = false } = {}) {
  const conn = { query: jest.fn(), end: jest.fn(async () => {}) };
  conn.query.mockImplementation(async ({ sql }) => {
    if (failAll) throw new Error("Table 'st_260714' doesn't exist");
    const hit = failLastdays.find(ld => sql.includes(`st_${ld}`));
    if (hit) throw new Error(`Table 'st_${hit}' doesn't exist`);
    return [rows];
  });
  mysql.createConnection.mockResolvedValue(conn);
  return conn;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ─────────────────────────────────────────────────────

describe("processSingleStore — outcome & rekap_remote logging", () => {
  test("EXCEEDED: nilai di atas threshold → upsert summary, tetap di list, log jelas", async () => {
    mockWrcConnection({ filterRows: [sesuaiRow(String(THRESHOLD + 100000))] });

    const result = await penyesuaianService.processSingleStore(STORE, PERIODE, "2026", "07");

    expect(result.success).toBe(true);
    expect(result.outcome).toBe("EXCEEDED");
    expect(result.hasIssue).toBe(true);

    // Summary di-upsert (RECID='*') → tampil di list
    expect(SesuaiTokoSummary.upsert).toHaveBeenCalledTimes(1);
    expect(SesuaiTokoSummary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ KDTK, PERIODE, SESUAI: THRESHOLD + 100000, RECID: "*" }),
    );
    // Tidak di-resolve
    expect(SesuaiTokoSummary.update).not.toHaveBeenCalled();

    // Log rekap_remote per toko jelas: status token + detail nilai
    const log = lastRekapLog();
    expect(log).toEqual([
      CAB,
      KDTK,
      "penyesuaian",
      `[${KDTK}] EXCEEDED`,
      expect.stringContaining("melebihi threshold"),
    ]);
    expect(log[4]).toContain("500,000"); // threshold ikut di-log untuk analisa
  });

  test("BELOW_THRESHOLD: data ada tapi di bawah threshold → resolve (update RECID), log jelas", async () => {
    mockWrcConnection({ filterRows: [sesuaiRow(THRESHOLD)] }); // == threshold → belum EXCEEDED

    const result = await penyesuaianService.processSingleStore(STORE, PERIODE, "2026", "07");

    expect(result.success).toBe(true);
    expect(result.outcome).toBe("BELOW_THRESHOLD");
    expect(result.hasIssue).toBe(false);

    expect(SesuaiTokoSummary.upsert).not.toHaveBeenCalled();
    expect(SesuaiTokoSummary.update).toHaveBeenCalledTimes(1);
    expect(SesuaiTokoSummary.update).toHaveBeenCalledWith(
      { RECID: "1" },
      { where: { PERIODE, KDTK } },
    );

    const log = lastRekapLog();
    expect(log[3]).toBe(`[${KDTK}] BELOW_THRESHOLD`);
    expect(log[4]).toContain("di bawah threshold");
  });

  test("DATA_MISSING: SESUAI NULL (data ST tak ada) → screening DIBATALKAN, tanpa update DB, log jelas", async () => {
    const conn = mockWrcConnection({ filterRows: [sesuaiRow(null)], stCount: 0 });

    const result = await penyesuaianService.processSingleStore(STORE, PERIODE, "2026", "07");

    // Screening dibatalkan — bukan sukses, bukan error
    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(result.outcome).toBe("DATA_MISSING");
    // KUNCI FIX: toko TIDAK boleh di-resolve / diubah saat data sumber tidak ada
    expect(result.hasIssue).toBe(true);
    expect(SesuaiTokoSummary.update).not.toHaveBeenCalled();
    expect(SesuaiTokoSummary.upsert).not.toHaveBeenCalled();

    // Query diagnostik countStRows dieksekusi (filter + count = 2 query)
    expect(conn.query).toHaveBeenCalledTimes(2);
    expect(conn.query.mock.calls[1][0].sql).toContain(`st_`);

    const log = lastRekapLog();
    expect(log[3]).toBe(`[${KDTK}] DATA_ST_MISSING`);
    expect(log[4]).toContain("0 baris");
    expect(log[4]).toContain("DIBATALKAN");
    expect(log[4]).toContain("Tidak ada update ke DB");
  });

  test("DATA_MISSING: query countStRows gagal pun toko tetap tidak di-resolve", async () => {
    mockWrcConnection({ filterRows: [sesuaiRow(null)], failCount: true });

    const result = await penyesuaianService.processSingleStore(STORE, PERIODE, "2026", "07");

    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(result.outcome).toBe("DATA_MISSING");
    expect(SesuaiTokoSummary.update).not.toHaveBeenCalled();
    expect(lastRekapLog()[3]).toBe(`[${KDTK}] DATA_ST_MISSING`);
  });

  test("DATA_MISSING: filterResult kosong (0 baris) juga dianggap DATA_MISSING, bukan below threshold", async () => {
    mockWrcConnection({ filterRows: [], stCount: 0 });

    const result = await penyesuaianService.processSingleStore(STORE, PERIODE, "2026", "07");

    expect(result.outcome).toBe("DATA_MISSING");
    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(result.hasIssue).toBe(true);
    expect(SesuaiTokoSummary.update).not.toHaveBeenCalled();
    expect(lastRekapLog()[3]).toBe(`[${KDTK}] DATA_ST_MISSING`);
  });

  test("ERROR: query filter gagal → success=false, tidak di-resolve, log status ERROR", async () => {
    mockWrcConnection({ failFilter: true });

    const result = await penyesuaianService.processSingleStore(STORE, PERIODE, "2026", "07");

    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(false);
    expect(result.outcome).toBeNull();
    expect(SesuaiTokoSummary.update).not.toHaveBeenCalled();
    expect(SesuaiTokoSummary.upsert).not.toHaveBeenCalled();

    const log = lastRekapLog();
    expect(log[3]).toBe(`[${KDTK}] ERROR`);
    expect(log[4]).toContain("doesn't exist");
  });

  test("koneksi WRC gagal dibuka → log status ERROR, tidak di-resolve", async () => {
    mysql.createConnection.mockResolvedValue(null);

    const result = await penyesuaianService.processSingleStore(STORE, PERIODE, "2026", "07");

    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(false);
    expect(SesuaiTokoSummary.update).not.toHaveBeenCalled();
    expect(lastRekapLog()[3]).toBe(`[${KDTK}] ERROR`);
  });

  test("log final ditulis walau suppressIntermediateLogs=true (combined screening)", async () => {
    mockWrcConnection({ filterRows: [sesuaiRow(THRESHOLD + 500000)] });

    await penyesuaianService.processSingleStore(STORE, PERIODE, "2026", "07", null, null, {
      suppressIntermediateLogs: true,
    });

    expect(RekapRemoteService.addToTemp).toHaveBeenCalledTimes(1);
    expect(lastRekapLog()[3]).toBe(`[${KDTK}] EXCEEDED`);
  });
});

describe("config queries — filterWrc tidak lagi menyaring threshold di SQL", () => {
  test("filterWrc tidak punya HAVING (agar SESUAI NULL ≠ di bawah threshold)", () => {
    const sql = penyesuaianConfig.queries.filterWrc(CAB, PERIODE, KDTK, "260731");

    expect(sql).not.toMatch(/HAVING/i);
    expect(sql).toContain(`st_260731`);
    expect(sql).toContain(KDTK);
  });

  test("countStRows mengecek baris st milik toko", () => {
    const sql = penyesuaianConfig.queries.countStRows(KDTK, "260731");

    expect(sql).toContain("COUNT(*)");
    expect(sql).toContain("st_260731");
    expect(sql).toContain(KDTK);
  });

  test("sesuaiThreshold dipakai sebagai sumber kebenaran threshold", () => {
    expect(penyesuaianConfig.sesuaiThreshold).toBe(500000);
  });
});

describe("getDetailFromStore — lastday periode tarikan penyesuaian terakhir SUKSES", () => {
  test("pakai lastday dari UPDTIME summary (H-1 tanggal tarikan penyesuaian terakhir sukses)", async () => {
    SesuaiTokoSummary.findOne.mockResolvedValue({ UPDTIME: new Date("2026-07-15T10:00:00") });
    const conn = mockDetailWrc({ rows: [detailRow("000001")] });

    const result = await penyesuaianService.getDetailFromStore(KDTK, PERIODE);

    expect(result.success).toBe(true);
    expect(result.cancelled).toBe(false);
    expect(result.lastday).toBe("260714"); // H-1 dari 15 Juli 2026
    expect(conn.query).toHaveBeenCalledTimes(1);
    expect(conn.query.mock.calls[0][0].sql).toContain("st_260714");
    expect(SesuaiToko.destroy).toHaveBeenCalledTimes(1);
    expect(SesuaiToko.bulkCreate).toHaveBeenCalledTimes(1);
    expect(result.records).toHaveLength(1);
  });

  test("lastday summary gagal (tabel hilang) → fallback ke lastday terbaru dan tetap sukses", async () => {
    SesuaiTokoSummary.findOne.mockResolvedValue({ UPDTIME: new Date("2026-07-15T10:00:00") });
    const latest = penyesuaianService.getLastday("2026", "07");
    const conn = mockDetailWrc({ rows: [detailRow("000001")], failLastdays: ["260714"] });

    const result = await penyesuaianService.getDetailFromStore(KDTK, PERIODE);

    expect(result.success).toBe(true);
    expect(result.lastday).toBe(latest);
    expect(conn.query).toHaveBeenCalledTimes(2);
    expect(conn.query.mock.calls[1][0].sql).toContain(`st_${latest}`);
    expect(SesuaiToko.bulkCreate).toHaveBeenCalledTimes(1);
  });

  test("SEMUA kandidat gagal → cancelled=true, TANPA update DB (detail lama dipertahankan), tidak throw", async () => {
    SesuaiTokoSummary.findOne.mockResolvedValue({ UPDTIME: new Date("2026-07-15T10:00:00") });
    const conn = mockDetailWrc({ failAll: true });

    await expect(penyesuaianService.getDetailFromStore(KDTK, PERIODE)).resolves.toMatchObject({
      success: false,
      cancelled: true,
    });

    expect(SesuaiToko.destroy).not.toHaveBeenCalled();
    expect(SesuaiToko.bulkCreate).not.toHaveBeenCalled();
    expect(conn.end).toHaveBeenCalled();
  });

  test("summary belum ada → langsung pakai lastday terbaru (1 percobaan)", async () => {
    SesuaiTokoSummary.findOne.mockResolvedValue(null);
    const latest = penyesuaianService.getLastday("2026", "07");
    const conn = mockDetailWrc({ rows: [detailRow("000001")] });

    const result = await penyesuaianService.getDetailFromStore(KDTK, PERIODE);

    expect(result.lastday).toBe(latest);
    expect(conn.query).toHaveBeenCalledTimes(1);
    expect(conn.query.mock.calls[0][0].sql).toContain(`st_${latest}`);
  });
});

describe("loadRecordsDetailFromDb — tarik detail dibatalkan → data detail lama tetap dipakai", () => {
  test("records lama dikembalikan apa adanya, tanpa update DB & tanpa log rekap_remote", async () => {
    const staleRows = [
      { RECID: "*", CABANG: CAB, PERIODE, KDTK, PRDCD: "000001", SINGKATAN: "Item", SESUAI: "600000", STATUS_UPDTIME: "UPD" },
    ];
    SesuaiToko.getModel.mockResolvedValue({ sequelize: { query: jest.fn(async () => staleRows) } });
    SesuaiTokoSummary.findOne.mockResolvedValue({ UPDTIME: new Date("2026-07-15T10:00:00") });
    mockDetailWrc({ failAll: true });

    const result = await penyesuaianService.loadRecordsDetailFromDb({ periode: PERIODE, cabang: CAB, kdtk: KDTK });

    expect(result).toEqual(staleRows);
    expect(result).toHaveLength(1);
    // Tanpa update DB apa pun
    expect(SesuaiToko.destroy).not.toHaveBeenCalled();
    expect(SesuaiToko.bulkCreate).not.toHaveBeenCalled();
    // Menampilkan detail BUKAN screening → tidak boleh menulis rekap_remote
    // (status log screening bisa menipu screeningGuard agar skip hari yang sama)
    expect(RekapRemoteService.addToTemp).not.toHaveBeenCalled();
  });
});
