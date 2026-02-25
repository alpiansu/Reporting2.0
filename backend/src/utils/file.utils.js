/**
 * File Utilities for robust file operations
 * Handles atomic writes and retries for Windows file locking issues
 */
import fs from "fs/promises";
import logger from "../config/logger.js";

/**
 * Perform an atomic write with retries
 * @param {string} filePath - Target file path
 * @param {string|Buffer} content - Content to write
 * @param {number} maxRetries - Maximum number of retries
 */
export async function writeAtomicWithRetry(filePath, content, maxRetries = 5) {
  const tempPath = `${filePath}.tmp`;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 1. Write to temporary file
      await fs.writeFile(tempPath, content, "utf8");
      
      // 2. Rename temporary to target (Atomic on POSIX, nearly atomic on Windows)
      await fs.rename(tempPath, filePath);
      
      return true;
    } catch (error) {
      lastError = error;
      
      // Retryable errors on Windows
      const isRetryable = error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EEXIST' || error.code === 'EACCES';
      
      if (isRetryable && attempt < maxRetries) {
        const waitTime = Math.min(100 * Math.pow(2, attempt - 1), 1000) + Math.random() * 50;
        logger.warn(`File busy/locked during write to ${filePath} (${error.code}), retrying attempt ${attempt + 1}/${maxRetries} in ${Math.round(waitTime)}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Read file with retries
 * @param {string} filePath - File path to read
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<string>} File content
 */
export async function readFileWithRetry(filePath, maxRetries = 5) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch (error) {
      lastError = error;
      
      if (error.code === 'ENOENT') {
        throw error; // File not found, no point in retrying
      }

      const isRetryable = error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES';
      
      if (isRetryable && attempt < maxRetries) {
        const waitTime = Math.min(100 * Math.pow(2, attempt - 1), 1000) + Math.random() * 50;
        logger.warn(`File busy/locked during read from ${filePath} (${error.code}), retrying attempt ${attempt + 1}/${maxRetries} in ${Math.round(waitTime)}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
}
