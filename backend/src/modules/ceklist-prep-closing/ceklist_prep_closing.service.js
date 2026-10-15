/**
 * CeklistPrepClosing Orchestrator Service
 * Proxy to all sub-services + summary aggregation
 */
import logger from "../../config/logger.js";
import spaceHddService from "./services/space_hdd.service.js";
import spaceTampungService from "./services/space_tampung.service.js";
import importIdtService from "./services/import_idt.service.js";
import rekapScreeningService from "./services/rekap_screening.service.js";
import excelExportService from "./services/excel_export.service.js";
import sshStorageService from "./services/ssh_storage.service.js";

class CeklistPrepClosingService {
  // ─── Space HDD Bulanan ───────────────────────────────────────────────────

  async getSpaceHdd({ periode, cabang = "All" }) {
    return spaceHddService.getAll(periode, cabang);
  }

  async upsertSpaceHdd(data) {
    return spaceHddService.upsert(data);
  }

  async deleteSpaceHdd(kdcab, periode) {
    return spaceHddService.delete(kdcab, periode);
  }

  async initSpaceHdd(periode) {
    const templateResult = await spaceHddService.getBulkTemplate(periode);

    // Otomatis lakukan pengecekan sisa storage via SSH untuk seluruh server Linux
    // Dibatasi dengan batas waktu maksimal 7 detik agar tidak memblokir respon HTTP
    let sshResult = null;
    try {
      const sshPromise = sshStorageService.checkBatchStorage(periode, { timeoutMs: 4000 });
      let timeoutHandle;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error("Timeout proses pengecekan SSH batch (7s)")), 7000);
      });
      sshResult = await Promise.race([sshPromise, timeoutPromise]);
      clearTimeout(timeoutHandle);
      logger.info(`[ceklist_prep_closing] initSpaceHdd auto-SSH check completed: ${sshResult.successCount} success, ${sshResult.failedCount} failed`);
    } catch (err) {
      logger.warn(`[ceklist_prep_closing] initSpaceHdd auto-SSH check failed/timed out: ${err.message}`);
      sshResult = { total: 0, successCount: 0, failedCount: 0, error: err.message };
    }

    return {
      ...templateResult,
      ssh: sshResult,
    };
  }

  async getSpaceHddHistory(kdcab) {
    return spaceHddService.getHistory(kdcab);
  }

  async checkSshStorage({ kdcab, periode, targetPath }) {
    return sshStorageService.checkStorage({ kdcab, periode, targetPath });
  }

  async checkBatchSshStorage(periode) {
    return sshStorageService.checkBatchStorage(periode);
  }

  async listSshMounts(kdcab) {
    return sshStorageService.listMounts(kdcab);
  }

  // ─── Space HDD Tampung ───────────────────────────────────────────────────

  async getSpaceTampung({ periode, cabang = "All" }) {
    return spaceTampungService.getAll(periode, cabang);
  }

  async upsertSpaceTampung(data) {
    return spaceTampungService.upsert(data);
  }

  async deleteSpaceTampung(cab, periode) {
    return spaceTampungService.delete(cab, periode);
  }

  async initSpaceTampung(periode) {
    return spaceTampungService.getBulkTemplate(periode);
  }

  // ─── Import IDT ──────────────────────────────────────────────────────────

  async getImportIdt({ periode, cabang = "All" }) {
    return importIdtService.getAll(periode, cabang);
  }

  async upsertImportIdt(data) {
    return importIdtService.upsert(data);
  }

  async deleteImportIdt(kdcab, periode) {
    return importIdtService.delete(kdcab, periode);
  }

  async initImportIdt(periode) {
    return importIdtService.getBulkTemplate(periode);
  }

  async uploadCaptureIdt(kdcab, periode, captureUrl) {
    return importIdtService.uploadCapture(kdcab, periode, captureUrl);
  }

  // ─── Rekap Screening ─────────────────────────────────────────────────────

  async getRekapScreening({ periode, cabang = "All" }) {
    return rekapScreeningService.getRekapScreening({ periode, cabang });
  }

  // ─── Export Excel ────────────────────────────────────────────────────────

  async exportExcel({ periode, cabang = "All", res }) {
    return excelExportService.exportToResponse({ periode, cabang, res });
  }

  // ─── Summary ─────────────────────────────────────────────────────────────

  async getSummary({ periode, cabang = "All" }) {
    logger.info(`[ceklist_prep_closing.service] getSummary periode=${periode} cabang=${cabang}`);

    const [hddRows, tampungRows, idtRows, rekapSummary] = await Promise.all([
      spaceHddService.getAll(periode, cabang),
      spaceTampungService.getAll(periode, cabang),
      importIdtService.getAll(periode, cabang),
      rekapScreeningService.getRekapSummary({ periode, cabang }),
    ]);

    return {
      periode,
      cabang,
      summary: {
        spaceHdd: {
          total: hddRows.length,
          critical: hddRows.filter(r => r.predictedUsage !== null && r.predictedUsage < 10).length,
        },
        spaceTampung: {
          total: tampungRows.length,
        },
        importIdt: {
          total: idtRows.length,
          done: idtRows.filter(r => r.CAPTURE && r.CAPTURE.trim() !== "").length,
        },
        rekapScreening: {
          total: rekapSummary.total,
          ruleKeys: rekapSummary.ruleKeys,
        },
      },
    };
  }
}

export default new CeklistPrepClosingService();
