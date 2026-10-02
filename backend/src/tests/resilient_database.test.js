/**
 * Unit Tests: Health fix issue #13 — reconnect cycle dishare antar request
 *   - Dua getDatabase() bersamaan saat DB down → hanya SATU siklus reconnect
 *     (connect dipanggil 1× per attempt, tidak ada badai force-reconnect).
 *   - Hasil null tidak di-cache: cycle berikutnya memulai attempt baru.
 *   - Kontrak pemanggil TIDAK berubah: resolve sequelize | null, tidak pernah reject.
 *
 * Run with: npx jest --testPathPatterns resilient_database
 */

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() },
}));

// dotenv + fs di config/resilient-database tidak boleh menyentuh disk nyata
jest.mock("dotenv", () => ({ __esModule: true, default: { config: jest.fn() } }));
jest.mock("fs/promises", () => ({
  mkdir: jest.fn(async () => {}),
  readFile: jest.fn(async () => "[]"),
  writeFile: jest.fn(async () => {}),
}));

import resilientDb, { DatabaseUnavailableError } from "../config/resilient-database.js";
import logger from "../config/logger.js";

function freshInstance() {
  // Instance terpisah agar state singleton antar test tidak bocor
  const Ctor = Object.getPrototypeOf(resilientDb).constructor;
  return new Ctor();
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("ResilientDatabase.getDatabase (retry cycle dishare)", () => {
  test("dua pemanggil bersamaan saat DB down → hanya satu siklus reconnect, keduanya null", async () => {
    const db = freshInstance();
    db.isConnected = false;
    db.sequelize = null;

    let connectCalls = 0;
    db.connect = jest.fn(async () => {
      connectCalls += 1;
      throw new Error("ECONNREFUSED");
    });

    const p1 = db.getDatabase();
    const p2 = db.getDatabase();

    // Backoff 2s → attempt 2 → backoff 4s → attempt 3 → null
    await jest.advanceTimersByTimeAsync(7000);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(db.connect).toHaveBeenCalledTimes(3); // 1 siklus = 3 attempt, bukan 6
    expect(connectCalls).toBe(3);
  });

  test("pemanggil yang datang di tengah siklus ikut cycle yang sama", async () => {
    const db = freshInstance();
    db.isConnected = false;
    db.sequelize = null;

    db.connect = jest.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    const p1 = db.getDatabase();
    await jest.advanceTimersByTimeAsync(1000);

    const p2 = db.getDatabase(); // datang saat siklus masih jalan
    await jest.advanceTimersByTimeAsync(6000);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(db.connect).toHaveBeenCalledTimes(3);
  });

  test("sukses di attempt 2 → resolve sequelize tanpa reject", async () => {
    const db = freshInstance();
    db.isConnected = false;
    db.sequelize = null;

    const fakeSequelize = { mark: "instance-2" };
    db.connect = jest.fn(async ({ force } = {}) => {
      if (!force) throw new Error("ECONNREFUSED"); // attempt 1 gagal
      db.sequelize = fakeSequelize;
      db.isConnected = true;
      return fakeSequelize; // attempt 2 (force) sukses
    });

    const p = db.getDatabase();
    await jest.advanceTimersByTimeAsync(2000); // melewati backoff 2s
    const result = await p;

    expect(result).toBe(fakeSequelize);
    expect(db.connect).toHaveBeenCalledTimes(2);
  });

  test("hasil null tidak di-cache: getDatabase berikutnya memulai siklus baru", async () => {
    const db = freshInstance();
    db.isConnected = false;
    db.sequelize = null;

    let fail = true;
    db.connect = jest.fn(async () => {
      if (fail) throw new Error("ECONNREFUSED");
      db.isConnected = true;
      db.sequelize = { mark: "ok" };
      return db.sequelize;
    });

    // Siklus 1 → null
    const cycle1 = db.getDatabase();
    await jest.advanceTimersByTimeAsync(7000);
    expect(await cycle1).toBeNull();
    expect(db.connect).toHaveBeenCalledTimes(3);

    // DB sudah pulih → siklus baru harus dijalankan, bukan mengembalikan null lama
    fail = false;
    const cycle2 = db.getDatabase();
    const result = await cycle2;
    expect(result).toEqual({ mark: "ok" });
    expect(db.connect).toHaveBeenCalledTimes(4); // hanya 1 attempt baru (langsung sukses)
  });

  test("DB sudah connected → return sequelize langsung tanpa reconnect", async () => {
    const db = freshInstance();
    db.isConnected = true;
    db.sequelize = { mark: "live" };
    db.connect = jest.fn();

    const result = await db.getDatabase();
    expect(result).toEqual({ mark: "live" });
    expect(db.connect).not.toHaveBeenCalled();
  });
});

describe("Health fix #14 — batas waktu, hook disconnect & force destroy", () => {
  test("getDatabase melempar DatabaseUnavailableError (503) saat koneksi menggantung > 15 detik", async () => {
    const db = freshInstance();
    db.isConnected = false;
    db.sequelize = null;
    db.connect = jest.fn(() => new Promise(() => {})); // menggantung selamanya

    const p = db.getDatabase();
    const assertion = expect(p).rejects.toMatchObject({
      name: "DatabaseUnavailableError",
      statusCode: 503,
    });

    await jest.advanceTimersByTimeAsync(15000);
    await assertion;

    // peringatan dini saat request tertahan > 2 detik ikut terpicu
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("tertahan menunggu database"));
  });

  test("beforeDisconnect TIDAK lagi menandai DB mati (regresi rebuild tiap 10 detik)", () => {
    const db = freshInstance();
    const hooks = {};
    db.sequelize = {
      addHook: (name, fn) => {
        hooks[name] = fn;
      },
    };
    db.isConnected = true;

    db.setupConnectionHandlers();

    expect(typeof hooks.beforeDisconnect).toBe("function");
    hooks.beforeDisconnect();
    expect(db.isConnected).toBe(true); // dulu: false → memicu rebuild instance tiap request

    hooks.afterConnect();
    expect(db.isConnected).toBe(true);
  });

  test("forceDestroyPool membuang koneksi available + in-use tanpa menunggu drain", () => {
    const db = freshInstance();
    const makeResource = id => ({ id, destroy: jest.fn() });
    const available = makeResource(1);
    const inUse = makeResource(2);
    const fakePool = {
      _availableObjects: [{ resource: available }],
      _inUseObjects: [{ resource: inUse }],
      destroy: jest.fn(() => Promise.resolve()),
    };

    db.forceDestroyPool({ connectionManager: { pool: fakePool } });

    expect(fakePool.destroy).toHaveBeenCalledWith(available);
    expect(fakePool.destroy).toHaveBeenCalledWith(inUse);
    expect(available.destroy).toHaveBeenCalled(); // socket dipaksa mati dulu
    expect(inUse.destroy).toHaveBeenCalled();
  });

  test("close() yang menggantung dibatasi lalu memaksa buang koneksi", async () => {
    const db = freshInstance();
    const fakePool = {
      _availableObjects: [],
      _inUseObjects: [],
      destroy: jest.fn(() => Promise.resolve()),
    };
    db.sequelize = { close: () => new Promise(() => {}), connectionManager: { pool: fakePool } };
    db.isConnected = true;

    const p = db.close();
    await jest.advanceTimersByTimeAsync(5000);
    await p;

    expect(db.isConnected).toBe(false);
    expect(db.sequelize).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("memaksa menutup koneksi"));
  });

  test("executeOperation: operasi menggantung → 503 setelah deadline; fallback tetap dipakai", async () => {
    const db = freshInstance();
    db.getDatabase = jest.fn(async () => ({ mark: "live" }));

    const p1 = db.executeOperation(() => new Promise(() => {}));
    const a1 = expect(p1).rejects.toMatchObject({ name: "DatabaseUnavailableError" });
    await jest.advanceTimersByTimeAsync(60000);
    await a1;

    const p2 = db.executeOperation(() => new Promise(() => {}), { offline: true });
    const a2 = expect(p2).resolves.toEqual({ offline: true });
    await jest.advanceTimersByTimeAsync(60000);
    await a2;
  });

  test("executeOperation: getDatabase melempar 503 → fallback dipakai", async () => {
    const db = freshInstance();
    db.getDatabase = jest.fn(async () => {
      throw new DatabaseUnavailableError("Menunggu koneksi database melebihi 15000ms");
    });

    const result = await db.executeOperation(() => Promise.resolve("tidak dipakai"), { cached: 1 });
    expect(result).toEqual({ cached: 1 });
  });

  test("heartbeat gagal (authenticate menggantung) → tandai DB down & buang pool", async () => {
    const db = freshInstance();
    const fakePool = {
      _availableObjects: [],
      _inUseObjects: [],
      destroy: jest.fn(() => Promise.resolve()),
    };
    db.sequelize = {
      authenticate: jest.fn(() => new Promise(() => {})),
      connectionManager: { pool: fakePool },
    };
    db.isConnected = true;

    const hb = db.runHeartbeat();
    await jest.advanceTimersByTimeAsync(8000);
    await hb;

    expect(db.isConnected).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Heartbeat database gagal"));
  });
});
