/**
 * WRC Executor Service — Monthly Reports
 *
 * Tanggung jawab:
 *   1. Baca koneksi WRC dari constringwrc (via global wrc.service.js)
 *   2. Buka MySQL pool ke WRC (bukan single connection)
 *   3. Eksekusi queries-wrc secara SEQUENTIAL (satu per satu, tidak ada paralel)
 *   4. Eksekusi queries-export, kumpulkan rows per sheet
 *   5. Tutup pool dan bersihkan memori setelah selesai
 *
 * ─── Catatan Concurrency ────────────────────────────────────────────────────
 *   - Pool dan results disimpan di LOCAL VARIABLE (bukan class property)
 *   - Aman untuk banyak request bersamaan karena tidak ada shared mutable state
 *   - Report A dan Report B dari user berbeda berjalan PARALEL (tidak saling tunggu)
 *   - Yang SEQUENTIAL adalah queries-wrc di DALAM satu report
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ─── Catatan Query ──────────────────────────────────────────────────────────
 *   - TIDAK ADA timeout pada eksekusi query WRC (proses WRC memang lama)
 *   - Placeholder {userId}, {cab}, {prd}, {prdPrev}, {prdYear}, {prdMonth} disubstitusi otomatis
 *   - Nilai placeholder di-sanitize: hanya [a-zA-Z0-9_] agar aman di nama table
 * ────────────────────────────────────────────────────────────────────────────
 */

import mysql from "mysql2/promise";
import WrcService from "../../../services/wrc.service.js";
import logger from "../../../config/logger.js";

// Instansiasi wrcService (wrc.service.js mengeksport class, bukan singleton)
const wrcService = new WrcService();


/**
 * Substitusi placeholder dalam SQL string.
 * Placeholder format: {namaKey}
 * Nilai di-sanitize → hanya alfanumerik + underscore (aman untuk nama table).
 *
 * @param {string} sql       - SQL template
 * @param {Object} params    - { userId, cab, ... }
 * @returns {string}         - SQL yang sudah disubstitusi
 */
function injectParams(sql, params = {}) {
  let result = sql;
  for (const [key, val] of Object.entries(params)) {
    const safeVal = String(val).replace(/[^a-zA-Z0-9_]/g, "_");
    result = result.replaceAll(`{${key}}`, safeVal);
  }
  return result;
}

/**
 * Eksekusi satu laporan penuh:
 *   1. Baca config koneksi WRC untuk cab via wrc.service.js
 *   2. Buka pool MySQL ke WRC
 *   3. Eksekusi queries-wrc SEQUENTIAL
 *   4. Eksekusi queries-export, kumpulkan rows per key (nama sheet)
 *   5. Tutup pool, bersihkan memori
 *
 * @param {Object} options
 * @param {Object} options.reportConfig  - Satu entry dari monthly_reports_config.json
 * @param {string} options.cab           - Kode cabang (contoh: "G001")
 * @param {string} options.userId        - Username user aktif (dari JWT)
 * @param {string} options.prd           - Periode format YYMM (contoh: "2501")
 * @param {string} options.prdYear       - Tahun lengkap (contoh: "2025")
 * @param {string} options.prdMonth      - Bulan 2 digit (contoh: "01")
 * @returns {Promise<Object>}            - { [sheetKey]: rows[] }
 */
export async function executeReport({ reportConfig, cab, userId, prd = "", prdYear = "", prdMonth = "" }) {
  const reportName = reportConfig["name-reports"];
  const reportId   = reportConfig["id-reports"];
  const queriesWrc    = reportConfig["queries-wrc"]    || [];
  const queriesExport = reportConfig["queries-export"] || [];
  const queriesCleanup = reportConfig["queries-cleanup"] || [];

  // ─── Hitung prdPrev (bulan sebelumnya) ──────────────────────────────────
  // Contoh: prd="2604" (April 2026) → prdPrev="2603" (Maret 2026)
  //         prd="2601" (Jan 2026)   → prdPrev="2512" (Des 2025)
  let prdPrev = "";
  if (prd && /^\d{4}$/.test(prd)) {
    const yy  = parseInt(prd.substring(0, 2), 10);
    const mm  = parseInt(prd.substring(2, 4), 10);
    let prevYY = yy;
    let prevMM = mm - 1;
    if (prevMM === 0) {
      prevMM = 12;
      prevYY = yy - 1;
    }
    prdPrev = `${String(prevYY).padStart(2, "0")}${String(prevMM).padStart(2, "0")}`;
  }

  // Parameter untuk substitusi placeholder
  // {userId}   → username aktif (aman untuk nama table)
  // {cab}      → kode cabang    (aman untuk nama table)
  // {prd}      → periode YYMM   (contoh: 2604)
  // {prdPrev}  → periode YYMM bulan sebelumnya (contoh: 2603)
  // {prdYear}  → tahun 4 digit  (contoh: 2026)
  // {prdMonth} → bulan 2 digit  (contoh: 04)
  const params = { userId, cab, prd, prdPrev, prdYear, prdMonth };

  logger.info(`[wrc_executor][${reportId}] ═══ Mulai eksekusi laporan: "${reportName}" | cab=${cab} | user=${userId} ═══`);

  // ─── Step 1: Baca config koneksi WRC dari DB EDP ──────────────────────────
  logger.info(`[wrc_executor][${cab}] Membaca constringwrc dari DB EDP...`);
  let wrcConfig;
  try {
    wrcConfig = await wrcService.getConnWRC(cab);
    logger.info(`[wrc_executor][${cab}] Config WRC berhasil dibaca: host=${wrcConfig.host}, db=${wrcConfig.database}`);
  } catch (err) {
    logger.error(`[wrc_executor][${cab}] Gagal membaca constringwrc: ${err.message}`);
    throw new Error(`Gagal membaca konfigurasi WRC untuk cabang ${cab}: ${err.message}`);
  }

  // ─── Step 2: Buka MySQL pool ke WRC ──────────────────────────────────────
  logger.info(`[wrc_executor][${cab}] Membuka koneksi pool ke WRC (host=${wrcConfig.host})...`);
  let pool;
  try {
    pool = mysql.createPool({
      host:               wrcConfig.host,
      user:               wrcConfig.user,
      password:           wrcConfig.password,
      database:           wrcConfig.database,
      multipleStatements: true,
      dateStrings:        ["DATE", "DATETIME"],
      waitForConnections: true,
      connectionLimit:    3,    // cukup untuk 1 laporan per request
      maxIdle:            1,
      idleTimeout:        7200000,
      connectTimeout:     10000,
    });
    // Test koneksi awal
    const testConn = await pool.getConnection();
    await testConn.ping();
    testConn.release();
    logger.info(`[wrc_executor][${cab}] Pool WRC aktif dan siap digunakan`);
  } catch (err) {
    logger.error(`[wrc_executor][${cab}] Gagal membuka pool WRC: ${err.message}`);
    throw new Error(`Gagal membuka koneksi ke WRC cabang ${cab}: ${err.message}`);
  }

  let results = null;
  let conn    = null;

  try {
    conn = await pool.getConnection();
    logger.info(`[wrc_executor][${cab}] Koneksi dari pool berhasil diambil`);

    // ─── Step 3: Eksekusi queries-wrc SEQUENTIAL ──────────────────────────
    const totalWrc = queriesWrc.length;
    if (totalWrc === 0) {
      logger.warn(`[wrc_executor][${cab}] Tidak ada queries-wrc untuk dieksekusi`);
    } else {
      logger.info(`[wrc_executor][${cab}] Mulai eksekusi ${totalWrc} query WRC secara sequential...`);
    }

    for (const [i, rawSql] of queriesWrc.entries()) {
      const queryNum = i + 1;
      const finalSql = injectParams(rawSql, params);
      const preview  = finalSql.replace(/\s+/g, " ").trim().substring(0, 120);

      logger.info(`[wrc_executor][${cab}] ─── Eksekusi WRC query ke-${queryNum} dari ${totalWrc} ───`);
      logger.debug(`[wrc_executor][${cab}] Query preview: ${preview}${finalSql.length > 120 ? "..." : ""}`);

      const startTime = Date.now();
      await conn.query(finalSql); // TIDAK ADA timeout — proses WRC memang lama
      const duration = Date.now() - startTime;

      logger.info(`[wrc_executor][${cab}] Query ke-${queryNum} SELESAI (${duration}ms)`);
    }

    if (totalWrc > 0) {
      logger.info(`[wrc_executor][${cab}] Semua ${totalWrc} queries-wrc berhasil dieksekusi`);
    }

    // ─── Step 4: Eksekusi queries-export, kumpulkan rows per sheet ────────
    const totalExport = queriesExport.length;
    logger.info(`[wrc_executor][${cab}] Mulai eksekusi ${totalExport} query export...`);

    results = {};
    for (const [j, item] of queriesExport.entries()) {
      const sheetKey  = item.key;
      const rawSql    = item.query;
      const finalSql  = injectParams(rawSql, params);

      logger.info(`[wrc_executor][${cab}] Export query ${j + 1}/${totalExport} → sheet: "${sheetKey}"`);
      logger.debug(`[wrc_executor][${cab}] Export query preview: ${finalSql.replace(/\s+/g, " ").trim().substring(0, 120)}`);

      const startTime = Date.now();
      const [rows]    = await conn.query(finalSql);
      const duration  = Date.now() - startTime;

      results[sheetKey] = rows;
      logger.info(`[wrc_executor][${cab}] Sheet "${sheetKey}": ${rows.length} baris (${duration}ms)`);
    }

    // ─── Step 5: Eksekusi queries-cleanup PARALEL ─────────────────────────
    const totalCleanup = queriesCleanup.length;
    if (totalCleanup > 0) {
      logger.info(`[wrc_executor][${cab}] Mulai eksekusi ${totalCleanup} query CLEANUP secara paralel...`);
      
      const cleanupPromises = queriesCleanup.map(async (rawSql, idx) => {
        const queryNum = idx + 1;
        const finalSql = injectParams(rawSql, params);
        const preview  = finalSql.replace(/\s+/g, " ").trim().substring(0, 120);
        
        logger.info(`[wrc_executor][${cab}] ─── Mulai Cleanup query ke-${queryNum} dari ${totalCleanup} ───`);
        logger.debug(`[wrc_executor][${cab}] Cleanup query preview: ${preview}${finalSql.length > 120 ? "..." : ""}`);
        
        const startTime = Date.now();
        // Gunakan pool.query (jika conn dari pool dikembalikan setelah ini)
        // Atau buat koneksi baru dari pool khusus untuk tiap query agar paralel optimal di db level
        // Karena kita punya pool dengan limit 3, mari kita pinjam koneksi baru / pakai langsung pool.query
        await pool.query(finalSql); 
        const duration = Date.now() - startTime;
        
        logger.info(`[wrc_executor][${cab}] Cleanup query ke-${queryNum} SELESAI (${duration}ms)`);
      });

      await Promise.all(cleanupPromises);
      logger.info(`[wrc_executor][${cab}] Semua ${totalCleanup} queries-cleanup selesai dieksekusi`);
    }

    logger.info(`[wrc_executor][${reportId}] ═══ Eksekusi laporan "${reportName}" selesai ═══`);
    return results;

  } catch (err) {
    logger.error(`[wrc_executor][${cab}] Error saat eksekusi: ${err.message}`);
    throw err;

  } finally {
    // ─── Step 5: Cleanup koneksi dan memori ──────────────────────────────
    // Release koneksi kembali ke pool
    if (conn) {
      try {
        conn.release();
        logger.debug(`[wrc_executor][${cab}] Koneksi dikembalikan ke pool`);
      } catch (e) {
        logger.warn(`[wrc_executor][${cab}] Gagal release koneksi: ${e.message}`);
      }
    }

    // Tutup pool — penting! jangan biarkan koneksi WRC tergantung
    if (pool) {
      try {
        await pool.end();
        logger.info(`[wrc_executor][${cab}] Pool WRC berhasil ditutup`);
      } catch (e) {
        logger.warn(`[wrc_executor][${cab}] Gagal menutup pool: ${e.message}`);
      }
      pool = null; // lepas referensi
    }

    // Catatan: results sengaja TIDAK dinull-kan di sini karena masih dibutuhkan
    // oleh caller (excel_export.service). Caller yang bertanggung jawab
    // untuk null-kan setelah selesai streaming.
  }
}
