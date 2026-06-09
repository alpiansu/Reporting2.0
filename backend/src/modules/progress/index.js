/**
 * Progress module index
 */
import progressRoutes from "./progress.routes.js";
import progressService from "./progress.service.js";
import { authenticateJWT } from "../../middlewares/index.js";

export default {
  progressRoutes,
  progressService,
  initialize: (app) => {
    // Semua route progress dilindungi JWT agar req.user selalu terisi
    app.use("/api/progress", authenticateJWT, progressRoutes);
    return { progressService };
  },
};
