/**
 * Unit Tests: Health fix issue5 — rekap_remote temp log
 *   - release mutex IDEMPOTEN (dulu timeout+finally bisa melepas lock2× →
 *     dua penulis bersamaan → file log korup/hilang)
 *   - addToTemp akumulasi IN-MEMORY + flush debounce (dulu baca+tulis ulang
 *     SELURUH file per log → O(n²) I/O saat screening massal)
 *   - saveToDatabase menguras dari memori (merge file) + unlink + batal timer
 *
 * Run with: npx jest --testPathPatterns rekap_remote_health
 */

// ─── Mocks (di-hoist sebelum import) ─────────────────────────────

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() },
}));

jest.mock("../models/rekap_remote.model.js", () => ({
  __esModule: true,
  default: { bulkCreate: jest.fn() },
}));

jest.mock("../modules/rekap_remote/rekap_remote_staging.service.js", () => ({
  __esModule: true,
  default: { syncToJsonFile: jest.fn(async () => {}), deleteRecords: jest.fn(async () => 0), getModuleData: jest.fn(async () => []) },
}));

// DB lokal tidak dipakai di test — cukup dilaporkan "available" agar bulkCreate jalan
jest.mock("../config/resilient-database.js", () => ({
  __esModule: true,
  default: { isDatabaseAvailable: jest.fn(() => true), forceReconnect: jest.fn(async () => {}) },
}));

jest.mock("../utils/index.js", () => ({
  __esModule: true,
  fileUtils: {
    readFileWithRetry: jest.fn(async () => "{}"),
    writeAtomicWithRetry: jest.fn(async () => true),
  },
}));

// Service hanya memakai fs.mkdir & fs.unlink — sisanya via fileUtils (di-mock)
jest.mock("fs/promises", () => ({
  __esModule: true,
  default: {
    mkdir: jest.fn(async () => undefined),
    unlink: jest.fn(async () => undefined),
  },
}));

import fs from "fs/promises";
import RekapRemote from "../models/rekap_remote.model.js";
import { fileUtils } from "../utils/index.js";
import RekapRemoteService from "../modules/rekap_remote/rekap_remote.service.js";

const svc = RekapRemoteService;

/** Flush rantai microtask (mutex/antrian promise) — aman dipakai dengan fake timers */
const flushMicrotasks = async (n = 25) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  fileUtils.readFileWithRetry.mockResolvedValue("{}");
  RekapRemote.bulkCreate.mockImplementation(async rows => rows);
  // Reset state singleton antar test
  svc.memLogs = null;
  svc.memDirty = false;
  if (svc.flushTimer) {
    clearTimeout(svc.flushTimer);
    svc.flushTimer = null;
  }
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// ─── issue5a: release idempoten ──────────────────────────────────

describe("rekap_remote — mutex release idempoten", () => {
  test("release boleh dipanggil2× tanpa melepas lock ganda; mutex tetap1-permit", async () => {
    const release = await svc._acquireWithTimeout("test");
    release();
    expect(() => release()).not.toThrow(); // dulu: panggilan kedua = double-release

    const relA = await svc._acquireWithTimeout("A");
    let acquiredB = false;
    const pB = svc._acquireWithTimeout("B").then(r => {
      acquiredB = true;
      return r;
    });
    await flushMicrotasks();
    // Dengan double-release (bug lama), B akan langsung dapat lock → true (gagal)
    expect(acquiredB).toBe(false);

    relA();
    const relB = await pB;
    relB();
  });
});

// ─── issue5b: akumulasi memori + flush debounce ──────────────────

describe("rekap_remote — addToTemp in-memory + flush debounce", () => {
  test("addToTemp beruntun: baca file sekali, tulis file sekali (dulu O(n²))", async () => {
    await svc.addToTemp("G001", "T001", "penyesuaian", "[T001] EXCEEDED", "nilai Rp 1");
    await svc.addToTemp("G001", "T002", "penyesuaian", "[T002] ERROR", "koneksi");
    await svc.addToTemp("G002", "T003", "rekon_sales", "[T003] EXCEEDED", "ok");

    // Dulu:3× baca +3× tulis file penuh per3 panggilan
    expect(fileUtils.readFileWithRetry).toHaveBeenCalledTimes(1);
    expect(fileUtils.writeAtomicWithRetry).not.toHaveBeenCalled(); // menunggu debounce

    await jest.advanceTimersByTimeAsync(svc.flushDelayMs);
    await flushMicrotasks();

    expect(fileUtils.writeAtomicWithRetry).toHaveBeenCalledTimes(1); //1× flush untuk3 log
    const [file, content] = fileUtils.writeAtomicWithRetry.mock.calls[0];
    expect(file).toContain("rekap_remote_logs.json");
    const parsed = JSON.parse(content);
    expect(Object.keys(parsed)).toHaveLength(3);
    expect(parsed["G001_T001_penyesuaian"].status).toBe("[T001] EXCEEDED");
    expect(parsed["G001_T001_penyesuaian"].message).toBe("nilai Rp 1");
    expect(svc.memDirty).toBe(false); // sudah bersih setelah flush
  });

  test("update key yang sama setelah flush → status terbaru yang menang", async () => {
    await svc.addToTemp("G001", "T001", "penyesuaian", "[T001] ERROR");
    await jest.advanceTimersByTimeAsync(svc.flushDelayMs);
    await flushMicrotasks();

    await svc.addToTemp("G001", "T001", "penyesuaian", "[T001] EXCEEDED");
    await jest.advanceTimersByTimeAsync(svc.flushDelayMs);
    await flushMicrotasks();

    const content = JSON.parse(fileUtils.writeAtomicWithRetry.mock.calls.at(-1)[1]);
    expect(content["G001_T001_penyesuaian"].status).toBe("[T001] EXCEEDED");
  });
});

// ─── issue5c: saveToDatabase menguras memori ─────────────────────

describe("rekap_remote — saveToDatabase menguras dari memori", () => {
  test("log di memori tersimpan ke DB walau belum sempat flush; state di-reset", async () => {
    await svc.addToTemp("G001", "T001", "penyesuaian", "[T001] EXCEEDED");
    await svc.addToTemp("G002", "T002", "rekon_sales", "[T002] ERROR");
    expect(svc.memDirty).toBe(true);
    expect(svc.flushTimer).toBeTruthy(); // masih ada flush tertunda

    const result = await svc.saveLogsToDatabase();

    expect(RekapRemote.bulkCreate).toHaveBeenCalledTimes(1);
    const rows = RekapRemote.bulkCreate.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.status).sort()).toEqual(["[T001] EXCEEDED", "[T002] ERROR"]);
    expect(result.savedCount).toBe(2);

    // State di-reset & flush batal — tidak ada tulis ganda setelah pengurasan
    expect(svc.memDirty).toBe(false);
    expect(svc.flushTimer).toBeNull();
    expect(svc.memLogs).toEqual({});
    expect(fs.unlink).toHaveBeenCalled(); // konsisten dgn perilaku lama: file di-unlink

    await jest.advanceTimersByTimeAsync(svc.flushDelayMs);
    await flushMicrotasks();
    expect(fileUtils.writeAtomicWithRetry).not.toHaveBeenCalled(); // flush batal, tidak menulis lagi
  });
});
