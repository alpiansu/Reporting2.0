/**
 * Unit Test: resolusi saldo toko SUDAH TUTUP (fitur Monitoring Buka/Tutup Toko).
 *
 * Kebijakan yang ditutup di sini:
 *  - Tidak adanya baris di tabel kodetoko TERBARU bukan berarti saldo nol.
 *    Pencarian dilakukan MUNDUR: periode terbaru -> belakang sampai ketemu.
 *  - Toko yang tidak ketemu di tabel manapun -> TIDAK_ADA (bukan NOL),
 *    karena tabel WRC digulung tiap bulan (periode lama hilang).
 *  - Saldo dikunci: NOL terverifikasi tidak ditimpa; nilai tersimpan hanya
 *    di-query ulang untuk ADA_SISA/TIDAK_ADA saat periode tutup lebih baru
 *    dari periode data terbaru WRC.
 *  - Nilai memakai SUM(SALDO_AKH) untuk qty dan SUM(RP_SLD_AKH) untuk rupiah.
 *
 * Run with: npx jest --testPathPatterns store_monitoring_saldo
 */

jest.mock("../config/logger.js", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() },
}));

import StoreSyncService from "../modules/store/store-sync.service.js";
import {
  SALDO_ACTION,
  SALDO_STATUS,
  SALDO_RULE_VERSION,
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
} from "../modules/store/store-saldo.resolver.js";

const prevEntri = (over = {}) => ({
  kodeToko: "T1PS",
  cabang: "G026",
  tglTutup: "2026-10-31",
  statusSaldo: SALDO_STATUS.NOL,
  saldoQty: 0,
  saldoRp: 0,
  periodeSaldo: "2610",
  saldoRuleVersion: SALDO_RULE_VERSION,
  ...over,
});

describe("periode: YYMM & perbandingan lintas tahun", () => {
  test("periodeFromTanggal mengubah tanggal tutup jadi YYMM", () => {
    expect(periodeFromTanggal("2026-10-31")).toBe("2610");
    expect(periodeFromTanggal("2027-01-05")).toBe("2701");
    expect(periodeFromTanggal("0000-00-00")).toBeNull();
    expect(periodeFromTanggal(null)).toBeNull();
    expect(periodeFromTanggal("")).toBeNull();
  });

  test("periodeToMonthIndex memakai bulan absolut (aman lintas tahun)", () => {
    expect(periodeToMonthIndex("2612")).toBeLessThan(periodeToMonthIndex("2701"));
    expect(periodeToMonthIndex("2610")).toBe(2026 * 12 + 10);
    expect(periodeToMonthIndex("2026-10")).toBe(2026 * 12 + 10);
    expect(periodeToMonthIndex("bogus")).toBeNull();
  });

  test("comparePeriode: tgl tutup 2027-01 lebih besar dari data WRC 2612", () => {
    expect(comparePeriode("2701", "2612")).toBe(1);
    expect(comparePeriode("2610", "2610")).toBe(0);
    expect(comparePeriode("2609", "2610")).toBe(-1);
    expect(comparePeriode(null, "2610")).toBeNull();
  });
});

describe("listKodetokoTables — urut terbaru -> terlama", () => {
  test("menyaring nama tak valid dan membalik urutan jadi descending", () => {
    const tables = listKodetokoTables([
      "kodetoko_2512",
      "kodetoko_2601",
      "kodetoko_2610",
      "mstran_2610",
      "kodetoko_ab",
      null,
    ]);
    expect(tables.map((t) => t.table)).toEqual([
      "kodetoko_2610",
      "kodetoko_2601",
      "kodetoko_2512",
    ]);
    expect(tables[0].periode).toBe("2610");
  });

  test("urutan tetap benar saat periode melewati batas tahun", () => {
    const tables = listKodetokoTables(["kodetoko_2701", "kodetoko_2612"]);
    expect(tables.map((t) => t.periode)).toEqual(["2701", "2612"]);
  });
});

describe("decideSaldoAction — kapan toko perlu di-query ke WRC", () => {
  test("belum pernah sync -> RECHECK", () => {
    expect(decideSaldoAction({ prev: null, tglTutup: "2026-10-31", periodLatest: "2610" }))
      .toBe(SALDO_ACTION.RECHECK);
  });

  test("NOL terverifikasi (v2) -> SKIP_NOL, tidak ditimpa", () => {
    expect(decideSaldoAction({ prev: prevEntri(), tglTutup: "2026-10-31", periodLatest: "2610" }))
      .toBe(SALDO_ACTION.SKIP_NOL);
  });

  test("NOL hasil logika lama (tanpa marker) -> RECHECK sekali untuk verifikasi ulang", () => {
    const legacy = prevEntri({ saldoRuleVersion: undefined });
    expect(decideSaldoAction({ prev: legacy, tglTutup: "2010-12-01", periodLatest: "2610" }))
      .toBe(SALDO_ACTION.RECHECK);
  });

  test("ADA_SISA + tgl tutup lebih baru dari periode data WRC -> RECHECK", () => {
    const prev = prevEntri({ statusSaldo: SALDO_STATUS.ADA_SISA, saldoQty: 12, saldoRp: 150000 });
    expect(decideSaldoAction({ prev, tglTutup: "2026-11-15", periodLatest: "2610" }))
      .toBe(SALDO_ACTION.RECHECK);
  });

  test("ADA_SISA tetap RECHECK walau tgl tutup sudah tercakup data WRC (dicari sampai nol)", () => {
    const prev = prevEntri({ statusSaldo: SALDO_STATUS.ADA_SISA, saldoQty: 12, saldoRp: 150000 });
    expect(decideSaldoAction({ prev, tglTutup: "2026-10-31", periodLatest: "2610" }))
      .toBe(SALDO_ACTION.RECHECK);
    expect(decideSaldoAction({ prev, tglTutup: "2020-08-01", periodLatest: "2610" }))
      .toBe(SALDO_ACTION.RECHECK);
  });

  test("ADA_SISA lintas tahun: tutup 2027-01 vs data WRC 2612 -> RECHECK", () => {
    const prev = prevEntri({ statusSaldo: SALDO_STATUS.ADA_SISA });
    expect(decideSaldoAction({ prev, tglTutup: "2027-01-10", periodLatest: "2612" }))
      .toBe(SALDO_ACTION.RECHECK);
  });

  test("TIDAK_ADA menunggu data masuk (tgl tutup > periode WRC) -> RECHECK, selain itu KEEP", () => {
    const prev = prevEntri({ statusSaldo: SALDO_STATUS.TIDAK_ADA, periodeSaldo: null });
    expect(decideSaldoAction({ prev, tglTutup: "2026-11-02", periodLatest: "2610" }))
      .toBe(SALDO_ACTION.RECHECK);
    expect(decideSaldoAction({ prev, tglTutup: "2026-09-02", periodLatest: "2610" }))
      .toBe(SALDO_ACTION.KEEP);
  });
});

describe("resolveSaldoFromLookup — hasil pencarian mundur menjadi status", () => {
  test("tidak ketemu sama sekali -> TIDAK_ADA (BUKAN nol)", () => {
    const r = resolveSaldoFromLookup(null);
    expect(r.statusSaldo).toBe(SALDO_STATUS.TIDAK_ADA);
    expect(r.saldoQty).toBe(0);
    expect(r.saldoRp).toBe(0);
    expect(r.periodeSaldo).toBeNull();
  });

  test("ketemu baris dengan qty & rp 0 -> NOL terkonfirmasi", () => {
    const r = resolveSaldoFromLookup({ qty: 0, rp: 0, periode: "2610" });
    expect(r.statusSaldo).toBe(SALDO_STATUS.NOL);
    expect(r.periodeSaldo).toBe("2610");
  });

  test("ketemu nilai di periode LAMA (bukan terbaru) -> ADA_SISA + periode yang ketemu", () => {
    const r = resolveSaldoFromLookup({ qty: 3, rp: 45000, periode: "2609" });
    expect(r.statusSaldo).toBe(SALDO_STATUS.ADA_SISA);
    expect(r.saldoQty).toBe(3);
    expect(r.saldoRp).toBe(45000);
    expect(r.periodeSaldo).toBe("2609");
  });

  test("cukup salah satu dari qty/rp yang non nol -> ADA_SISA", () => {
    expect(resolveSaldoFromLookup({ qty: 0, rp: 900, periode: "2610" }).statusSaldo)
      .toBe(SALDO_STATUS.ADA_SISA);
    expect(resolveSaldoFromLookup({ qty: 5, rp: 0, periode: "2610" }).statusSaldo)
      .toBe(SALDO_STATUS.ADA_SISA);
  });
});

describe("buildSaldoFields / carrySaldoFields", () => {
  test("hasil query WRC dicap terverifikasi (versi aturan + sumber + waktu)", () => {
    const f = buildSaldoFields(
      { statusSaldo: SALDO_STATUS.ADA_SISA, saldoQty: 4, saldoRp: 8000, periodeSaldo: "2610" },
      { source: "wrc" },
    );
    expect(f).toMatchObject({
      statusSaldo: SALDO_STATUS.ADA_SISA,
      saldoQty: 4,
      saldoRp: 8000,
      periodeSaldo: "2610",
      statusText: "Ada Sisa Saldo",
      saldoRuleVersion: SALDO_RULE_VERSION,
      saldoSource: "wrc",
    });
    expect(typeof f.saldoVerifiedAt).toBe("string");
  });

  test("TIDAK_ADA diberi statusText yang menjelaskan tabel sudah digulung", () => {
    const f = buildSaldoFields(resolveSaldoFromLookup(null));
    expect(f.statusSaldo).toBe(SALDO_STATUS.TIDAK_ADA);
    expect(f.statusText).toContain("Data Tidak Ada");
  });

  test("carrySaldoFields mempertahankan nilai & meta lokal apa adanya", () => {
    const prev = prevEntri({
      statusSaldo: SALDO_STATUS.ADA_SISA,
      saldoQty: 7,
      saldoRp: 70000,
      saldoSource: "wrc",
      saldoVerifiedAt: "2026-10-01T00:00:00.000Z",
    });
    const f = carrySaldoFields(prev);
    expect(f).toMatchObject({
      statusSaldo: SALDO_STATUS.ADA_SISA,
      saldoQty: 7,
      saldoRp: 70000,
      periodeSaldo: "2610",
      saldoRuleVersion: SALDO_RULE_VERSION,
      saldoSource: "wrc",
      saldoVerifiedAt: "2026-10-01T00:00:00.000Z",
    });
  });
});

/**
 * Koneksi palsu: setiap query SELECT saldo dijawab dari fixture per tabel.
 * Meniru perilaku WRC: periode lama hilang ketika periode baru masuk.
 */
const makeConnection = (fixture) => ({
  query: jest.fn(async (sql, params) => {
    const match = sql.match(/kodetoko_\d{4}/);
    if (!match) return [[]];
    const table = match[0];
    const codes = params?.[0] || [];
    const data = fixture[table] || {};
    const rows = codes
      .filter((c) => Object.prototype.hasOwnProperty.call(data, c))
      .map((c) => ({ kodeToko: c, qty: data[c].qty, rp: data[c].rp }));
    return [rows];
  }),
});

describe("lookupSaldoBackward — pencarian mundur dari periode terbaru", () => {
  const service = new StoreSyncService();

  test("tak ketemu di tabel terbaru -> dicek ke tabel sebelumnya sampai ketemu", async () => {
    const conn = makeConnection({
      kodetoko_2610: { T1PS: { qty: 10, rp: 100000 } },
      kodetoko_2609: { T2PS: { qty: 3, rp: 45000 } },
    });
    const tables = listKodetokoTables(["kodetoko_2610", "kodetoko_2609"]);
    const found = await service.lookupSaldoBackward(conn, tables, ["T1PS", "T2PS"]);

    expect(found.get("T1PS")).toEqual({ qty: 10, rp: 100000, periode: "2610" });
    expect(found.get("T2PS")).toEqual({ qty: 3, rp: 45000, periode: "2609" });
    expect(found.size).toBe(2);
  });

  test("nilai dipakai dari kemunculan PERTAMA (periode terbaru tempat toko ada)", async () => {
    const conn = makeConnection({
      kodetoko_2610: { T1PS: { qty: 0, rp: 0 } },
      kodetoko_2609: { T1PS: { qty: 9, rp: 90000 } },
    });
    const tables = listKodetokoTables(["kodetoko_2610", "kodetoko_2609"]);
    const found = await service.lookupSaldoBackward(conn, tables, ["T1PS"]);

    expect(found.get("T1PS")).toEqual({ qty: 0, rp: 0, periode: "2610" });
    // resolve -> NOL terkonfirmasi (bukan diambil dari periode lama yang masih ada sisa)
    expect(resolveSaldoFromLookup(found.get("T1PS")).statusSaldo).toBe(SALDO_STATUS.NOL);
  });

  test("toko tutup lama yang sudah tidak ada di tabel manapun -> tidak ketemu (TIDAK_ADA)", async () => {
    const conn = makeConnection({
      kodetoko_2610: { T1PS: { qty: 1, rp: 1000 } },
      kodetoko_2609: { T1PS: { qty: 1, rp: 1000 } },
    });
    const tables = listKodetokoTables(["kodetoko_2610", "kodetoko_2609"]);
    const found = await service.lookupSaldoBackward(conn, tables, ["TLAMA"]);

    expect(found.has("TLAMA")).toBe(false);
    expect(resolveSaldoFromLookup(found.get("TLAMA") || null).statusSaldo)
      .toBe(SALDO_STATUS.TIDAK_ADA);
  });

  test("berhenti lebih awal begitu semua kandidat ketemu (tidak query periode lama)", async () => {
    const conn = makeConnection({
      kodetoko_2610: { T1PS: { qty: 1, rp: 1000 }, T2PS: { qty: 2, rp: 2000 } },
      kodetoko_2609: { T1PS: { qty: 1, rp: 1000 }, T2PS: { qty: 2, rp: 2000 } },
    });
    const tables = listKodetokoTables(["kodetoko_2610", "kodetoko_2609"]);
    await service.lookupSaldoBackward(conn, tables, ["T1PS", "T2PS"]);

    expect(conn.query).toHaveBeenCalledTimes(1);
  });

  test("kandidat dibagi per chunk 500 agar aman terhadap packet size", async () => {
    const conn = makeConnection({ kodetoko_2610: {} });
    const tables = listKodetokoTables(["kodetoko_2610"]);
    const codes = Array.from({ length: 1200 }, (_, i) => `T${i}XX`);

    await service.lookupSaldoBackward(conn, tables, codes);

    expect(conn.query).toHaveBeenCalledTimes(3); // 500 + 500 + 200
    const sizes = conn.query.mock.calls.map((c) => c[1][0].length);
    expect(sizes).toEqual([500, 500, 200]);
  });

  test("tanpa kandidat / tanpa tabel -> tidak ada query sama sekali", async () => {
    const conn = makeConnection({});
    const tables = listKodetokoTables(["kodetoko_2610"]);
    const foundEmpty = await service.lookupSaldoBackward(conn, tables, []);
    expect(foundEmpty.size).toBe(0);
    expect(conn.query).not.toHaveBeenCalled();
  });
});

describe("alur end-to-end keputusan + hasil lookup (tanpa DB asli)", () => {
  const service = new StoreSyncService();
  const periodLatest = "2610";

  const run = async (prev, tglTutup, fixture) => {
    const tables = listKodetokoTables(Object.keys(fixture).sort());
    const action = decideSaldoAction({ prev, tglTutup, periodLatest: tables[0]?.periode || null });
    if (action !== SALDO_ACTION.RECHECK) {
      return { action, fields: composeSaldoFields({ action, prev, hit: null }) };
    }
    const conn = makeConnection(fixture);
    const found = await service.lookupSaldoBackward(conn, tables, ["T1PS"]);
    return {
      action,
      fields: composeSaldoFields({ action, prev, hit: found.get("T1PS") || null }),
    };
  };

  test("belum sync + tak ketemu di tabel manapun -> TIDAK_ADA, bukan NOL", async () => {
    const { action, fields } = await run(null, "2010-12-01", {
      kodetoko_2610: { TOTHER: { qty: 5, rp: 5000 } },
      kodetoko_2609: {},
    });
    expect(action).toBe(SALDO_ACTION.RECHECK);
    expect(fields.statusSaldo).toBe(SALDO_STATUS.TIDAK_ADA);
    expect(fields.saldoQty).toBe(0);
    expect(fields.saldoRp).toBe(0);
    expect(fields.periodeSaldo).toBeNull();
  });

  test("belum sync + ada saldo di periode lama -> ADA_SISA dengan qty & rupiah", async () => {
    const { fields } = await run(null, "2026-10-15", {
      kodetoko_2610: {},
      kodetoko_2609: { T1PS: { qty: 12, rp: 350000 } },
    });
    expect(fields.statusSaldo).toBe(SALDO_STATUS.ADA_SISA);
    expect(fields.saldoQty).toBe(12);
    expect(fields.saldoRp).toBe(350000);
    expect(fields.periodeSaldo).toBe("2609");
  });

  test("NOL terverifikasi -> tidak di-query dan tidak ditimpa", async () => {
    const prev = prevEntri({ statusSaldo: SALDO_STATUS.NOL, saldoQty: 0, saldoRp: 0 });
    const { action, fields } = await run(prev, "2026-10-31", { kodetoko_2610: {} });
    expect(action).toBe(SALDO_ACTION.SKIP_NOL);
    expect(fields.statusSaldo).toBe(SALDO_STATUS.NOL);
    expect(fields.periodeSaldo).toBe("2610");
  });

  test("ADA_SISA dicari walau tgl tutup <= periode WRC: ketemu 0 -> NOL (berhenti)", async () => {
    const prev = prevEntri({
      statusSaldo: SALDO_STATUS.ADA_SISA,
      saldoQty: 7,
      saldoRp: 77000,
      periodeSaldo: "2608",
      tglTutup: "2026-05-20",
    });
    const { action, fields } = await run(prev, "2026-05-20", {
      kodetoko_2610: { T1PS: { qty: 0, rp: 0 } },
    });
    expect(action).toBe(SALDO_ACTION.RECHECK);
    expect(fields.statusSaldo).toBe(SALDO_STATUS.NOL);
    expect(fields.saldoQty).toBe(0);
    expect(fields.saldoRp).toBe(0);
    expect(fields.periodeSaldo).toBe("2610");
  });

  test("ADA_SISA tapi datanya sudah tidak ada di WRC -> nilai lama dipertahankan & tetap dicari lagi", async () => {
    const prev = prevEntri({
      statusSaldo: SALDO_STATUS.ADA_SISA,
      saldoQty: 7,
      saldoRp: 77000,
      periodeSaldo: "2608",
      tglTutup: "2026-05-20",
    });
    const { action, fields } = await run(prev, "2026-05-20", { kodetoko_2610: {} });
    expect(action).toBe(SALDO_ACTION.RECHECK);
    expect(fields.statusSaldo).toBe(SALDO_STATUS.ADA_SISA);
    expect(fields.saldoQty).toBe(7);
    expect(fields.saldoRp).toBe(77000);
    expect(fields.periodeSaldo).toBe("2608");
  });

  test("ADA_SISA ketemu nilai di periode lama -> nilai & periode diperbarui", async () => {
    const prev = prevEntri({
      statusSaldo: SALDO_STATUS.ADA_SISA,
      saldoQty: 7,
      saldoRp: 77000,
      periodeSaldo: "2608",
      tglTutup: "2026-05-20",
    });
    const { fields } = await run(prev, "2026-05-20", {
      kodetoko_2610: {},
      kodetoko_2609: { T1PS: { qty: 3, rp: 45000 } },
    });
    expect(fields.statusSaldo).toBe(SALDO_STATUS.ADA_SISA);
    expect(fields.saldoQty).toBe(3);
    expect(fields.saldoRp).toBe(45000);
    expect(fields.periodeSaldo).toBe("2609");
  });

  test("ADA_SISA + tgl tutup lebih baru dari data WRC + di periode terbaru sudah 0 -> jadi NOL", async () => {
    // Kasus asli: saldo masih 7 di 2609, toko tutup 2026-11-30 (2611),
    // data WRC baru sampai 2610 (2611 > 2610 -> RECHECK), dan di 2610
    // saldonya sudah bersih (0) -> NOL terkonfirmasi, dikunci.
    const prev = prevEntri({
      statusSaldo: SALDO_STATUS.ADA_SISA,
      saldoQty: 7,
      saldoRp: 77000,
      periodeSaldo: "2609",
      tglTutup: "2026-11-30",
    });
    const { action, fields } = await run(prev, "2026-11-30", {
      kodetoko_2610: { T1PS: { qty: 0, rp: 0 } },
      kodetoko_2609: { T1PS: { qty: 7, rp: 77000 } },
    });
    expect(action).toBe(SALDO_ACTION.RECHECK);
    expect(fields.statusSaldo).toBe(SALDO_STATUS.NOL);
    expect(fields.saldoQty).toBe(0);
    expect(fields.saldoRp).toBe(0);
    expect(fields.periodeSaldo).toBe("2610");
    expect(fields.saldoRuleVersion).toBe(SALDO_RULE_VERSION);
  });

  test("NOL hasil logika lama diverifikasi ulang: tak ketemu -> diubah jadi TIDAK_ADA", async () => {
    const legacy = prevEntri({ saldoRuleVersion: undefined, tglTutup: "2010-12-01" });
    const { action, fields } = await run(legacy, "2010-12-01", { kodetoko_2610: {} });
    expect(action).toBe(SALDO_ACTION.RECHECK);
    expect(fields.statusSaldo).toBe(SALDO_STATUS.TIDAK_ADA);
    expect(fields.saldoRuleVersion).toBe(SALDO_RULE_VERSION);
  });
});

describe("composeSaldoFields — penggabungan keputusan + hasil lookup", () => {
  test("RECHECK dengan hasil nol -> NOL terverifikasi", () => {
    const f = composeSaldoFields({
      action: SALDO_ACTION.RECHECK,
      prev: prevEntri({ statusSaldo: SALDO_STATUS.ADA_SISA, saldoQty: 4, saldoRp: 4000 }),
      hit: { qty: 0, rp: 0, periode: "2610" },
    });
    expect(f.statusSaldo).toBe(SALDO_STATUS.NOL);
    expect(f.saldoRuleVersion).toBe(SALDO_RULE_VERSION);
  });

  test("RECHECK tanpa hasil & sebelumnya ADA_SISA -> tetap ADA_SISA (bukan TIDAK_ADA)", () => {
    const f = composeSaldoFields({
      action: SALDO_ACTION.RECHECK,
      prev: prevEntri({ statusSaldo: SALDO_STATUS.ADA_SISA, saldoQty: 9, saldoRp: 90000 }),
      hit: null,
    });
    expect(f.statusSaldo).toBe(SALDO_STATUS.ADA_SISA);
    expect(f.saldoQty).toBe(9);
    expect(f.saldoRp).toBe(90000);
  });

  test("RECHECK tanpa hasil & sebelumnya tidak ada -> TIDAK_ADA", () => {
    const f = composeSaldoFields({ action: SALDO_ACTION.RECHECK, prev: null, hit: null });
    expect(f.statusSaldo).toBe(SALDO_STATUS.TIDAK_ADA);
    expect(f.saldoQty).toBe(0);
    expect(f.saldoRp).toBe(0);
    expect(f.periodeSaldo).toBeNull();
  });

  test("KEEP / SKIP_NOL -> mempertahankan nilai tersimpan apa adanya", () => {
    const prev = prevEntri({
      statusSaldo: SALDO_STATUS.ADA_SISA,
      saldoQty: 5,
      saldoRp: 5000,
      saldoVerifiedAt: "2026-10-01T00:00:00.000Z",
    });
    const f = composeSaldoFields({ action: SALDO_ACTION.KEEP, prev, hit: null });
    expect(f.statusSaldo).toBe(SALDO_STATUS.ADA_SISA);
    expect(f.saldoQty).toBe(5);
    expect(f.saldoRp).toBe(5000);
    expect(f.saldoVerifiedAt).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("chunkArray", () => {
  test("membagi array sesuai ukuran chunk", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkArray([], 2)).toEqual([]);
  });
});
