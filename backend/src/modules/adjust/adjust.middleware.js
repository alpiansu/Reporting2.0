import multer from "multer";
import logger from "../../config/logger.js";

// Configure multer for memory storage
const storage = multer.memoryStorage();

// Create multer instance with file filter for CSV
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept only CSV files
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
  limits: {
    fileSize: 1024 * 1024 * 5, // 5MB limit
  },
});

// Error handling middleware for multer
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error(`Multer error: ${err.message}`);
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
    });
  } else if (err) {
    logger.error(`File upload error: ${err.message}`);
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

export const uploadCsv = upload.single("file");
