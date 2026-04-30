/**
 * Multer middleware for Import IDT capture image uploads
 * Saves to: public/uploads/ceklist-capture/{kdcab}/
 * Filename format: {kdcab}_{periode}_{timestamp}.{ext}
 */
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base upload directory
const BASE_UPLOAD_DIR = path.join(__dirname, "../../../public/uploads/ceklist-capture");

// Ensure base directory exists at module load
if (!fs.existsSync(BASE_UPLOAD_DIR)) {
  fs.mkdirSync(BASE_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Subfolder per KDCAB for easier management
    const kdcab = req.query?.kdcab || req.body?.kdcab || "unknown";
    const dir = path.join(BASE_UPLOAD_DIR, kdcab);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const kdcab  = req.query?.kdcab  || req.body?.kdcab  || "unknown";
    const periode = req.query?.periode || req.body?.periode || "0000";
    const ts  = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    // e.g. G033_2410_1714385600123.jpg
    cb(null, `${kdcab}_${periode}_${ts}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("File tidak valid. Hanya JPEG, PNG, GIF, dan WebP yang diizinkan."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

export default upload;

/**
 * Helper: get the public URL / relative path of the uploaded file
 * Returns a path like: /uploads/ceklist-capture/{kdcab}/{filename}
 */
export function getCaptureUrl(req) {
  if (!req.file) return null;
  const kdcab   = req.query?.kdcab  || req.body?.kdcab  || "unknown";
  return `/uploads/ceklist-capture/${kdcab}/${req.file.filename}`;
}
