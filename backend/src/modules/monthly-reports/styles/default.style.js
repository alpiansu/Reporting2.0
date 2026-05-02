/**
 * Default Styling untuk Monthly Reports Excel Export
 *
 * File ini adalah BASELINE styling yang digunakan oleh semua laporan
 * jika tidak ada custom style yang terdaftar untuk id-reports tertentu.
 *
 * ─────────────────────────────────────────────────────────────────
 * CARA MEMBUAT CUSTOM STYLE:
 *   1. Buat file baru di: styles/custom/{id-reports}.style.js
 *   2. Ikuti format dari: styles/custom/example_report.style.js
 *   3. Tidak perlu mengubah file lain — sistem akan mendeteksi otomatis.
 * ─────────────────────────────────────────────────────────────────
 */

const defaultStyle = {
  // ─── Header Row ──────────────────────────────────────────────────────────────
  headerFill: {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" }, // Biru medium
  },
  headerFont: {
    bold: true,
    color: { argb: "FFFFFFFF" }, // Putih
    size: 11,
    name: "Calibri",
  },
  headerAlignment: {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  },
  headerRowHeight: 28,

  // ─── Data Row ────────────────────────────────────────────────────────────────
  dataFont: {
    size: 10,
    name: "Calibri",
  },
  dataAlignment: {
    vertical: "middle",
    horizontal: "left",
    wrapText: false,
  },
  dataRowHeight: 18,

  // ─── Alternating Row (zebra stripe) ──────────────────────────────────────────
  altFill: {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDCE6F1" }, // Biru sangat muda
  },

  // ─── Border ──────────────────────────────────────────────────────────────────
  borderThin: {
    top:    { style: "thin" },
    left:   { style: "thin" },
    bottom: { style: "thin" },
    right:  { style: "thin" },
  },

  // ─── Auto-width Column Constraints ───────────────────────────────────────────
  minColWidth: 10,
  maxColWidth: 45,

  // ─── Freeze Pane ─────────────────────────────────────────────────────────────
  // freezeRow: 1 → baris header (row pertama) akan ter-freeze saat scroll
  freezeRow: 1,

  // ─── Title Row (di atas header) ──────────────────────────────────────────────
  titleFont: {
    bold: true,
    size: 13,
    name: "Calibri",
  },
};

export default defaultStyle;
