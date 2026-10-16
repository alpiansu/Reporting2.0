import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import * as ftp from "basic-ftp";
import config from "./deploy.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");
const envPath = path.join(frontendRoot, ".env");
const envBackupPath = path.join(frontendRoot, ".env.deploy.bak");
const distDir = path.join(frontendRoot, config.buildDir || "dist");

// Parsing argumen CLI
const isDryRun = process.argv.includes("--dry-run");
const skipBuild = process.argv.includes("--skip-build");

console.log("==================================================");
console.log("  🚀 DEPLOYMENT SCRIPT :: REPORTING 2.0 (FRONTEND)");
console.log("==================================================");
console.log(`FTP Target Host : ${config.ftp.host}:${config.ftp.port}`);
console.log(`FTP Remote Dir  : ${config.ftp.remoteDir}`);
console.log(`Injected API URL: ${config.envOverrides.VITE_API_URL}`);
console.log(`Web Verification: ${config.webUrl}`);
console.log(`Mode            : ${isDryRun ? "🔍 DRY-RUN (Simulasi saja)" : "⚡ LIVE DEPLOY"}`);
console.log("--------------------------------------------------\n");

/**
 * Kembalikan file .env dari backup
 */
function restoreEnvBackup() {
  if (fs.existsSync(envBackupPath)) {
    try {
      fs.copyFileSync(envBackupPath, envPath);
      fs.unlinkSync(envBackupPath);
      console.log("\n🔄 [RESTORE] File frontend/.env berhasil dikembalikan ke konfigurasi lokal semula.");
    } catch (err) {
      console.error("\n❌ Gagal merestore .env dari backup:", err.message);
    }
  }
}

// Pastikan backup selalu di-restore jika user menekan Ctrl+C atau terjadi crash
process.on("SIGINT", () => {
  console.log("\n⚠️ Proses dibatalkan oleh pengguna (SIGINT).");
  restoreEnvBackup();
  process.exit(1);
});
process.on("SIGTERM", () => {
  restoreEnvBackup();
  process.exit(1);
});

async function runFrontendDeploy() {
  let envOriginalContent = null;

  try {
    // 1. Backup & Update .env Sementara
    if (fs.existsSync(envPath)) {
      envOriginalContent = fs.readFileSync(envPath, "utf-8");
      fs.copyFileSync(envPath, envBackupPath);
      console.log("📦 Backup frontend/.env -> .env.deploy.bak dibuat.");

      let modifiedEnv = envOriginalContent;
      for (const [key, val] of Object.entries(config.envOverrides)) {
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(modifiedEnv)) {
          modifiedEnv = modifiedEnv.replace(regex, `${key}=${val}`);
        } else {
          modifiedEnv += `\n${key}=${val}`;
        }
      }

      fs.writeFileSync(envPath, modifiedEnv, "utf-8");
      console.log(`📝 .env sementara di-update untuk production:`);
      for (const [key, val] of Object.entries(config.envOverrides)) {
        console.log(`   - ${key}=${val}`);
      }
    } else {
      console.warn("⚠️ File frontend/.env tidak ditemukan, membuat .env baru sementara...");
      let newEnv = "";
      for (const [key, val] of Object.entries(config.envOverrides)) {
        newEnv += `${key}=${val}\n`;
      }
      fs.writeFileSync(envPath, newEnv, "utf-8");
    }

    // 2. Jalankan Build
    if (skipBuild) {
      console.log("\n⏩ [SKIP-BUILD] Melewati tahap build sesuai flag --skip-build.");
    } else {
      console.log("\n🔨 Menjalankan build frontend (npm run build)...");
      execSync("npm run build", {
        cwd: frontendRoot,
        stdio: "inherit",
      });
      console.log("✅ Build frontend selesai. Output berada di folder:", distDir);
    }
  } finally {
    // 3. SELALU kembalikan .env asli terlepas dari build sukses atau gagal
    restoreEnvBackup();
  }

  // Verifikasi folder dist hasil build
  if (!fs.existsSync(distDir)) {
    throw new Error(`Folder build '${distDir}' tidak ditemukan. Pastikan build berhasil.`);
  }

  const distFiles = fs.readdirSync(distDir);
  console.log(`\n📂 Isi folder ${config.buildDir}: [${distFiles.join(", ")}]`);

  if (isDryRun) {
    console.log("\n==================================================");
    console.log("  🔍 SIMULASI DRY-RUN FRONTEND SELESAI.");
    console.log("  Build telah diuji dan .env lokal tetap aman.");
    console.log("==================================================");
    return;
  }

  // 4. Upload ke Server FTP menggunakan FTPS
  console.log("\n🔌 Menghubungkan ke FTP server via FTPS (TLS)...");
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: config.ftp.host,
      port: config.ftp.port,
      user: config.ftp.user,
      password: config.ftp.password,
      secure: config.ftp.secure,
      secureOptions: config.ftp.secureOptions,
    });
    console.log("✅ FTPS Connected & Authenticated.");

    // Pastikan direktori remote ada
    await client.ensureDir(config.ftp.remoteDir);
    console.log(`📁 Masuk ke remote directory: ${config.ftp.remoteDir}`);

    console.log(`\n📤 Memulai upload isi '${config.buildDir}' ke remote '${config.ftp.remoteDir}'...`);
    await client.uploadFromDir(distDir, config.ftp.remoteDir);
    console.log("✅ Semua file build frontend berhasil di-upload ke server FTP!");
  } finally {
    client.close();
    console.log("🔌 Koneksi FTP ditutup.");
  }

  // 5. Verifikasi Halaman Web
  console.log(`\n🩺 Melakukan verifikasi HTTP GET ke: ${config.webUrl}...`);
  try {
    const res = await fetch(config.webUrl);
    console.log(`✅ Web Response Status: ${res.status} ${res.statusText}`);
    console.log("\n🎉 DEPLOYMENT FRONTEND BERHASIL!");
  } catch (err) {
    console.warn(`⚠️ Gagal menghubungi web endpoint: ${err.message}`);
  }

  console.log("==================================================\n");
}

runFrontendDeploy().catch((err) => {
  console.error("\n❌ DEPLOYMENT FRONTEND GAGAL:", err.message);
  process.exit(1);
});
