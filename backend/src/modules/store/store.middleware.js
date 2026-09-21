import multer from "multer";
import logger from "../../config/logger.js";

// Configure multer for memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept INI/TXT and CSV files
    const name = (file.originalname || "").toLowerCase();
    if (name.endsWith(".ini") || name.endsWith(".txt") || name.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file INI/TXT/CSV yang diperbolehkan"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error(`Multer error: ${err.message}`);
    return res.status(400).json({ success: false, message: `File upload error: ${err.message}` });
  } else if (err) {
    logger.error(`File upload error: ${err.message}`);
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

export const uploadIni = upload.single("file");
export const uploadCsv = upload.single("file");