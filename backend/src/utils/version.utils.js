import { createRequire } from "module";

// Satu sumber kebenaran versi aplikasi: backend/package.json
// Dipakai oleh route /api/health, swagger, dan komponen lain yang butuh versi.
const require = createRequire(import.meta.url);
const pkg = require("../../package.json");

export const APP_NAME = pkg.name || "backend";
export const APP_VERSION = pkg.version || "0.0.0";

export default { APP_NAME, APP_VERSION };
