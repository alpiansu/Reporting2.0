/**
 * Orchestrator — Menganalisis penyebab perubahan ACOST
 *
 * TIDAK membuat query DB baru. Semua data sudah di-fetch oleh
 * storeInspector.service.js dan dioper sebagai parameter.
 *
 * Arsitektur: 1 fungsi publik (analyzeAcostChange) + 1 fungsi
 * internal (comparePriceSequence). Tidak perlu dipisah ke file
 * terpisah karena:
 *   1. Data sudah ada di memori (filter via JS, bukan query SQL)
 *   2. Semua source pakai format data yang sama (array of rows)
 *   3. 1 file lebih mudah dirawat daripada 6 file terpisah
 */
import { FLOAT_EPSILON } from './constants.js';

/**
 * Bandingkan harga antar baris berurutan (harus sudah di-sort oleh caller).
 * anchorPrice = harga acuan sebelum baris pertama (biasanya BEGBAL).
 */
function comparePriceSequence(rows, anchorPrice, { dateField, priceField, source }) {
  const changes = [];
  let prevPrice = anchorPrice;
  for (const row of rows) {
    const price = Number(row[priceField]);
    if (Math.abs(price - prevPrice) >= FLOAT_EPSILON) {
      changes.push({
        tanggal: row[dateField],
        dari: prevPrice,
        ke: price,
        source,
        ref: row,
      });
    }
    prevPrice = price;
  }
  return { hasDifference: changes.length > 0, changes };
}

/**
 * Analisis penyebab perubahan ACOST.
 *
 * @param {Object} params
 * @param {Array} params.mstranRows - Raw rows dari tabel mstran (sudah di-fetch)
 * @param {Array} params.mtranRows - Raw rows dari tabel mtran (sudah di-fetch)
 * @param {Object|null} params.prodmast - Record prodmast (sudah di-fetch)
 * @param {number} params.begbal - Harga saldo awal (BEGBAL) dari sesuai_toko
 * @param {number} params.acostSekarang - ACOST saat ini dari prodmast
 * @param {boolean} params.isBkl - Apakah item ini BKL (punya SUPCO)
 * @param {Object|null} params.protectRow - Record protect (jika BKL)
 * @returns {Object} { cause, changes?, detail?, acostSekarang?, ... }
 */
export function analyzeAcostChange({
  mstranRows = [],
  mtranRows = [],
  prodmast = null,
  begbal = 0,
  acostSekarang = 0,
  isBkl = false,
  protectRow = null,
} = {}) {
  const anchorPrice = Number(begbal) || 0;

  // Helper sortir baris mstran berdasarkan tanggal
  const sortByDate = (a, b) => {
    const dateA = new Date(a.BUKTI_TGL || a.bukti_tgl);
    const dateB = new Date(b.BUKTI_TGL || b.bukti_tgl);
    if (dateA - dateB !== 0) return dateA - dateB;
    return (a.ADDTIME || '').localeCompare(b.ADDTIME || '');
  };

  // Helper sortir baris mtran berdasarkan tanggal
  const sortMtranByDate = (a, b) => {
    const dateA = new Date(a.TANGGAL || a.tanggal);
    const dateB = new Date(b.TANGGAL || b.tanggal);
    if (dateA - dateB !== 0) return dateA - dateB;
    return (a.ADDTIME || '').localeCompare(b.ADDTIME || '');
  };

  // ── Cek #1: BPB (RTYPE='BPB') ────────────────────────────
  const bpbRows = mstranRows
    .filter(r => (r.RTYPE || r.rtype || '').toUpperCase() === 'BPB')
    .sort(sortByDate);
  const bpb = comparePriceSequence(bpbRows, anchorPrice, {
    dateField: 'BUKTI_TGL', priceField: 'PRICE', source: 'bpb',
  });

  // ── Cek #2: Konversi BM (RTYPE='X' AND ISTYPE BM/KO) ────
  const konversiBmRows = mstranRows
    .filter(r => {
      const rtype = (r.RTYPE || r.rtype || '').toUpperCase();
      const istype = (r.ISTYPE || r.istype || '').toUpperCase();
      return rtype === 'X' && (istype === 'BM' || istype === 'KO');
    })
    .sort(sortByDate);
  const konversiBm = comparePriceSequence(konversiBmRows, anchorPrice, {
    dateField: 'BUKTI_TGL', priceField: 'PRICE', source: 'konversi_bm',
  });

  // ── Cek #3: Retur/K (RTYPE='K') ──────────────────────────
  const kRows = mstranRows
    .filter(r => (r.RTYPE || r.rtype || '').toUpperCase() === 'K')
    .sort(sortByDate);
  const k = comparePriceSequence(kRows, anchorPrice, {
    dateField: 'BUKTI_TGL', priceField: 'PRICE', source: 'k',
  });

  // ── Cek #4: MTRAN HPP ────────────────────────────────────
  const mtranRowsSorted = [...mtranRows].sort(sortMtranByDate);
  const mtranHpp = comparePriceSequence(mtranRowsSorted, anchorPrice, {
    dateField: 'TANGGAL', priceField: 'HPP', source: 'mtran_hpp',
  });

  // Gabung semua perubahan, urutkan berdasarkan tanggal
  const allChanges = [...bpb.changes, ...konversiBm.changes, ...k.changes, ...mtranHpp.changes]
    .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

  // ── CABANG A: Ada bukti transaksi yang mengubah harga ─────
  if (allChanges.length > 0) {
    return {
      cause: 'transaction_evidence',
      changes: allChanges,
      detail: { bpb, konversiBm, k, mtranHpp },
    };
  }

  // ── CABANG B: BKL item — cek kecocokan dengan protect ────
  if (isBkl && protectRow) {
    const hargabl = Number(protectRow.HARGABL || protectRow.hargabl);
    const cocok = Math.abs(acostSekarang - hargabl) < FLOAT_EPSILON;
    return {
      cause: cocok ? 'protect_sync' : 'protect_mismatch',
      acostSekarang,
      hargablProtect: hargabl,
    };
  }

  // ── CABANG C: Non-BKL, tanpa transaksi, ACOST berubah ────
  return {
    cause: 'unexplained_acost_anomaly',
    begbal: anchorPrice,
    acostSekarang,
  };
}
