import app from "./app.js";
import expressApp from "./app.js";
import http from "http";
import config from "./config/index.js";
const { resilientDb } = config;
import logger from "./config/logger.js";
import User from "./models/user.model.js";
import { initializeModels } from "./models/index.js";
// Modules are now initialized in app.js

// Set port
const PORT = config.port;

// Create dummy user
async function createDummyUser() {
  // Default admin credentials - mudah dihapus karena terisolasi di satu tempat
  const defaultAdmin = {
    username: "admin",
    password: "admin123", // jangan di-hash manual
    email: "admin@example.com",
    fullName: "Administrator",
    role: "admin",
  };

  // Check if user already exists and is active
  const existing = await User.findOne({ where: { username: defaultAdmin.username } });
  if (!existing) {
    await User.create(defaultAdmin); // biarkan hook model yang hash
    logger.info(`Dummy user created: ${defaultAdmin.username}/${defaultAdmin.password}`);
  } else {
    // Pastikan user aktif
    if (!existing.isActive) {
      existing.isActive = true;
      await existing.save();
      logger.info("Dummy user re-activated");
    } else {
      logger.info("Dummy user already exists and active");
    }
  }
}

// Start server
async function startServer() {
  try {
    // Try to connect to database (optional for resilient mode)
    try {
      await resilientDb.initialize();
      const sequelize = await resilientDb.getDatabase();
      if (sequelize) {
        logger.info("Database connection established successfully");

        // Initialize all registered models (replaces manual sync)
        if (config.nodeEnv === "development") {
          logger.info("Initializing database models...");
          const initResult = await initializeModels();

          if (initResult.success.length > 0) {
            logger.info(`Successfully initialized models: ${initResult.success.join(", ")}`);
          }

          if (initResult.failed.length > 0) {
            logger.warn(`Failed to initialize models: ${initResult.failed.map(f => f.name).join(", ")}`);
          }

          // Also run sequelize sync for any models not in registry
          await sequelize.sync({ alter: false });
          logger.info("Database models initialization completed");
        }

        // Create dummy user
        await createDummyUser();
      } else {
        logger.warn("Database connection not available");
        logger.info("Server will start in offline mode with limited functionality");
      }
    } catch (dbError) {
      logger.warn(`Database connection failed: ${dbError.message}`);
      logger.info("Server will start in offline mode with limited functionality");
    }

    // Store service and scheduler are now initialized in app.js through modules
    logger.info("Services initialized through module system");

    // Create HTTP server
    const server = http.createServer(expressApp);

    // Start listening for requests
    server.listen(PORT, () => {
      logger.info(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Server startup error: ${error.message}`);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", err => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  // Close server & exit process
  process.exit(1);
});

// Start server
startServer();
