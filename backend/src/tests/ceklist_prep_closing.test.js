/**
 * Unit Tests: ceklist-prep-closing module
 *
 * Run with:  npm test -- --testPathPattern=ceklist-prep-closing
 * or:        npm run test ceklist-prep-closing
 */

// ─── Mock all external dependencies BEFORE any imports ────────────────────────

// Logger stub
jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} },
}));

// Config / resilientDb stub
jest.mock("../config/index.js", () => ({
  __esModule: true,
  default: { resilientDb: { getDatabase: async () => null } },
}));

// Sequelize DataTypes stub (so model file loads without a real DB)
jest.mock("sequelize", () => {
  const actual = jest.requireActual("sequelize");
  return { ...actual, DataTypes: actual.DataTypes };
});

// ─── Mock the 3 ceklist Sequelize wrappers ────────────────────────────────────

const mockHddRows = [
  { ID: "G0332410", KDCAB: "G033", IP: "192.168.1.1", PERIODE: "2410", FREE_SPACE: "37.1 GB", TGL_CHECK: null, OS: "WINDOWS", FU: null, FREE_AFTER: null },
  { ID: "G0342410", KDCAB: "G034", IP: "192.168.1.2", PERIODE: "2410", FREE_SPACE: "1.81 TB", TGL_CHECK: null, OS: "WINDOWS", FU: null, FREE_AFTER: null },
];
const mockHddPrevRows = [
  { ID: "G0332409", KDCAB: "G033", IP: "192.168.1.1", PERIODE: "2409", FREE_SPACE: "50 GB" },
];

jest.mock("../modules/ceklist-prep-closing/ceklist_prep_closing.model.js", () => ({
  __esModule: true,
  CeklistSpaceHddWrapper: {
    findAll: jest.fn(({ where }) => {
      if (where?.PERIODE === "2410") return Promise.resolve(mockHddRows);
      if (where?.PERIODE === "2409") return Promise.resolve(mockHddPrevRows);
      return Promise.resolve([]);
    }),
    findByPk: jest.fn(pk => {
      const all = [...mockHddRows, ...mockHddPrevRows];
      const found = all.find(r => r.ID === pk);
      return Promise.resolve(found ? { dataValues: found } : null);
    }),
    upsert: jest.fn(() => Promise.resolve([{}, true])),
    destroy: jest.fn(() => Promise.resolve(1)),
  },
  CeklistSpaceTampungWrapper: {
    findAll: jest.fn(() => Promise.resolve([])),
    findByPk: jest.fn(() => Promise.resolve(null)),
    upsert: jest.fn(() => Promise.resolve([{}, true])),
    destroy: jest.fn(() => Promise.resolve(1)),
  },
  CeklistImportIdtWrapper: {
    findAll: jest.fn(() => Promise.resolve([])),
    findByPk: jest.fn(() => Promise.resolve(null)),
    upsert: jest.fn(() => Promise.resolve([{}, true])),
    destroy: jest.fn(() => Promise.resolve(1)),
    bulkCreate: jest.fn(() => Promise.resolve([])),
  },
}));

// Mock storeService for importIdtService tests
jest.mock("../modules/store/storeService.js", () => ({
  __esModule: true,
  default: {
    stores: [
      { notes: "INDUK", branch: "G033", storeCode: "G033" },
      { notes: "INDUK", branch: "G034", storeCode: "G034" },
      { notes: "STB",   branch: "G033", storeCode: "G033" }, // non-INDUK, should be excluded
    ],
    initialized: true,
    ensureInitialized: jest.fn(() => Promise.resolve()),
  },
}));

// Mock prep-closing model for rekap_screening service
jest.mock("../modules/prep-closing/prep_closing.model.js", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(() => Promise.resolve([
      {
        dataValues: {
          ID: "G0339901012410",
          RECID: "*",
          CAB: "G033",
          KDTK: "9901",
          PRD_CLOSING: "2410",
          ISSUES: [{ key: "const_prd_check" }, { key: "vir_disc05_check" }],
          CRITICAL_ISSUES: 1,
          FAILED_RULES: 2,
          TOTAL_RULES: 10,
          LAST_SCREENED: "2024-10-15T10:00:00Z",
        },
      },
    ])),
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Helper: parseGb", () => {
  let parseGb;

  beforeAll(async () => {
    const mod = await import("../modules/ceklist-prep-closing/services/space_hdd.service.js");
    parseGb = mod.parseGb;
  });

  test("parses GB string", () => {
    expect(parseGb("37.1 GB")).toBeCloseTo(37.1);
  });

  test("parses TB string and converts to GB", () => {
    expect(parseGb("1.81 TB")).toBeCloseTo(1853.44);
  });

  test("parses MB string and converts to GB", () => {
    expect(parseGb("512 MB")).toBeCloseTo(0.5);
  });

  test("returns null for null/undefined input", () => {
    expect(parseGb(null)).toBeNull();
    expect(parseGb(undefined)).toBeNull();
  });

  test("returns null for unrecognized format", () => {
    expect(parseGb("unknown")).toBeNull();
  });
});

describe("Helper: getPreviousPeriode", () => {
  let getPreviousPeriode;

  beforeAll(async () => {
    const mod = await import("../modules/ceklist-prep-closing/services/space_hdd.service.js");
    getPreviousPeriode = mod.getPreviousPeriode;
  });

  test("decrements month", () => {
    expect(getPreviousPeriode("2410")).toBe("2409");
    expect(getPreviousPeriode("2412")).toBe("2411");
  });

  test("handles year rollover: January → December of previous year", () => {
    expect(getPreviousPeriode("2501")).toBe("2412");
    expect(getPreviousPeriode("2401")).toBe("2312");
    expect(getPreviousPeriode("0001")).toBe("9912"); // edge: YY=00 wraps to 99
  });
});

describe("SpaceHddService", () => {
  let spaceHddService;

  beforeAll(async () => {
    const mod = await import("../modules/ceklist-prep-closing/services/space_hdd.service.js");
    spaceHddService = mod.default;
  });

  test("getAll returns records with computed fields", async () => {
    const rows = await spaceHddService.getAll("2410", "All");
    expect(rows).toHaveLength(2);

    const g033 = rows.find(r => r.KDCAB === "G033");
    expect(g033).toBeDefined();
    // FREE_SPACE=37.1 GB, lastMonth=50 GB → usage=37.1-50=-12.9, predicted=37.1-12.9=24.2
    expect(g033.usageDiskSpace).toBeCloseTo(-12.9, 1);
    expect(g033.predictedUsage).toBeCloseTo(24.2, 1);
    expect(g033.freeSpaceGb).toBeCloseTo(37.1);
    expect(g033.freeSpaceLastMonthGb).toBeCloseTo(50);
  });

  test("getAll row without last-month record has null computed fields", async () => {
    const rows = await spaceHddService.getAll("2410", "All");
    const g034 = rows.find(r => r.KDCAB === "G034");
    // No previous period record for G034
    expect(g034.usageDiskSpace).toBeNull();
    expect(g034.predictedUsage).toBeNull();
    expect(g034.freeSpaceGb).toBeCloseTo(1853.44, 0); // 1.81 TB
  });

  test("upsert calls CeklistSpaceHddWrapper.upsert with correct payload", async () => {
    const { CeklistSpaceHddWrapper } = await import("../modules/ceklist-prep-closing/ceklist_prep_closing.model.js");
    await spaceHddService.upsert({ kdcab: "G033", ip: "192.168.1.1", periode: "2410", freeSpace: "37.1 GB", os: "WINDOWS" });
    expect(CeklistSpaceHddWrapper.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ ID: "G0332410", KDCAB: "G033", PERIODE: "2410" })
    );
  });

  test("delete calls CeklistSpaceHddWrapper.destroy", async () => {
    const { CeklistSpaceHddWrapper } = await import("../modules/ceklist-prep-closing/ceklist_prep_closing.model.js");
    const result = await spaceHddService.delete("G033", "2410");
    expect(CeklistSpaceHddWrapper.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { KDCAB: "G033", PERIODE: "2410" } })
    );
    expect(result).toHaveProperty("deleted");
  });
});

describe("ImportIdtService.getBulkTemplate", () => {
  let importIdtService;

  beforeAll(async () => {
    const mod = await import("../modules/ceklist-prep-closing/services/import_idt.service.js");
    importIdtService = mod.default;
  });

  test("generates skeleton only for branches without existing records", async () => {
    // CeklistImportIdtWrapper.findAll returns [] so all 2 INDUK branches need records
    const result = await importIdtService.getBulkTemplate("2410");
    expect(result.total).toBe(2);  // 2 INDUK branches (G033, G034)
    expect(result.created).toBe(2);
    expect(result.existing).toBe(0);
  });

  test("uploadCapture saves captureUrl to DB", async () => {
    const { CeklistImportIdtWrapper } = await import("../modules/ceklist-prep-closing/ceklist_prep_closing.model.js");
    CeklistImportIdtWrapper.findByPk.mockResolvedValueOnce({
      dataValues: { ID: "G0332410", KDCAB: "G033", PERIODE: "2410", CAPTURE: "/uploads/ceklist-capture/G033/test.jpg" },
    });
    const result = await importIdtService.uploadCapture("G033", "2410", "/uploads/ceklist-capture/G033/test.jpg");
    expect(CeklistImportIdtWrapper.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ CAPTURE: "/uploads/ceklist-capture/G033/test.jpg" })
    );
    expect(result.CAPTURE).toBe("/uploads/ceklist-capture/G033/test.jpg");
  });
});

describe("RekapScreeningService", () => {
  let rekapScreeningService;

  beforeAll(async () => {
    const mod = await import("../modules/ceklist-prep-closing/services/rekap_screening.service.js");
    rekapScreeningService = mod.default;
  });

  test("getRekapScreening returns flattened rows with rule key columns", async () => {
    const result = await rekapScreeningService.getRekapScreening({ periode: "2410" });
    expect(result.total).toBe(1);
    expect(result.ruleKeys).toContain("const_prd_check");
    expect(result.ruleKeys).toContain("vir_disc05_check");

    const row = result.data[0];
    expect(row.cab).toBe("G033");
    expect(row.kdtk).toBe("9901");
    expect(row.failedRules).toBe(2);
    // Flattened rule key columns
    expect(row).toHaveProperty("const_prd_check");
    expect(row).toHaveProperty("vir_disc05_check");
  });
});
