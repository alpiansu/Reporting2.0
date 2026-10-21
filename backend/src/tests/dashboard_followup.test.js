import { jest } from "@jest/globals";

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../modules/penyesuaian/penyesuaian.service.js", () => {
  const mockPenyesuaianData = [
    { PERIODE: "2610", RECID: "*", CABANG: "G001", KDTK: "TK01", SESUAI: "-1500000" },
    { PERIODE: "2610", RECID: "*", CABANG: "G001", KDTK: "TK02", SESUAI: "250000" },
    { PERIODE: "2610", RECID: "*", CABANG: "G002", KDTK: "TK03", SESUAI: "-50000" },
    { PERIODE: "2610", RECID: "", CABANG: "G002", KDTK: "TK04", SESUAI: "0" },
  ];

  const mockEnrichedStores = [
    {
      PERIODE: "2610",
      RECID: "*",
      CABANG: "G001",
      KDTK: "TK01",
      SESUAI: "-1500000",
      note: null,
    },
    {
      PERIODE: "2610",
      RECID: "*",
      CABANG: "G001",
      KDTK: "TK02",
      SESUAI: "250000",
      note: { noteText: "Sudah konfirmasi" },
    },
    {
      PERIODE: "2610",
      RECID: "*",
      CABANG: "G002",
      KDTK: "TK03",
      SESUAI: "-50000",
      note: null,
    },
  ];

  return {
    __esModule: true,
    default: {
      penyesuaianData: mockPenyesuaianData,
      ensureDataLoaded: jest.fn().mockResolvedValue(true),
      enrichWithNotes: jest.fn().mockResolvedValue(mockEnrichedStores),
    },
  };
});

jest.mock("../modules/rekon_virtual_mrg/rekon_virtual_mrg.service.js", () => {
  const mockData = {
    status: "success",
    data: [
      { CABANG: "G001", SHOP: "TK01", PRDCD: "PR01", SEL: -5, note: null },
      { CABANG: "G001", SHOP: "TK01", PRDCD: "PR02", SEL: 10, note: { noteText: "OK" } },
      { CABANG: "G002", SHOP: "TK03", PRDCD: "PR03", SEL: 2, note: null },
    ],
  };
  return {
    __esModule: true,
    default: {
      getAll: jest.fn().mockResolvedValue(mockData),
      getAllRecords: jest.fn().mockResolvedValue(mockData),
    },
  };
});

jest.mock("../modules/ceklist-prep-closing/services/space_hdd.service.js", () => ({
  __esModule: true,
  default: {
    getAll: jest.fn().mockResolvedValue([
      {
        KDCAB: "G001",
        IP: "192.168.1.1",
        OS: "Linux",
        FREE_SPACE: "8.5G",
        freeSpaceGb: 8.5,
        predictedUsage: 7.2,
        FU: "",
      },
      {
        KDCAB: "G002",
        IP: "192.168.2.1",
        OS: "Linux",
        FREE_SPACE: "25.0G",
        freeSpaceGb: 25.0,
        predictedUsage: 32.0,
        FU: "Sudah koordinasi",
      },
      {
        KDCAB: "G003",
        IP: "192.168.3.1",
        OS: "Linux",
        FREE_SPACE: null,
        freeSpaceGb: null,
        predictedUsage: null,
        FU: null,
      },
    ]),
  },
}));

jest.mock("../modules/store/storeService.js", () => ({
  __esModule: true,
  default: {
    ensureInitialized: jest.fn().mockResolvedValue(true),
    getAllCabang: jest.fn().mockResolvedValue([
      { branch_code: "G001", branch_name: "Cabang Satu" },
      { branch_code: "G002", branch_name: "Cabang Dua" },
      { branch_code: "G003", branch_name: "Cabang Tiga" },
    ]),
  },
}));

// Import target under test after mocks
import dashboardService from "../modules/dashboard/dashboard.service.js";
import dashboardController from "../modules/dashboard/dashboard.controller.js";

describe("Dashboard Follow-Up Resume", () => {
  describe("dashboardService.getFollowUpResume", () => {
    it("should compute correct summary and branch matrix", async () => {
      const result = await dashboardService.getFollowUpResume("2610");

      expect(result).toBeDefined();
      expect(result.periode).toBe("2610");

      // 1. Penyesuaian stats
      // 3 active stores; TK01 (-1500000, no note), TK02 (250000, with note), TK03 (-50000, no note)
      // Unfollowed stores = 2 (TK01 and TK03)
      // Total nominal unfollowed = 1500000 + 50000 = 1550000
      // Fantastic stores = 1 (TK01 with 1500000)
      expect(result.kpi.penyesuaian.unfollowedStores).toBe(2);
      expect(result.kpi.penyesuaian.totalNominalUnfollowed).toBe(1550000);
      expect(result.kpi.penyesuaian.avgNominalUnfollowed).toBe(775000);
      expect(result.kpi.penyesuaian.maxNominalUnfollowed).toBe(1500000);
      expect(result.kpi.penyesuaian.minNominalUnfollowed).toBe(50000);
      expect(result.kpi.penyesuaian.fantasticCount).toBe(1);
      expect(result.kpi.penyesuaian.fantasticStores).toHaveLength(1);
      expect(result.kpi.penyesuaian.fantasticStores[0].kdtk).toBe("TK01");

      // 2. Virtual margin based stats
      // Total items = 3, Unfollowed items = 2 (TK01 and TK03), Unfollowed shops = 2
      expect(result.kpi.virtualMrg.unfollowedItems).toBe(2);
      expect(result.kpi.virtualMrg.unfollowedShops).toBe(2);

      // 3. Closing space HDD stats
      // G001: critical unfollowed (free < 10)
      // G002: warning but already FU
      // G003: unchecked
      expect(result.kpi.closingSpace.criticalUnfollowed).toBe(1);
      expect(result.kpi.closingSpace.warningUnfollowed).toBe(0);
      expect(result.kpi.closingSpace.uncheckedBranches).toBe(1);

      // 4. Branch matrix check
      expect(result.branches).toBeDefined();
      const g001 = result.branches.find((b) => b.cabang === "G001");
      expect(g001).toBeDefined();
      expect(g001.penyesuaian.unfollowedStores).toBe(1);
      expect(g001.penyesuaian.fantasticCount).toBe(1);
      expect(g001.virtualMrg.unfollowedItems).toBe(1);
      expect(g001.closingSpace.status).toBe("critical");
      expect(g001.closingSpace.needsFu).toBe(true);
      expect(g001.needsAttention).toBe(true);

      const g002 = result.branches.find((b) => b.cabang === "G002");
      expect(g002).toBeDefined();
      expect(g002.penyesuaian.unfollowedStores).toBe(1);
      expect(g002.closingSpace.status).toBe("warning");
      expect(g002.closingSpace.needsFu).toBe(false); // already FU
      expect(g002.needsAttention).toBe(true); // because of penyesuaian

      const g003 = result.branches.find((b) => b.cabang === "G003");
      expect(g003).toBeDefined();
      expect(g003.closingSpace.status).toBe("unchecked");
      expect(g003.closingSpace.needsFu).toBe(true);
      expect(g003.needsAttention).toBe(true);
    });
  });

  describe("dashboardController.getFollowUpResume", () => {
    it("should return resume json with status 200", async () => {
      const req = { query: { periode: "2610" } };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await dashboardController.getFollowUpResume(req, res);

      expect(res.json).toHaveBeenCalledTimes(1);
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.periode).toBe("2610");
      expect(responseData.kpi).toBeDefined();
      expect(responseData.branches).toBeDefined();
    });

    it("should handle errors gracefully with status 500", async () => {
      const req = { query: { periode: "2610" } };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      const spy = jest
        .spyOn(dashboardService, "getFollowUpResume")
        .mockRejectedValueOnce(new Error("Database disconnected"));

      await dashboardController.getFollowUpResume(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });

      spy.mockRestore();
    });
  });
});
