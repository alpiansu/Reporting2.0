import axios from "axios";

// Create axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  // [Health fix #14] Default axios TANPA timeout (infinite) → saat backend
  // menggantung, UI menampilkan "pending" selamanya tanpa pesan error apa pun.
  // 30 detik; layanan yang butuh waktu lama sudah set timeout sendiri per-request
  // (monthlyReports & salesCustab: 600000ms → menang atas default ini).
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor for handling errors
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // [Health fix #14] Pesan yang jelas untuk timeout/gangguan jaringan —
    // komponen biasanya menampilkan error.message, dan tanpa blok ini user
    // hanya melihat teks teknis "timeout of 30000ms exceeded".
    if (error.code === "ECONNABORTED") {
      error.message = "Server tidak merespons (timeout). Silakan coba lagi.";
    } else if (error.code === "ERR_NETWORK") {
      error.message = "Tidak dapat terhubung ke server. Periksa koneksi jaringan Anda.";
    }

    // Jangan refresh token jika request ke /auth/login
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes("/auth/login")) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        const response = await axios.post(
          `${api.defaults.baseURL}/auth/refresh-token`,
          { refreshToken },
          { headers: { "Content-Type": "application/json" } }
        );

        const { token } = response.data;
        localStorage.setItem("token", token);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Clear auth data
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        
        // Redirect to login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      }
    }

    // Handle 401 errors that are not related to token refresh
    if (error.response?.status === 401) {
      // Clear auth data
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      
      // Redirect to login page if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
