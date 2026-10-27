jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() },
}));

jest.mock("../config/index.js", () => ({
  __esModule: true,
  default: { resilientDb: { getDatabase: jest.fn(async () => null), forceReconnect: jest.fn(async () => null) } },
}));

jest.mock("../models/notes.model.js", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn(), findAll: jest.fn() },
}));

jest.mock("../modules/notes/notes.service.js", () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(),
    remove: jest.fn(),
  },
}));

import config from "../modules/notes/notes.config.js";
import { autoNoteVirtMrg } from "../modules/notes/notes.controller.js";

describe("Notes AutoNote Virtual Margin Queries", () => {
  it("config autoNotes should contain all 8 query templates", () => {
    expect(config.autoNotes).toBeDefined();
    expect(typeof config.autoNotes.checkQtyRmb).toBe("string");
    expect(typeof config.autoNotes.rekonVirtualMrg).toBe("string");
    expect(typeof config.autoNotes.rekonVirtualMrgDelon).toBe("string");
    expect(typeof config.autoNotes.rekonVirtualMrgEnhanced).toBe("string");
    expect(typeof config.autoNotes.rawMtran).toBe("string");
    expect(typeof config.autoNotes.rawMstran).toBe("string");
    expect(typeof config.autoNotes.rawIpulsa).toBe("string");
    expect(typeof config.autoNotes.rawVirtualTrx).toBe("string");
  });

  it("autoNoteVirtMrg controller should validate missing parameters", async () => {
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const reqMissing = {
      body: { cabang: "G033", kdtk: "T001" }, // missing prdcd and tanggal
    };

    await autoNoteVirtMrg(reqMissing, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining("wajib diisi"),
      })
    );
  });

  it("autoNoteVirtMrg should generate all 8 queries without leftover ? placeholders", async () => {
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const req = {
      body: {
        cabang: "G033",
        kdtk: "T10C",
        prdcd: "20067890",
        tanggal: "2026-10-25",
      },
    };

    await autoNoteVirtMrg(req, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          data: expect.objectContaining({
            queries: expect.any(Array),
          }),
        }),
      })
    );

    const callArgs = mockRes.json.mock.calls[0][0];
    const queries = callArgs.data.data.queries;

    expect(queries).toHaveLength(8);

    // Verify preservation of old queries
    expect(queries[0].title).toContain("Query 1: Cek QTY RMB");
    expect(queries[1].title).toContain("Query 2: Rekon Virtual Margin (Utama)");
    expect(queries[2].title).toContain("Query 3: Rekon Virtual Margin (Delon Fallback)");

    // Verify new queries
    expect(queries[3].title).toContain("Query 4: Diagnosa Pola Selisih Virtual Margin");
    expect(queries[4].title).toContain("Query 5: Raw Data MTRAN");
    expect(queries[5].title).toContain("Query 6: Raw Data MSTRAN");
    expect(queries[6].title).toContain("Query 7: Raw Data IPULSA_TRANSAKSI");
    expect(queries[7].title).toContain("Query 8: Raw Data VIRTUAL_TRX");

    // Verify descriptions exist
    for (const q of queries) {
      expect(q.description).toBeDefined();
      expect(q.description.length).toBeGreaterThan(5);
    }

    // Verify all queries have target parameters bound and NO remaining ? placeholder
    for (const q of queries) {
      expect(q.sql).not.toContain("?");
      expect(q.sql).toContain("'2026-10-25'");
      expect(q.sql).toContain("'20067890'");
    }
  });

  it("autoNoteVirtMrg should escape single quotes in prdcd or tanggal", async () => {
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const req = {
      body: {
        cabang: "G033",
        kdtk: "T10C",
        prdcd: "20067'890",
        tanggal: "2026-10-25",
      },
    };

    await autoNoteVirtMrg(req, mockRes);
    const callArgs = mockRes.json.mock.calls[0][0];
    const queries = callArgs.data.data.queries;

    // Escaped to ''
    expect(queries[0].sql).toContain("'20067''890'");
  });
});
