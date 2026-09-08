/**
 * Migration script: Re-encrypt store configs dengan key baru
 *
 * Jalankan saat key di .env berubah:
 *   node scripts/re-encrypt-store-configs.js
 *
 * Script ini akan:
 * 1. Membaca encrypted configs dengan key LAMA
 * 2. Decrypt semua passwords
 * 3. Re-encrypt dengan key BARU
 * 4. Menulis ulang ke JSON file
 */
import { reEncryptStoreInterfenceConfigs } from "../src/utils/crypto.utils.js";
import fs from "fs/promises";
import path from "path";
import readline from "readline";
import dotenv from "dotenv";

dotenv.config({ path: path.join(import.meta.dirname, "..", ".env") });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const newPassphrase = process.env.STORE_CONFIG_KEY;
  if (!newPassphrase) {
    console.error("❌ STORE_CONFIG_KEY tidak ditemukan di .env");
    process.exit(1);
  }

  console.log("🔐 Re-encrypt Store Interfence Configs");
  console.log("─".repeat(50));

  // Baca key lama dari file yang ada
  const filePath = path.join(process.cwd(), "data", "store_interfence_configs.json");
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw);
    console.log(`📄 File ditemukan. Fingerprint saat ini: ${data.keyFingerprint}`);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error("❌ File store_interfence_configs.json tidak ditemukan!");
      console.error("   Jalankan setup script terlebih dahulu:");
      console.error("   node scripts/setup-store-interfence-configs.js");
    } else {
      console.error("❌ Error membaca file:", err.message);
    }
    process.exit(1);
  }

  const oldPassphrase = await ask("🔑 Masukkan key LAMA: ");
  if (!oldPassphrase.trim()) {
    console.error("❌ Key lama tidak boleh kosong!");
    process.exit(1);
  }

  console.log(`\n🔄 Re-encrypting dengan key baru...`);

  try {
    const result = await reEncryptStoreInterfenceConfigs(oldPassphrase.trim(), newPassphrase);
    console.log(`✅ Berhasil! ${result.count} configs di-re-encrypt.`);
    console.log(`🔑 Fingerprint baru: (akan ditampilkan saat server start)`);
    console.log("\nSekarang aman untuk restart server.");
  } catch (error) {
    console.error("❌ Gagal re-encrypt:", error.message);
    if (error.message.includes("Unsupported state") || error.message.includes("unable to authenticate")) {
      console.error("   Key lama salah! Data tidak bisa di-decrypt dengan key yang diberikan.");
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  rl.close();
  process.exit(1);
});
