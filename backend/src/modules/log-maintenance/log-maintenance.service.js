import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { StringDecoder } from "string_decoder";
import dayjs from "dayjs";
import jwt from "jsonwebtoken";
import logger from "../../config/logger.js";
import jwtConfig from "../../config/jwt.js";
import { LOG_MAINTENANCE_CONFIG } from "./log-maintenance.config.js";

const TIMESTAMP_HOUR_PATTERN =
  /"timestamp"\s*:\s*"\d{4}-\d{2}-\d{2}[ T](\d{2}):/;

const createHttpError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

class LogMaintenanceService {
  constructor({ logDir = LOG_MAINTENANCE_CONFIG.logDir } = {}) {
    this.logDir = path.resolve(logDir);
  }

  _validateFilename(filename) {
    if (typeof filename !== "string" || filename.length === 0) {
      throw createHttpError("Nama file log tidak valid", 400);
    }

    if (filename !== path.basename(filename)) {
      throw createHttpError("Nama file log tidak valid", 400);
    }

    if (!LOG_MAINTENANCE_CONFIG.allowedFilenamePattern.test(filename)) {
      throw createHttpError("Nama file log tidak valid", 400);
    }

    const filePath = path.resolve(this.logDir, filename);
    const expectedPrefix = `${this.logDir}${path.sep}`;

    if (!filePath.startsWith(expectedPrefix)) {
      throw createHttpError("Nama file log tidak valid", 400);
    }

    return filePath;
  }

  async _statFile(filePath) {
    try {
      const stats = await fsp.lstat(filePath);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        throw createHttpError("File log tidak ditemukan", 404);
      }
      return stats;
    } catch (error) {
      if (error.statusCode) throw error;
      if (error.code === "ENOENT") {
        throw createHttpError("File log tidak ditemukan", 404);
      }
      throw error;
    }
  }

  async _resolveFile(filename) {
    const filePath = this._validateFilename(filename);
    const stats = await this._statFile(filePath);
    return { filePath, stats };
  }

  _assertSuperadmin(user) {
    if (!user || user.role !== "superadmin") {
      throw createHttpError("Insufficient permissions to manage log files", 403);
    }
  }

  _isActiveFilename(filename) {
    const today = dayjs().format("YYYY-MM-DD");
    return filename === `app-${today}.log` || filename === `error-${today}.log`;
  }

  _assertNotActive(filename) {
    if (this._isActiveFilename(filename)) {
      throw createHttpError(
        "File log aktif hari ini sedang ditulis oleh aplikasi dan tidak dapat dihapus",
        409,
      );
    }
  }

  _mapUnlinkError(error) {
    if (error.code === "ENOENT") {
      return createHttpError("File log tidak ditemukan", 404);
    }
    if (error.code === "EACCES") {
      return createHttpError("Tidak memiliki izin untuk menghapus file log", 403);
    }
    if (error.code === "EBUSY" || error.code === "EPERM") {
      return createHttpError(
        "File log sedang digunakan atau terkunci. Coba lagi setelah proses selesai",
        409,
      );
    }
    return error;
  }

  async listFiles() {
    let entries;

    try {
      entries = await fsp.readdir(this.logDir);
    } catch (error) {
      if (error.code === "ENOENT") {
        return {
          files: [],
          summary: {
            totalFiles: 0,
            totalSize: 0,
            app: { count: 0, size: 0 },
            error: { count: 0, size: 0 },
          },
        };
      }
      throw error;
    }

    const files = [];
    const summary = {
      totalFiles: 0,
      totalSize: 0,
      app: { count: 0, size: 0 },
      error: { count: 0, size: 0 },
    };

    for (const name of entries) {
      if (!LOG_MAINTENANCE_CONFIG.allowedFilenamePattern.test(name)) continue;

      let stats;
      try {
        stats = await fsp.lstat(path.join(this.logDir, name));
      } catch (error) {
        if (error.code === "ENOENT") continue;
        throw error;
      }

      if (!stats.isFile() || stats.isSymbolicLink()) continue;

      const type = name.startsWith("app-") ? "app" : "error";
      const compressed = name.endsWith(".gz");
      const active = this._isActiveFilename(name);

      files.push({
        name,
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        type,
        compressed,
        active,
        deletable: !active,
        previewable: !compressed,
      });

      summary.totalFiles += 1;
      summary.totalSize += stats.size;
      summary[type].count += 1;
      summary[type].size += stats.size;
    }

    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));

    return { files, summary };
  }

  _clampPreviewBytes(maxBytes) {
    const requested = Number(maxBytes);

    if (!Number.isFinite(requested) || requested <= 0) {
      return LOG_MAINTENANCE_CONFIG.defaultPreviewBytes;
    }

    return Math.min(
      Math.max(Math.floor(requested), LOG_MAINTENANCE_CONFIG.minPreviewBytes),
      LOG_MAINTENANCE_CONFIG.maxPreviewBytes,
    );
  }

  _readWindow(filePath, start, end) {
    if (end <= start) return Promise.resolve(Buffer.alloc(0));

    return new Promise((resolve, reject) => {
      const chunks = [];
      const stream = fs.createReadStream(filePath, {
        start,
        end: end - 1,
        highWaterMark: 64 * 1024,
      });

      stream.on("data", chunk => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }

  _parseOffset(value, label, max) {
    if (value === undefined || value === null || value === "") return null;

    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw createHttpError(`${label} tidak valid`, 400);
    }

    return Math.min(Math.floor(parsed), max);
  }

  _assertPreviewable(filename) {
    if (filename.endsWith(".gz")) {
      throw createHttpError(
        "File log sudah dikompres. Preview, timeline, dan pencarian tidak tersedia. Silakan download file",
        415,
      );
    }
  }

  _extractHour(text) {
    const match = TIMESTAMP_HOUR_PATTERN.exec(text);
    if (!match) return null;

    const hour = Number(match[1]);
    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
  }

  _accumulateHourLines(buffer, baseOffset, buckets) {
    let position = 0;

    while (position < buffer.length) {
      const newlineIndex = buffer.indexOf(0x0a, position);
      const isLastLine = newlineIndex === -1;
      const contentEnd = isLastLine ? buffer.length : newlineIndex;
      const lineEnd = isLastLine ? buffer.length : newlineIndex + 1;

      if (contentEnd > position) {
        const text = buffer
          .subarray(position, contentEnd)
          .toString("utf8")
          .replace(/\r$/, "");
        const hour = this._extractHour(text);

        if (hour !== null) {
          const startOffset = baseOffset + position;
          const endOffset = baseOffset + lineEnd;
          const bucket = buckets[hour];

          if (bucket.startOffset === null) bucket.startOffset = startOffset;
          bucket.endOffset = endOffset;
          bucket.lines += 1;
        }
      }

      position = lineEnd;

      if (isLastLine) break;
    }
  }

  async _scanHourIndex(filePath, size) {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      startOffset: null,
      endOffset: null,
      lines: 0,
      bytes: 0,
    }));

    if (size === 0) return { hours: buckets, totalLines: 0 };

    const handle = await fsp.open(filePath, "r");
    let position = 0;
    let carry = Buffer.alloc(0);
    let carryStart = 0;

    try {
      while (position < size) {
        const toRead = Math.min(
          LOG_MAINTENANCE_CONFIG.hourScanChunkBytes,
          size - position,
        );
        const buffer = Buffer.allocUnsafe(toRead);
        const { bytesRead } = await handle.read(buffer, 0, toRead, position);

        if (!bytesRead) break;

        const chunk = bytesRead === toRead ? buffer : buffer.subarray(0, bytesRead);
        const combined = carry.length
          ? Buffer.concat([carry, chunk], carry.length + chunk.length)
          : chunk;
        const combinedStart = carry.length ? carryStart : position;
        const lastNewline = combined.lastIndexOf(0x0a);

        if (lastNewline >= 0) {
          this._accumulateHourLines(
            combined.subarray(0, lastNewline + 1),
            combinedStart,
            buckets,
          );
          carry = Buffer.from(combined.subarray(lastNewline + 1));
          carryStart = combinedStart + lastNewline + 1;
        } else {
          carry = Buffer.from(combined);
          carryStart = combinedStart;
        }

        position += bytesRead;
      }

      if (carry.length) {
        this._accumulateHourLines(carry, carryStart, buckets);
      }
    } finally {
      await handle.close();
    }

    const totalLines = buckets.reduce((total, bucket) => total + bucket.lines, 0);

    for (const bucket of buckets) {
      bucket.bytes =
        bucket.startOffset === null ? 0 : bucket.endOffset - bucket.startOffset;
    }

    return { hours: buckets, totalLines };
  }

  async getHours(filename) {
    const { filePath, stats } = await this._resolveFile(filename);
    this._assertPreviewable(filename);

    const { hours, totalLines } = await this._scanHourIndex(filePath, stats.size);

    return {
      filename,
      size: stats.size,
      totalLines,
      hours,
    };
  }

  async getChunk(filename, { cursor, maxBytes, startOffset, endOffset } = {}) {
    const { filePath, stats } = await this._resolveFile(filename);
    this._assertPreviewable(filename);

    const size = stats.size;
    const rangeStart = this._parseOffset(startOffset, "Awal rentang log", size) ?? 0;
    const rangeEnd = this._parseOffset(endOffset, "Akhir rentang log", size) ?? size;

    if (rangeStart > rangeEnd) {
      throw createHttpError("Rentang log tidak valid", 400);
    }

    const emptyResult = {
      filename,
      text: "",
      startOffset: rangeStart,
      endOffset: rangeStart,
      nextCursor: rangeStart,
      hasMore: false,
      lineAligned: true,
      size,
      rangeStart,
      rangeEnd,
    };

    if (size === 0 || rangeStart === rangeEnd) return emptyResult;

    let end = rangeEnd;

    if (cursor !== undefined && cursor !== null && cursor !== "") {
      const parsedCursor = Number(cursor);

      if (!Number.isFinite(parsedCursor) || parsedCursor < 0) {
        throw createHttpError("Cursor log tidak valid", 400);
      }

      end = Math.min(Math.floor(parsedCursor), rangeEnd);
    }

    if (end <= rangeStart) return emptyResult;

    const limit = this._clampPreviewBytes(maxBytes);
    const start = Math.max(rangeStart, end - limit);
    const buffer = await this._readWindow(filePath, start, end);

    let contentStart = 0;
    let lineAligned = start === rangeStart;

    if (start > rangeStart) {
      const newlineIndex = buffer.indexOf(0x0a);

      if (newlineIndex >= 0 && start + newlineIndex + 1 < end) {
        contentStart = newlineIndex + 1;
        lineAligned = true;
      } else {
        lineAligned = false;
      }
    }

    const returnedStart = start + contentStart;
    const textBuffer = buffer.subarray(contentStart);
    const decoder = new StringDecoder("utf8");
    let text = decoder.write(textBuffer);

    if (end >= size) {
      text += decoder.end();
    }

    return {
      filename,
      text,
      startOffset: returnedStart,
      endOffset: end,
      nextCursor: returnedStart,
      hasMore: returnedStart > rangeStart,
      lineAligned,
      size,
      rangeStart,
      rangeEnd,
    };
  }

  _parseLogMetadata(raw) {
    let parsed = null;

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    const timestamp =
      typeof parsed?.timestamp === "string" ? parsed.timestamp : null;
    const level = typeof parsed?.level === "string" ? parsed.level : null;
    const message =
      typeof parsed?.message === "string" ? parsed.message : raw;
    const hour = timestamp ? this._extractHour(raw) : null;

    return {
      timestamp,
      level,
      hour,
      message:
        message.length > 2000 ? `${message.slice(0, 1997)}...` : message,
    };
  }

  _collectSearchLines(buffer, baseOffset, needle, remaining, skipFirstPartial) {
    const results = [];
    let firstCompleteOffset = 0;
    let olderBoundary = baseOffset;

    if (skipFirstPartial) {
      const newlineIndex = buffer.indexOf(0x0a);

      if (newlineIndex === -1) {
        return {
          results,
          nextCursor: baseOffset,
          stoppedAtLimit: false,
        };
      }

      firstCompleteOffset = newlineIndex + 1;
      olderBoundary = baseOffset + firstCompleteOffset;
    }

    const lines = [];
    let position = firstCompleteOffset;

    while (position < buffer.length) {
      const newlineIndex = buffer.indexOf(0x0a, position);
      const isLastLine = newlineIndex === -1;
      const contentEnd = isLastLine ? buffer.length : newlineIndex;
      const lineEnd = isLastLine ? buffer.length : newlineIndex + 1;
      const raw = buffer
        .subarray(position, contentEnd)
        .toString("utf8")
        .replace(/\r$/, "");

      if (raw) {
        lines.push({
          start: baseOffset + position,
          end: baseOffset + lineEnd,
          raw,
        });
      }

      position = lineEnd;

      if (isLastLine) break;
    }

    let nextCursor = olderBoundary;

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index];

      if (line.raw.toLowerCase().includes(needle)) {
        results.push({
          ...this._parseLogMetadata(line.raw),
          offset: line.start,
          endOffset: line.end,
        });

        if (results.length >= remaining) {
          nextCursor = line.start;
          return {
            results,
            nextCursor,
            stoppedAtLimit: true,
          };
        }
      }
    }

    return {
      results,
      nextCursor,
      stoppedAtLimit: false,
    };
  }

  async search(filename, { q, cursor, limit, maxScanBytes } = {}) {
    const { filePath, stats } = await this._resolveFile(filename);
    this._assertPreviewable(filename);

    const query = typeof q === "string" ? q.trim() : "";

    if (query.length < 2) {
      throw createHttpError("Kata kunci pencarian minimal 2 karakter", 400);
    }

    if (query.length > LOG_MAINTENANCE_CONFIG.searchMaxQueryLength) {
      throw createHttpError(
        `Kata kunci maksimal ${LOG_MAINTENANCE_CONFIG.searchMaxQueryLength} karakter`,
        400,
      );
    }

    const size = stats.size;
    let end = size;

    if (cursor !== undefined && cursor !== null && cursor !== "") {
      const parsedCursor = Number(cursor);

      if (!Number.isFinite(parsedCursor) || parsedCursor < 0) {
        throw createHttpError("Cursor pencarian tidak valid", 400);
      }

      end = Math.min(Math.floor(parsedCursor), size);
    }

    const requestedLimit = Number(limit);
    const maxResults =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), LOG_MAINTENANCE_CONFIG.searchMaxResults)
        : LOG_MAINTENANCE_CONFIG.searchMaxResults;
    const requestedScan = Number(maxScanBytes);
    const scanBudget =
      Number.isFinite(requestedScan) && requestedScan > 0
        ? Math.min(
            Math.max(Math.floor(requestedScan), 64 * 1024),
            LOG_MAINTENANCE_CONFIG.searchMaxScanBytes,
          )
        : LOG_MAINTENANCE_CONFIG.searchMaxScanBytes;
    const needle = query.toLowerCase();
    const results = [];
    let scannedBytes = 0;
    let nextCursor = end;

    while (scannedBytes < scanBudget && end > 0 && results.length < maxResults) {
      const readSize = Math.min(
        LOG_MAINTENANCE_CONFIG.searchWindowBytes,
        scanBudget - scannedBytes,
      );
      const readStart = Math.max(0, end - readSize);
      const buffer = await this._readWindow(filePath, readStart, end);

      if (buffer.length === 0) {
        nextCursor = 0;
        break;
      }

      let skipFirstPartial = false;

      if (readStart > 0) {
        const previousByte = await this._readWindow(
          filePath,
          readStart - 1,
          readStart,
        );
        skipFirstPartial =
          previousByte.length > 0 && previousByte[0] !== 0x0a;
      }

      scannedBytes += buffer.length;

      const windowResult = this._collectSearchLines(
        buffer,
        readStart,
        needle,
        maxResults - results.length,
        skipFirstPartial,
      );

      results.push(...windowResult.results);
      nextCursor = windowResult.nextCursor;

      if (windowResult.stoppedAtLimit) break;

      end = nextCursor;
    }

    return {
      query,
      results,
      nextCursor,
      hasMore: nextCursor > 0,
      scannedBytes,
      size,
    };
  }

  async createDownloadTicket(filename, user) {
    this._assertSuperadmin(user);

    await this._resolveFile(filename);

    const ticket = jwt.sign(
      {
        purpose: LOG_MAINTENANCE_CONFIG.downloadTicketPurpose,
        filename,
        role: user.role,
        sub: user.id,
      },
      jwtConfig.JWT_SECRET,
      { expiresIn: LOG_MAINTENANCE_CONFIG.downloadTicketTtlSeconds },
    );

    return {
      ticket,
      expiresIn: LOG_MAINTENANCE_CONFIG.downloadTicketTtlSeconds,
    };
  }

  async getDownloadTarget(ticket) {
    if (typeof ticket !== "string" || ticket.length === 0) {
      throw createHttpError("Ticket download tidak valid", 401);
    }

    let decoded;

    try {
      decoded = jwt.verify(ticket, jwtConfig.JWT_SECRET);
    } catch (error) {
      throw createHttpError("Ticket download tidak valid atau sudah kedaluwarsa", 401);
    }

    if (
      decoded.purpose !== LOG_MAINTENANCE_CONFIG.downloadTicketPurpose ||
      decoded.role !== "superadmin" ||
      typeof decoded.filename !== "string"
    ) {
      throw createHttpError("Ticket download tidak valid", 401);
    }

    const { filePath, stats } = await this._resolveFile(decoded.filename);

    return {
      filePath,
      filename: decoded.filename,
      size: stats.size,
    };
  }

  async _deleteOne(filename, user, ip) {
    const filePath = this._validateFilename(filename);
    this._assertNotActive(filename);

    const stats = await this._statFile(filePath);

    try {
      await fsp.unlink(filePath);
    } catch (error) {
      throw this._mapUnlinkError(error);
    }

    logger.info(
      `[log-maintenance] Deleted ${filename} (${stats.size} bytes) by ${user?.username || "unknown"} from ${ip || "-"}`,
    );

    return {
      filename,
      size: stats.size,
      deletedAt: new Date().toISOString(),
    };
  }

  async deleteFile(filename, user, { ip } = {}) {
    this._assertSuperadmin(user);

    return this._deleteOne(filename, user, ip);
  }

  async bulkDelete(filenames, user, { ip } = {}) {
    this._assertSuperadmin(user);

    if (!Array.isArray(filenames) || filenames.length === 0) {
      throw createHttpError("Daftar file log wajib diisi", 400);
    }

    const uniqueFilenames = [...new Set(filenames.filter(name => typeof name === "string"))];

    if (uniqueFilenames.length === 0) {
      throw createHttpError("Daftar file log wajib diisi", 400);
    }

    if (uniqueFilenames.length > LOG_MAINTENANCE_CONFIG.maxBulkDelete) {
      throw createHttpError(
        `Maksimal ${LOG_MAINTENANCE_CONFIG.maxBulkDelete} file per permintaan`,
        400,
      );
    }

    const result = {
      deleted: [],
      skipped: [],
      failed: [],
    };

    for (const filename of uniqueFilenames) {
      try {
        const deleted = await this._deleteOne(filename, user, ip);
        result.deleted.push(deleted);
      } catch (error) {
        const item = { filename, reason: error.message };

        if (error.statusCode && error.statusCode < 500) {
          result.skipped.push(item);
        } else {
          result.failed.push(item);
        }
      }
    }

    return result;
  }
}

export default LogMaintenanceService;
