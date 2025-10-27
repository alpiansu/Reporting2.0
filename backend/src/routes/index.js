import express from "express";
import progressRoutes from "./progress.routes.js";
import { authenticateJWT } from "../middlewares/index.js";
import modules from "../modules/index.js";

const router = express.Router();

// Global progress routes
router.use("/api/progress", authenticateJWT, progressRoutes);

// Daftar module terdaftar
router.get("/api/modules", authenticateJWT, (req, res) => {
  try {
    // Ambil semua properti dari modules, kecuali 'initialize'
    const availableModules = Object.keys(modules).filter(key => key !== "initialize");

    // Bersihkan suffix "Module" biar rapi
    const cleanNames = availableModules.map(name => name.replace(/Module$/, ""));

    // Ubah jadi bentuk "Camel Case" → "Camel Case"
    const formattedNames = cleanNames.map(name => {
      // Pisahkan berdasarkan huruf besar, lalu kapitalisasi awal kata
      const words = name.replace(/([A-Z])/g, " $1").trim();
      return words
        .split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    });

    res.json({
      count: cleanNames.length,
      modules: cleanNames,
      module_names: formattedNames,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Note: All other routes (auth, store, sync, userActivity, upload) are now handled by their respective modules

export default router;
