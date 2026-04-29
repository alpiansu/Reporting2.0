/**
 * Excel Export Service
 * Generates a 4-sheet Excel workbook using exceljs:
 *   Sheet 1: Space HDD Bulanan (main table + historical reference table below)
 *   Sheet 2: Space HDD Tampung
 *   Sheet 3: Import IDT
 *   Sheet 4: Rekap Screening Toko
 */
import ExcelJS from "exceljs";
import logger from "../../../config/logger.js";
import spaceHddService from "./space_hdd.service.js";
import spaceTampungService from "./space_tampung.service.js";
import importIdtService from "./import_idt.service.js";
import rekapScreeningService from "./rekap_screening.service.js";
import { getPreviousPeriode } from "./space_hdd.service.js";

// ─── Style helpers ────────────────────────────────────────────────────────────

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const ALT_FILL    = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };
const BORDER_THIN = {
  top:    { style: "thin" },
  left:   { style: "thin" },
  bottom: { style: "thin" },
  right:  { style: "thin" },
};

function styleHeader(row) {
  row.eachCell(cell => {
    cell.fill   = HEADER_FILL;
    cell.font   = HEADER_FONT;
    cell.border = BORDER_THIN;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  row.height = 30;
}

function styleDataRow(row, isAlt = false) {
  row.eachCell({ includeEmpty: true }, cell => {
    if (isAlt) cell.fill = ALT_FILL;
    cell.border = BORDER_THIN;
    cell.alignment = { vertical: "middle", wrapText: false };
  });
}

function autoWidth(sheet, minWidth = 10, maxWidth = 40) {
  sheet.columns.forEach(col => {
    let maxLen = minWidth;
    col.eachCell({ includeEmpty: false }, cell => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, maxWidth);
  });
}

// ─── Sheet builders ───────────────────────────────────────────────────────────

function buildSpaceHddSheet(sheet, rows, periode) {
  sheet.addRow([]); // spacer
  const titleRow = sheet.addRow([`Space HDD Bulanan — Periode ${periode}`]);
  titleRow.font = { bold: true, size: 13 };
  sheet.addRow([]);

  // Main table headers
  const mainHeaders = [
    "KDCAB", "IP", "FREE SPACE", "Free Space Last Month (GB)",
    "Usage Disk Space (GB)", "Predicted HDD Usage (GB)",
    "TGL CHECK", "OS", "FU (Follow Up)", "Free After",
  ];
  const hRow = sheet.addRow(mainHeaders);
  styleHeader(hRow);

  rows.forEach((r, idx) => {
    const dataRow = sheet.addRow([
      r.KDCAB, r.IP, r.FREE_SPACE,
      r.freeSpaceLastMonthGb ?? "",
      r.usageDiskSpace ?? "",
      r.predictedUsage ?? "",
      r.TGL_CHECK ?? "",
      r.OS ?? "",
      r.FU ?? "",
      r.FREE_AFTER ?? "",
    ]);
    styleDataRow(dataRow, idx % 2 === 1);
  });

  // Spacer + historical reference table
  sheet.addRow([]);
  sheet.addRow([]);
  const prevPeriode = getPreviousPeriode(periode);
  const refTitle = sheet.addRow([`Referensi Data Bulan Sebelumnya (${prevPeriode})`]);
  refTitle.font = { bold: true, italic: true };
  sheet.addRow([]);

  const refHeaders = ["KDCAB", "IP", "FREE SPACE", "TGL CHECK"];
  const refHRow = sheet.addRow(refHeaders);
  styleHeader(refHRow);

  rows.forEach((r, idx) => {
    if (r.freeSpaceLastMonthGb !== null) {
      const refRow = sheet.addRow([
        r.KDCAB, r.IP,
        r.freeSpaceLastMonthGb !== null ? `${r.freeSpaceLastMonthGb} GB` : "",
        "",
      ]);
      styleDataRow(refRow, idx % 2 === 1);
    }
  });

  autoWidth(sheet);
}

function buildSpaceTampungSheet(sheet, rows, periode) {
  sheet.addRow([]);
  const titleRow = sheet.addRow([`Space HDD Tampung — Periode ${periode}`]);
  titleRow.font = { bold: true, size: 13 };
  sheet.addRow([]);

  const hRow = sheet.addRow(["CAB", "PATH", "CAPACITY", "FREE SPACE", "TGL CHECK"]);
  styleHeader(hRow);

  rows.forEach((r, idx) => {
    const dataRow = sheet.addRow([
      r.CAB, r.PATH ?? "", r.CAPACITY ?? "",
      r.FREE_SPACE ?? "", r.TGL_CHECK ?? "",
    ]);
    styleDataRow(dataRow, idx % 2 === 1);
  });

  autoWidth(sheet);
}

function buildImportIdtSheet(sheet, rows, periode) {
  sheet.addRow([]);
  const titleRow = sheet.addRow([`Import IDT — Periode ${periode}`]);
  titleRow.font = { bold: true, size: 13 };
  sheet.addRow([]);

  const hRow = sheet.addRow(["KDCAB", "CAPTURE"]);
  styleHeader(hRow);

  rows.forEach((r, idx) => {
    const dataRow = sheet.addRow([r.KDCAB, r.CAPTURE ?? ""]);
    styleDataRow(dataRow, idx % 2 === 1);
  });

  autoWidth(sheet);
}

function buildRekapScreeningSheet(sheet, { data, ruleKeys }, periode) {
  sheet.addRow([]);
  const titleRow = sheet.addRow([`Rekap Screening Toko — Periode ${periode}`]);
  titleRow.font = { bold: true, size: 13 };
  sheet.addRow([]);

  const baseHeaders = ["CAB", "KDTK", "PRD CLOSING", "TOTAL RULES", "FAILED", "CRITICAL", "LAST SCREENED"];
  const hRow = sheet.addRow([...baseHeaders, ...ruleKeys]);
  styleHeader(hRow);

  data.forEach((r, idx) => {
    const ruleValues = ruleKeys.map(k => (r[k] !== null && r[k] !== undefined ? r[k] : ""));
    const dataRow = sheet.addRow([
      r.cab, r.kdtk, r.prdClosing,
      r.totalRules ?? "", r.failedRules ?? "", r.criticalIssues ?? "",
      r.lastScreened ?? "",
      ...ruleValues,
    ]);
    styleDataRow(dataRow, idx % 2 === 1);
  });

  autoWidth(sheet, 8, 30);
}

// ─── Main export ──────────────────────────────────────────────────────────────

class ExcelExportService {
  /**
   * Generate and stream an Excel workbook to the HTTP response
   * @param {Object} params
   * @param {string} params.periode
   * @param {string} [params.cabang]
   * @param {import('express').Response} params.res
   */
  async exportToResponse({ periode, cabang = "All", res }) {
    logger.info(`[excel_export.service] exportToResponse periode=${periode} cabang=${cabang}`);

    // Fetch all data in parallel
    const [hddRows, tampungRows, idtRows, rekapResult] = await Promise.all([
      spaceHddService.getAll(periode, cabang),
      spaceTampungService.getAll(periode, cabang),
      importIdtService.getAll(periode, cabang),
      rekapScreeningService.getRekapScreening({ periode, cabang }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator  = "Reporting2.0";
    workbook.created  = new Date();
    workbook.modified = new Date();

    buildSpaceHddSheet(workbook.addWorksheet("Space HDD Bulanan"), hddRows, periode);
    buildSpaceTampungSheet(workbook.addWorksheet("Space Hdd Tampung"), tampungRows, periode);
    buildImportIdtSheet(workbook.addWorksheet("Import IDT"), idtRows, periode);
    buildRekapScreeningSheet(workbook.addWorksheet("Rekap Screening Toko"), rekapResult, periode);

    const filename = `Cek_list_Prepare_Closing_${periode}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  }
}

export default new ExcelExportService();
