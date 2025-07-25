const express = require("express");
const authRoutes = require("./auth.routes");
const storeRoutes = require("./store.routes");
const screeningRoutes = require("./screening.routes");
const { swaggerUi, swaggerSpec } = require("../config/swagger");

const router = express.Router();

// Swagger UI route (harus di atas semua route /api/* agar file static swagger tidak bentrok)
router.use("/api", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
router.use("/api/auth", authRoutes);
router.use("/api/stores", storeRoutes);
router.use("/api/screenings", screeningRoutes);

module.exports = router;
