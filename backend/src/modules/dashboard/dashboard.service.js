import fs from "fs/promises";
import path from "path";
import logger from "../../config/logger.js";
import resilientDb from "../../config/resilient-database.js";
import User from "../../models/user.model.js";

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
      const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).getTime();

      // Count unique INDUK stores by storeCode
      const uniqueStoreCodes = new Set(
        stores.filter((s) => s.notes === "INDUK").map((s) => s.storeCode),
      );
      const totalStores = uniqueStoreCodes.size;

      const syncedToday = stores.filter((s) => {
        const upd = new Date(s.updtime || s.updatedAt).getTime();
        return upd >= today && s.notes === "INDUK";
      }).length;

      const needsAttention = totalStores - syncedToday;

      // DB connection info
      const dbStatus = resilientDb.getStatus();

      return {
        totalStores,
        totalPenyesuaian: penyesuaian.length,
        totalRekonSales: rekonSales.length,
        syncedToday,
        needsAttention,
        lastSync: stores.length > 0 ? stores[0].updtime : null,
        dbHost: process.env.DB_HOST || "N/A",
        dbPort: process.env.DB_PORT || "3306",
        dbConnected: dbStatus.isConnected,
      };
    } catch (error) {
      logger.error(`Dashboard stats failed: ${error.message}`);
      throw error;
    }
  }

  async getRecentActivity() {
    try {
      const activityDir = path.join(this.dataDir, "user-activities.json");
      let allActivities = [];

      try {
        const files = await fs.readdir(activityDir);
        for (const file of files) {
          if (file.endsWith("-activities.json")) {
            const content = await fs.readFile(
              path.join(activityDir, file),
              "utf8",
            );
            const activities = JSON.parse(content);
            allActivities = allActivities.concat(activities);
          }
        }
      } catch (error) {
        logger.warn(
          `Could not read user activities directory: ${error.message}`,
        );
      }

      // Sort by date descending
      allActivities.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );

      const recent = allActivities.slice(0, 15);

      // Enrich with user data from DB so the frontend can display names.
      // Falls back gracefully if DB is unavailable.
      const uniqueUserIds = [
        ...new Set(recent.map((a) => a.userId).filter(Boolean)),
      ];
      let userMap = {};

      if (uniqueUserIds.length > 0) {
        try {
          // User model is JSON-file-based; findAll returns all users without filtering.
          // We fetch all and keep only the IDs we need.
          const allUsers = await User.findAll();
          allUsers.forEach((u) => {
            if (uniqueUserIds.includes(u.id)) {
              userMap[u.id] = {
                id: u.id,
                username: u.username,
                fullName: u.fullName || u.username,
              };
            }
          });
        } catch (dbErr) {
          // DB might be offline — log a warning and continue without enrichment
          logger.warn(
            `Could not enrich activities with user data: ${dbErr.message}`,
          );
        }
      }

      return recent.map((a) => ({
        ...a,
        user: userMap[a.userId] || null,
      }));
    } catch (error) {
      logger.error(`Dashboard recent activity failed: ${error.message}`);
      return [];
    }
  }
}

export default new DashboardService();
