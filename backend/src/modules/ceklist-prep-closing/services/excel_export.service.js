/**
 * Excel Export Service
 * Generates a 4-sheet Excel workbook using exceljs:
 *   Sheet 1: Space HDD Bulanan (main table + historical reference table below)
 *   Sheet 2: Space HDD Tampung
 *   Sheet 3: Import IDT
 *   Sheet 4: Rekap Screening Toko
 */
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import logger from "../../../config/logger.js";
import spaceHddService from "./space_hdd.service.js";
import spaceTampungService from "./space_tampung.service.js";
import importIdtService from "./import_idt.service.js";
import rekapScreeningService from "./rekap_screening.service.js";
import { getPreviousPeriode } from "./space_hdd.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
// public/ is at: backend/public/ → relative to this file: ../../../../public
const PUBLIC_DIR = path.join(__dirname, "../../../../public");

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

async function buildSpaceHddSheet(sheet, workbook, rows, periode) {
  sheet.addRow([]); // spacer
  const titleRow = sheet.addRow([`Space HDD Bulanan — Periode ${periode}`]);
  titleRow.font = { bold: true, size: 13 };
  sheet.addRow([]);

  const mainHeaders = [
    "KDCAB", "IP", "FREE SPACE", "Free Space Last Month (GB)",
    "Usage Disk Space (GB)", "Predicted HDD Usage (GB)",
    "TGL CHECK", "OS", "FU (Follow Up)", "Free After", "Capture",
  ];
  const hRow = sheet.addRow(mainHeaders);
  styleHeader(hRow);

  const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp)$/i;
  const DATA_START_ROW   = sheet.rowCount + 1;
  const TEXT_ROW_HEIGHT  = 18;
  const CAPTURE_COL      = 11; // 1-based column index for Capture

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const excelRowNum = DATA_START_ROW + i;
    const isAlt = i % 2 === 1;

    const dataRow = sheet.addRow([
      r.KDCAB, r.IP, r.FREE_SPACE,
      r.freeSpaceLastMonthGb ?? "",
      r.usageDiskSpace ?? "",
      r.predictedUsage ?? "",
      r.TGL_CHECK ?? "",
      r.OS ?? "",
      r.FU ?? "",
      r.FREE_AFTER ?? "",
      "", // Capture cell — left empty; image placed on top
    ]);
    styleDataRow(dataRow, isAlt);

    if (r.CAPTURE_PATH && IMAGE_EXTENSIONS.test(r.CAPTURE_PATH)) {
      const absPath = path.join(PUBLIC_DIR, r.CAPTURE_PATH);
      if (fs.existsSync(absPath)) {
        try {
          const ext     = path.extname(absPath).slice(1).toLowerCase();
          const extMap  = { jpg: "jpeg", jpeg: "jpeg", png: "png", gif: "gif", webp: "png" };
          const imgBuf  = fs.readFileSync(absPath);
          const dims    = getImageDimensions(imgBuf, ext);
          const { width: embedW, height: embedH } = scaleWithConstraints(dims?.width, dims?.height);
          dataRow.height = embedH + 6;
          const imgId = workbook.addImage({ buffer: imgBuf, extension: extMap[ext] || "png" });
          // Calculate centered position: (columnWidth - imageWidth) / 2
          const colWidthPx = 85 * 7; // ~7px per Excel char width
          const centeredDx = Math.max(0, (colWidthPx - embedW) / 2);
          sheet.addImage(imgId, {
            tl: { col: CAPTURE_COL - 1, row: excelRowNum - 1, dx: centeredDx, dy: 3 },
            ext: { width: embedW, height: embedH },
            editAs: "oneCell",
          });
        } catch (_) { dataRow.getCell(CAPTURE_COL).value = r.CAPTURE_PATH; }
      }
    } else {
      dataRow.height = TEXT_ROW_HEIGHT;
    }
  }

  // Set column widths appropriately
  sheet.getColumn(1).width = 14; // KDCAB - fit for data like "G033"
  sheet.getColumn(2).width = 18; // IP address
  sheet.getColumn(3).width = 15; // FREE SPACE
  sheet.getColumn(4).width = 22; // Free Space Last Month
  sheet.getColumn(5).width = 22; // Usage Disk Space
  sheet.getColumn(6).width = 24; // Predicted Usage
  sheet.getColumn(7).width = 14; // TGL CHECK
  sheet.getColumn(8).width = 10; // OS
  sheet.getColumn(9).width = 25; // FU
  sheet.getColumn(10).width = 14; // Free After
  // Set Capture column width wider for better image display
  sheet.getColumn(CAPTURE_COL).width = 85;

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
}

async function buildSpaceTampungSheet(sheet, workbook, rows, periode) {
  sheet.addRow([]);
  const titleRow = sheet.addRow([`Space HDD Tampung — Periode ${periode}`]);
  titleRow.font = { bold: true, size: 13 };
  sheet.addRow([]);

  const hRow = sheet.addRow(["CAB", "PATH", "CAPACITY", "FREE SPACE", "TGL CHECK", "Capture"]);
  styleHeader(hRow);

  const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp)$/i;
  const DATA_START_ROW   = sheet.rowCount + 1;
  const TEXT_ROW_HEIGHT  = 18;
  const CAPTURE_COL      = 6; // 1-based

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const excelRowNum = DATA_START_ROW + i;
    const isAlt = i % 2 === 1;

    const dataRow = sheet.addRow([
      r.CAB, r.PATH ?? "", r.CAPACITY ?? "",
      r.FREE_SPACE ?? "", r.TGL_CHECK ?? "", "",
    ]);
    styleDataRow(dataRow, isAlt);

    if (r.CAPTURE_PATH && IMAGE_EXTENSIONS.test(r.CAPTURE_PATH)) {
      const absPath = path.join(PUBLIC_DIR, r.CAPTURE_PATH);
      if (fs.existsSync(absPath)) {
        try {
          const ext     = path.extname(absPath).slice(1).toLowerCase();
          const extMap  = { jpg: "jpeg", jpeg: "jpeg", png: "png", gif: "gif", webp: "png" };
          const imgBuf  = fs.readFileSync(absPath);
          const dims    = getImageDimensions(imgBuf, ext);
          const { width: embedW, height: embedH } = scaleWithConstraints(dims?.width, dims?.height);
          dataRow.height = embedH + 6;
          const imgId = workbook.addImage({ buffer: imgBuf, extension: extMap[ext] || "png" });
          // Center image in capture column
          const colWidthPx = 85 * 7;
          const centeredDx = Math.max(0, (colWidthPx - embedW) / 2);
          sheet.addImage(imgId, {
            tl: { col: CAPTURE_COL - 1, row: excelRowNum - 1, dx: centeredDx, dy: 3 },
            ext: { width: embedW, height: embedH },
            editAs: "oneCell",
          });
        } catch (_) { dataRow.getCell(CAPTURE_COL).value = r.CAPTURE_PATH; }
      }
    } else {
      dataRow.height = TEXT_ROW_HEIGHT;
    }
  }

  // Set column widths appropriately
  sheet.getColumn(1).width = 14; // CAB - fit for data like "G033"
  sheet.getColumn(2).width = 28; // PATH
  sheet.getColumn(3).width = 14; // CAPACITY
  sheet.getColumn(4).width = 14; // FREE SPACE
  sheet.getColumn(5).width = 14; // TGL CHECK
  // Set Capture column wider for better image display
  sheet.getColumn(CAPTURE_COL).width = 85;
}

/**
 * Read actual image dimensions from a Buffer — pure Node, no extra deps.
 * Supports PNG, JPEG, GIF. Returns null for unknown/invalid.
 */
function getImageDimensions(buf, ext) {
  try {
    if (ext === "png") {
      if (buf.length < 24) return null;
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (ext === "jpeg" || ext === "jpg") {
      if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
      let i = 2;
      while (i < buf.length - 1) {
        if (buf[i] !== 0xff) break;
        const marker = buf[i + 1];
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7].includes(marker)) {
          return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
        }
        if (marker === 0xd9) break;
        i += 2 + buf.readUInt16BE(i + 2);
      }
      return null;
    }
    if (ext === "gif") {
      if (buf.length < 10) return null;
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }
  } catch (_) { /* ignore */ }
  return null;
}

/**
 * Scale w×h to fit inside [minW,maxW]×[minH,maxH] preserving aspect ratio.
 * Falls back to 160×120 when original dimensions unknown.
 */
function scaleWithConstraints(origW, origH,
  { minW = 160, maxW = 440, minH = 120, maxH = 330 } = {}) {
  if (!origW || !origH) return { width: 320, height: 240 };
  const aspect = origW / origH;
  let w = origW, h = origH;
  if (w > maxW) { w = maxW; h = w / aspect; }
  if (h > maxH) { h = maxH; w = h * aspect; }
  if (w < minW) { w = minW; h = w / aspect; }
  if (h < minH) { h = minH; w = h * aspect; }
  if (w > maxW) { w = maxW; h = w / aspect; }
  if (h > maxH) { h = maxH; w = h * aspect; }
  return { width: Math.round(w), height: Math.round(h) };
}

/**
 * Build the Import IDT sheet.
 * Embeds images with exact pixel sizing (ext) to preserve aspect ratio.
 * Falls back to text for non-image CAPTURE values.
 */
async function buildImportIdtSheet(sheet, workbook, rows, periode) {
  sheet.addRow([]);
  const titleRow = sheet.addRow([`Import IDT — Periode ${periode}`]);
  titleRow.font = { bold: true, size: 13 };
  sheet.addRow([]);

  const hRow = sheet.addRow(["KDCAB", "Status", "Capture / Keterangan", "Update"]);
  styleHeader(hRow);

  sheet.getColumn(1).width = 14; // KDCAB - fit for data
  sheet.getColumn(2).width = 12; // Status
  sheet.getColumn(3).width = 85; // Capture column wider for images
  sheet.getColumn(4).width = 18; // Update

  const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp)$/i;
  const TEXT_ROW_HEIGHT   = 20;
  const DATA_START_ROW    = sheet.rowCount + 1;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const excelRowNum = DATA_START_ROW + i;
    const isAlt  = i % 2 === 1;
    const status = r.CAPTURE ? "Done" : "Pending";

    if (r.CAPTURE && IMAGE_EXTENSIONS.test(r.CAPTURE)) {
      const absPath = path.join(PUBLIC_DIR, r.CAPTURE);

      if (fs.existsSync(absPath)) {
        const ext     = path.extname(absPath).slice(1).toLowerCase();
        const extMap  = { jpg: "jpeg", jpeg: "jpeg", png: "png", gif: "gif", webp: "png" };
        const imgType = extMap[ext] || "png";

        try {
          const imgBuf = fs.readFileSync(absPath);
          const dims   = getImageDimensions(imgBuf, ext);
          const { width: embedW, height: embedH } = scaleWithConstraints(dims?.width, dims?.height);

          const dataRow = sheet.addRow([r.KDCAB, status, "", r.UPDTIME ?? ""]);
          dataRow.height = embedH + 6;   // row height matches image + small padding
          styleDataRow(dataRow, isAlt);

          const imgId = workbook.addImage({ buffer: imgBuf, extension: imgType });
          // Center image in capture column (column 3)
          const colWidthPx = 85 * 7; // ~7px per Excel char width
          const centeredDx = Math.max(0, (colWidthPx - embedW) / 2);
          sheet.addImage(imgId, {
            tl: { col: 2, row: excelRowNum - 1, dx: centeredDx, dy: 3 },  // 0-based, centered
            ext: { width: embedW, height: embedH }, // exact px — no stretching
            editAs: "oneCell",
          });
        } catch (imgErr) {
          logger.warn(`[excel_export] image embed failed for ${absPath}: ${imgErr.message}`);
          const dataRow = sheet.addRow([r.KDCAB, status, r.CAPTURE, r.UPDTIME ?? ""]);
          dataRow.height = TEXT_ROW_HEIGHT;
          styleDataRow(dataRow, isAlt);
        }
      } else {
        const dataRow = sheet.addRow([r.KDCAB, status, r.CAPTURE, r.UPDTIME ?? ""]);
        dataRow.height = TEXT_ROW_HEIGHT;
        styleDataRow(dataRow, isAlt);
      }
    } else {
      const dataRow = sheet.addRow([r.KDCAB, status, r.CAPTURE ?? "", r.UPDTIME ?? ""]);
      dataRow.height = TEXT_ROW_HEIGHT;
      styleDataRow(dataRow, isAlt);
    }
  }
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

    await buildSpaceHddSheet(workbook.addWorksheet("Space HDD Bulanan"), workbook, hddRows, periode);
    await buildSpaceTampungSheet(workbook.addWorksheet("Space Hdd Tampung"), workbook, tampungRows, periode);
    await buildImportIdtSheet(workbook.addWorksheet("Import IDT"), workbook, idtRows, periode);
    buildRekapScreeningSheet(workbook.addWorksheet("Rekap Screening Toko"), rekapResult, periode);

    const filename = `Cek_list_Prepare_Closing_${periode}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  }
}

export default new ExcelExportService();
