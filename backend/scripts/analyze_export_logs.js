/**
 * Analisis Log Export Laporan (Fase 0 — Observasi & Pengukuran)
 *
 * Membaca log backend (winston JSON, `backend/logs/app-*.log`) dan menyusun
 * ringkasan durasi export laporan bulanan & harian, sehingga bisa diketahui
 * di tahap mana waktu terbuang (query WRC / build Excel / stream).
 *
 * Cara pakai:
 *   node scripts/analyze_export_logs.js                # pakai log hari ini
 *   node scripts/analyze_export_logs.js logs/app-2026-08-04.log
 *   node scripts/analyze_export_logs.js logs           # scan semua app-*.log
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_DIR = path.join(__dirname, "../logs");

// ─── Util ────────────────────────────────────────────────────────────────────
function fmt(ms) {
  if (ms == null || Number.isNaN(ms)) return "-";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${(s / 60).toFixed(1)}menit`;
}

function todayLogPath() {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return path.join(DEFAULT_LOG_DIR, `app-${ymd}.log`);
}

function resolveLogFiles(input) {
  if (!input) return [todayLogPath()];
  if (fs.existsSync(input)) {
    const st = fs.statSync(input);
    if (st.isDirectory()) {
      return fs.readdirSync(input)
        .filter(f => f.startsWith("app-") && f.endsWith(".log"))
        .sort()
        .map(f => path.join(input, f));
    }
    return [input];
  }
  console.error(`❌ File/direktori tidak ditemukan: ${input}`);
  process.exit(1);
}

function readEntries(file) {
  const entries = [];
  const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj.message === "string") {
        entries.push({
          ts: obj.timestamp || "",
          level: obj.level || "",
          msg: obj.message,
        });
      }
    } catch {
      /* line non-JSON diabaikan */
    }
  }
  return entries;
}

// ─── Parsing Monthly Reports ─────────────────────────────────────────────────
// Format baru (async job): "startExport id=..." ; format lama: "exportReport id=..."
const RE_RUN_START =
  /\[monthly_reports\.controller\] (?:startExport|exportReport) id=(\S+) \| cab=(\S+) \| prd=(\S+) \| user=(\S+)/;
const RE_RUN_END = /exportReport selesai: id=\S+ \| cab=\S+ \| prd=\S+ \| user=\S+ \(total (\d+)ms\)/;
// Kegagalan: background job gagal / gagal saat start
const RE_RUN_ERR = /Job \S+ (?:gagal|dibatalkan): (.+)/;
const RE_START_ERR = /startExport error: (.+)/;
const RE_WRC_QUERY = /Query ke-(\d+) SELESAI \((\d+)ms\)/;
const RE_SHEET = /Sheet "(.+)": (\d+) baris \((\d+)ms\)/;
const RE_CLEANUP = /Cleanup query ke-(\d+) SELESAI \((\d+)ms\)/;
const RE_PHASE_WRC = /Fase WRC selesai dalam (\d+)ms/;
const RE_PHASE_EXPORT = /Fase export selesai dalam (\d+)ms/;
const RE_PHASE_CLEANUP = /Fase cleanup selesai dalam (\d+)ms/;
const RE_TOTAL = /Total eksekusi laporan dalam (\d+)ms/;
const RE_XLSX_BUILD = /\[excel_export\] Building sheet: "(.+)" \((\d+) baris\)/;
const RE_XLSX_BUILD_DONE = /Build workbook selesai dalam (\d+)ms/;
const RE_XLSX_STREAM = /Stream selesai: "(.+)" \((\d+)ms\)/;

function parseMonthly(entries) {
  const runs = [];
  let cur = null;

  // Run yang tidak lengkap (belum ada baris selesai/error, mis. log dipindai
  // saat proses masih berjalan) tetap di-push agar data parsial tidak hilang.
  const finishRun = () => {
    if (cur) runs.push(cur);
    cur = null;
  };

  for (const e of entries) {
    // Mulai run baru
    const mStart = e.msg.match(RE_RUN_START);
    if (mStart) {
      finishRun();
      cur = {
        id: mStart[1],
        cab: mStart[2],
        prd: mStart[3],
        user: mStart[4],
        queries: [],
        sheets: [],
        cleanups: [],
        excelRows: [],
        phaseWrc: null,
        phaseExport: null,
        phaseCleanup: null,
        total: null,
        excelBuild: null,
        excelStream: null,
        ended: false,
        failed: null,
      };
      continue;
    }
    if (!cur) continue;

    const mEnd = e.msg.match(RE_RUN_END);
    if (mEnd) {
      cur.total = parseInt(mEnd[1], 10);
      cur.ended = true;
      finishRun();
      continue;
    }
    const mErr = e.msg.match(RE_RUN_ERR);
    if (mErr) {
      cur.failed = mErr[1];
      finishRun();
      continue;
    }
    const mStartErr = e.msg.match(RE_START_ERR);
    if (mStartErr) {
      cur.failed = mStartErr[1];
      finishRun();
      continue;
    }

    let m;
    if ((m = e.msg.match(RE_WRC_QUERY))) cur.queries.push([parseInt(m[1], 10), parseInt(m[2], 10)]);
    else if ((m = e.msg.match(RE_SHEET))) cur.sheets.push({ key: m[1], rows: parseInt(m[2], 10), ms: parseInt(m[3], 10) });
    else if ((m = e.msg.match(RE_CLEANUP))) cur.cleanups.push([parseInt(m[1], 10), parseInt(m[2], 10)]);
    else if ((m = e.msg.match(RE_PHASE_WRC))) cur.phaseWrc = parseInt(m[1], 10);
    else if ((m = e.msg.match(RE_PHASE_EXPORT))) cur.phaseExport = parseInt(m[1], 10);
    else if ((m = e.msg.match(RE_PHASE_CLEANUP))) cur.phaseCleanup = parseInt(m[1], 10);
    else if ((m = e.msg.match(RE_TOTAL))) cur.total = parseInt(m[1], 10);
    else if ((m = e.msg.match(RE_XLSX_BUILD))) cur.excelRows.push({ key: m[1], rows: parseInt(m[2], 10) });
    else if ((m = e.msg.match(RE_XLSX_BUILD_DONE))) cur.excelBuild = parseInt(m[1], 10);
    else if ((m = e.msg.match(RE_XLSX_STREAM))) cur.excelStream = parseInt(m[2], 10);
  }
  finishRun();
  return runs;
}

// ─── Parsing Sales Custab (harian) ───────────────────────────────────────────
const RE_DAILY_START = /\[sales_custab\]\[wrc_dt\] executing query for cab=(\S+), dates=(\d+), plu=(\d+)/;
const RE_DAILY_DONE = /\[sales_custab\]\[wrc_dt\] query done, rows=(\d+), duration=(\d+)ms/;

function parseDaily(entries) {
  const runs = [];
  let cur = null;
  for (const e of entries) {
    const mStart = e.msg.match(RE_DAILY_START);
    if (mStart) {
      cur = { cab: mStart[1], dates: mStart[2], plu: mStart[3], rows: null, ms: null };
      continue;
    }
    if (!cur) continue;
    const mDone = e.msg.match(RE_DAILY_DONE);
    if (mDone) {
      cur.rows = parseInt(mDone[1], 10);
      cur.ms = parseInt(mDone[2], 10);
      runs.push(cur);
      cur = null;
    }
  }
  return runs;
}

// ─── Output ──────────────────────────────────────────────────────────────────
function printMonthly(runs) {
  console.log("\n═══ RINGKASAN EXPORT LAPORAN BULANAN ═══");
  if (runs.length === 0) {
    console.log("(tidak ada log export bulanan ditemukan di file yang dipindai)");
    return;
  }
  const sorted = [...runs].sort((a, b) => (b.total || 0) - (a.total || 0));
  sorted.forEach((r, i) => {
    const status = r.failed ? `❌ GAGAL: ${r.failed}` : r.ended ? "✅ selesai" : "… (log tidak lengkap)";
    console.log(
      `\n${i + 1}. [${r.id}] cab=${r.cab} prd=${r.prd} user=${r.user}`,
    );
    console.log(`   Total: ${fmt(r.total)}   Status: ${status}`);
    const sumQ = r.queries.reduce((a, q) => a + q[1], 0);
    const sumS = r.sheets.reduce((a, s) => a + s.ms, 0);
    const sumC = r.cleanups.reduce((a, q) => a + q[1], 0);
    console.log(
      `   Fase WRC: ${fmt(r.phaseWrc ?? sumQ)} (${r.queries.length} query) | ` +
        `Fase export: ${fmt(r.phaseExport ?? sumS)} (${r.sheets.length} sheet) | ` +
        `Fase cleanup: ${fmt(r.phaseCleanup ?? sumC)} (${r.cleanups.length} query)`,
    );
    if (r.excelBuild != null) console.log(`   Build Excel: ${fmt(r.excelBuild)} (${r.excelRows.length} sheet, total ${r.excelRows.reduce((a, s) => a + s.rows, 0)} baris)`);
    if (r.excelStream != null) console.log(`   Stream file: ${fmt(r.excelStream)}`);

    if (r.queries.length) {
      console.log("   Query WRC terberat:");
      [...r.queries]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(q => console.log(`     #${q[0]}: ${fmt(q[1])}`));
    }
    if (r.sheets.length) {
      console.log("   Sheet terberat:");
      [...r.sheets]
        .sort((a, b) => b.ms - a.ms)
        .slice(0, 5)
        .forEach(s => console.log(`     "${s.key}": ${s.rows} baris (${fmt(s.ms)})`));
    }
  });
}

function printDaily(runs) {
  console.log("\n═══ RINGKASAN QUERY LAPORAN HARIAN (Sales Custab) ═══");
  if (runs.length === 0) {
    console.log("(tidak ada log query harian ditemukan di file yang dipindai)");
    return;
  }
  const sorted = [...runs].sort((a, b) => (b.ms || 0) - (a.ms || 0));
  sorted.slice(0, 20).forEach((r, i) => {
    console.log(`${i + 1}. cab=${r.cab} | ${r.dates} hari | ${r.plu} PLU | ${r.rows} baris | ${fmt(r.ms)}`);
  });
  const avg = Math.round(runs.reduce((a, r) => a + (r.ms || 0), 0) / runs.length);
  console.log(`\nTotal ${runs.length} query, rata-rata ${fmt(avg)}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
const input = process.argv[2];
const files = resolveLogFiles(input);

let allEntries = [];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const entries = readEntries(f);
  allEntries = allEntries.concat(entries);
  console.log(`📄 Dibaca: ${f} (${entries.length} baris log)`);
}

if (allEntries.length === 0) {
  console.log("Tidak ada baris log yang terbaca. Jalankan backend dulu / periksa path log.");
  process.exit(0);
}

printMonthly(parseMonthly(allEntries));
printDaily(parseDaily(allEntries));
console.log("");
