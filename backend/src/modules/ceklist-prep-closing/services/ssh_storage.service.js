/**
 * SSH Storage Service for Ceklist Prepare Closing
 * Executes remote disk space check via SSH on Linux servers using ssh2
 */
import { Client } from "ssh2";
import logger from "../../../config/logger.js";
import ceklistPanduanService from "../../ceklist_panduan/ceklist_panduan.service.js";
import spaceHddService from "./space_hdd.service.js";

/**
 * Extract target mount path from HDD_CHECK string if present.
 * Examples:
 *  "df -h /home, min 50 GB (datadir /home/data/mysql/, mysql57)" -> "/home"
 *  "df -h /home (centos-home)" -> "/home"
 *  "df -h /home/home_lama" -> "/home/home_lama"
 *  "df -h /dev/sda1, min 100 GB" -> "/dev/sda1"
 *  "df -h /dev/mapper/centos-home" -> "/dev/mapper/centos-home"
 *
 * @param {string} hddCheckText
 * @returns {string}
 */
export function extractDefaultPath(hddCheckText) {
  if (!hddCheckText || typeof hddCheckText !== "string") return "/home";
  const trimmed = hddCheckText.trim();

  // Pattern: df -[hHkKmMbB...]* <path>
  const match = trimmed.match(/df\s+-[a-zA-Z0-9]+\s+([/a-zA-Z0-9_.-]+)/i);
  if (match && match[1]) {
    // Strip trailing commas, colons, or parentheses
    return match[1].replace(/[,):;]+$/, "").trim();
  }

  // Common fallbacks by keywords
  if (trimmed.includes("/home/home_lama")) return "/home/home_lama";
  if (trimmed.includes("/home")) return "/home";
  if (trimmed.includes("/dev/mapper/centos-home")) return "/dev/mapper/centos-home";
  if (trimmed.includes("/dev/sda1")) return "/dev/sda1";

  return "/home";
}

/**
 * Parse POSIX standard `df -P` output lines into structured objects.
 * Format of each data line:
 * Filesystem 1048576-blocks Used Available Capacity Mounted on
 *
 * @param {string} stdout
 * @returns {Array<{ filesystem: string, totalMb: number, usedMb: number, availMb: number, availGb: number, freeSpaceStr: string, capacity: string, mountedOn: string }>}
 */
export function parseDfOutput(stdout) {
  if (!stdout || typeof stdout !== "string") return [];
  const lines = stdout.trim().split(/\r?\n/);
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length >= 6) {
      const filesystem = parts[0];
      const totalMb = parseInt(parts[1], 10) || 0;
      const usedMb = parseInt(parts[2], 10) || 0;
      const availMb = parseInt(parts[3], 10) || 0;
      const capacity = parts[4];
      const mountedOn = parts.slice(5).join(" "); // handles mount paths with spaces
      const availGb = parseFloat((availMb / 1024).toFixed(1));
      const freeSpaceStr = `${availGb} GB`;

      results.push({
        filesystem,
        totalMb,
        size: totalMb,
        usedMb,
        used: usedMb,
        availMb,
        available: availMb,
        availGb,
        freeSpaceStr,
        capacity,
        mountedOn,
        mounted: mountedOn,
      });
    }
  }

  return results;
}

class SshStorageService {
  /**
   * Execute an SSH command with timeout and return stdout/stderr
   * Never logs passwords.
   *
   * @param {Object} opts
   * @param {string} opts.ip
   * @param {number} [opts.port=22]
   * @param {string} opts.username
   * @param {string} opts.password
   * @param {string} opts.command
   * @param {number} [opts.timeoutMs=8000]
   * @returns {Promise<{ stdout: string, stderr: string, code: number }>}
   */
  async executeSshCommand({ ip, port = 22, username, password, command, timeoutMs = 8000 }) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let isSettled = false;

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try {
            conn.end();
            conn.destroy();
          } catch (_) {}
          reject(new Error(`Koneksi SSH ke ${ip}:${port} timeout (${timeoutMs / 1000}s). Pastikan VPN/server aktif.`));
        }
      }, timeoutMs);

      conn.on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            if (!isSettled) {
              isSettled = true;
              clearTimeout(timer);
              conn.end();
              reject(err);
            }
            return;
          }

          let stdout = "";
          let stderr = "";

          stream.on("data", chunk => {
            stdout += chunk.toString("utf8");
          });

          stream.stderr.on("data", chunk => {
            stderr += chunk.toString("utf8");
          });

          stream.on("close", code => {
            if (!isSettled) {
              isSettled = true;
              clearTimeout(timer);
              conn.end();
              resolve({ stdout, stderr, code: code ?? 0 });
            }
          });
        });
      });

      conn.on("error", err => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          reject(new Error(`Gagal terhubung ke ${ip}:${port} (${err.message})`));
        }
      });

      try {
        conn.connect({
          host: ip,
          port,
          username,
          password,
          readyTimeout: timeoutMs,
          algorithms: {
            serverHostKey: [
              "ssh-rsa",
              "ssh-dss",
              "ecdsa-sha2-nistp256",
              "ecdsa-sha2-nistp384",
              "ecdsa-sha2-nistp521",
              "rsa-sha2-512",
              "rsa-sha2-256",
              "ssh-ed25519",
            ],
          },
        });
      } catch (err) {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          reject(err);
        }
      }
    });
  }

  /**
   * Check storage via SSH for a single branch.
   * Allows dynamic path override: if targetPath is provided, queries that path.
   * If omitted, falls back to default parsed from panduan.HDD_CHECK.
   * Updates ceklist_space_hdd record automatically.
   *
   * @param {Object} params
   * @param {string} params.kdcab        e.g. "G107"
   * @param {string} params.periode      e.g. "2610"
   * @param {string} [params.targetPath] optional dynamic path override e.g. "/home"
   * @returns {Promise<Object>}
   */
  async checkStorage({ kdcab, periode, targetPath }) {
    if (!kdcab || !periode) throw new Error("kdcab dan periode wajib diisi");

    logger.info(`[ssh_storage.service] checkStorage kdcab=${kdcab} periode=${periode} targetPath=${targetPath || "(default)"}`);

    const panduan = await (ceklistPanduanService.getByKdcab ? ceklistPanduanService.getByKdcab(kdcab) : ceklistPanduanService.getOne(kdcab));
    if (!panduan) {
      throw new Error(`Data panduan untuk cabang ${kdcab} tidak ditemukan.`);
    }

    const isSsh = String(panduan.REMOTE_BULANAN || "").toUpperCase().includes("SSH") ||
                  String(panduan.OS || "").toUpperCase() === "LINUX";

    if (!isSsh) {
      throw new Error(`Cabang ${kdcab} (${panduan.NAMACAB}) tidak menggunakan SSH (OS: ${panduan.OS}, Remote: ${panduan.REMOTE_BULANAN}). Gunakan input manual.`);
    }

    if (!panduan.IP_BULANAN) {
      throw new Error(`IP_BULANAN untuk cabang ${kdcab} belum diisi di panduan.`);
    }
    if (!panduan.USER_BULANAN) {
      throw new Error(`USER_BULANAN untuk cabang ${kdcab} belum diisi di panduan.`);
    }
    if (!panduan.PASS_BULANAN) {
      throw new Error(`PASS_BULANAN untuk cabang ${kdcab} belum diisi di panduan.`);
    }

    const port = parseInt(panduan.PORT_BULANAN, 10) || 22;
    const defaultPath = extractDefaultPath(panduan.HDD_CHECK);
    const pathToQuery = (targetPath && typeof targetPath === "string" && targetPath.trim())
      ? targetPath.trim()
      : defaultPath;

    // Use POSIX standard df with block size 1MB (1048576 bytes)
    const command = `df -P -B1048576 "${pathToQuery}"`;

    let execResult;
    let actualPathChecked = pathToQuery;

    try {
      execResult = await this.executeSshCommand({
        ip: panduan.IP_BULANAN,
        port,
        username: panduan.USER_BULANAN,
        password: panduan.PASS_BULANAN,
        command,
      });
    } catch (err) {
      logger.warn(`[ssh_storage.service] SSH check failed for ${kdcab} on ${pathToQuery}: ${err.message}`);
      throw err;
    }

    let parsed = parseDfOutput(execResult.stdout);

    // Fallback: if the specific target path was invalid or returned empty, try fallback to /home or /
    if (parsed.length === 0 && pathToQuery !== "/home" && pathToQuery !== "/") {
      logger.warn(`[ssh_storage.service] Output empty for ${pathToQuery}, trying fallback to /home for ${kdcab}`);
      try {
        const fallbackCmd = `df -P -B1048576 /home`;
        const fbResult = await this.executeSshCommand({
          ip: panduan.IP_BULANAN,
          port,
          username: panduan.USER_BULANAN,
          password: panduan.PASS_BULANAN,
          command: fallbackCmd,
        });
        parsed = parseDfOutput(fbResult.stdout);
        if (parsed.length > 0) {
          actualPathChecked = "/home";
        }
      } catch (_) {}
    }

    if (parsed.length === 0) {
      throw new Error(`Tidak dapat membaca output df dari server ${kdcab} (${panduan.IP_BULANAN}). Output: ${execResult.stdout || execResult.stderr}`);
    }

    // Match the target path against mountedOn or filesystem, or fall back to first row
    const diskDetail = parsed.find(m =>
      m.mountedOn === actualPathChecked ||
      m.filesystem === actualPathChecked ||
      (m.mountedOn !== "/" && actualPathChecked.startsWith(m.mountedOn))
    ) || parsed[0];
    const freeSpaceStr = diskDetail.freeSpaceStr;

    // Today's date YYYY-MM-DD
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Auto-update central database ceklist_space_hdd
    const updatedRecord = await spaceHddService.upsert({
      kdcab,
      ip: panduan.IP_BULANAN,
      periode,
      freeSpace: freeSpaceStr,
      tglCheck: todayStr,
      os: "LINUX",
    });

    logger.info(`[ssh_storage.service] checkStorage success for ${kdcab}: ${freeSpaceStr} on ${actualPathChecked}`);

    return {
      success: true,
      kdcab,
      namacab: panduan.NAMACAB,
      ip: panduan.IP_BULANAN,
      periode,
      pathChecked: actualPathChecked,
      targetPath: actualPathChecked,
      matchedMount: diskDetail.mountedOn || diskDetail.mounted,
      defaultPath,
      freeSpace: freeSpaceStr,
      tglCheck: todayStr,
      diskDetail,
      details: {
        filesystem: diskDetail.filesystem,
        sizeMb: diskDetail.totalMb,
        usedMb: diskDetail.usedMb,
        availMb: diskDetail.availMb,
        usePercent: diskDetail.capacity,
      },
      record: updatedRecord,
    };
  }

  /**
   * List all mounted filesystems from remote server via SSH.
   * Useful for dynamic mount selection on the frontend.
   *
   * @param {string} kdcab
   * @returns {Promise<Array<Object>>}
   */
  async listMounts(kdcab) {
    if (!kdcab) throw new Error("kdcab wajib diisi");

    const panduan = await (ceklistPanduanService.getByKdcab ? ceklistPanduanService.getByKdcab(kdcab) : ceklistPanduanService.getOne(kdcab));
    if (!panduan) throw new Error(`Data panduan untuk cabang ${kdcab} tidak ditemukan.`);

    const isSsh = String(panduan.REMOTE_BULANAN || "").toUpperCase().includes("SSH") ||
                  String(panduan.OS || "").toUpperCase() === "LINUX";

    if (!isSsh) {
      throw new Error(`Cabang ${kdcab} tidak menggunakan SSH.`);
    }

    const port = parseInt(panduan.PORT_BULANAN, 10) || 22;
    const { stdout } = await this.executeSshCommand({
      ip: panduan.IP_BULANAN,
      port,
      username: panduan.USER_BULANAN,
      password: panduan.PASS_BULANAN,
      command: "df -P -B1048576",
    });

    return parseDfOutput(stdout);
  }

  /**
   * Batch check storage for all SSH-enabled branches.
   * Runs with concurrency limit of 2 to avoid network congestion.
   *
   * @param {string} periode
   * @returns {Promise<{ total: number, successCount: number, failedCount: number, results: Array<Object> }>}
   */
  async checkBatchStorage(periode) {
    if (!periode) throw new Error("periode wajib diisi");

    const allPanduan = await ceklistPanduanService.getAll();
    const sshBranches = allPanduan.filter(p =>
      String(p.REMOTE_BULANAN || "").toUpperCase().includes("SSH") ||
      String(p.OS || "").toUpperCase() === "LINUX"
    );

    if (sshBranches.length === 0) {
      return { total: 0, successCount: 0, failedCount: 0, results: [] };
    }

    const concurrency = 2;
    const results = [];
    const pool = new Set();

    for (const p of sshBranches) {
      const task = (async () => {
        try {
          const res = await this.checkStorage({ kdcab: p.KDCAB, periode });
          return { kdcab: p.KDCAB, success: true, ...res };
        } catch (err) {
          logger.warn(`[ssh_storage.service] Batch check failed for ${p.KDCAB}: ${err.message}`);
          return { kdcab: p.KDCAB, success: false, error: err.message };
        }
      })();

      results.push(task);
      pool.add(task);
      const clean = () => pool.delete(task);
      task.then(clean, clean);

      if (pool.size >= concurrency) {
        await Promise.race(pool);
      }
    }

    const executedResults = await Promise.all(results);
    const successCount = executedResults.filter(r => r.success).length;
    const failedCount = executedResults.filter(r => !r.success).length;

    return {
      total: sshBranches.length,
      successCount,
      failedCount,
      results: executedResults,
    };
  }

  extractDefaultPath(text) {
    return extractDefaultPath(text);
  }

  parseDfOutput(stdout) {
    return parseDfOutput(stdout);
  }
}

export default new SshStorageService();
