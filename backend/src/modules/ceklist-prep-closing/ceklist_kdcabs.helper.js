/**
 * Shared helpers for Ceklist Prep Closing
 * - getIndukKdcabs: daftar cabang INDUK (4-huruf) dari storeService, dipakai oleh
 *   semua service ceklist untuk membangkitkan skeleton record per periode.
 */
import storeService from "../store/storeService.js";

/**
 * Get unique INDUK branch codes (4-char, e.g. G026) from storeService.
 * Dipakai bersama oleh space_hdd, space_tampung, dan import_idt.
 * @returns {Promise<string[]>}
 */
export async function getIndukKdcabs() {
  await storeService.ensureInitialized();

  const indukStores = storeService.stores.filter(s => s.notes === "INDUK");
  const kdcabSet = new Set(
    indukStores
      .map(s => (typeof s.branch === "string" ? s.branch.trim().toUpperCase() : ""))
      .filter(k => /^[A-Z0-9]{4}$/.test(k)),
  );
  return [...kdcabSet];
}