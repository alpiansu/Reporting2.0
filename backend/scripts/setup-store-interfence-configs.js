/**
 * Setup script: Generate encrypted store_interfence_configs.json
 *
 * Jalankan sekali saja untuk membuat file terenkripsi:
 *   node scripts/setup-store-interfence-configs.js
 *
 * Script ini akan:
 * 1. Mengambil 5 credentials yang sebelumnya hardcoded di db_store.js
 * 2. Meng-encrypt semua password
 * 3. Menyimpan ke data/store_interfence_configs.json
 */
import { encrypt, fingerprint } from "../src/utils/crypto.utils.js";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(import.meta.dirname, "..", ".env") });

const PASSPHRASE = process.env.STORE_CONFIG_KEY;

if (!PASSPHRASE) {
  console.error("❌ STORE_CONFIG_KEY tidak ditemukan di .env");
  console.error("   Tambahkan: STORE_CONFIG_KEY=your-key-here");
  process.exit(1);
}

// 5 credentials yang sebelumnya hardcoded di createDbStoreInterfence()
const plaintextConfigs = [
  {
    user: "kasir",
    password: "YSXmX3Q5qqiW68LgQWQ6j9D2mI2JRvfEU=rH+OeBLr1u",
  },
  {
    user: "kasir",
    password: "HmtPVo5Rf+XCLUdpjRoOF4zSNjegX5qB0=Kh2bF3x+gO",
  },
  {
    user: "kasir",
    password: "ZjHPhpS3T4+YFNh3F94EWJn4m/TeNsBFE=DS0J/Y7Vu4",
  },
  {
    user: "root",
    password: "phha8KKaFMraZOx7X4WYkJRJE6nlIrREM=XeAb9A5JTq",
  },
  {
    user: "root",
    password: "vdhoTZNDyeEcyiAV/5vlUcd6srNsylsVE=U0o+YPeZ/L",
  },
];

async function main() {
  console.log("🔐 Encrypting store interfence configs...\n");

  const data = {
    version: 1,
    keyFingerprint: fingerprint(PASSPHRASE),
    configs: plaintextConfigs.map((config) => ({
      user: config.user,
      password: encrypt(config.password, PASSPHRASE),
    })),
  };

  const filePath = path.join(process.cwd(), "data", "store_interfence_configs.json");
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));

  console.log(`✅ Berhasil! ${data.configs.length} configs terenkripsi.`);
  console.log(`📁 File: ${filePath}`);
  console.log(`🔑 Fingerprint: ${data.keyFingerprint}`);
  console.log("\nSekarang aman untuk menghapus hardcoded credentials dari db_store.js");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
