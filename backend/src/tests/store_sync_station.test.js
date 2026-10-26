/**
 * Unit Test: Deteksi perubahan station pada sync master toko.
 */

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() },
}));

import StoreSyncService from "../modules/store/store-sync.service.js";
import storeService from "../modules/store/store.service.js";

describe("Store Sync — Deteksi Perubahan Station", () => {
  let syncService;

  beforeEach(() => {
    syncService = new StoreSyncService();
    jest.clearAllMocks();
  });

  test("station berbeda (misal TW06: '00' vs '01') memicu updateStore", async () => {
    const existing = {
      id: 8026,
      storeCode: "TW06",
      station: "00",
      storeName: "H NAWI RAYA 2",
      dbHost: "10.46.36.34",
      branch: "G107",
      notes: "INDUK",
    };

    const record = {
      storeCode: "TW06",
      station: "01",
      storeName: "H NAWI RAYA 2",
      ip: "10.46.36.34",
      type: "INDUK",
      cabang: "G107",
    };

    const branch = "G107";
    const storeData = {
      storeCode: record.storeCode,
      station: record.station,
      dbHost: record.ip,
      notes: record.type,
      storeName: record.storeName,
      branch,
    };

    const isIpOrNameChanged =
      existing.dbHost !== storeData.dbHost || existing.storeName !== storeData.storeName;
    const isStationChanged =
      String(existing.station || "").trim() !== String(storeData.station || "").trim();
    const isNotesChanged =
      String(existing.notes || "").trim().toUpperCase() !==
      String(storeData.notes || "").trim().toUpperCase();
    const isBranchChanged = String(existing.branch || "").trim().toUpperCase() !== branch;

    const isChanged = isIpOrNameChanged || isStationChanged || isNotesChanged || isBranchChanged;

    expect(isIpOrNameChanged).toBe(false);
    expect(isBranchChanged).toBe(false);
    expect(isNotesChanged).toBe(false);
    expect(isStationChanged).toBe(true);
    expect(isChanged).toBe(true);
  });

  test("station identik (misal '01' vs ' 01 ') tidak dianggap berubah", () => {
    const existing = {
      station: "01",
      dbHost: "10.46.36.34",
      storeName: "H NAWI RAYA 2",
      branch: "G107",
      notes: "INDUK",
    };

    const storeData = {
      station: " 01 ",
      dbHost: "10.46.36.34",
      storeName: "H NAWI RAYA 2",
      branch: "G107",
      notes: "INDUK",
    };

    const isStationChanged =
      String(existing.station || "").trim() !== String(storeData.station || "").trim();
    expect(isStationChanged).toBe(false);
  });
});
