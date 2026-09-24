/**
 * Unit Tests: Health fix issue7 — wrc.service.getConnWRC cache constring per cabang
 * Dulu: setiap panggilan (per toko per module saat screening massal) membuka +
 * query + tutup koneksi EDP → ribuan handshake. Kini di-cache per cabang dengan
 * TTL5 menit; kegagalan TIDAK di-cache (retry berikutnya query ulang).
 *
 * Run with: npx jest --testPathPatterns wrc_service
 */

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() },
}));

jest.mock("mysql2/promise", () => ({
  __esModule: true,
  default: { createConnection: jest.fn() },
}));

import mysql from "mysql2/promise";
import WrcBulananService from "../services/wrc.service.js";

const CONSTRING = "Server=10.10.1.1;UID=wrc;Password=rahasia;Database=db_wrc_g033";

function mockEdp({ fail = false } = {}) {
  const conn = {
    execute: jest.fn(async () => {
      if (fail) throw new Error("db_edp down");
      return [[{ nilai: CONSTRING }]];
    }),
    end: jest.fn(async () => {}),
  };
  mysql.createConnection.mockResolvedValue(conn);
  return conn;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getConnWRC — cache constring per cabang (TTL)", () => {
  test("cabang sama dalam TTL → EDP dihubungi sekali; hasil berupa salinan config", async () => {
    const svc = new WrcBulananService();
    mockEdp();

    const c1 = await svc.getConnWRC("G033");
    const c2 = await svc.getConnWRC("G033");

    expect(mysql.createConnection).toHaveBeenCalledTimes(1);
    expect(c1.host).toBe("10.10.1.1");
    expect(c1.user).toBe("wrc");
    expect(c1.password).toBe("rahasia");
    expect(c1.database).toBe("db_wrc_g033");
    expect(c1.multipleStatements).toBe(true);
    expect(c1.dateStrings).toEqual(["DATE", "DATETIME"]);

    expect(c2).toEqual(c1);
    expect(c2).not.toBe(c1); // salinan — pemakai tidak mengubah cache
  });

  test("cabang berbeda → cache terpisah (query sekali per cabang)", async () => {
    const svc = new WrcBulananService();
    mockEdp();

    await svc.getConnWRC("G033");
    await svc.getConnWRC("G001");
    await svc.getConnWRC("G001");

    expect(mysql.createConnection).toHaveBeenCalledTimes(2);
  });

  test("TTL kedaluwarsa → query ulang (config terbaru yang dipakai)", async () => {
    const svc = new WrcBulananService();
    mockEdp();

    await svc.getConnWRC("G033");
    svc.connWrCache.get("G033").cachedAt = Date.now() - svc.connWrTTL - 1;
    await svc.getConnWRC("G033");

    expect(mysql.createConnection).toHaveBeenCalledTimes(2);
  });

  test("kegagalan TIDAK di-cache → percobaan berikutnya query ulang", async () => {
    const svc = new WrcBulananService();
    mockEdp({ fail: true });

    await expect(svc.getConnWRC("G033")).rejects.toThrow("db_edp down");
    expect(svc.connWrCache.size).toBe(0);

    mockEdp(); // EDP pulih
    const config = await svc.getConnWRC("G033");

    expect(mysql.createConnection).toHaveBeenCalledTimes(2);
    expect(config.host).toBe("10.10.1.1");
  });
});
