/**
 * LPP PDF Exporter — Custom PDF Export untuk Laporan LPP
 *
 * Menggunakan jspdf + jspdf-autotable untuk menghasilkan output
 * yang identik dengan legacy project (reference_template).
 *
 * Logo di-import langsung dari legacy project untuk menghindari
 * korupsi base64 saat embedding.
 */

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { logoIndomaret } from "../../styles/custom/logoIndomaret.js";
import logger from "../../../../config/logger.js";
import MCabang from "../../../../models/m_cabang.model.js";

function formatPeriod(prd) {
  if (!prd || !/^\d{4}$/.test(prd)) return prd || "-";
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const yy = parseInt(prd.substring(0, 2), 10);
  const mm = parseInt(prd.substring(2, 4), 10);
  return `${monthNames[mm - 1] || "?"} ${2000 + yy}`;
}

/**
 * Ekspor LPP PDF ke HTTP response.
 * Menggunakan jspdf + jspdf-autotable — identik dengan legacy formatLppPdf.js.
 */
export async function exportToResponse({ reportConfig, results, res, prd, cab }) {
  const reportName = reportConfig["name-reports"] || "LPP Pdf";
  const valData = results["Data"] || [];
  const valTot = results["Total"] || [];

  if (valData.length === 0) {
    logger.warn("[lpp-pdf-exporter] Tidak ada data untuk LPP PDF");
    res.setHeader("Content-Type", "application/json");
    return res.status(404).json({ message: "Tidak ada data untuk laporan ini" });
  }

  const combinedRows = [...valData, ...valTot];
  const rows = combinedRows.map(item => Object.values(item));

  const cabang = cab ? await MCabang.findByPk(cab) : null;
  const stringBranch = cabang ? cabang.namacab : cab;
  const strDate = formatPeriod(prd);
  const fileName = `LPP Pdf-${cab} ${strDate}`;

  logger.info(`[lpp-pdf-exporter] Mulai generate LPP PDF: cab=${cab} | prd=${prd} | rows=${rows.length}`);

  try {
    // ── 1. Buat jsPDF document — landscape ────────────────────────────────────
    const pdf = new jsPDF({ orientation: "landscape" });

    // ── 2. Helper: tambah logo + header ke setiap halaman ─────────────────────
    const addImageOnEachPage = (imagePath, width, height) => {
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.addImage(imagePath, "PNG", 15, 3, width, height);
        pdf.setFontSize(5);
        pdf.text("Rekap Laporan Mutasi Persediaan", 37, 5);
        pdf.text("Cab " + stringBranch, 37, 7.5);
        pdf.text("Periode " + strDate, 37, 10);
      }
    };

    // ── 3. Header columns dari key data pertama ───────────────────────────────
    const headers = Object.keys(valData[0]);

    // ── 4. AutoTable — identik dengan legacy (font 3pt, theme grid, dst) ───────
    // NOTE: columnStyles duplicate key '1' adalah bug legacy (ditiru persis)
    autoTable(pdf, {
      head: [headers],
      body: rows,
      theme: "grid",
      styles: {
        fontSize: 3,
        cellPadding: 1,
      },
      headStyles: {
        fontSize: 3,
        fillColor: [0, 0, 200],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        align: "left",
      },
      columnStyles: {
        align: "right",
        0: { minWidth: 10, maxWidth: 15, align: "left" },
        1: { minWidth: 10, maxWidth: 15, align: "left" },
      },
      willDrawCell: data => {
        if (data.section === "body") {
          const totalRows = rows.length;
          const lastCustomRows = 5;
          if (data.row.index >= totalRows - lastCustomRows && data.row.index < totalRows) {
            pdf.setFillColor(119, 209, 149);
          }
        }
      },
    });

    // ── 5. Tambah logo + header di setiap halaman ────────────────────────────
    addImageOnEachPage(logoIndomaret, 20, 7.5);

    // ── 6. Stream ke response ────────────────────────────────────────────────
    const pdfBuffer = Buffer.from(pdf.output("arraybuffer"));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName + ".pdf")}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.end(pdfBuffer);

    logger.info(`[lpp-pdf-exporter] Selesai: "${fileName}.pdf" (${pdfBuffer.length} bytes)`);
  } catch (err) {
    logger.error(`[lpp-pdf-exporter] Gagal generate PDF: ${err.message}`);
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json");
      return res.status(500).json({ message: `Gagal generate PDF: ${err.message}` });
    }
  }
}
