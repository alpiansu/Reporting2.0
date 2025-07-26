const express = require("express");
const authRoutes = require("./auth.routes");
const storeRoutes = require("./store.routes");
const screeningRoutes = require("./screening.routes");
const userActivityRoutes = require("./userActivity.routes");
const uploadRoutes = require("./upload.routes");
const { swaggerUi, swaggerSpec } = require("../config/swagger");

const router = express.Router();

// Swagger UI route (gunakan .use agar file static swagger bisa diakses)
router.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
router.use("/api/auth", authRoutes);
router.use("/api/stores", storeRoutes);
router.use("/api/screenings", screeningRoutes);
router.use("/api/user-activities", userActivityRoutes);
router.use("/api/upload", uploadRoutes);

module.exports = router;
