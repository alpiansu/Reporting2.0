/**
 * Encryption/Decryption utility untuk store configs
 *
 * Menggunakan AES-256-GCM (authenticated encryption) dengan
 * PBKDF2 key derivation dari passphrase di .env
 *
 * Format encrypted: base64(salt:iv:authTag:ciphertext)
 */
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import logger from "../config/logger.js";

const ALGORITHM = "aes-256-gcm";
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const SEPARATOR = ":";

/**
 * Derive 32-byte AES key dari passphrase menggunakan PBKDF2
 * @param {string} passphrase - Key dari .env
 * @param {Buffer} salt - Salt untuk key derivation
 * @returns {Buffer} 32-byte derived key
 */
function deriveKey(passphrase, salt) {
  return crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha512");
}

/**
 * Generate fingerprint dari passphrase (untuk verifikasi key)
 * @param {string} passphrase - Key dari .env
 * @returns {string} SHA-256 fingerprint (hex, 16 chars pertama)
 */
export function fingerprint(passphrase) {
  const hash = crypto.createHash("sha256").update(passphrase).digest("hex");
  return hash.substring(0, 16);
}

/**
 * Encrypt plaintext menggunakan AES-256-GCM
 * @param {string} plaintext - Teks yang akan di-encrypt
 * @param {string} passphrase - Key dari .env
 * @returns {string} Encrypted string (base64 format: salt:iv:authTag:ciphertext)
 */
export function encrypt(plaintext, passphrase) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: salt:iv:authTag:ciphertext (all base64)
  const payload = [
    salt.toString("base64"),
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(SEPARATOR);

  return payload;
}

/**
 * Decrypt ciphertext menggunakan AES-256-GCM
 * @param {string} encrypted - Encrypted string (base64 format: salt:iv:authTag:ciphertext)
 * @param {string} passphrase - Key dari .env
 * @returns {string} Decrypted plaintext
 * @throws {Error} Jika key salah atau data corrupt
 */
export function decrypt(encrypted, passphrase) {
  const parts = encrypted.split(SEPARATOR);
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted format: expected 4 parts (salt:iv:authTag:ciphertext)");
  }

  const [saltB64, ivB64, authTagB64, ciphertextB64] = parts;

  const salt = Buffer.from(saltB64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const key = deriveKey(passphrase, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Load dan decrypt store interfence configs dari JSON file
 * @param {string} passphrase - Key dari .env
 * @returns {Promise<Array>} Array of {user, password} objects
 */
export async function loadStoreInterfenceConfigs(passphrase) {
  const filePath = path.join(process.cwd(), "data", "store_interfence_configs.json");

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw);

    // Verifikasi fingerprint
    const currentFingerprint = fingerprint(passphrase);
    if (data.keyFingerprint && data.keyFingerprint !== currentFingerprint) {
      logger.error(
        `[Crypto] Key fingerprint mismatch! Current: ${currentFingerprint}, Expected: ${data.keyFingerprint}. ` +
          `Run: node scripts/re-encrypt-store-configs.js`
      );
      throw new Error(
        "Encryption key mismatch. Data dienkripsi dengan key yang berbeda. " +
          "Jalankan: node scripts/re-encrypt-store-configs.js"
      );
    }

    // Decrypt semua passwords
    const configs = data.configs.map((config) => ({
      user: config.user,
      password: decrypt(config.password, passphrase),
    }));

    logger.info(`[Crypto] Loaded ${configs.length} store interfence configs`);
    return configs;
  } catch (error) {
    if (error.code === "ENOENT") {
      logger.warn(
        `[Crypto] Store interfence config file not found at ${filePath}. No credentials available.`
      );
      return [];
    }
    throw error;
  }
}

/**
 * Encrypt configs dan simpan ke JSON file
 * @param {Array} configs - Array of {user, password} objects (plaintext)
 * @param {string} passphrase - Key dari .env
 * @returns {Promise<void>}
 */
export async function saveStoreInterfenceConfigs(configs, passphrase) {
  const filePath = path.join(process.cwd(), "data", "store_interfence_configs.json");

  const data = {
    version: 1,
    keyFingerprint: fingerprint(passphrase),
    configs: configs.map((config) => ({
      user: config.user,
      password: encrypt(config.password, passphrase),
    })),
  };

  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  logger.info(`[Crypto] Saved ${configs.length} store interfence configs`);
}

/**
 * Re-encrypt configs dengan key baru
 * @param {string} oldPassphrase - Key lama untuk decrypt
 * @param {string} newPassphrase - Key baru untuk encrypt
 * @returns {Promise<{count: number}>} Jumlah configs yang di-re-encrypt
 */
export async function reEncryptStoreInterfenceConfigs(oldPassphrase, newPassphrase) {
  const filePath = path.join(process.cwd(), "data", "store_interfence_configs.json");

  const raw = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(raw);

  // Decrypt dengan key lama
  const configs = data.configs.map((config) => ({
    user: config.user,
    password: decrypt(config.password, oldPassphrase),
  }));

  // Re-encrypt dengan key baru
  const newData = {
    version: 1,
    keyFingerprint: fingerprint(newPassphrase),
    configs: configs.map((config) => ({
      user: config.user,
      password: encrypt(config.password, newPassphrase),
    })),
  };

  await fs.writeFile(filePath, JSON.stringify(newData, null, 2));
  logger.info(`[Crypto] Re-encrypted ${configs.length} store interfence configs with new key`);

  return { count: configs.length };
}
