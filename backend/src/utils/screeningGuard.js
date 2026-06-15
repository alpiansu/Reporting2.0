/**
 * Screening Guard Utility
 *
 * Mencegah toko yang sama di-screen berkali-kali dalam 1 hari pada mass screening.
 * Memanfaatkan data rekap_remote JSON yang sudah ada sebagai sumber kebenaran.
 *
 * Guard HANYA berlaku untuk mass screening (semua cabang / 1 cabang).
 * Single store screening (re-screen 1 toko) TIDAK ada guard.
 */
import rekapRemoteStagingService from "../modules/rekap_remote/rekap_remote_staging.service.js";
import moment from "moment-timezone";
import logger from "../config/logger.js";

class ScreeningGuard {
  /**
   * Cek apakah toko sudah sukses screening hari ini.
   *
   * @param {string} moduleName - nama module (prep_closing, penyesuaian, dll)
   * @param {string} kdtk - kode toko
   * @returns {Promise<{screened: boolean, reason: string, updtime: string|null}>}
   *   - screened: true jika sudah sukses hari ini (harus di-skip)
   *   - reason: "no_data" | "previous_failed" | "already_success_today" | "stale_data"
   *   - updtime: waktu screening terakhir (jika ada)
   */
  async isSuccessToday(moduleName, kdtk) {
    try {
      const data = await rekapRemoteStagingService._getData(moduleName);
      const entry = data.find(item => item.kdtk === kdtk);

      logger.info(`[screeningGuard] Cek status untuk ${moduleName}/${kdtk}: ${entry ? "ada data" : "tidak ada data"}`);

      // Belum ada data untuk toko ini di module ini
      if (!entry) return { screened: false, reason: "no_data", updtime: null };

      // Cek apakah status gagal (mengandung "error" case-insensitive)
      const isFailed = /error/i.test(entry.status || "");
      logger.info(`[screeningGuard] Cek status untuk ${moduleName}/${kdtk}: ${isFailed ? "gagal" : "berhasil"}`);
      if (isFailed) return { screened: false, reason: "previous_failed", updtime: entry.updtime };

      // Cek apakah updtime hari ini (Asia/Jakarta)
      const today = moment.tz("Asia/Jakarta").format("YYYY-MM-DD");
      const entryDate = moment(entry.updtime, "YYYY-MM-DD HH:mm:ss").format("YYYY-MM-DD");

      logger.info(
        `[screeningGuard] Cek status untuk ${moduleName}/${kdtk}: ${entryDate === today ? "hari ini" : `bukan hari ini (Nilai: ${entryDate} vs ${today})`}`,
      );
      if (entryDate === today) {
        return { screened: true, reason: "already_success_today", updtime: entry.updtime };
      }

      // Data ada tapi bukan hari ini (basi)
      return { screened: false, reason: "stale_data", updtime: entry.updtime };
    } catch (error) {
      // Jika gagal baca data rekap_remote, jangan block screening
      logger.warn(`[screeningGuard] Gagal cek status untuk ${moduleName}/${kdtk}: ${error.message}`);
      return { screened: false, reason: "guard_error", updtime: null };
    }
  }
}

export default new ScreeningGuard();
