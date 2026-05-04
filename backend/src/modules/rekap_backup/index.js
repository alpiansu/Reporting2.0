import routes from "./rekap_backup.routes.js";
import stagingService from "./services/rekap_backup_staging.service.js";

export default {
  initialize: (app) => {
    // Initialize staging service in background
    stagingService.initialize().catch(err => console.error(err));
    
    app.use("/api/rekap-backup", routes);
    return { routes };
  }
};
