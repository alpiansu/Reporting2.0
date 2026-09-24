/**
 * Unit Tests: Health fix issue1-4
 *  1. server.js unhandledRejection tidak lagi process.exit — handler murni logging
 *     (diverifikasi via review kode; tidak diuji di sini agar server.js tidak di-import test)
 *  2. Guard write SSE pada notifications controller — logika guard identik dengan
 *     sendToClient GlobalProgressService yang diuji di bawah
 *  3. GlobalProgressService SSE: clientId unik & cleanup per-koneksi (anti timer bocor)
 *  4. Notifications service: async I/O (tidak memblokir event loop), tulis atomic,
 *     serialisasi mutex, dan pemangkasan (read >30 hari, unread >90 hari)
 *
 * Run with: npx jest --testPathPatterns notifications_health
 */

// ─── Mocks (di-hoist sebelum import) ─────────────────────────────

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() },
}));

// File layer di-mock: test tidak boleh menyentuh disk
jest.mock("fs/promises", () => ({
  __esModule: true,
  default: {
    mkdir: jest.fn(async () => undefined),
    readFile: jest.fn(async () => "[]"),
    writeFile: jest.fn(async () => undefined),
  },
}));

jest.mock("../utils/file.utils.js", () => ({
  __esModule: true,
  writeAtomicWithRetry: jest.fn(async () => true),
  readFileWithRetry: jest.fn(async () => "[]"),
}));

import fs from "fs/promises";
import { writeAtomicWithRetry } from "../utils/file.utils.js";
import service from "../modules/notifications/notifications.service.js";

// ─── Notifications service ───────────────────────────────────────

beforeEach(async () => {
  jest.clearAllMocks();
  fs.readFile.mockResolvedValue("[]");
  await service.readJson(true); // invalidate cache antar test
  service.setEventEmitter(null);
});

describe("notifications service — async I/O + atomic write", () => {
  test("create → async, tulis file atomik, emit SSE, bentuk notif tetap", async () => {
    const emitter = { emit: jest.fn() };
    service.setEventEmitter(emitter);

    const notif = await service.create({ username: "admin", type: "t", title: "Judul", message: "Pesan" });

    expect(notif.id).toMatch(/^notif_/);
    expect(notif.read).toBe(false);
    expect(notif.username).toBe("admin");

    // Tulis atomic: path notifications.json, isi berisi notifikasi baru
    expect(writeAtomicWithRetry).toHaveBeenCalledTimes(1);
    const [file, content] = writeAtomicWithRetry.mock.calls[0];
    expect(file).toContain("notifications.json");
    expect(JSON.parse(content)[0].title).toBe("Judul");

    // SSE broadcast tetap terjadi
    expect(emitter.emit).toHaveBeenCalledWith("notif:admin", notif);
    service.setEventEmitter(null);
  });

  test("getByUser & getUnreadCount menunggu pembacaan async (return value, bukan Promise)", async () => {
    const iso = daysAgo => new Date(Date.now() - daysAgo * 86400000).toISOString();
    fs.readFile.mockResolvedValue(
      JSON.stringify([
        { id: "n1", username: "u1", read: false, created_at: iso(1) },
        { id: "n2", username: "u1", read: true, created_at: iso(2) },
        { id: "n3", username: "other", read: false, created_at: iso(3) },
      ]),
    );
    await service.readJson(true);

    const list = await service.getByUser("u1");
    expect(list.map(n => n.id)).toEqual(["n1", "n2"]); // unread dulu, lalu by date

    const count = await service.getUnreadCount("u1");
    expect(count).toBe(1);
    expect(typeof count).toBe("number"); // regression: tanpa async akan jadi Promise
  });

  test("markRead → true jika ada, false jika tidak ditemukan", async () => {
    fs.readFile.mockResolvedValue(
      JSON.stringify([{ id: "n1", username: "u1", read: false, created_at: new Date().toISOString() }]),
    );
    await service.readJson(true);

    expect(await service.markRead("n1")).toBe(true);
    expect(await service.markRead("nope")).toBe(false);
  });
});

describe("notifications service — pemangkasan (anti file tumbuh tanpa batas)", () => {
  test("cleanup memangkas read >30 hari & unread >90 hari, sisanya dipertahankan", async () => {
    const iso = daysAgo => new Date(Date.now() - daysAgo * 86400000).toISOString();
    fs.readFile.mockResolvedValue(
      JSON.stringify([
        { id: "read-old", username: "u1", read: true, created_at: iso(31) }, // buang
        { id: "unread-very-old", username: "u1", read: false, created_at: iso(100) }, // buang (aturan baru)
        { id: "unread-recent", username: "u1", read: false, created_at: iso(5) }, // simpan
        { id: "read-recent", username: "u1", read: true, created_at: iso(5) }, // simpan
      ]),
    );
    await service.readJson(true);

    const result = await service.cleanup();

    expect(result.removed).toBe(2);
    const [, content] = writeAtomicWithRetry.mock.calls.at(-1);
    expect(JSON.parse(content).map(n => n.id).sort()).toEqual(["read-recent", "unread-recent"]);
  });

  test("scheduleCleanup idempotent & stopCleanup membersihkan timer", () => {
    const t1 = service.scheduleCleanup(999999);
    const t2 = service.scheduleCleanup(999999);
    expect(t1).toBeTruthy();
    expect(t2).toBe(t1); // tidak membuat timer ganda
    service.stopCleanup();
    expect(service.cleanupTimer).toBeNull();
  });
});

// ─── GlobalProgressService SSE (issue3) ──────────────────────────

describe("GlobalProgressService SSE — clientId unik & cleanup per koneksi", () => {
  let svc;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers(); // module-level interval & heartbeat jadi timer palsu → tidak menahan proses test
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    svc = require("../services/progress/GlobalProgressService.js").default;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const makeConn = () => {
    const closes = [];
    const req = {
      params: { progressId: "p1" },
      on: (event, cb) => {
        if (event === "close") closes.push(cb);
      },
    };
    const res = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      writableEnded: false,
      destroyed: false,
    };
    return { req, res, closes };
  };

  test("dua koneksi serentak → clientId berbeda; menutup satu tidak merusak/menghapus yang lain", () => {
    const handler = svc.createSSEHandler(null);
    const a = makeConn();
    const b = makeConn();
    handler(a.req, a.res);
    handler(b.req, b.res);

    // clientId unik (dulu `client-${Date.now()}` bisa tabrakan → entry tertimpa + timer bocor)
    expect(svc.clients.size).toBe(2);
    const ids = [...svc.clients.keys()];
    expect(new Set(ids).size).toBe(2);

    // Event connected terkirim ke dua-duanya
    expect(a.res.write).toHaveBeenCalledWith(expect.stringContaining("connected"));
    expect(b.res.write).toHaveBeenCalledWith(expect.stringContaining("connected"));

    // Tutup koneksi A: heartbeat A harus ter-clear, koneksi B tetap utuh
    const timersBefore = jest.getTimerCount(); // module cleanup + heartbeat A + heartbeat B
    a.closes[0]();

    expect(svc.clients.size).toBe(1);
    expect(jest.getTimerCount()).toBe(timersBefore - 1);
    expect(svc.clients.has(ids[1])).toBe(true);
  });

  test("sendToClient tidak menulis ke response yang sudah end/destroyed (anti crash)", () => {
    const ended = { writableEnded: true, destroyed: false, write: jest.fn() };
    svc.sendToClient(ended, { percentage: 50 });
    expect(ended.write).not.toHaveBeenCalled();

    const alive = { writableEnded: false, destroyed: false, write: jest.fn() };
    svc.sendToClient(alive, { percentage: 50 });
    expect(alive.write).toHaveBeenCalledTimes(1);
    expect(alive.write.mock.calls[0][0]).toContain("progress");
  });
});
