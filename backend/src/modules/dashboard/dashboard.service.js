import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";

class DashboardService {
  constructor() {
    this.dataDir = path.join(process.cwd(), "data");
  }

  async readJsonFile(filename) {
    try {
      const filePath = path.join(this.dataDir, filename);
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      logger.error(`Error reading ${filename}: ${error.message}`);
      return [];
    }
  }

  async getStats() {
    try {
      const stores = await this.readJsonFile("stores.json");
      const penyesuaian = await this.readJsonFile("penyesuaian.json");
      const rekonSales = await this.readJsonFile("rekon_sales.json");
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      // Count unique INDUK stores by storeCode
      const uniqueStoreCodes = new Set(
        stores.filter(s => s.notes === "INDUK").map(s => s.storeCode)
      );
      const totalStores = uniqueStoreCodes.size;

      const syncedToday = stores.filter(s => {
        const upd = new Date(s.updtime || s.updatedAt).getTime();
        return upd >= today && s.notes === "INDUK";
      }).length;

      const needsAttention = totalStores - syncedToday;

      return {
        totalStores,
        totalPenyesuaian: penyesuaian.length,
        totalRekonSales: rekonSales.length,
        syncedToday,
        needsAttention,
        lastSync: stores.length > 0 ? stores[0].updtime : null,
      };
    } catch (error) {
      logger.error(`Dashboard stats failed: ${error.message}`);
      throw error;
    }
  }

  async getRecentActivity() {
    try {
      // In this system, user activities are stored per user in a directory usually
      // or in user-activities.json if aggregated.
      // Based on my previous `ls`, there is a `user-activities.json` but 
      // UserActivityService said it stores in `data/user-activities.json` as a DIR?
      // Wait, let's re-verify UserActivityService constructor.
      /*
      12:     this.dataDir = path.join(process.cwd(), "data/user-activities.json");
      ...
      51:     return path.join(this.dataDir, `user-${userId}-activities.json`);
      */
      // So `data/user-activities.json` is a DIRECTORY.
      
      const activityDir = path.join(this.dataDir, "user-activities.json");
      let allActivities = [];
      
      try {
        const files = await fs.readdir(activityDir);
        for (const file of files) {
          if (file.endsWith("-activities.json")) {
            const content = await fs.readFile(path.join(activityDir, file), "utf8");
            const activities = JSON.parse(content);
            allActivities = allActivities.concat(activities);
          }
        }
      } catch (error) {
        logger.warn(`Could not read user activities directory: ${error.message}`);
      }

      // Sort by date descending
      allActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return allActivities.slice(0, 10);
    } catch (error) {
      logger.error(`Dashboard recent activity failed: ${error.message}`);
      return [];
    }
  }
}

export default new DashboardService();
