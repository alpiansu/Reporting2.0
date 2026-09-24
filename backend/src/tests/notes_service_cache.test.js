/**
 * Unit Tests: Health fix issue8 — notesService.getAll() memo hasil enrich
 *   - Dulu: .map() enrich dievaluasi di SETIAP request (enrichWithNotes dll)
 *     padahal readJson sudah cache — pemborosan O(n) per request.
 *   - Sekarang: hasil memo per cacheTTL; invalidasi saat writeJson (mutasi note).
 *   - Bentuk return TIDAK berubah: Array<Object> dengan field fullName ter-enrich.
 *
 * Run with: npx jest --testPathPatterns notes_service_cache
 */

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() },
}));

// config/index.js pakai import.meta (rusak di Jest) — notes hanya butuh resilientDb
jest.mock("../config/index.js", () => ({
  __esModule: true,
  default: { resilientDb: { getDatabase: jest.fn(async () => null), forceReconnect: jest.fn(async () => null) } },
}));

jest.mock("../models/notes.model.js", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn(), findAll: jest.fn() },
}));

jest.mock("../modules/user/user.service.js", () => ({
  __esModule: true,
  default: { getAllUsers: jest.fn(async () => []) },
}));

// Layer file di-mock — test tidak menyentuh data/notes.json sungguhan
jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import fs from "fs";
import notesService from "../modules/notes/notes.service.js";
import notesConfig from "../modules/notes/notes.config.js";
import userService from "../modules/user/user.service.js";

const NOTE = {
  unixKey: "T1232607",
  pic: "pic1",
  tableName: "web_reporting.sesuaiToko",
  noteText: "catatan lama",
};

beforeEach(() => {
  jest.clearAllMocks();
  fs.readFileSync.mockReturnValue(JSON.stringify([NOTE]));
  userService.getAllUsers.mockResolvedValue([{ username: "pic1", fullName: "Budi Santoso" }]);

  // Reset state singleton antar test
  notesService.allNotesCache = null;
  notesService.allNotesCachedAt = 0;
  notesService.cache = null;
  notesService.lastLoaded = 0;
  notesService.userMap = null;
  notesService.userMapLoadedAt = 0;
});

afterEach(() => {
  // Bersihkan timer auto-clear cache yang dibuat readJson (real timer)
  if (notesService.cacheTimer) {
    clearTimeout(notesService.cacheTimer);
    notesService.cacheTimer = null;
  }
});

describe("notes service — memoisasi getAll", () => {
  test("getAll dimemo: enrich tidak dihitung ulang tiap request, bentuk return tetap", async () => {
    const a = await notesService.getAll();
    const b = await notesService.getAll();

    expect(a).toBe(b); // hasil memo — bukan array/enrich baru tiap panggilan
    expect(a).toHaveLength(1);
    expect(a[0].fullName).toBe("Budi Santoso"); // enrich tetap ada
    expect(a[0].noteText).toBe("catatan lama");
    expect(a[0].unixKey).toBe("T1232607");

    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    expect(userService.getAllUsers).toHaveBeenCalledTimes(1);
  });

  test("writeJson (jalur mutasi note) meng-invalidate memo → getAll baca ulang", async () => {
    await notesService.getAll();
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);

    fs.readFileSync.mockReturnValue(JSON.stringify([]));
    await notesService.writeJson([]); // dipanggil upsert/removeByKey

    const after = await notesService.getAll();
    expect(after).toEqual([]);
    expect(fs.readFileSync).toHaveBeenCalledTimes(2);
  });

  test("memo kedaluwarsa (cacheTTL) → baca & enrich ulang dengan data terbaru", async () => {
    const first = await notesService.getAll();

    // Usapakan umur memo & cache readJson melebihi TTL
    notesService.allNotesCachedAt = Date.now() - notesConfig.cacheTTL - 1;
    notesService.lastLoaded = Date.now() - notesConfig.cacheTTL - 1;
    fs.readFileSync.mockReturnValue(JSON.stringify([{ ...NOTE, noteText: "catatan baru" }]));

    const second = await notesService.getAll();

    expect(second).not.toBe(first);
    expect(second[0].noteText).toBe("catatan baru");
    expect(fs.readFileSync).toHaveBeenCalledTimes(2);
  });
});
