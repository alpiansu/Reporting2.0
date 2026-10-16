/**
 * Konfigurasi Deployment Frontend ke Server 192.168.133.7 via FTPS
 */

export default {
  // Target API backend yang akan disuntikkan ke frontend/.env sementara sebelum npm run build
  envOverrides: {
    VITE_API_URL: "http://192.168.133.7:3005/api",
    VITE_APP_TITLE: "Reporting 2.0",
  },

  // Konfigurasi koneksi FTP (FileZilla Server)
  ftp: {
    host: process.env.DEPLOY_FTP_HOST || "192.168.133.7",
    port: parseInt(process.env.DEPLOY_FTP_PORT, 10) || 21,
    user: process.env.DEPLOY_FTP_USER || "deploy",
    password: process.env.DEPLOY_FTP_PASSWORD || "deploy",
    secure: true, // Wajib TLS (AUTH TLS) untuk FileZilla Server
    secureOptions: {
      rejectUnauthorized: false, // Menerima sertifikat self-signed lokal
    },
    remoteDir: "/fe-report2.0",
  },

  // Script build (npm run build) dan direktori output
  buildScript: "build",
  buildDir: "dist",

  // URL web untuk verifikasi setelah upload selesai
  webUrl: "http://192.168.133.7:8081",
};
