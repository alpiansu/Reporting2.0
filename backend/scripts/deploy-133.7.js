import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ssh2Pkg from "ssh2";
import config from "./deploy.config.js";

const { Client } = ssh2Pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");

// Parsing argumen CLI
const isDryRun = process.argv.includes("--dry-run");

console.log("==================================================");
console.log("  🚀 DEPLOYMENT SCRIPT :: REPORTING 2.0 (BACKEND)");
console.log("==================================================");
console.log(`Target Host    : ${config.server.host}:${config.server.port}`);
console.log(`Remote Path    : ${config.server.remotePath}`);
console.log(`PM2 Target App : ${config.pm2.appName}`);
console.log(`Mode           : ${isDryRun ? "🔍 DRY-RUN (Simulasi saja, tidak ada file di-upload)" : "⚡ LIVE DEPLOY"}`);
console.log("--------------------------------------------------\n");

/**
 * Cek apakah relative path masuk ke daftar proteksi / exclude
 */
function checkExclusion(relPath) {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\.\//, "");

  // 1. HARD PROTECTED: .env & variasi
  for (const protectedPattern of config.protectedFiles || []) {
    if (protectedPattern === ".env" && (normalized === ".env" || normalized.endsWith("/.env"))) {
      return { excluded: true, reason: "HARD PROTECTED (.env tidak boleh ditimpa)" };
    }
    if (protectedPattern.includes("*")) {
      const regex = new RegExp("^" + protectedPattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
      const basename = normalized.split("/").pop();
      if (regex.test(normalized) || regex.test(basename)) {
        return { excluded: true, reason: `HARD PROTECTED (${protectedPattern})` };
      }
    } else if (normalized === protectedPattern || normalized.endsWith("/" + protectedPattern)) {
      return { excluded: true, reason: `HARD PROTECTED (${protectedPattern})` };
    }
  }

  // 2. EXCLUDE RULES
  for (const rule of config.exclude || []) {
    const cleanRule = rule.replace(/\\/g, "/").replace(/\/$/, "");

    // Wildcard match (e.g. *.log, *.tmp)
    if (cleanRule.includes("*")) {
      const regex = new RegExp("^" + cleanRule.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
      const basename = normalized.split("/").pop();
      if (regex.test(normalized) || regex.test(basename)) {
        return { excluded: true, reason: `Exclude wildcard: ${rule}` };
      }
      continue;
    }

    // Exact file match (e.g. src/utils/xcmd.utils.js)
    if (normalized === cleanRule) {
      return { excluded: true, reason: `File spesifik di-exclude: ${rule}` };
    }

    // Exact basename match
    const basename = normalized.split("/").pop();
    if (basename === cleanRule) {
      return { excluded: true, reason: `File spesifik di-exclude: ${rule}` };
    }

    // Folder match (e.g. data or data/)
    if (normalized === cleanRule || normalized.startsWith(cleanRule + "/")) {
      return { excluded: true, reason: `Folder di-exclude: ${rule}` };
    }
  }

  return { excluded: false };
}

/**
 * Rekursif scan direktori untuk mengumpulkan file yang akan diupload
 */
function scanFiles() {
  const uploadList = [];
  const skippedList = [];

  function walkDir(currentDir, baseRelDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.join(baseRelDir, entry.name).replace(/\\/g, "/");

      const check = checkExclusion(relPath);
      if (check.excluded) {
        skippedList.push({ relPath, reason: check.reason });
        continue;
      }

      if (entry.isDirectory()) {
        walkDir(fullPath, relPath);
      } else if (entry.isFile()) {
        uploadList.push({
          relPath,
          localPath: fullPath,
          remotePath: `${config.server.remotePath}/${relPath}`.replace(/\\/g, "/"),
        });
      }
    }
  }

  // Scan seluruh entitas di root backend/
  const rootEntries = fs.readdirSync(backendRoot, { withFileTypes: true });
  for (const entry of rootEntries) {
    const relPath = entry.name.replace(/\\/g, "/");
    const fullPath = path.join(backendRoot, entry.name);

    const check = checkExclusion(relPath);
    if (check.excluded) {
      skippedList.push({ relPath, reason: check.reason });
      continue;
    }

    if (entry.isDirectory()) {
      if ((config.includeDirs || []).includes(entry.name)) {
        walkDir(fullPath, entry.name);
      } else {
        skippedList.push({ relPath, reason: "Direktori tidak terdaftar di includeDirs" });
      }
    } else if (entry.isFile()) {
      if ((config.includeRootFiles || []).includes(entry.name)) {
        uploadList.push({
          relPath,
          localPath: fullPath,
          remotePath: `${config.server.remotePath}/${relPath}`.replace(/\\/g, "/"),
        });
      } else {
        skippedList.push({ relPath, reason: "File root tidak terdaftar di includeRootFiles" });
      }
    }
  }

  // 3. Scan Whitelist Overrides (Pengecualian khusus: file tetap di-upload meski foldernya di-exclude)
  const whitelistOverrides = [];
  for (const whiteFile of config.whitelistFiles || []) {
    const norm = whiteFile.replace(/\\/g, "/").replace(/^\.\//, "");
    const fullPath = path.join(backendRoot, norm);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ File whitelist tidak ditemukan secara lokal: ${whiteFile}`);
      continue;
    }

    // Pastikan tidak melanggar HARD PROTECTED (.env)
    const check = checkExclusion(norm);
    if (check.excluded && check.reason.includes("HARD PROTECTED")) {
      console.warn(`⛔ DITOLAK: File ${norm} masuk HARD PROTECTED dan tidak bisa di-whitelist!`);
      continue;
    }

    // Jika belum ada di uploadList, tambahkan
    if (!uploadList.some((item) => item.relPath === norm)) {
      uploadList.push({
        relPath: norm,
        localPath: fullPath,
        remotePath: `${config.server.remotePath}/${norm}`.replace(/\\/g, "/"),
        isWhitelistOverride: true,
      });
      whitelistOverrides.push(norm);
    }
  }

  return { uploadList, skippedList, whitelistOverrides };
}

/**
 * Helper untuk membuat direktori remote jika belum ada
 */
async function ensureRemoteDir(sftp, remoteDirPath, dirCache) {
  const normalized = remoteDirPath.replace(/\\/g, "/");
  if (dirCache.has(normalized)) return;

  const parts = normalized.split("/");
  let current = parts[0]; // e.g. "D:"

  for (let i = 1; i < parts.length; i++) {
    current += "/" + parts[i];
    if (dirCache.has(current)) continue;

    await new Promise((resolve) => {
      sftp.stat(current, (statErr) => {
        if (statErr) {
          sftp.mkdir(current, (mkdirErr) => {
            dirCache.add(current);
            resolve();
          });
        } else {
          dirCache.add(current);
          resolve();
        }
      });
    });
  }
}

/**
 * Eksekusi command via SSH
 */
function execRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = "";
      let stderr = "";

      stream.on("close", (code) => {
        resolve({ code, stdout, stderr });
      });
      stream.on("data", (data) => {
        stdout += data.toString();
      });
      stream.stderr.on("data", (data) => {
        stderr += data.toString();
      });
    });
  });
}

/**
 * Main Deploy Runner
 */
async function runDeploy() {
  console.log("📂 Memindai file lokal...");
  const { uploadList, skippedList, whitelistOverrides } = scanFiles();

  console.log(`\n📋 HASIL PEMINDAIAN:`);
  console.log(`   - File akan di-upload : ${uploadList.length} file`);
  console.log(`   - File/Folder dilewati: ${skippedList.length} item\n`);

  if (whitelistOverrides.length > 0) {
    console.log("✨ WHITELIST OVERRIDES (Pengecualian Khusus):");
    for (const w of whitelistOverrides) {
      console.log(`   ⭐ [INCLUDE] ${w} (Tetap di-upload meskipun folder induknya di-exclude)`);
    }
    console.log();
  }

  console.log("🛡️  CONTOH FILE/FOLDER YANG DILEWATI (PROTECTED/EXCLUDED):");
  const sampledSkipped = skippedList.slice(0, 10);
  for (const item of sampledSkipped) {
    console.log(`   ❌ [SKIP] ${item.relPath} -> ${item.reason}`);
  }
  if (skippedList.length > 10) {
    console.log(`   ... dan ${skippedList.length - 10} item lainnya.`);
  }

  // Verifikasi khusus untuk file yang dilarang
  console.log("\n🔒 VERIFIKASI FILE LARANGAN KHUSUS:");
  const envCheck = skippedList.some((s) => s.relPath.includes(".env"));
  const xcmdCheck = skippedList.some((s) => s.relPath.includes("xcmd.utils.js"));
  const dataCheck = skippedList.some((s) => s.relPath.startsWith("data"));

  console.log(`   - .env diproteksi?         : ${envCheck ? "✅ YA (Aman)" : "⚠️ TIDAK DITEMUKAN"}`);
  console.log(`   - xcmd.utils.js di-exclude?: ${xcmdCheck ? "✅ YA (Aman, tidak disentuh)" : "⚠️ TIDAK DITEMUKAN"}`);
  console.log(`   - folder data di-exclude?  : ${dataCheck ? "✅ YA (Aman, tidak disentuh kecuali whitelist)" : "⚠️ TIDAK DITEMUKAN"}`);

  if (isDryRun) {
    console.log("\n==================================================");
    console.log("  🔍 SIMULASI DRY-RUN SELESAI.");
    console.log("  Tidak ada perubahan yang dilakukan pada server.");
    console.log("==================================================");
    return;
  }

  // Mulai koneksi SSH & SFTP
  console.log("\n🔌 Menghubungkan ke server via SSH...");
  const conn = new Client();

  await new Promise((resolve, reject) => {
    conn.on("ready", resolve).on("error", reject).connect({
      host: config.server.host,
      port: config.server.port,
      username: config.server.username,
      password: config.server.password,
    });
  });

  console.log("✅ SSH Connected.");

  // SFTP Upload
  console.log("📦 Membuka sesi SFTP...");
  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, sftpSession) => {
      if (err) return reject(err);
      resolve(sftpSession);
    });
  });

  console.log(`\n📤 Memulai upload ${uploadList.length} file ke ${config.server.remotePath}...`);
  const dirCache = new Set();
  let uploadedCount = 0;

  for (const file of uploadList) {
    const remoteDir = path.dirname(file.remotePath).replace(/\\/g, "/");
    await ensureRemoteDir(sftp, remoteDir, dirCache);

    await new Promise((resolve, reject) => {
      sftp.fastPut(file.localPath, file.remotePath, (err) => {
        if (err) return reject(err);
        uploadedCount++;
        if (uploadedCount % 20 === 0 || uploadedCount === uploadList.length) {
          process.stdout.write(`\r   Progress: [${uploadedCount}/${uploadList.length}] file ter-upload...`);
        }
        resolve();
      });
    });
  }

  console.log("\n✅ Semua file berhasil di-upload!");

  // Restart PM2 BE_REPORT2.0 di remote server
  console.log("\n🔄 Memeriksa & merestart proses PM2 di server...");
  const pm2Cmd = `cmd.exe /c "pm2 restart ${config.pm2.appName} || (cd /d ${config.server.remotePath} && pm2 start src/server.js --name ${config.pm2.appName}) && pm2 save"`;

  const { code, stdout, stderr } = await execRemote(conn, pm2Cmd);
  if (stdout) console.log(stdout.trim());
  if (stderr && !stderr.includes("PM2")) console.error(stderr.trim());

  conn.end();
  console.log("✅ Koneksi SSH ditutup.");

  // Verifikasi Health Check dengan Retry Loop
  console.log(`\n🩺 Menjalankan health-check ke: ${config.pm2.healthCheckUrl}...`);
  let healthOk = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(config.pm2.healthCheckUrl, { method: "GET" });
      if (res.ok) {
        const json = await res.json();
        console.log(`✅ Health Check Status: ${res.status} ${res.statusText} (Attempt ${attempt})`);
        console.log("   Response Data      :", JSON.stringify(json, null, 2));
        console.log("\n🎉 DEPLOYMENT BERHASIL & SERVER ONLINE!");
        healthOk = true;
        break;
      }
    } catch (err) {
      process.stdout.write(`   Menunggu server ready (Percobaan ${attempt}/5)...\r`);
    }
  }

  if (!healthOk) {
    console.warn(`\n⚠️ Health check belum merespons setelah 5 percobaan.`);
    console.warn("   Silakan cek log remote dengan: pm2 logs BE_REPORT2.0");
  }

  console.log("==================================================\n");
}

runDeploy().catch((err) => {
  console.error("\n❌ DEPLOYMENT GAGAL:", err.message);
  process.exit(1);
});
