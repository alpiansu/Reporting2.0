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

  async getFollowUpResume(req, res) {
    try {
      const { periode } = req.query;
      const resume = await dashboardService.getFollowUpResume(periode);
      res.json(resume);
    } catch (error) {
      logger.error(`Error in getFollowUpResume controller: ${error.message}`);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default new DashboardController();
