/**
 * Unit Test: resolusi cabang pada sync master toko.
 *
 * Kebijakan: m_cabang adalah SATU-SATUNYA sumber kebenaran cabang valid.
 * Resolusi per toko berprioritas: kolom sumber (TOKOMAIN.ini CABANG /
 * master-tokomain.csv kdcab) -> peta WRC -> cabang existing. Hanya kode yang
 * terdaftar di m_cabang yang boleh dipakai; jika tidak ada satupun yang
 * terdaftar -> null (toko tidak boleh masuk / diperbarui di stores.json).
 *
 * Ini menutup akar bug lama: fallback substring(0,1) di createStore yang
 * memalsukan cabang = huruf pertama kode toko (P/R/X/Z) sehingga cabang karangan
 * ikut masuk stores.json, mass screening "All", dan riwayat mass scan.
 *
 * Run with: npx jest --testPathPatterns store_sync_branch
 */

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() },
}));

import StoreSyncService from "../modules/store/store-sync.service.js";

// Meniru m_cabang.json (7 cabang terdaftar)
const REGISTERED = new Set(["G026", "G033", "G107", "G113", "G117", "G157", "G295"]);

const resolve = p => new StoreSyncService()._resolveRegisteredBranch({ registered: REGISTERED, ...p });

describe("_resolveRegisteredBranch — hanya cabang terdaftar di m_cabang", () => {
  test("kolom sumber terdaftar → dipakai (prioritas utama)", () => {
    expect(resolve({ sourceCab: "G033", wrcCab: "G026", existingCab: "G113" })).toBe("G033");
  });

  test("sumber terdaftar menang atas WRC/existing yang berbeda (prioritas sumber)", () => {
    expect(resolve({ sourceCab: "G117", wrcCab: "G157", existingCab: "G026" })).toBe("G117");
  });

  test("normalisasi spasi & huruf kecil → tetap cocok", () => {
    expect(resolve({ sourceCab: " g033 " })).toBe("G033");
    expect(resolve({ wrcCab: "g107" })).toBe("G107");
  });

  test("kolom sumber tak terdaftar → fallback ke WRC terdaftar", () => {
    expect(resolve({ sourceCab: "P", wrcCab: "G026" })).toBe("G026");
  });

  test("kolom sumber kosong → pakai WRC terdaftar", () => {
    expect(resolve({ sourceCab: "", wrcCab: "G107" })).toBe("G107");
  });

  test("sumber & WRC kosong → pertahankan cabang existing yang terdaftar", () => {
    expect(resolve({ sourceCab: "", wrcCab: "", existingCab: "G113" })).toBe("G113");
  });

  test("cabang karangan (huruf pertama kode toko) tidak pernah lolos", () => {
    expect(resolve({ sourceCab: "P", wrcCab: "X", existingCab: "Z" })).toBeNull();
    expect(resolve({ sourceCab: "R" })).toBeNull();
    expect(resolve({ sourceCab: "X" })).toBeNull();
    expect(resolve({ sourceCab: "Z" })).toBeNull();
  });

  test("existing ber-cabang karangan tidak dipertahankan", () => {
    // existing "P" tak terdaftar & tak ada kandidat lain → null (akan dibersihkan)
    expect(resolve({ sourceCab: "", wrcCab: "", existingCab: "P" })).toBeNull();
  });

  test("tidak ada kandidat sama sekali → null", () => {
    expect(resolve({})).toBeNull();
    expect(resolve({ sourceCab: "", wrcCab: "", existingCab: "" })).toBeNull();
    expect(resolve({ sourceCab: null, wrcCab: undefined, existingCab: null })).toBeNull();
  });
});
