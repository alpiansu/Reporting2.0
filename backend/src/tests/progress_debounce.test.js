/**
 * Unit Tests: Health fix issue9 — debounce tulis progress.json
 *   - updateProgress (jalur panas, ±2× per toko saat screening) di-debounce
 *     saveDelayMs; SEKALI tulis untuk banyak update, isi = progressMap terbaru.
 *   - Jalur terminal (start/cancel/complete/fail) TETAP tulis langsung.
 *   - startProgress & cancelTask flush debounce SEBELUM _loadProgressData —
 *     reload tidak pernah mengembalikan state yang belum sempat tertulis.
 *   - Bentuk return task & response API TIDAK berubah.
 *
 * Run with: npx jest --testPathPatterns progress_debounce
 */

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() },
}));

// Layer file di-mock — progress.json tidak disentuh sungguhan
jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock("fs/promises", () => ({
  readFile: jest.fn(async () => "{}"),
  writeFile: jest.fn(async () => {}),
  rename: jest.fn(async () => {}),
}));

import fsPromises from "fs/promises";
import progressService from "../modules/progress/progress.service.js";

// "Disk" tiruan: readFile harus mencerminkan tulisan terakhir (stateful),
// supaya alur flush → reload di cancelTask meniru sistem nyata.
let diskState = "{}";

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  diskState = "{}";
  fsPromises.readFile.mockImplementation(async () => diskState);
  fsPromises.writeFile.mockImplementation(async (_path, content) => {
    diskState = content;
  });
  fsPromises.rename.mockResolvedValue(undefined);

  // Reset state singleton antar test
  progressService.progressMap.clear();
  progressService.abortSet.clear();
  progressService.processingStoresMap.clear();
  if (progressService.saveTimer) {
    clearTimeout(progressService.saveTimer);
    progressService.saveTimer = null;
  }
  progressService.isInitialized = false;
  progressService.initializingPromise = null;
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("progress.service — debounce tulis progress.json", () => {
  test("updateProgress di-debounce: satu tulis untuk banyak update, isi = state terbaru", async () => {
    const task = await progressService.startProgress("t_deb", 10, { module: "penyesuaian", title: "T" });
    expect(task.completed).toBe(0);

    const writesAfterStart = fsPromises.writeFile.mock.calls.length;
    expect(writesAfterStart).toBe(1); // startProgress tetap tulis langsung

    const u1 = await progressService.updateProgress("t_deb", 2, "2/10");
    expect(u1.completed).toBe(2); // bentuk return task TIDAK berubah
    expect(u1.percentage).toBe(20);
    await progressService.updateProgress("t_deb", 4, "4/10");

    expect(fsPromises.writeFile.mock.calls.length).toBe(writesAfterStart); // belum ada tulis baru

    await jest.advanceTimersByTimeAsync(progressService.saveDelayMs);

    expect(fsPromises.writeFile.mock.calls.length).toBe(writesAfterStart + 1); //1 flush untuk2 update
    const saved = JSON.parse(fsPromises.writeFile.mock.calls.at(-1)[1]);
    expect(saved.t_deb.completed).toBe(4); // flush menyimpan progressMap TERKINI
    expect(progressService.saveTimer).toBeNull();
  });

  test("cancelTask flush debounce SEBELUM reload — update terakhir tidak hilang dari snapshot", async () => {
    await progressService.startProgress("t_can", 10, "go");
    await progressService.updateProgress("t_can", 7, "7/10"); // debounce tertunda
    expect(fsPromises.writeFile.mock.calls.length).toBe(1); // hanya tulisan start

    const snapshot = await progressService.cancelTask("t_can");

    expect(snapshot.status).toBe("cancelled");
    expect(snapshot.completed).toBe(7); // tanpa flush, reload akan mengembalikan completed=0 (basi)
    expect(progressService.progressMap.has("t_can")).toBe(false);

    // flush (tulis state terbaru) + tulis hasil cancel
    expect(fsPromises.writeFile.mock.calls.length).toBe(3);

    await jest.advanceTimersByTimeAsync(progressService.saveDelayMs + 100);
    expect(fsPromises.writeFile.mock.calls.length).toBe(3); // timer debounce sudah dibatalkan
  });

  test("jalur terminal tetap tulis langsung (completeProgress tidak di-debounce)", async () => {
    await progressService.startProgress("t_end", 5, "x");
    const before = fsPromises.writeFile.mock.calls.length;

    const done = await progressService.completeProgress("t_end");

    expect(done.percentage).toBe(100);
    expect(done.status).toBe("completed");
    expect(fsPromises.writeFile.mock.calls.length).toBe(before + 1);
  });
});
