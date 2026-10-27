jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock("p-limit", () => ({
  __esModule: true,
  default: () => fn => fn(),
}));

jest.mock("../modules/progress/progress.service.js", () => ({
  __esModule: true,
  default: {
    startProgress: jest.fn().mockResolvedValue(true),
    updateProgress: jest.fn().mockResolvedValue(true),
    completeProgress: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock("../models/hist_adjust.model.js", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("../models/saldovirtual.model.js", () => ({
  __esModule: true,
  default: {
    update: jest.fn().mockResolvedValue([1]),
  },
}));

jest.mock("../modules/rekon_virtual_mrg/rekon_virtual_mrg.service.js", () => ({
  __esModule: true,
  default: {
    syncToJsonFile: jest.fn().mockResolvedValue(10),
  },
}));

jest.mock("../modules/adjust/hist_adjust_staging.service.js", () => ({
  __esModule: true,
  default: {
    bulkInsert: jest.fn().mockResolvedValue({ insertedCount: 2 }),
  },
}));

jest.mock("../modules/store/storeService.js", () => ({
  __esModule: true,
  default: {
    getStoresByCodes: jest.fn(),
    getStoreIPHost: jest.fn(),
  },
}));

import adjustService from "../modules/adjust/adjust.service.js";
import { confirmVirtualMarginAdjust } from "../modules/adjust/adjust.controller.js";
import apiResponse from "../utils/apiResponse.js";
import SaldoVirtual from "../models/saldovirtual.model.js";
import rekonVirtualService from "../modules/rekon_virtual_mrg/rekon_virtual_mrg.service.js";
import histAdjustStagingService from "../modules/adjust/hist_adjust_staging.service.js";
import storeService from "../modules/store/storeService.js";

describe("Adjust Service - Confirm Virtual Margin Adjust", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should update SaldoVirtual RECID = '1' only for SUCCESS items and sync JSON per period", async () => {
    const items = [
      {
        kdtk: "TW06",
        cabang: "G107",
        prdcd: "1001",
        tgl_selisih: "2026-02-15",
        qty_adj: 5,
        keter: "Adjust BC Khusus",
        status: "SUCCESS",
      },
      {
        kdtk: "TW06",
        cabang: "G107",
        prdcd: "1002",
        tgl_selisih: "2026-02-16",
        qty_adj: 2,
        keter: "Adjust BC Khusus",
        status: "SUCCESS",
      },
      {
        kdtk: "TW10",
        cabang: "G107",
        prdcd: "2001",
        tgl_selisih: "2026-02-20",
        qty_adj: 10,
        keter: "Adjust BC Khusus Gagal",
        status: "FAILED",
      },
    ];

    const result = await adjustService.confirmVirtualMarginAdjust({
      items,
      username: "superadmin",
      fullName: "Super Administrator",
    });

    expect(result.totalItems).toBe(3);
    expect(result.updatedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.affectedStores).toBe(1); // TW06
    expect(result.affectedPeriods).toEqual(["2602"]);

    // SaldoVirtual update harus dipanggil tepat 2 kali (hanya untuk yang SUCCESS)
    expect(SaldoVirtual.update).toHaveBeenCalledTimes(2);

    // Verifikasi parameter SaldoVirtual.update pertama
    expect(SaldoVirtual.update).toHaveBeenCalledWith(
      { RECID: "1" },
      expect.objectContaining({
        where: expect.objectContaining({
          SHOP: "TW06",
          PRDCD: "1001",
          TANGGAL: "2026-02-15",
          CABANG: "G107",
        }),
      }),
    );

    // SaldoVirtual.update TIDAK boleh dipanggil dengan PRDCD 2001 (FAILED)
    expect(SaldoVirtual.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        where: expect.objectContaining({
          PRDCD: "2001",
        }),
      }),
    );

    // History staging bulkInsert harus dipanggil dengan 3 record (2 success, 1 failed)
    expect(histAdjustStagingService.bulkInsert).toHaveBeenCalledTimes(1);
    const historyArg = histAdjustStagingService.bulkInsert.mock.calls[0][0];
    expect(historyArg.length).toBe(3);
    expect(historyArg[0].status).toBe("SUCCESS");
    expect(historyArg[1].status).toBe("SUCCESS");
    expect(historyArg[2].status).toBe("FAILED");

    // syncToJsonFile harus dipanggil sekali untuk periode "2602"
    expect(rekonVirtualService.syncToJsonFile).toHaveBeenCalledTimes(1);
    expect(rekonVirtualService.syncToJsonFile).toHaveBeenCalledWith("2602");
  });

  test("should throw error if items array is empty", async () => {
    await expect(
      adjustService.confirmVirtualMarginAdjust({
        items: [],
        username: "admin",
      }),
    ).rejects.toThrow("Daftar item virtual margin wajib diisi");
  });

  describe("Virtual Margin JSON Matching & Generation", () => {
    test("getUnadjustedVirtualMarginMap should only load unadjusted records (RECID !== '1')", async () => {
      jest.spyOn(adjustService, "readVirtualMarginJsonFile").mockImplementation(async (periode) => {
        if (periode === "2602") {
          return [
            {
              RECID: "*",
              CABANG: "G107",
              SHOP: "TW06",
              TANGGAL: "2026-02-15",
              PRDCD: "1001",
              SINGKATAN: "PRODUK UNADJUSTED 1",
              SEL: -2,
              PRICE: 10000,
              ACOST: 8000,
            },
            {
              RECID: "1", // sudah diadjust sebelumnya
              CABANG: "G107",
              SHOP: "TW06",
              TANGGAL: "2026-02-16",
              PRDCD: "1002",
              SINGKATAN: "PRODUK ALREADY ADJUSTED",
              SEL: 1,
              PRICE: 15000,
              ACOST: 12000,
            },
          ];
        }
        return [];
      });

      const map = await adjustService.getUnadjustedVirtualMarginMap(["2602"]);
      expect(map.size).toBe(1);
      expect(map.has("TW06_2026-02-15_1001")).toBe(true);
      expect(map.has("TW06_2026-02-16_1002")).toBe(false); // RECID = '1' diabaikan

      const item = map.get("TW06_2026-02-15_1001");
      expect(item.SINGKATAN).toBe("PRODUK UNADJUSTED 1");
    });

    test("processCsvAdjustGenerate should ONLY include matched unadjusted items in virtualMarginItems", async () => {
      // Mock storeService
      storeService.getStoresByCodes.mockResolvedValue([
        { storeCode: "TW06", storeName: "H NAWI RAYA 2", station: "01", branch: "G107" },
      ]);

      // Mock JSON file reading
      jest.spyOn(adjustService, "readVirtualMarginJsonFile").mockImplementation(async (periode) => {
        if (periode === "2602") {
          return [
            {
              RECID: "*",
              CABANG: "G107",
              SHOP: "TW06",
              TANGGAL: "2026-02-15",
              PRDCD: "1001",
              SINGKATAN: "INDST V-ELCT 20.000",
              SEL: -5,
              PRICE: 20000,
              ACOST: 18000,
            },
            {
              RECID: "1", // sudah RECID = 1
              CABANG: "G107",
              SHOP: "TW06",
              TANGGAL: "2026-02-16",
              PRDCD: "1002",
              SINGKATAN: "PRODUK SUDAH ADJUST",
              SEL: -2,
            },
          ];
        }
        return [];
      });

      // CSV contains 3 rows:
      // Row 1: matches unadjusted record (TW06, 1001, 2026-02-15) -> SHOULD MATCH
      // Row 2: matches already-adjusted record (TW06, 1002, 2026-02-16, RECID=1) -> SHOULD NOT MATCH
      // Row 3: non-matching product/date (TW06, 9999, 2026-02-20) -> SHOULD NOT MATCH
      const csvContent =
        "KDTK,PRDCD,QTY_ADJ,KETER,TGL_SELISIH\n" +
        "TW06,1001,5,Koreksi Selisih,2026-02-15\n" +
        "TW06,1002,2,Sudah Teradjust,2026-02-16\n" +
        "TW06,9999,1,Tidak Ada Di Virtual Mrg,2026-02-20\n";

      const result = await adjustService.processCsvAdjustGenerate(
        Buffer.from(csvContent),
        "admin",
        "Administrator",
      );

      expect(result.totalRecords).toBe(3);
      // History records tetap 3 untuk eksekusi BC Khusus
      expect(result.historyRecords.length).toBe(3);

      // virtualMarginItems HANYA berisi 1 item yang match dan unadjusted!
      expect(result.virtualMarginItems.length).toBe(1);
      const vmItem = result.virtualMarginItems[0];
      expect(vmItem.kdtk).toBe("TW06");
      expect(vmItem.prdcd).toBe("1001");
      expect(vmItem.tgl_selisih).toBe("2026-02-15");
      expect(vmItem.singkatan).toBe("INDST V-ELCT 20.000");
      expect(vmItem.sel_virtual).toBe(-5);
      expect(vmItem.price).toBe(20000);
      expect(vmItem.acost).toBe(18000);
      expect(vmItem.status).toBe("SUCCESS");
    });
  });

  describe("Controller confirmVirtualMarginAdjust", () => {
    test("should respond with HTTP 200 and formatted message without ERR_HTTP_INVALID_STATUS_CODE", async () => {
      const mockReq = {
        body: {
          items: [
            {
              kdtk: "TW06",
              cabang: "G107",
              prdcd: "1001",
              tgl_selisih: "2026-02-15",
              qty_adj: 5,
              status: "SUCCESS",
            },
          ],
        },
        user: { username: "admin_test", fullName: "Admin Tester" },
      };

      const mockJson = jest.fn();
      const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
      const mockRes = { status: mockStatus };

      await confirmVirtualMarginAdjust(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalItems: 1,
            updatedCount: 1,
            failedCount: 0,
            message: expect.stringContaining("1 item diperbarui ke database"),
          }),
        }),
      );
    });

    test("should return 400 bad request if items array is missing or empty", async () => {
      const mockReq = { body: { items: [] }, user: { username: "admin_test" } };
      const mockJson = jest.fn();
      const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
      const mockRes = { status: mockStatus };

      await confirmVirtualMarginAdjust(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("tidak boleh kosong"),
        }),
      );
    });
  });

  describe("apiResponse.success resilience", () => {
    test("should safely accept message string as 3rd param without throwing RangeError", () => {
      const mockJson = jest.fn();
      const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
      const mockRes = { status: mockStatus };

      apiResponse.success(mockRes, { foo: "bar" }, "Custom success message");

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: { message: "Custom success message", foo: "bar" },
      });
    });
  });
});
