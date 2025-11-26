let prepClosingService;

const mockRules = [
  { key: "const_prd_check", name: "Konstanta Periode", category: "system_config" },
  { key: "vir_disc05_check", name: "Virtual Discount 05", category: "system_config" },
];

const mockRecords = [
  {
    KDTK: "1001",
    ISSUES: [
      { ruleKey: "const_prd_check", severity: "critical" },
      { ruleKey: "vir_disc05_check", severity: "high" },
    ],
  },
  {
    KDTK: "1002",
    ISSUES: [{ ruleKey: "vir_disc05_check", severity: "medium" }],
  },
];

jest.mock("../modules/prep-closing/prep_closing.model.js", () => ({
  __esModule: true,
  default: {
    getModel: async () => ({
      findAll: async () => mockRecords,
    }),
  },
}));

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
  },
}));

jest.mock("../modules/prep-closing/rules/rule.engine.js", () => ({
  __esModule: true,
  default: {
    ensureInitialized: async () => {},
    rules: mockRules,
  },
}));

jest.mock("p-limit", () => ({
  __esModule: true,
  default:
    () =>
    fn =>
    async (...args) =>
      fn(...args),
}));

describe("PrepClosingService.getRulesSummary", () => {
  beforeAll(async () => {
    const mod = await import("../modules/prep-closing/prep_closing.service.js");
    prepClosingService = mod.default;
  });
  test("aggregates per rule with severity breakdown and store list", async () => {
    const result = await prepClosingService.getRulesSummary({ cabang: "All", periode: "2507" });
    expect(result).toBeDefined();
    const data = result.data;
    const prd = data.find(d => d.ruleKey === "const_prd_check");
    const vir = data.find(d => d.ruleKey === "vir_disc05_check");
    expect(prd.totalStores).toBe(1);
    expect(prd.severity).toBe("critical");
    expect(prd.severityBreakdown.critical).toBe(1);
    expect(prd.storeList).toContain("1001");
    expect(vir.totalStores).toBe(2);
    expect(vir.severity).toBe("high");
    expect(vir.severityBreakdown.high).toBe(1);
    expect(vir.severityBreakdown.medium).toBe(1);
  });
});
