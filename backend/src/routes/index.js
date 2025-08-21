const express = require("express");
const { swaggerUi, swaggerSpec } = require("../config/swagger");

const router = express.Router();

// Swagger UI route (gunakan .use agar file static swagger bisa diakses)
router.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Note: All routes (auth, store, sync, userActivity, upload) are now handled by their respective modules

module.exports = router;
