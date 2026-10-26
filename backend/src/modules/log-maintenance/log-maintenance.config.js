import { logDir } from "../../config/logger.js";

export const LOG_MAINTENANCE_CONFIG = Object.freeze({
  logDir,
  allowedFilenamePattern: /^(app|error)-\d{4}-\d{2}-\d{2}\.log(?:\.\d+)?(?:\.gz)?$/,
  defaultPreviewBytes: 256 * 1024,
  minPreviewBytes: 4 * 1024,
  maxPreviewBytes: 1024 * 1024,
  hourScanChunkBytes: 1024 * 1024,
  searchWindowBytes: 1024 * 1024,
  searchMaxScanBytes: 2 * 1024 * 1024,
  searchMaxResults: 50,
  searchMaxQueryLength: 200,
  maxBulkDelete: 100,
  downloadTicketTtlSeconds: 60,
  downloadTicketPurpose: "log-maintenance-download",
});
