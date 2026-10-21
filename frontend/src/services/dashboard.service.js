import api from "./api";

class DashboardService {
  async getStats() {
    try {
      const response = await api.get("/dashboard/stats");
      return response.data;
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      throw error;
    }
  }

  async getRecentActivity() {
    try {
      const response = await api.get("/dashboard/recent-activity");
      return response.data;
    } catch (error) {
      console.error("Error fetching dashboard activity:", error);
      throw error;
    }
  }

  async getFollowUpResume(periode) {
    try {
      const response = await api.get("/dashboard/followup-resume", {
        params: periode ? { periode } : {},
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching dashboard followup resume:", error);
      throw error;
    }
  }
}

export default new DashboardService();
