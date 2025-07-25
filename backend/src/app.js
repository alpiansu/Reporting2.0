const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const routes = require("./routes");
const { requestLogger, errorHandler, notFound } = require("./middlewares");
const config = require("./config");

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS middleware
app.use(cors(config.corsOptions));

// Request parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use(requestLogger);

// API routes
app.use(routes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

module.exports = app;
