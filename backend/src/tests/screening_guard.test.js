/**
 * Unit Tests: Screening Guard
 *
 * Pastikan status rekap_remote per toko menghasilkan perilaku guard yang benar:
 *   - EXCEEDED / BELOW_THRESHOLD / success → di-skip screen ulang hari ini
 *   - DATA_ST_MISSING                      → di-screen ULANG hari ini
 *                                            (data ST mungkin baru masuk siang hari)
 *   - ERROR / failed                       → di-screen ulang
 *
 * Run with: npm test -- --testPathPattern=screening_guard
 */

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock("../modules/rekap_remote/rekap_remote_staging.service.js", () => ({
  __esModule: true,
  default: { getModuleData: jest.fn(async () => []) },
}));

const moment = require("moment-timezone");
const screeningGuard = require("../utils/screeningGuard.js").default;
const rekapRemoteStagingService = require("../modules/rekap_remote/rekap_remote_staging.service.js").default;

const KDTK = "T1234";

const entryWith = status => ({
  cab: "G033",
  kdtk: KDTK,
  module_name: "penyesuaian",
  status,
  updtime: moment().format("YYYY-MM-DD HH:mm:ss"),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("screeningGuard.isSuccessToday — penyesuaian status tokens", () => {
  test("belum ada data → tidak di-skip", async () => {
    rekapRemoteStagingService.getModuleData.mockResolvedValue([]);
    const res = await screeningGuard.isSuccessToday("penyesuaian", KDTK);
    expect(res.screened).toBe(false);
    expect(res.reason).toBe("no_data");
  });

  test("EXCEEDED hari ini → di-skip (screen sudah jalan)", async () => {
    rekapRemoteStagingService.getModuleData.mockResolvedValue([entryWith(`[${KDTK}] EXCEEDED`)]);
    const res = await screeningGuard.isSuccessToday("penyesuaian", KDTK);
    expect(res.screened).toBe(true);
    expect(res.reason).toBe("already_success_today");
  });

  test("BELOW_THRESHOLD hari ini → di-skip", async () => {
    rekapRemoteStagingService.getModuleData.mockResolvedValue([entryWith(`[${KDTK}] BELOW_THRESHOLD`)]);
    const res = await screeningGuard.isSuccessToday("penyesuaian", KDTK);
    expect(res.screened).toBe(true);
  });

  test("DATA_ST_MISSING hari ini → TIDAK di-skip (harus screen ulang)", async () => {
    rekapRemoteStagingService.getModuleData.mockResolvedValue([entryWith(`[${KDTK}] DATA_ST_MISSING`)]);
    const res = await screeningGuard.isSuccessToday("penyesuaian", KDTK);
    expect(res.screened).toBe(false);
    expect(res.reason).toBe("data_incomplete");
  });

  test("ERROR hari ini → TIDAK di-skip (screen ulang)", async () => {
    rekapRemoteStagingService.getModuleData.mockResolvedValue([entryWith(`[${KDTK}] ERROR`)]);
    const res = await screeningGuard.isSuccessToday("penyesuaian", KDTK);
    expect(res.screened).toBe(false);
    expect(res.reason).toBe("previous_failed");
  });

  test("status success (marker combined screening) → di-skip", async () => {
    rekapRemoteStagingService.getModuleData.mockResolvedValue([entryWith(`[${KDTK}] success`)]);
    const res = await screeningGuard.isSuccessToday("penyesuaian", KDTK);
    expect(res.screened).toBe(true);
  });

  test("EXCEEDED kemarin (stale) → tidak di-skip", async () => {
    rekapRemoteStagingService.getModuleData.mockResolvedValue([
      {
        ...entryWith(`[${KDTK}] EXCEEDED`),
        updtime: moment().subtract(1, "day").format("YYYY-MM-DD HH:mm:ss"),
      },
    ]);
    const res = await screeningGuard.isSuccessToday("penyesuaian", KDTK);
    expect(res.screened).toBe(false);
    expect(res.reason).toBe("stale_data");
  });

  test("gagal baca staging → guard tidak memblokir screening", async () => {
    rekapRemoteStagingService.getModuleData.mockRejectedValue(new Error("db down"));
    const res = await screeningGuard.isSuccessToday("penyesuaian", KDTK);
    expect(res.screened).toBe(false);
    expect(res.reason).toBe("guard_error");
  });
});
