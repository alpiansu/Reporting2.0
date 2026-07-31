import multer from "multer";
import logger from "../../config/logger.js";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
  limits: {
    fileSize: 1 * 1024 * 1024,
  },
});

export const uploadCsv = upload.single("csvFile");

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
