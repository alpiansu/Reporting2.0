/**
 * Resolusi status saldo toko SUDAH TUTUP (fitur Monitoring Buka/Tutup Toko).
 *
 * Konteks:
 *  - Nilai saldo diambil dari tabel WRC `kodetoko_YYMM` per cabang:
 *      qty = SUM(SALDO_AKH), rp = SUM(RP_SLD_AKH) GROUP BY KODE_TOKO.
 *  - Tabel WRC DIGULUNG tiap bulan: periode lama hilang saat periode baru masuk,
 *    sehingga tidak adanya baris di tabel TERBARU tidak boleh diartikan saldo nol.
 *  - Memori lokal: data/store-monitoring.json berisi statusSaldo tiap toko dari
 *    sync sebelumnya. Sync baru membaca memori ini lebih dulu, lalu hanya
 *    men-query WRC untuk toko yang memang perlu dicek ulang.
 *
 * Status:
 *  - ADA_SISA  : ketemu nilai != 0 pada periode TERBARU tempat toko muncul
 *  - NOL       : ketemu baris dengan nilai 0 (terkonfirmasi nol) -> dikunci permanen
 *  - TIDAK_ADA : tidak ketemu di lokal maupun di seluruh tabel kodetoko yang tersedia
 *                (tabel periodenya sudah digulung WRC) -> BUKAN berarti nol
 */

export const SALDO_STATUS = {
  ADA_SISA: "ADA_SISA",
  NOL: "NOL",
  TIDAK_ADA: "TIDAK_ADA",
};

/**
 * Versi aturan resolusi saldo.
 * Entri NOL TANPA versi ini adalah hasil logika lama ("tidak ketemu = nol"),
 * sehingga diverifikasi ulang SEKALI dengan pencarian mundur, lalu dikunci.
 */
export const SALDO_RULE_VERSION = 2;

export const SALDO_ACTION = {
  /** Perlu query ke WRC (pencarian mundur periode terbaru -> belakang) */
  RECHECK: "RECHECK",
  /** Pakai nilai tersimpan di lokal, JANGAN query dan JANGAN timpa */
  KEEP: "KEEP",
  /** Sudah NOL terverifikasi -> lewati, JANGAN ditimpa */
  SKIP_NOL: "SKIP_NOL",
};

export const SALDO_STATUS_TEXT = {
  ADA_SISA: "Ada Sisa Saldo",
  NOL: "Saldo Nol (Clear)",
  TIDAK_ADA: "Data Tidak Ada (Tabel WRC Digulung)",
};

/** Batas jumlah literal IN (?) per query agar aman terhadap packet size */
export const IN_CHUNK_SIZE = 500;

const KODETETO_PATTERN = /^kodetoko_(\d{4})$/;

/**
 * Periode YYMM ("2610") dari tanggal "YYYY-MM-DD".
 * @returns {string|null}
 */
export function periodeFromTanggal(tgl) {
  if (!tgl) return null;
  const s = String(tgl).trim();
  if (!s || s.startsWith("0000-00-00")) return null;
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const yy = m[1].slice(2);
  return `${yy}${m[2]}`;
}

/**
 * Ubah periode ("YYMM" / "YY-MM" / "YYYY-MM") menjadi indeks bulan absolut.
 * Dipakai untuk membandingkan periode agar aman lintas tahun (2701 > 2612).
 * @returns {number|null}
 */
export function periodeToMonthIndex(periode) {
  if (periode === null || periode === undefined || periode === "") return null;
  const s = String(periode).trim();
  let m = s.match(/^(\d{2})(\d{2})$/);
  if (m) return (2000 + Number(m[1])) * 12 + Number(m[2]);
  m = s.match(/^(\d{2})-(\d{2})$/);
  if (m) return (2000 + Number(m[1])) * 12 + Number(m[2]);
  m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) return Number(m[1]) * 12 + Number(m[2]);
  return null;
}

/**
 * Bandingkan dua periode.
 * @returns {number|null} -1 / 0 / 1, atau null bila salah satu tidak valid
 */
export function comparePeriode(a, b) {
  const ia = periodeToMonthIndex(a);
  const ib = periodeToMonthIndex(b);
  if (ia === null || ib === null) return null;
  if (ia < ib) return -1;
  if (ia > ib) return 1;
  return 0;
}

/**
 * Susun daftar tabel kodetoko_YYMM dari hasil SHOW TABLES, terurut
 * TERBARU dahulu (berdasarkan periode numerik, aman lintas tahun).
 * @param {string[]} tableNames
 * @returns {Array<{table: string, periode: string}>}
 */
export function listKodetokoTables(tableNames) {
  const list = [];
  for (const raw of tableNames || []) {
    const name = String(raw || "").trim();
    const m = name.match(KODETETO_PATTERN);
    if (!m) continue;
    list.push({ table: name, periode: m[1] });
  }
  list.sort((x, y) => {
    const cmp = comparePeriode(y.periode, x.periode);
    return cmp === 0 ? 0 : cmp;
  });
  return list;
}

/**
 * Bagi array menjadi beberapa chunk berukuran tetap.
 */
export function chunkArray(arr, size = IN_CHUNK_SIZE) {
  const out = [];
  const list = Array.isArray(arr) ? arr : [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

/**
 * Keputusan apakah sebuah toko sudah tutup perlu di-query ke WRC.
 *
 * Aturan:
 *  - Belum pernah sync (prev kosong)                -> RECHECK
 *  - NOL terverifikasi (saldoRuleVersion >= 2)      -> SKIP_NOL (kunci, jangan ditimpa)
 *  - NOL hasil logika lama (tanpa marker)           -> RECHECK (verifikasi ulang sekali)
 *  - ADA_SISA                                       -> RECHECK selalu,
 *      sampai ketemu nilai 0 (jadi NOL). Saldo yang tadinya ada tidak boleh
 *      berhenti dicari hanya karena periode tutup sudah tercakup data WRC.
 *  - TIDAK_ADA:
 *      periode tutup > periode data terbaru WRC     -> RECHECK (data WRC belum mencakup periode tutup)
 *      selain itu (tgl tutup sudah lewat & tetap tidak ketemu) -> KEEP (kunci)
 *
 * @param {object} p
 * @param {object|null} p.prev        status saldo tersimpan di lokal (sync sebelumnya)
 * @param {string|null} p.tglTutup    tanggal tutup toko dari master WRC
 * @param {string|null} p.periodLatest periode kodetoko terbaru di WRC ("YYMM")
 * @returns {string} SALDO_ACTION
 */
export function decideSaldoAction({ prev = null, tglTutup = null, periodLatest = null } = {}) {
  if (!prev || !prev.statusSaldo) return SALDO_ACTION.RECHECK;

  if (prev.statusSaldo === SALDO_STATUS.NOL) {
    const verified = Number(prev.saldoRuleVersion) >= SALDO_RULE_VERSION;
    return verified ? SALDO_ACTION.SKIP_NOL : SALDO_ACTION.RECHECK;
  }

  // Saldo tadinya ada -> terus dicari sampai terbukti nol, apapun periode tutupnya
  if (prev.statusSaldo === SALDO_STATUS.ADA_SISA) return SALDO_ACTION.RECHECK;

  if (prev.statusSaldo === SALDO_STATUS.TIDAK_ADA) {
    const cmp = comparePeriode(periodeFromTanggal(tglTutup || prev.tglTutup), periodLatest);
    if (cmp !== null && cmp > 0) return SALDO_ACTION.RECHECK;
    return SALDO_ACTION.KEEP;
  }

  // Status lokal tidak dikenal -> cek ulang
  return SALDO_ACTION.RECHECK;
}

/**
 * Terjemahkan hasil pencarian mundur ke status saldo.
 * @param {object|null} hit { qty, rp, periode } bila ketemu, null bila tidak ketemu sama sekali
 * @returns {{statusSaldo: string, saldoQty: number, saldoRp: number, periodeSaldo: string|null}}
 */
export function resolveSaldoFromLookup(hit) {
  if (!hit) {
    return {
      statusSaldo: SALDO_STATUS.TIDAK_ADA,
      saldoQty: 0,
      saldoRp: 0,
      periodeSaldo: null,
    };
  }
  const saldoQty = Number(hit.qty) || 0;
  const saldoRp = Number(hit.rp) || 0;
  const isZero = saldoQty === 0 && saldoRp === 0;
  return {
    statusSaldo: isZero ? SALDO_STATUS.NOL : SALDO_STATUS.ADA_SISA,
    saldoQty,
    saldoRp,
    periodeSaldo: hit.periode || null,
  };
}

/**
 * Bangun field saldo dari hasil query WRC terbaru (dicap sebagai terverifikasi).
 */
export function buildSaldoFields(resolved, { source = "wrc" } = {}) {
  const statusSaldo = resolved.statusSaldo;
  return {
    statusSaldo,
    saldoQty: Number(resolved.saldoQty) || 0,
    saldoRp: Number(resolved.saldoRp) || 0,
    periodeSaldo: resolved.periodeSaldo ?? null,
    statusText: SALDO_STATUS_TEXT[statusSaldo] || statusSaldo,
    saldoRuleVersion: SALDO_RULE_VERSION,
    saldoSource: source,
    saldoVerifiedAt: new Date().toISOString(),
  };
}

/**
 * Bawa nilai saldo tersimpan di lokal apa adanya (tanpa query, tanpa timpa).
 */
export function carrySaldoFields(prev) {
  const statusSaldo = prev?.statusSaldo || SALDO_STATUS.TIDAK_ADA;
  return {
    statusSaldo,
    saldoQty: Number(prev?.saldoQty) || 0,
    saldoRp: Number(prev?.saldoRp) || 0,
    periodeSaldo: prev?.periodeSaldo ?? null,
    statusText: SALDO_STATUS_TEXT[statusSaldo] || statusSaldo,
    saldoRuleVersion: prev?.saldoRuleVersion ?? null,
    saldoSource: prev?.saldoSource ?? "lokal",
    saldoVerifiedAt: prev?.saldoVerifiedAt ?? null,
  };
}

/**
 * Susun field saldo akhir untuk satu toko sudah tutup dari hasil keputusan
 * + hasil pencarian mundur.
 *
 * @param {object} p
 * @param {string} p.action SALDO_ACTION hasil decideSaldoAction
 * @param {object|null} p.prev status saldo tersimpan di lokal (sync sebelumnya)
 * @param {object|null} p.hit  hasil lookup { qty, rp, periode } atau null (tidak ketemu)
 */
export function composeSaldoFields({ action, prev = null, hit = null } = {}) {
  if (action === SALDO_ACTION.RECHECK) {
    if (hit) return buildSaldoFields(resolveSaldoFromLookup(hit));

    // Pencarian mundur tidak menemukan baris sama sekali:
    //  - pernah ADA_SISA -> nilai lama dipertahankan agar statusnya tetap
    //    "ada sisa" dan terus dicari pada sync berikutnya sampai ketemu 0;
    //  - selain itu       -> TIDAK_ADA (bukan nol), dikunci bila tgl tutup sudah lewat.
    if (prev && prev.statusSaldo === SALDO_STATUS.ADA_SISA) {
      return carrySaldoFields(prev);
    }
    return buildSaldoFields(resolveSaldoFromLookup(null));
  }

  return carrySaldoFields(prev);
}

export default {
  SALDO_STATUS,
  SALDO_RULE_VERSION,
  SALDO_ACTION,
  SALDO_STATUS_TEXT,
  IN_CHUNK_SIZE,
  periodeFromTanggal,
  periodeToMonthIndex,
  comparePeriode,
  listKodetokoTables,
  chunkArray,
  decideSaldoAction,
  resolveSaldoFromLookup,
  buildSaldoFields,
  carrySaldoFields,
  composeSaldoFields,
};
