const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

module.exports = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",

  // Database configuration
  database: require("./database"),

  // JWT configuration
  jwt: require("./jwt"),

  // Logger configuration
  logger: require("./logger"),

  // Connection timeout
  connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT) || 30000,

  // CORS configuration
  corsOptions: {
    origin: [process.env.CORS_ORIGIN || "http://localhost:5173", "http://localhost:3001", "http://localhost:5174"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
};
