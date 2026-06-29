/**
 * Unit Tests: Rekon Sales Module
 *
 * Tests service-layer methods with mocked dependencies.
 * Covers: screening, read data, single-store refresh, note CRUD
 *
 * Run with: npm test -- --testPathPattern=rekon_sales
 */

// ─── Mock all external deps BEFORE any imports ────────────────

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock("../modules/rekon_sales/rekon_sales.config.js", () => ({
  __esModule: true,
  default: {
    connectionRetry: { maxRetries: 3, retryDelay: 2000 },
    parallelProcessing: { concurrencyLimit: 5, branchConcurrencyLimit: 2, storeTimeoutMs: 120000, queryTimeoutMs: 10000 },
    taskProgressName: "rekonSalesTask",
    cache: { summaryTTL: 3600000, detailTTL: 300000, cleanupInterval: 600000, inactiveThreshold: 1800000 },
    storage: { baseDir: "data/rekon_sales", filePrefix: "rekon_sales" },
    tolerance: 50,
  },
}));

jest.mock("sequelize", () => {
  const actual = jest.requireActual("sequelize");
  return { ...actual, DataTypes: actual.DataTypes };
});

// Config (used by model files; uses import.meta.url which breaks in Jest)
jest.mock("../config/index.js", () => ({
  __esModule: true,
  default: { resilientDb: { getDatabase: async () => null } },
}));

jest.mock("../config/db_store.js", () => ({
  __esModule: true,
  default: {
    createDbStore: jest.fn(() => Promise.resolve(null)),
  },
}));

const mockCacheManager = {
  initialize: jest.fn(),
  generateKey: jest.fn(() => "mock-key"),
  get: jest.fn(() => null),
  set: jest.fn(),
  clear: jest.fn(),
  loadFromFile: jest.fn(() => Promise.resolve([])),
  saveToFile: jest.fn(() => Promise.resolve()),
};
jest.mock("../modules/rekon_sales/cache.manager.js", () => ({
  __esModule: true,
  default: jest.fn(() => mockCacheManager),
}));

jest.mock("p-limit", () => ({
  __esModule: true,
  default: jest.fn(() => async fn => { return await fn(); }),
}));

// ─── Mock data fixtures ─────────────────────────────────────

// Data for syncToJsonFile-based methods (getSummary, getResumeByKdtk, etc.)
// Uses ORIGINAL column names (no SQL aliases)
const mockRekonSalesRows = [
  {
    RECID: "*", CAB: "G033", KDTK: "TW75", TANGGAL: "2025-05-15",
    NET_TOKO: 1500000, NET_GL: 1499500, SEL_NET_GL: 500,
    NET_CLOSINGDETAIL: 1499000, SEL_NET_CD: 1000,
    PPN_MTRAN: 150000, PPN_GL: 149950, SEL_PPN_GL: 50,
    PPN_CD: 149900, SEL_PPN_CD: 100,
    RETUR_PPNJP_ISTORE: 0,
    NET_RETUR_ECOM: 0, PPN_RETUR_ECOM: 0,
    UPDTIME: "2025-05-16 10:00:00",
  },
  {
    RECID: "*", CAB: "G033", KDTK: "T001", TANGGAL: "2025-05-16",
    NET_TOKO: 2300000, NET_GL: 2300100, SEL_NET_GL: -100,
    NET_CLOSINGDETAIL: 2300000, SEL_NET_CD: 0,
    PPN_MTRAN: 230000, PPN_GL: 230010, SEL_PPN_GL: -10,
    PPN_CD: 230000, SEL_PPN_CD: 0,
    RETUR_PPNJP_ISTORE: 500,
    NET_RETUR_ECOM: 100, PPN_RETUR_ECOM: 10,
    UPDTIME: "2025-05-17 10:00:00",
  },
];

// Data for getFullRekonSalesData — uses ALIASED column names from the SQL query
// (r.NET_CLOSINGDETAIL AS NET_CD, r.PPN_MTRAN AS PPN_TOKO, etc.)
const mockFullRekonSalesRows = [
  {
    RECID: "*", CAB: "G033", KDTK: "TW75", TANGGAL: "2025-05-15",
    NET_TOKO: 1500000, NET_GL: 1499500, SEL_NET_GL: 500,
    NET_CD: 1499000, SEL_NET_CD: 1000,
    PPN_TOKO: 150000, PPN_GL: 149950, SEL_PPN_GL: 50,
    PPN_CD: 149900, SEL_PPN_CD: 100,
    RETUR_PPNJP_ISTORE: 0,
    SEL_PPN_CD2: 100,
    NET_RETUR_ECOM: 0, PPN_RETUR_ECOM: 0,
    KETFU: "Catatan test", UPDTIME_NOTE: "2025-05-16T10:00:00.000Z",
    FULLNAME: "Test User", SEL_KODE_PESAN: "A12345678",
  },
  {
    RECID: "*", CAB: "G033", KDTK: "T001", TANGGAL: "2025-05-16",
    NET_TOKO: 2300000, NET_GL: 2300100, SEL_NET_GL: -100,
    NET_CD: 2300000, SEL_NET_CD: 0,
    PPN_TOKO: 230000, PPN_GL: 230010, SEL_PPN_GL: -10,
    PPN_CD: 230000, SEL_PPN_CD: 0,
    RETUR_PPNJP_ISTORE: 500,
    SEL_PPN_CD2: -500,
    NET_RETUR_ECOM: 100, PPN_RETUR_ECOM: 10,
    KETFU: null, UPDTIME_NOTE: null,
    FULLNAME: null, SEL_KODE_PESAN: null,
  },
];

const mockMtranVsCdRows = [
  {
    CAB: "G033", SHOP: "TW75", TANGGAL: "2025-05-15",
    DOCNO: "DOC001", SEQNO: 1, PLU: "899999001", SINGKATAN: "Test Item A",
    QTY: "2", PRICE: "50000", GROSS: "100000", HPP: "80000",
    SELISIH: "1000", RTYPE: "J", ISPPN: "Y",
  },
  {
    CAB: "G033", SHOP: "TW75", TANGGAL: "2025-05-15",
    DOCNO: "DOC001", SEQNO: 2, PLU: "899999002", SINGKATAN: "Test Item B",
    QTY: "1", PRICE: "25000", GROSS: "25000", HPP: "20000",
    SELISIH: "500", RTYPE: "J", ISPPN: "N",
  },
];

const mockStoreService = {
  ensureInitialized: jest.fn(),
  stores: [
    { storeCode: "TW75", branch: "G033", cab: "G033", notes: "INDUK" },
    { storeCode: "T001", branch: "G033", cab: "G033", notes: "INDUK" },
  ],
  getStoreByCode: jest.fn(code => {
    if (code === "TW75") return { storeCode: "TW75", branch: "G033", cab: "G033", storeName: "Toko TW75" };
    if (code === "T001") return { storeCode: "T001", branch: "G033", cab: "G033", storeName: "Toko T001" };
    return null;
  }),
  getStoreIPHost: jest.fn(() => Promise.resolve({ dbHost: "localhost", dbName: "test_db" })),
  getStoresByBranch: jest.fn(() => [{ storeCode: "TW75", cab: "G033" }, { storeCode: "T001", cab: "G033" }]),
};

jest.mock("../modules/store/storeService.js", () => ({
  __esModule: true,
  default: mockStoreService,
}));

jest.mock("../modules/rekon_sales/helpers/wrc.data.helper.js", () => ({
  __esModule: true,
  default: {
    openDataGLWrc: jest.fn(() => Promise.resolve({ data: [] })),
    tarikKodePesanan: jest.fn(() => Promise.resolve("")),
  },
}));

jest.mock("../modules/rekon_sales/helpers/store.query.helper.js", () => ({
  __esModule: true,
  default: {
    fetchMtranVsCD: jest.fn(() => Promise.resolve([])),
    cekSelisihMtranVsCD: jest.fn(() => Promise.resolve([])),
  },
}));

jest.mock("../modules/rekon_sales/helpers/rekon.calculator.js", () => ({
  __esModule: true,
  default: {
    calculateRekon: jest.fn(() => ({ records: [], hasIssue: false, diffData: [], detailData: [] })),
  },
}));

jest.mock("../modules/rekap_remote/rekap_remote.service.js", () => ({
  __esModule: true,
  default: {
    addToTemp: jest.fn(),
    saveLogsToDatabase: jest.fn(),
  },
}));

const mockProgressService = {
  startProgress: jest.fn(),
  updateProgress: jest.fn(),
  failProgress: jest.fn(),
  completeProgress: jest.fn(),
  isAborted: jest.fn(() => false),
};
jest.mock("../modules/progress/progress.service.js", () => ({
  __esModule: true,
  default: mockProgressService,
}));

jest.mock("../utils/screeningGuard.js", () => ({
  __esModule: true,
  default: {
    isSuccessToday: jest.fn(() => Promise.resolve({ screened: false, reason: "no_data" })),
  },
}));

jest.mock("../modules/notes/notes.service.js", () => ({
  __esModule: true,
  default: {
    upsert: jest.fn(data => Promise.resolve({
      toJSON: () => ({ ...data, fullName: "Test User" }),
    })),
    removeByKey: jest.fn(() => Promise.resolve({ deleted: true })),
    getByKey: jest.fn(() => Promise.resolve(null)),
  },
}));

jest.mock("../modules/user/user.service.js", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    findByCredentials: jest.fn(() => Promise.resolve({ username: "testuser", fullName: "Test User" })),
  })),
}));

// ─── Import live module ──────────────────────────────────────

let rekonSalesService;
let screeningGuard;
let RekonCalculator;
let RekonSales;
let DetailRekonSales;
let MtranVsCd;

beforeAll(async () => {
  const mod = await import("../modules/rekon_sales/rekon_sales.service.js");
  rekonSalesService = mod.default;
  const sg = await import("../utils/screeningGuard.js");
  screeningGuard = sg.default;
  const rc = await import("../modules/rekon_sales/helpers/rekon.calculator.js");
  RekonCalculator = rc.default;
  const rs = await import("../modules/rekon_sales/models/rekon_sales.model.js");
  RekonSales = rs.default;
  const drs = await import("../modules/rekon_sales/models/detail_rekon_sales.model.js");
  DetailRekonSales = drs.default;
  const mvc = await import("../modules/rekon_sales/models/mtran_vs_cd.model.js");
  MtranVsCd = mvc.default;
});

beforeEach(() => {
  rekonSalesService.invalidateCache();
  // Re-set default mock implementations that jest.clearAllMocks would wipe
});

// ─── Helpers ─────────────────────────────────────────────────

function mockRekonSalesModelQuery(fn) {
  jest.spyOn(RekonSales, "getModel").mockResolvedValue({
    sequelize: { query: fn },
    destroy: jest.fn(() => Promise.resolve(1)),
  });
}

function mockMtranVsCdFindAll(fn) {
  jest.spyOn(MtranVsCd, "getModel").mockResolvedValue({
    findAll: fn,
  });
}

// ══════════════════════════════════════════════════════════════
// 1. SCREENING — Level 3 (Single Store Refresh)
// ══════════════════════════════════════════════════════════════

describe("screening — Level 3 (Single Store)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rekonSalesService.invalidateCache();
    // Restore default implementations after clearAllMocks
    mockStoreService.getStoreByCode.mockImplementation(code => {
      if (code === "TW75") return { storeCode: "TW75", branch: "G033", cab: "G033" };
      if (code === "T001") return { storeCode: "T001", branch: "G033", cab: "G033" };
      return null;
    });
    mockStoreService.getStoreIPHost.mockImplementation(() => Promise.resolve({ dbHost: "localhost", dbName: "test_db" }));
    mockStoreService.getStoresByBranch.mockImplementation(() =>
      [{ storeCode: "TW75", cab: "G033" }, { storeCode: "T001", cab: "G033" }]
    );
    RekonCalculator.calculateRekon.mockImplementation(() => []);
    screeningGuard.isSuccessToday.mockImplementation(() => Promise.resolve({ screened: false, reason: "no_data" }));
  });

  test("sukses screening 1 toko tanpa issue", async () => {
    mockRekonSalesModelQuery(jest.fn(() => Promise.resolve([[], {}])));
    mockMtranVsCdFindAll(jest.fn(() => Promise.resolve([])));

    const result = await rekonSalesService.screening({
      kdtk: "TW75",
      periode: "2025-05",
      username: "testuser",
      fullName: "Test User",
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.message).toContain("TW75");
    expect(result.hasIssues).toBe(false);

    const RekapRemoteService = require("../modules/rekap_remote/rekap_remote.service.js").default;
    expect(RekapRemoteService.saveLogsToDatabase).toHaveBeenCalled();
  });

  test("sukses screening 1 toko dengan issue", async () => {
    const dbStore = require("../config/db_store.js").default;
    dbStore.createDbStore.mockResolvedValue({
      end: jest.fn(),
    });

    jest.spyOn(RekonSales, "bulkCreate").mockResolvedValue([]);

    const StoreQueryHelper = require("../modules/rekon_sales/helpers/store.query.helper.js").default;
    StoreQueryHelper.fetchMtranVsCD.mockResolvedValue([{
      SHOP: "TW75", TANGGAL: "2025-05-15", CAB: "G033",
    }]);

    RekonCalculator.calculateRekon.mockResolvedValue([{
      CAB: "G033", KDTK: "TW75", TGL: "2025-05-15",
      NET_TOKO: 1500000, NET_GL: 1499500, NET_CLOSINGDETAIL: 1499000,
      SEL_NET_GL: 500, SEL_NET_CD: 1000,
      PPN_TOKO: 150000, PPN_GL: 149950, PPN_CD: 149900,
      SEL_PPN_GL: 50, SEL_PPN_CD: 100,
      NET_RETUR_ECOM: 0, PPN_RETUR_ECOM: 0, RETUR_PPNJP_ISTORE: 0,
    }]);

    mockRekonSalesModelQuery(jest.fn(() => Promise.resolve([[], {}])));
    mockMtranVsCdFindAll(jest.fn(() => Promise.resolve([])));

    const result = await rekonSalesService.screening({
      kdtk: "TW75",
      periode: "2025-05",
      username: "testuser",
      fullName: "Test User",
    });

    expect(result.success).toBe(true);
    expect(result.hasIssues).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// 2. SCREENING — Level 1 & 2 (Mass / Branch)
// ══════════════════════════════════════════════════════════════

describe("screening — Level 1 & 2 (Multi-Store)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rekonSalesService.invalidateCache();
    mockStoreService.getStoreByCode.mockImplementation(code => {
      if (code === "TW75") return { storeCode: "TW75", branch: "G033", cab: "G033" };
      if (code === "T001") return { storeCode: "T001", branch: "G033", cab: "G033" };
      return null;
    });
    mockStoreService.getStoreIPHost.mockImplementation(() => Promise.resolve({ dbHost: "localhost", dbName: "test_db" }));
    mockStoreService.getStoresByBranch.mockImplementation(() =>
      [{ storeCode: "TW75", cab: "G033" }, { storeCode: "T001", cab: "G033" }]
    );
    RekonCalculator.calculateRekon.mockImplementation(() => []);
    screeningGuard.isSuccessToday.mockImplementation(() => Promise.resolve({ screened: false, reason: "no_data" }));
    WrcDataHelper.openDataGLWrc.mockImplementation(() => Promise.resolve({ data: [] }));
    // Prevent timeout by making processSingleStore return immediately
    mockStoreService.getStoreIPHost.mockImplementation(() => Promise.resolve(null));
  });

  let WrcDataHelper;

  beforeAll(async () => {
    const wrc = await import("../modules/rekon_sales/helpers/wrc.data.helper.js");
    WrcDataHelper = wrc.default;
  });

  test("Level 1 : screening All cabang", async () => {
    jest.spyOn(RekonSales, "bulkCreate").mockResolvedValue([]);
    jest.spyOn(MtranVsCd, "bulkCreate").mockResolvedValue([]);

    mockRekonSalesModelQuery(jest.fn(() => Promise.resolve([[], {}])));
    mockMtranVsCdFindAll(jest.fn(() => Promise.resolve([])));

    const result = await rekonSalesService.screening({
      cabang: "All",
      periode: "2025-05",
      username: "testuser",
      fullName: "Test User",
    });

    expect(result).toBeDefined();
  });

  test("Level 2 : screening 1 cabang — screeningGuard dijalankan", async () => {
    jest.spyOn(RekonSales, "bulkCreate").mockResolvedValue([]);
    jest.spyOn(DetailRekonSales, "bulkCreate").mockResolvedValue([]);
    jest.spyOn(MtranVsCd, "bulkCreate").mockResolvedValue([]);

    mockRekonSalesModelQuery(jest.fn(() => Promise.resolve([[], {}])));
    mockMtranVsCdFindAll(jest.fn(() => Promise.resolve([])));

    const result = await rekonSalesService.screening({
      cabang: "G033",
      periode: "2025-05",
      username: "testuser",
      fullName: "Test User",
    });

    expect(result).toBeDefined();
    expect(result.screenedStores).toBeGreaterThan(0);
    expect(result.activeStores).toBe(0);
    expect(result.resolvedStores).toBeGreaterThan(0);
    expect(mockProgressService.startProgress).toHaveBeenCalled();
    expect(mockProgressService.completeProgress).toHaveBeenCalled();
  });

  test("Level 2 : skip toko yg sudah sukses hari ini (screeningGuard)", async () => {
    // Make getStoreIPHost return null again (skips processSingleStore)
    mockStoreService.getStoreIPHost.mockImplementation(() => Promise.resolve(null));

    screeningGuard.isSuccessToday.mockResolvedValueOnce({ screened: true, reason: "already_success_today", updtime: "2025-05-17" });

    jest.spyOn(RekonSales, "bulkCreate").mockResolvedValue([]);

    mockRekonSalesModelQuery(jest.fn(() => Promise.resolve([[], {}])));
    mockMtranVsCdFindAll(jest.fn(() => Promise.resolve([])));

    const result = await rekonSalesService.screening({
      cabang: "G033",
      periode: "2025-05",
      username: "testuser",
      fullName: "Test User",
    });

    expect(result).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════
// 3. GET FULL REKON SALES DATA (Display)
// ══════════════════════════════════════════════════════════════

describe("getFullRekonSalesData", () => {
  test("returns formatted data untuk cabang spesifik", async () => {
    mockRekonSalesModelQuery(jest.fn(() => Promise.resolve([mockFullRekonSalesRows, {}])));

    const result = await rekonSalesService.getFullRekonSalesData({ cabang: "G033", month: "05", year: "2025" });

    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(2);

    const first = result[0];
    expect(first.cab).toBe("G033");
    expect(first.kdtk).toBe("TW75");
    expect(first.tgl).toBe("2025-05-15");

    // Field mapping (SQL aliases)
    expect(first.net_toko).toBe(1500000);
    expect(first.net_gl).toBe(1499500);
    expect(first.sel_net_gl).toBe(500);
    expect(first.net_cd).toBe(1499000);
    expect(first.sel_net_cd).toBe(1000);
    expect(first.ppn_toko).toBe(150000);
    expect(first.ppn_gl).toBe(149950);
    expect(first.ppn_cd).toBe(149900);

    // sel_ppn_cd2 calculated field
    expect(first.sel_ppn_cd2).toBe(100); // SEL_PPN_CD(100) - RETUR_PPNJP_ISTORE(0)

    // Note fields
    expect(first.ketfu).toBe("Catatan test");
    expect(first.fullname).toBe("Test User");

    // Kode pesanan issues
    expect(first.sel_kode_pesan).toBe("A12345678");
  });

  test("sel_ppn_cd2 = SEL_PPN_CD - RETUR_PPNJP_ISTORE", async () => {
    mockRekonSalesModelQuery(jest.fn(() => Promise.resolve([mockFullRekonSalesRows, {}])));

    const result = await rekonSalesService.getFullRekonSalesData({ cabang: "G033", month: "05", year: "2025" });

    // T001 has SEL_PPN_CD=0 and RETUR_PPNJP_ISTORE=500 → sel_ppn_cd2 = -500
    const t001 = result.find(r => r.kdtk === "T001");
    expect(t001.sel_ppn_cd2).toBe(-500);
  });

  test("return empty array jika tidak ada data", async () => {
    mockRekonSalesModelQuery(jest.fn(() => Promise.resolve([[], {}])));

    const result = await rekonSalesService.getFullRekonSalesData({ cabang: "All", month: "05", year: "2025" });
    expect(result).toEqual([]);
  });

  test("throw error jika month atau year kosong", async () => {
    await expect(
      rekonSalesService.getFullRekonSalesData({ cabang: "All" }),
    ).rejects.toThrow("Month and year are required");
  });

  test("throw error jika query gagal", async () => {
    mockRekonSalesModelQuery(jest.fn(() => Promise.reject(new Error("DB connection lost"))));

    await expect(
      rekonSalesService.getFullRekonSalesData({ cabang: "G033", month: "05", year: "2025" }),
    ).rejects.toThrow("DB connection lost");
  });
});

// ══════════════════════════════════════════════════════════════
// 4. GET DETAIL REKON SALES (per-item)
// ══════════════════════════════════════════════════════════════

describe("getDetailRekonSales", () => {
  test("returns per-item detail untuk 1 toko + tanggal", async () => {
    mockMtranVsCdFindAll(jest.fn(() => Promise.resolve(mockMtranVsCdRows)));

    const result = await rekonSalesService.getDetailRekonSales({ kdtk: "TW75", tanggal: "2025-05-15" });

    expect(result).toBeInstanceOf(Array);
    expect(result).toHaveLength(2);

    const first = result[0];
    expect(first.shop).toBe("TW75");
    expect(first.plu).toBe("899999001");
    expect(first.singkatan).toBe("Test Item A");
    expect(first.qty).toBe(2);
    expect(first.price).toBe(50000);
    expect(first.gross).toBe(100000);
    expect(first.hpp).toBe(80000);
    expect(first.selisih).toBe(1000);
    expect(first.rtype).toBe("J");
    expect(first.isppn).toBe("Y");
  });

  test("return empty array jika tidak ada data", async () => {
    mockMtranVsCdFindAll(jest.fn(() => Promise.resolve([])));

    const result = await rekonSalesService.getDetailRekonSales({ kdtk: "XXXX", tanggal: "2025-05-15" });
    expect(result).toEqual([]);
  });

  test("throw error jika kdtk atau tanggal kosong", async () => {
    await expect(
      rekonSalesService.getDetailRekonSales({ kdtk: "TW75" }),
    ).rejects.toThrow("kdtk and tanggal are required");
  });
});

// ══════════════════════════════════════════════════════════════
// 5. SUMMARY
// ══════════════════════════════════════════════════════════════

describe("getSummary", () => {
  beforeEach(() => {
    // Reset loadedPeriod so ensureDataLoaded actually loads fresh data
    rekonSalesService.invalidateCache();
  });

  test("menghitung aggregasi dari semua toko", async () => {
    mockRekonSalesModelQuery(jest.fn(() => Promise.resolve([mockRekonSalesRows, {}])));

    const result = await rekonSalesService.getSummary({ cabang: "G033", month: "05", year: "2025" });

    expect(result).toBeDefined();
    expect(result.data.total_stores).toBe(2);
    expect(result.data.total_issues).toBe(2);
    expect(result.data.total_sel_net_gl).toBe(600); // |500| + |-100|
    expect(result.data.total_sel_net_cd).toBe(1000); // |1000| + |0|
    expect(result.data.total_sel_ppn_gl).toBe(60); // |50| + |-10|
    expect(result.data.total_sel_ppn_cd).toBe(100); // |100| + |0|
  });

  test("throw error jika month/year kosong", async () => {
    await expect(
      rekonSalesService.getSummary({ cabang: "All" }),
    ).rejects.toThrow("Year and month are required to load data");
  });
});

// ══════════════════════════════════════════════════════════════
// 6. RESUME BY KDTK (Paginated)
// ══════════════════════════════════════════════════════════════

describe("getResumeByKdtk", () => {
  beforeEach(() => {
    rekonSalesService.invalidateCache();
  });

  test("mengembalikan resume dengan pagination default", async () => {
    mockRekonSalesModelQuery(jest.fn(() => Promise.resolve([mockRekonSalesRows, {}])));

    const result = await rekonSalesService.getResumeByKdtk({ cabang: "G033", month: "05", year: "2025" });

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });
});

// ══════════════════════════════════════════════════════════════
// 7. STORE DETAILS, DIFFERENCES, KODE PESANAN ISSUES
// ══════════════════════════════════════════════════════════════

describe("getStoreDetailsByMonth", () => {
  test("mengembalikan detail toko per bulan", async () => {
    jest.spyOn(RekonSales, "getModel").mockResolvedValue({
      findAll: jest.fn(() => Promise.resolve(mockRekonSalesRows)),
    });

    const result = await rekonSalesService.getStoreDetailsByMonth({ kdtk: "TW75", month: "05", year: "2025" });

    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.daily).toBeDefined();
    expect(result.notes).toBeDefined();
  });
});

describe("getDifferencesByMonth", () => {
  test("mengembalikan differences per bulan", async () => {
    jest.spyOn(MtranVsCd, "getModel").mockResolvedValue({
      findAll: jest.fn(() => Promise.resolve(mockMtranVsCdRows.map(r => ({ ...r, toJSON: () => r })))),
    });

    const result = await rekonSalesService.getDifferencesByMonth({ kdtk: "TW75", month: "05", year: "2025" });

    expect(result).toBeDefined();
    expect(result.daily).toBeDefined();
    expect(Array.isArray(result.daily)).toBe(true);
  });
});

describe("getKodePesananIssuesByMonth", () => {
  test("mengembalikan kode pesanan issues per bulan", async () => {
    const mockDetailRows = [
      { KDTK: "TW75", TGL: "2025-05-15", SUBKEY: "SEL_KODEPESANAN", VALSUBKEY: "A12345678", CAB: "G033",
        toJSON: function () { return { ...this, SELKODE: this.VALSUBKEY || "" }; } },
    ];

    jest.spyOn(DetailRekonSales, "getModel").mockResolvedValue({
      findAll: jest.fn(() => Promise.resolve(mockDetailRows)),
    });

    const result = await rekonSalesService.getKodePesananIssuesByMonth({ kdtk: "TW75", month: "05", year: "2025" });

    expect(result).toBeDefined();
    expect(result.daily).toBeDefined();
    expect(result.daily.length).toBeGreaterThanOrEqual(1);
  });
});

// ══════════════════════════════════════════════════════════════
// 8. EXPORT DATA
// ══════════════════════════════════════════════════════════════

describe("getExportData", () => {
  beforeEach(() => {
    rekonSalesService.invalidateCache();
  });

  test("mengembalikan summary + stores", async () => {
    mockRekonSalesModelQuery(jest.fn(() => Promise.resolve([mockRekonSalesRows, {}])));

    const result = await rekonSalesService.getExportData({ cabang: "G033", month: "05", year: "2025" });

    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.stores).toBeDefined();
    expect(Array.isArray(result.stores)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// 9. NOTE CRUD (via controller-level simulation)
// ══════════════════════════════════════════════════════════════

describe("Note operations", () => {
  let notesService;
  let UserService;

  beforeAll(async () => {
    const ns = await import("../modules/notes/notes.service.js");
    notesService = ns.default;
    const us = await import("../modules/user/user.service.js");
    UserService = us.default;
  });

  test("Controller updateNote: sukses create note baru", async () => {
    const { updateNote } = await import("../modules/rekon_sales/rekon_sales.controller.js");
    const mockReq = {
      user: { username: "testuser" },
      body: {
        cabang: "G033",
        kdtk: "TW75",
        tanggal: "2025-05-15",
        noteText: "Testing catatan baru",
      },
    };
    const mockRes = {
      json: jest.fn(),
      status: jest.fn(() => mockRes),
    };

    await updateNote(mockReq, mockRes);

    expect(notesService.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        Cabang: "G033",
        unixKey: "TW752025-05-15",
        noteText: "Testing catatan baru",
        tableName: "rekon_sales",
      }),
    );
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  test("Controller updateNote: hapus note jika noteText kosong", async () => {
    const { updateNote } = await import("../modules/rekon_sales/rekon_sales.controller.js");
    const mockReq = {
      user: { username: "testuser" },
      body: {
        cabang: "G033",
        kdtk: "TW75",
        tanggal: "2025-05-15",
        noteText: "",
      },
    };
    const mockRes = {
      json: jest.fn(),
      status: jest.fn(() => mockRes),
    };

    await updateNote(mockReq, mockRes);

    expect(notesService.removeByKey).toHaveBeenCalledWith("rekon_sales", "TW752025-05-15");
  });

  test("Controller updateNote: error jika field wajib kosong", async () => {
    const { updateNote } = await import("../modules/rekon_sales/rekon_sales.controller.js");
    const mockReq = {
      user: { username: "testuser" },
      body: {
        kdtk: "TW75",
        tanggal: "2025-05-15",
        noteText: "test",
      },
    };
    const mockRes = {
      json: jest.fn(),
      status: jest.fn(() => mockRes),
    };

    const { apiResponse } = await import("../utils/index.js");
    const badRequestSpy = jest.spyOn(apiResponse, "badRequest");

    await updateNote(mockReq, mockRes);

    expect(badRequestSpy).toHaveBeenCalled();
  });

  test("Controller updateNote: error jika noteText undefined", async () => {
    const { updateNote } = await import("../modules/rekon_sales/rekon_sales.controller.js");
    const mockReq = {
      user: { username: "testuser" },
      body: {
        cabang: "G033",
        kdtk: "TW75",
        tanggal: "2025-05-15",
      },
    };
    const mockRes = {
      json: jest.fn(),
      status: jest.fn(() => mockRes),
    };

    const { apiResponse } = await import("../utils/index.js");
    const badRequestSpy = jest.spyOn(apiResponse, "badRequest");

    await updateNote(mockReq, mockRes);

    expect(badRequestSpy).toHaveBeenCalledWith(mockRes, "noteText wajib diisi");
  });
});
