import ExcelJS from "exceljs";
import logger from "../../../../config/logger.js";

// Helper konversi '2501' menjadi 'JANUARI 2025'
function getMonthName(prd) {
  if (!prd || prd.length !== 4) return prd;
  const monthNames = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
  const year = `20${prd.substring(0, 2)}`;
  const monthIdx = parseInt(prd.substring(2, 4), 10) - 1;
  const month = monthNames[monthIdx] || prd.substring(2, 4);
  return `${month} ${year}`;
}

// Konversi index 0-based ke Column Letter (0 -> A, 1 -> B, dst)
function CHR(index) {
  return String.fromCharCode(65 + index);
}

export async function exportToResponse({ reportConfig, results, res, prd, cab }) {
  const workbook = new ExcelJS.Workbook();
  const reportName = reportConfig["name-reports"] || "Laporan BKP";
  const queriesExport = reportConfig["queries-export"] || [];

  logger.info(`[custom_exporter] Mulai build custom Excel: "${reportName}"`);

  // Jika tidak ada data sama sekali dari semua queries
  const sheetKeys = Object.keys(results || {});
  if (sheetKeys.length === 0) {
    logger.warn("[custom_exporter] Hasil WRC kosong, tidak ada sheet yang diproses.");
  }

  for (const item of queriesExport) {
    const sheetName = item.key;
    const valueToExport = results[sheetName];

    // Jika valueToExport kosong/null/array kosong, skip sheet
    if (!valueToExport || valueToExport.length === 0) {
      continue;
    }

    const sheet = workbook.addWorksheet(sheetName);
    let baris = 1;
    let rowsNumber = 1;

    // --- Header Judul ---
    sheet.getCell(`C${baris}`).value = `LAPORAN SALES BKP TOKO ${sheetName.toUpperCase()}`;
    sheet.getRow(baris).font = { bold: true, size: 12 };
    baris++;

    const strMonthName = getMonthName(prd);
    sheet.getCell(`C${baris}`).value = strMonthName;
    sheet.getRow(baris).font = { bold: true, size: 11 };
    baris++;

    sheet.getCell(`C${baris}`).value = `Cab. ${cab || ""}`;
    sheet.getRow(baris).font = { bold: true, size: 11 };
    baris++;

    // --- Pengaturan Lebar Kolom ---
    const columnWidths = [
      { column: 1, width: 4 },  // A
      { column: 2, width: 6 },  // B (Dulu 5, disesuaikan sedikit untuk KDTK)
      { column: 3, width: 25 }, // C
      { column: 4, width: 14 }, // D
      { column: 5, width: 14 }, // E
      { column: 6, width: 14 }, // F
      { column: 7, width: 14 }, // G
      { column: 8, width: 14 }, // H
      { column: 9, width: 12 }, // I
      { column: 10, width: 12 },// J
      { column: 11, width: 14 },// K
      { column: 12, width: 14 },// L
      { column: 13, width: 14 },// M
      { column: 14, width: 14 },// N
      { column: 15, width: 10 },// O (Dulu 7)
      { column: 16, width: 10 } // P (Dulu 7)
    ];

    columnWidths.forEach(cw => {
      sheet.getColumn(cw.column).width = cw.width;
    });

    // --- Header Tabel (Baris 4 & 5) ---
    // Style bawaan untuk header
    const headerStyle = {
      font: { bold: true, size: 10 },
      alignment: { vertical: "middle", horizontal: "center" },
      border: {
        top: { style: "thin" }, left: { style: "thin" },
        bottom: { style: "thin" }, right: { style: "thin" }
      }
    };

    // A4:C5 (NO, KDTK, NAMA TOKO)
    const staticHeaders = ["NO", "KDTK", "NAMA TOKO"];
    staticHeaders.forEach((text, i) => {
      const colLetter = CHR(i);
      sheet.mergeCells(`${colLetter}${baris}:${colLetter}${baris + 1}`);
      const cell = sheet.getCell(`${colLetter}${baris}`);
      cell.value = text;
      cell.style = { ...headerStyle, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFFCC" } } };
    });

    // D4:G4 (SALES NET)
    sheet.mergeCells(`D${baris}:G${baris}`);
    let cell = sheet.getCell(`D${baris}`);
    cell.value = "SALES NET";
    cell.style = { ...headerStyle, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCC99" } } };

    // H4:J4 (PPN)
    sheet.mergeCells(`H${baris}:J${baris}`);
    cell = sheet.getCell(`H${baris}`);
    cell.value = "PPN";
    cell.style = { ...headerStyle, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF99" } } };

    // K4:L4 (TOTAL)
    sheet.mergeCells(`K${baris}:L${baris}`);
    cell = sheet.getCell(`K${baris}`);
    cell.value = "TOTAL";
    cell.style = { ...headerStyle, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFFCC" } } };

    // M4:N4 (LPM)
    sheet.mergeCells(`M${baris}:N${baris}`);
    cell = sheet.getCell(`M${baris}`);
    cell.value = "LPM";
    cell.style = { ...headerStyle };

    // O4:P4 (SELISIH)
    sheet.mergeCells(`O${baris}:P${baris}`);
    cell = sheet.getCell(`O${baris}`);
    cell.value = "SELISIH";
    cell.style = { ...headerStyle };

    baris++; // Pindah ke baris 5 untuk sub-header

    const subHeaders = [
      { col: 'D', text: "SUB_BKP='Y'", color: "FFFFCC99" },
      { col: 'E', text: "SUB_BKP='C'", color: "FFFFCC99" },
      { col: 'F', text: "BEBAS_PPN", color: "FFFFCC99" },
      { col: 'G', text: "SUB_BKP='N'", color: "FFFFCC99" },
      { col: 'H', text: "SUB_BKP='Y'", color: "FFFFFF99" },
      { col: 'I', text: "SUB_BKP='C'", color: "FFFFFF99" },
      { col: 'J', text: "SUB_BKP='N'", color: "FFFFFF99" },
      { col: 'K', text: "SALES", color: "FFCCFFCC" },
      { col: 'L', text: "PPN", color: "FFCCFFCC" },
      { col: 'M', text: "TBERSIH", color: null },
      { col: 'N', text: "TPPN", color: null },
      { col: 'O', text: "SALES", color: null },
      { col: 'P', text: "PPN", color: null }
    ];

    subHeaders.forEach(sh => {
      const cell = sheet.getCell(`${sh.col}${baris}`);
      cell.value = sh.text;
      const fillObj = sh.color ? { type: "pattern", pattern: "solid", fgColor: { argb: sh.color } } : undefined;
      cell.style = { ...headerStyle, fill: fillObj || { type: "pattern", pattern: "none" } };
    });

    baris++; // Pindah ke baris 6 (mulai data)

    // --- DATA PART ---
    const totalArray = new Array(15).fill(0); // Index 0=A, 1=B, ..., 14=O, 15=P. (Total ada 16 kolom: 0 s/d 15)
    // Di logic lama, totalArray menampung sesuai jumlah properties, lalu di-splice 0, 2 (untuk buang NO dan KDTK/NamaToko).
    
    for (const rowObj of valueToExport) {
      const values = Object.values(rowObj);
      
      const rowData = [rowsNumber++, ...values]; // NO, KDTK, NAMA TOKO, dst...
      
      const dataRow = sheet.addRow(rowData);
      
      // Styling data row
      dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: "thin" }, left: { style: "thin" },
          bottom: { style: "thin" }, right: { style: "thin" }
        };
        cell.font = { size: 10 };
        // Format angka mulai kolom D (index 4 di exceljs)
        if (colNumber >= 4) {
          cell.numFmt = "#,##0";
        }
      });

      // Kalkulasi total
      for (let i = 0; i < values.length; i++) {
        const val = typeof values[i] !== "number" ? parseInt(values[i] || 0) : values[i];
        if (!isNaN(val)) {
          // values[0] adalah KDTK, values[1] adalah NAMA TOKO (string) -> akan jadi NaN / 0 kalau dicoba parse.
          // Jadi kita jumlahkan saja, lalu nanti kita replace 2 kolom awal dgn string 'TOTAL'
          totalArray[i] = (totalArray[i] || 0) + val;
        }
      }
      baris++;
    }

    // --- TOTAL PART ---
    // Di logic lama: totalArray.splice(0, 2) membuang value untuk KDTK dan NAMA TOKO.
    // arrayHead = ["TOTAL"] di merge A:C.
    const finalTotalArray = totalArray.slice(2); // Ambil dari column index 2 (karena values[0]=KDTK, values[1]=NAMA TOKO)
    
    const totalRowData = ["TOTAL", "", "", ...finalTotalArray]; // A, B, C digabung, D dst angka
    const totalRow = sheet.addRow(totalRowData);

    // Styling total row
    sheet.mergeCells(`A${baris}:C${baris}`);
    totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: "thin" }, left: { style: "thin" },
        bottom: { style: "thin" }, right: { style: "thin" }
      };
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB8CCE4" } };
      
      if (colNumber <= 3) { // Kolom A, B, C (yg di-merge)
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else {
        cell.numFmt = "#,##0";
      }
    });

    sheet.views = [{ showGridLines: false }];
  }

  // --- Konfigurasi Response ---
  const safeName = String(reportName).replace(/[^a-zA-Z0-9_\-\u00C0-\u024F]/g, "_");
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
  const prdSuffix = prd ? `_${prd}` : "";
  const filename = `${safeName}${prdSuffix}_${dateStr}.xlsx`;

  logger.info(`[custom_exporter] Streaming file: ${filename}`);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

  await workbook.xlsx.write(res);
  res.end();

  logger.info(`[custom_exporter] Stream selesai: "${filename}"`);
}
