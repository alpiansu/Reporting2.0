import dthrFtpRoutes from "./dthr_ftp.routes.js";
import dthrFtpService from "./dthr_ftp.service.js";

export default {
  dthrFtpService,
  dthrFtpRoutes,
  initialize: (app) => {
    app.use("/api/dthr-ftp", dthrFtpRoutes);
    return { dthrFtpService };
  },
};
