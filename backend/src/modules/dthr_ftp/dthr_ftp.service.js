import fs from "fs/promises";
import pLimit from "p-limit";
import moment from "moment-timezone";
import { Op } from "sequelize";
import logger from "../../config/logger.js";
import storeService from "../store/storeService.js";
import progressService from "../progress/progress.service.js";
import resilientDb from "../../config/resilient-database.js";
import { buildDthrFilename, runXcmd } from "../../utils/xcmd.utils.js";
import DthrFtpLog from "./dthr_ftp.model.js";

const XCMD_WORKING_DIR = process.env.XCMD_WORKING_DIR;
const XCMD_TIMEOUT_MS = parseInt(process.env.XCMD_TIMEOUT_MS, 10) || 60_000;

const STALE_PENDING_MINUTES = 60;

async function resolveStoreInfo(kdtk) {
  const store = await storeService.getStoreByCode(kdtk);
  if (!store) {
    throw new Error(`Store dengan kode ${kdtk} tidak ditemukan`);
  }
  return {
    cabang: store.branch || store.cab,
    namaToko: store.storeName || store.nama || `Toko ${kdtk}`,
  };
}

async function dispatchOne({ kdtk, tglTransaksi, username, force }) {
  const info = await resolveStoreInfo(kdtk);
  const fileName = buildDthrFilename({ kdtk, tglTransaksi });

  if (!force) {
    const alreadySent = await DthrFtpLog.findOne({
      where: { kdtk, tgl_transaksi: tglTransaksi, status: "success" },
    });
    if (alreadySent) {
      logger.info(`[dthr_ftp] Skipped ${fileName} — already sent successfully`);
      return { fileName, status: "skipped", kdtk, tglTransaksi, namaToko: info.namaToko };
    }
  }

  const logEntry = await DthrFtpLog.create({
    kdtk,
    kode_cab: info.cabang,
    tgl_transaksi: tglTransaksi,
    nama_file: fileName,
    status: "pending",
    sent_by: username,
  });

  try {
    await runXcmd(["PUSHDTHR", info.cabang, "eisho", fileName], {
      cwd: XCMD_WORKING_DIR,
      timeoutMs: XCMD_TIMEOUT_MS,
    });

    await logEntry.update({ status: "success", sent_at: new Date() });

    logger.info(`[dthr_ftp] Success: ${fileName} pushed via xcmd`);
    return { fileName, status: "success", kdtk, tglTransaksi, namaToko: info.namaToko };
  } catch (err) {
    await logEntry.update({ status: "failed", error_message: err.message });
    logger.error(`[dthr_ftp] Failed: ${fileName} — ${err.message}`);
    return { fileName, status: "failed", error: err.message, kdtk, tglTransaksi, namaToko: info.namaToko };
  }
}

class DthrFtpService {
  async validateWorkingDir() {
    if (!XCMD_WORKING_DIR) {
      throw new Error("XCMD_WORKING_DIR tidak dikonfigurasi di environment");
    }
    try {
      await fs.access(XCMD_WORKING_DIR);
    } catch {
      throw new Error(`Directory XCMD_WORKING_DIR (${XCMD_WORKING_DIR}) tidak ditemukan. Buat direktori tersebut atau perbaiki konfigurasi.`);
    }
  }

  async cleanupStalePending() {
    try {
      const cutoff = moment().subtract(STALE_PENDING_MINUTES, "minutes").toDate();
      const affected = await DthrFtpLog.update(
        { status: "failed", error_message: `Stale pending — di-reset otomatis setelah ${STALE_PENDING_MINUTES} menit` },
        { where: { status: "pending", created_at: { [Op.lt]: cutoff } } },
      );
      if (affected[0] > 0) {
        logger.info(`[dthr_ftp] Cleaned ${affected[0]} stale pending records`);
      }
    } catch (err) {
      logger.warn(`[dthr_ftp] Stale cleanup error: ${err.message}`);
    }
  }

  _getNtbTableName(periode) {
    return `db_edp.rekon_glslp_vs_ntb_${periode}`;
  }

  _canSendSql() {
    return `(n.HASIL_CEK IS NULL OR n.HASIL_CEK = '' OR NOT (LOWER(n.HASIL_CEK) LIKE '%file hr%' AND LOWER(n.HASIL_CEK) LIKE '%tidak ada%'))`;
  }

  _canSendCondition() {
    return `(HASIL_CEK IS NULL OR HASIL_CEK = '' OR NOT (LOWER(HASIL_CEK) LIKE '%file hr%' AND LOWER(HASIL_CEK) LIKE '%tidak ada%'))`;
  }

  async getDispatchSummary({ cabang, periode }) {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) throw new Error("Database tidak tersedia");
    if (!periode) throw new Error("Periode wajib diisi");

    const table = this._getNtbTableName(periode);
    const canSend = this._canSendCondition();

    const sql = `
      SELECT sub.cabang,
        COUNT(*) AS total,
        COUNT(DISTINCT l.kdtk, l.tgl_transaksi) AS sent,
        COUNT(*) - COUNT(DISTINCT l.kdtk, l.tgl_transaksi) AS unsent
      FROM (
        SELECT n.KODE_GUDANG AS cabang, n.KODE_TOKO, n.TGL_TRANSAKSI
        FROM ${table} n
        GROUP BY n.KODE_GUDANG, n.KODE_TOKO, n.TGL_TRANSAKSI
        HAVING SUM(CASE WHEN ${canSend} THEN 1 ELSE 0 END) > 0
      ) sub
      LEFT JOIN dthr_ftp_log l
        ON l.kdtk = sub.KODE_TOKO
        AND l.tgl_transaksi = sub.TGL_TRANSAKSI
        AND l.status = 'success'
      WHERE (:cabang = 'All' OR sub.cabang = :cabang)
      GROUP BY sub.cabang
      ORDER BY sub.cabang
    `;

    const [rows] = await sequelize.query(sql, { replacements: { cabang: cabang || "All" } });

    let grandTotal = 0, grandSent = 0, grandUnsent = 0;
    for (const r of rows) {
      grandTotal += Number(r.total);
      grandSent += Number(r.sent);
      grandUnsent += Number(r.unsent);
    }

    return { items: rows, totals: { total: grandTotal, sent: grandSent, unsent: grandUnsent } };
  }

  async getUnsentItems({ cabang, periode, force = false }) {
    const sequelize = await resilientDb.getDatabase();
    if (!sequelize) throw new Error("Database tidak tersedia");
    if (!periode) throw new Error("Periode wajib diisi");

    const table = this._getNtbTableName(periode);
    const canSend = this._canSendCondition();

    if (force) {
      const sql = `
        SELECT n.KODE_TOKO AS kdtk, n.TGL_TRANSAKSI AS tglTransaksi
        FROM ${table} n
        WHERE n.KODE_GUDANG = :cabang
        GROUP BY n.KODE_TOKO, n.TGL_TRANSAKSI
        HAVING SUM(CASE WHEN ${canSend} THEN 1 ELSE 0 END) > 0
        ORDER BY n.TGL_TRANSAKSI
      `;
      const [rows] = await sequelize.query(sql, { replacements: { cabang } });
      return rows;
    }

    const sql = `
      SELECT n.KODE_TOKO AS kdtk, n.TGL_TRANSAKSI AS tglTransaksi
      FROM ${table} n
      LEFT JOIN dthr_ftp_log l
        ON l.kdtk = n.KODE_TOKO
        AND l.tgl_transaksi = n.TGL_TRANSAKSI
        AND l.status = 'success'
      WHERE n.KODE_GUDANG = :cabang
        AND l.id IS NULL
      GROUP BY n.KODE_TOKO, n.TGL_TRANSAKSI
      HAVING SUM(CASE WHEN ${canSend} THEN 1 ELSE 0 END) > 0
      ORDER BY n.TGL_TRANSAKSI
    `;
    const [rows] = await sequelize.query(sql, { replacements: { cabang } });
    return rows;
  }

  async dispatchBatch(items, username, fullName, force = false) {
    await this.validateWorkingDir();

    // Dedup: only one dispatch per (kdtk, tglTransaksi) / per filename
    const seen = new Set();
    const uniqueItems = items.filter(i => {
      const key = `${i.kdtk}_${i.tglTransaksi}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (uniqueItems.length !== items.length) {
      logger.info(`[dthr_ftp] Dedup: ${items.length} items → ${uniqueItems.length} unique files`);
    }

    const taskId = `dthrFtpTask_${username}`;
    const totalItems = uniqueItems.length;

    const timeStart = moment().format("YYYY-MM-DD HH:mm:ss");
    await progressService.startProgress(taskId, totalItems, {
      module: "dthr_ftp",
      title: "Kirim DTHR ke FTP Nielsen",
      description: "registering task",
      startedBy: fullName || username,
      status: "registering",
      createdAt: timeStart,
    });

    this._processBatch(uniqueItems, username, force, taskId).catch(async (err) => {
      logger.error(`[dthr_ftp] Background batch failed: ${err.message}`);
      try {
        await progressService.failProgress(taskId, {
          description: err.message,
          status: "failed",
        });
      } catch { /* ignore */ }
    });

    return { taskId, total: totalItems };
  }

  async _processBatch(items, username, force, taskId) {
    const totalItems = items.length;
    const limit = pLimit(3);
    let completedCount = 0;

    const results = await Promise.allSettled(
      items.map((item) =>
        limit(async () => {
          const result = await dispatchOne({ ...item, username, force });
          completedCount++;
          const statusIcon = result.status === "success" ? "✓" : result.status === "skipped" ? "⏭" : "✗";
          await progressService.updateProgress(taskId, completedCount, {
            description: `${result.fileName} → ${result.status} ${statusIcon} (${completedCount}/${totalItems})`,
            status: "Mengirim DTHR...",
          });
          return result;
        }),
      ),
    );

    const summary = this._summarize(results);

    const timeCompleted = moment().format("YYYY-MM-DD HH:mm:ss");
    await progressService.updateProgress(taskId, totalItems, {
      description: `Selesai: ${summary.success} sukses, ${summary.skipped} skip, ${summary.failed} gagal dari ${totalItems} item`,
      status: "completed",
      completedAt: timeCompleted,
      success: summary.success,
      skipped: summary.skipped,
      failed: summary.failed,
      total: totalItems,
      details: summary.details,
    });

    await progressService.completeProgress(taskId);
  }

  _summarize(results) {
    let success = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];
    const details = [];

    for (const r of results) {
      if (r.status === "rejected") {
        failed++;
        errors.push(r.reason?.message || "Unknown error");
        details.push({ kdtk: '?', tglTransaksi: '?', nama_file: '?', namaToko: '', status: 'failed', error: r.reason?.message });
      } else {
        const v = r.value;
        const st = v.status;
        if (st === "success") success++;
        else if (st === "skipped") skipped++;
        else {
          failed++;
          errors.push(v.error || "Unknown error");
        }
        details.push({
          kdtk: v.kdtk || '',
          tglTransaksi: v.tglTransaksi || '',
          nama_file: v.fileName || '',
          namaToko: v.namaToko || '',
          status: st,
          error: v.error || null,
        });
      }
    }

    return { success, skipped, failed, errors, details };
  }

  async getLogs({ cabang, periode, status, page = 1, limit = 20 }) {
    const where = {};
    if (cabang) where.kode_cab = cabang;
    if (status) where.status = status;

    const offset = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      DthrFtpLog.findAll({
        where,
        order: [["created_at", "DESC"]],
        offset,
        limit,
      }),
      DthrFtpLog.count({ where }),
    ]);

    return {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async checkBatchStatus(items) {
    if (!items || items.length === 0) return {};

    const conditions = items.map((item) => ({
      kdtk: item.kdtk || item.kodeToko,
      tgl_transaksi: item.tglTransaksi,
    }));

    const sentLogs = await DthrFtpLog.findAll({
      where: {
        [Op.or]: conditions,
      },
      attributes: ["kdtk", "tgl_transaksi", "status"],
      order: [["id", "DESC"]],
    });

    const statusMap = {};
    for (const log of sentLogs) {
      const key = `${log.kdtk}_${log.tgl_transaksi}`;
      if (!(key in statusMap)) {
        statusMap[key] = log.status;
      }
    }
    return statusMap;
  }
}

export default new DthrFtpService();
