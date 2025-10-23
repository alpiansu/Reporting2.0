/**
 * Progress module index
 */
import progressRoutes from "./progress.routes.js";
import progressService from "./progress.service.js";

export default {
  progressRoutes,
  progressService,
  initialize: app => {
    // Register route for SSE streaming
    app.use("/api/progress", progressRoutes);
    return { progressService };
  },
};
