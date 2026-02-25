import dashboardService from "./dashboard.service.js";
import logger from "../../config/logger.js";

class DashboardController {
  async getStats(req, res) {
    try {
      const stats = await dashboardService.getStats();
      res.json(stats);
    } catch (error) {
      logger.error(`Error in getStats controller: ${error.message}`);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async getRecentActivity(req, res) {
    try {
      const activity = await dashboardService.getRecentActivity();
      res.json(activity);
    } catch (error) {
      logger.error(`Error in getRecentActivity controller: ${error.message}`);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default new DashboardController();
