/**
 * Unit Tests: Health fix issue #11 — export Excel streaming (tanpa buffer penuh)
 *   - generateExcel mengembalikan workbook ExcelJS (bukan writeBuffer).
 *   - exportExcel men-stream workbook.xlsx.write(res) + res.end, TANPA
 *     memanggil res.send/res.json pada jalur sukses.
 *   - Error sebelum headers terkirim → JSON 500 seperti sebelumnya.
 *   - Error setelah headers terkirim (headersSent) → cukup res.end, tanpa JSON.
 *   - Response API & filename TIDAK berubah.
 *
 * Run with: npx jest --testPathPatterns rekap_backup_export
 */

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() },
}));

// config/index.js pakai import.meta (breaks di Jest) — mock seperti test lain
jest.mock("../config/index.js", () => ({
  __esModule: true,
  default: { resilientDb: { getDatabase: async () => null, forceReconnect: async () => null } },
}));

// staging service membaca json staging dari disk — tidak relevan untuk test ini
jest.mock("../modules/rekap_backup/services/rekap_backup_staging.service.js", () => ({
  __esModule: true,
  default: {
    getData: jest.fn(async () => []),
    getAllData: jest.fn(async () => []),
    getSummaryData: jest.fn(async () => ({})),
    syncAllFromDatabase: jest.fn(async () => ({})),
  },
}));

import rekapBackupController from "../modules/rekap_backup/controllers/rekap_backup.controller.js";
import rekapBackupService from "../modules/rekap_backup/services/rekap_backup.service.js";
import stagingService from "../modules/rekap_backup/services/rekap_backup_staging.service.js";

function makeRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    headersSent: false,
    writableEnded: false,
    written: [],
    setHeader(k, v) {
      this.headers[k] = v;
    },
    write(chunk) {
      this.written.push(chunk);
      this.headersSent = true;
      return true;
    },
    end() {
      this.writableEnded = true;
      this.headersSent = true;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    send(payload) {
      this.body = payload;
      this.writableEnded = true;
      return this;
    },
  };
}

function makeReq(query = {}) {
  return { query };
}

function makeWorkbook({ failWrite = false } = {}) {
  return {
    xlsx: {
      write: jest.fn(async res => {
        if (failWrite) {
          res.write("partial"); // sebagian bytes terkirim → headersSent true
          throw new Error("stream error");
        }
        res.write("xlsx-bytes");
        res.end();
      }),
      // writeBuffer TIDAK ada — memastikan jalur lama tidak dipakai lagi
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("rekap_backup exportExcel (streaming)", () => {
  test("sukses: header + stream + end, tanpa res.send/res.json", async () => {
    const workbook = makeWorkbook();
    jest.spyOn(rekapBackupService, "generateExcel").mockResolvedValue(workbook);

    const res = makeRes();
    await rekapBackupController.exportExcel(makeReq({ cabang: "A01", startYear: "2024", endYear: "2025" }), res);

    expect(workbook.xlsx.write).toHaveBeenCalledTimes(1);
    expect(workbook.xlsx.write).toHaveBeenCalledWith(res);
    expect(res.writableEnded).toBe(true);
    expect(res.body).toBeNull(); // tidak ada JSON dikirim
    expect(res.headers["Content-Type"]).toContain("spreadsheetml");
    expect(res.headers["Content-Disposition"]).toContain("attachment");
    expect(res.headers["Content-Disposition"]).toContain(".xlsx");
  });

  test("filename mempertahankan format lama", async () => {
    jest.spyOn(rekapBackupService, "generateExcel").mockResolvedValue(makeWorkbook());

    const res = makeRes();
    await rekapBackupController.exportExcel(makeReq({ cabang: "A01", startYear: "2024", endYear: "2025" }), res);
    expect(res.headers["Content-Disposition"]).toContain('( 2024 s.d 2025 ) A01');

    const res2 = makeRes();
    await rekapBackupController.exportExcel(makeReq({}), res2);
    expect(res2.headers["Content-Disposition"]).toContain('filename="FORMAT DATA BULANAN & HARIAN.xlsx"');
  });

  test("error sebelum headers → JSON 500 seperti sebelumnya", async () => {
    jest.spyOn(rekapBackupService, "generateExcel").mockRejectedValue(new Error("boom"));

    const res = makeRes();
    await rekapBackupController.exportExcel(makeReq(), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, message: expect.stringContaining("boom") });
    expect(res.writableEnded).toBe(false); // tidak ada res.end pada jalur error awal
  });

  test("error setelah headers terkirim (stream putus) → cukup end, tanpa JSON", async () => {
    jest.spyOn(rekapBackupService, "generateExcel").mockResolvedValue(makeWorkbook({ failWrite: true }));

    const res = makeRes();
    await rekapBackupController.exportExcel(makeReq(), res);

    // xlsx.write melempar setelah sebagian stream terkirim → cukup tutup koneksi
    expect(res.writableEnded).toBe(true);
    expect(res.body).toBeNull();
    expect(res.statusCode).toBeNull();
  });

  test("generateExcel tetap mengembalikan workbook asli (bukan buffer)", async () => {
    jest.spyOn(stagingService, "getData").mockResolvedValue([]);
    jest.spyOn(stagingService, "getAllData").mockResolvedValue([]);

    const result = await rekapBackupService.generateExcel("All", "All", null);
    expect(result).toBeDefined();
    // Workbook ExcelJS punya worksheet 'Rekap Harian'
    const names = result.worksheets.map(ws => ws.name);
    expect(names).toContain("Rekap Harian");
  });
});
