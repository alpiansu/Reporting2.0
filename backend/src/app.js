import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import routes from "./routes/index.js";
import modules from "./modules/index.js";
import { requestLogger, errorHandler, notFound, databaseErrorHandler, addDatabaseStatus } from "./middlewares/index.js";
import config from "./config/index.js";
import resilientDb from "./config/resilient-database.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();

// Enable trust proxy to get real client IP when behind proxy/load balancer
app.set("trust proxy", true);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS middleware
app.use(cors(config.corsOptions));

// Serve static files for uploads (per folder)
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));

// Request parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use(requestLogger);

// Database status middleware
app.use(addDatabaseStatus);

// Initialize resilient database
resilientDb.initialize();

// Initialize modules
modules.initialize(app);

// API routes (for routes not handled by modules)
app.use(routes);

// 404 handler
app.use(notFound);

// Database error handler (before general error handler)
app.use(databaseErrorHandler);

// Error handler
app.use(errorHandler);

export default app;
