const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

const allowedOrigins = ["http://localhost", "http://192.168.61.228", "http://192.168.133.10"];

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
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow non-browser tools (Postman, curl, etc)
      console.log("origin", origin);
      // cek apakah origin ada di whitelist (mulai dengan localhost atau 192.168.61.228)
      if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
        return callback(null, true);
      } else {
        console.warn(`Blocked by CORS: ${origin}`);
        return callback(null, false); // tolak tanpa throw error
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
};
