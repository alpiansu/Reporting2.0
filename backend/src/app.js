const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const routes = require("./routes");
const modules = require("./modules");
const { requestLogger, errorHandler, notFound } = require("./middlewares");
const config = require("./config");

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

// Initialize modules
const initializedModules = modules.initialize(app);

// API routes (for routes not handled by modules)
app.use(routes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

module.exports = app;
