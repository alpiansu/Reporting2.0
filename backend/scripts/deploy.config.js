/**
 * Konfigurasi Deployment Backend ke Server 192.168.133.7
 */

export default {
  // Informasi Koneksi Remote Server
  server: {
    host: process.env.DEPLOY_HOST || "192.168.133.7",
    port: parseInt(process.env.DEPLOY_PORT, 10) || 22,
    username: process.env.DEPLOY_USER || "admin_epr",
    password: process.env.DEPLOY_PASSWORD || "root@admin_epr",
    remotePath: "D:/PROJECTS/NODEJS/numpang1minggu/be-report2.0",
  },

  // Konfigurasi PM2 di Remote Server
  pm2: {
    appName: "BE_REPORT2.0",
    healthCheckUrl: "http://192.168.133.7:3005/api/health",
  },

  // HARD PROTECTED: File ini dijamin tidak akan pernah di-upload / ditimpa di server
  protectedFiles: [
    ".env",
    ".env.*",
  ],

  // EXCLUDE RULES: Folder, File Spesifik, atau Wildcard yang TIDAK di-update
  // Path dihitung relatif dari folder 'backend/'
  exclude: [
    // --- 1. Folder yang sepenuhnya di-exclude ---
    "data",                // Folder data sepenuhnya di-exclude sesuai permintaan
    "node_modules",        // Dependencies di server
    "logs",                // Log aplikasi di server
    "exportedLap",         // File laporan generate di server
    "temp",                // Temporary files
    "test",                // Test files
    ".git",                // Git files
    ".vscode",             // Editor config

    // --- 2. File spesifik di lokasi mana pun yang TIDAK boleh di-update ---
    "src/utils/xcmd.utils.js", // Spesifik dilarang update sesuai permintaan

    // --- 3. Wildcard / Ekstensi ---
    "*.log",
    "*.tmp",
    "*.bak",
    "*.mjs",
  ],

  // File di root backend/ yang boleh di-upload
  includeRootFiles: [
    "package.json",
    "package-lock.json",
    "babel.config.cjs",
    ".nodemonignore",
    "README.md",
  ],

  // Direktori yang discan untuk di-upload (di luar root files)
  includeDirs: [
    "src",
    "scripts",
    "public",
  ],

  // WHITELIST OVERRIDES (Pengecualian Khusus):
  // File spesifik yang TETAP DI-UPLOAD meskipun folder induknya di-exclude di atas
  whitelistFiles: [
    "data/menus.json", // File menu tetap di-update meskipun folder 'data' di-exclude
  ],
};
