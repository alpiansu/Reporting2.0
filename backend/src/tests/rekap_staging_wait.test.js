/**
 * Unit Tests: Health fix issue10 — rekap_remote_staging.ensureDataLoaded
 *   - Dulu: poll flag loader100ms TANPA batas → loader macet = request "stuck" selamanya.
 *   - Sekarang: tunggu maksimal30 dtk; loader selesai → pakai hasilnya (perilaku lama),
 *     belum selesai → AMBIL ALIH pemuatannya (caller tetap mendapat data).
 *
 * Run with: npx jest --testPathPatterns rekap_staging_wait
 */

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() },
}));

jest.mock("../models/rekap_remote.model.js", () => ({
  __esModule: true,
  default: { bulkCreate: jest.fn(), findAll: jest.fn(), destroy: jest.fn() },
}));

jest.mock("../utils/index.js", () => ({
  __esModule: true,
  fileUtils: {
    readFileWithRetry: jest.fn(async () => '[{"id":1}]'),
    writeAtomicWithRetry: jest.fn(async () => true),
  },
}));

// staging hanya memakai mkdir/access/unlink/readdir dari fs/promises
jest.mock("fs/promises", () => ({
  __esModule: true,
  default: {
    mkdir: jest.fn(async () => undefined),
    access: jest.fn(async () => undefined),
    unlink: jest.fn(async () => undefined),
    readdir: jest.fn(async () => []),
  },
}));

import { fileUtils } from "../utils/index.js";
import rekapRemoteStagingService from "../modules/rekap_remote/rekap_remote_staging.service.js";

const svc = rekapRemoteStagingService;
const MODULE = "penyesuaian";

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  fileUtils.readFileWithRetry.mockResolvedValue('[{"id":1}]');

  // Reset state singleton antar test
  svc.initialized = false;
  svc.rekapCache.clear();
  svc.lastLoadTimes.clear();
  svc.isModuleLoading.clear();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("rekap_remote_staging — busy-wait dibatasi, ambil alih saat loader macet", () => {
  test("loader macet >30 dtk → diambil alih, data tetap terpakai (bukan stuck selamanya)", async () => {
    svc.isModuleLoading.set(MODULE, true); // flag loader "lain" macet (tak pernah selesai)

    const pending = svc.ensureDataLoaded(MODULE);
    await jest.advanceTimersByTimeAsync(31000); // lewati batas30 dtk
    await pending;

    expect(fileUtils.readFileWithRetry).toHaveBeenCalledTimes(1);
    expect(fileUtils.readFileWithRetry.mock.calls[0][0]).toContain(`${MODULE}.json`);
    expect(await svc.getModuleData(MODULE)).toEqual([{ id: 1 }]);
    expect(svc.isModuleLoading.has(MODULE)).toBe(false); // flag bersih setelah selesai
  });

  test("loader lama selesai dalam batas waktu → pakai hasilnya, TANPA baca ulang (perilaku lama)", async () => {
    await svc.ensureDataLoaded("_init"); // sekali untuk initialize + isi cache contoh
    expect(svc.initialized).toBe(true);

    // Simulasikan loader lain yang menyelesaikan tugasnya500ms kemudian
    svc.isModuleLoading.set("rekon_sales", true);
    setTimeout(() => {
      svc.rekapCache.set("rekon_sales", [{ id: 9 }]);
      svc.lastLoadTimes.set("rekon_sales", Date.now());
      svc.isModuleLoading.delete("rekon_sales");
    }, 500);

    const pending = svc.ensureDataLoaded("rekon_sales");
    await jest.advanceTimersByTimeAsync(1000);
    await pending;

    // Tidak ada ambil-alih → tidak ada panggilan baca file tambahan untuk rekon_sales
    const readsForSales = fileUtils.readFileWithRetry.mock.calls.filter(c =>
      String(c[0]).includes("rekon_sales"),
    );
    expect(readsForSales).toHaveLength(0);
    expect(svc.rekapCache.get("rekon_sales")).toEqual([{ id: 9 }]);
  });
});
