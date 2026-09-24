/**
 * Notifications module index
 */
import routes from "./notifications.routes.js";
import service from "./notifications.service.js";

export default {
  routes,
  service,
  initialize: app => {
    app.use("/api/notifications", routes);
    // Pemangkasan berkala (read >30 hari, unread >90 hari) supaya notifications.json
    // tidak tumbuh tanpa batas — jalankan saat start + interval1 jam
    service.scheduleCleanup();
    return { service };
  },
};
