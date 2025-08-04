const app = require("./app");
const { sequelize } = require("./models");
const config = require("./config");
const logger = require("./config/logger");
const User = require("./models/user.model");
const cronScheduler = require("./services/cronScheduler");
const storeService = require("./services/storeService");

// Set port
const PORT = config.port;

// Create dummy user
async function createDummyUser() {
  const username = "admin";
  const password = "admin123"; // jangan di-hash manual
  const email = "admin@example.com";

  // Check if user already exists and is active
  const existing = await User.findOne({ where: { username } });
  if (!existing) {
    await User.create({ username, password, email }); // biarkan hook model yang hash
    logger.info("Dummy user created: admin/admin123");
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
    // Connect to database
    await sequelize.authenticate();
    logger.info("Database connection established successfully");

    // Sync database models (in development only)
    if (config.nodeEnv === "development") {
      // Cek dan buat tabel jika belum ada, alter hanya jika field belum ada atau tidak sesuai
      await sequelize.sync({ alter: false }); // Hanya create table jika belum ada
      // Untuk alter, lakukan manual jika ada perubahan model
      // Contoh: await sequelize.getQueryInterface().addColumn('users', 'fieldBaru', { type: Sequelize.STRING });
      logger.info("Database models checked/created (no global alter)");

      // Cek dan alter sales_per_dept agar field sesuai
      const SalesPerDept = require("./models/sales_per_dept.model");
      await SalesPerDept.sync({ alter: true });
      logger.info("sales_per_dept table checked/altered as needed");
    }

    // Create dummy user
    await createDummyUser();

    // Initialize store service and scheduler
    await storeService.init();
    logger.info("Store service initialized successfully");
    await cronScheduler.init();
    logger.info("Store synchronization scheduler started");

    // Start listening for requests
    app.listen(PORT, () => {
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
