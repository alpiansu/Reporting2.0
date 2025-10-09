import api from "./api.js";

/**
 * Adjust Service - Handles all adjust module API calls
 */
class AdjustService {
  /**
   * Upload CSV file for adjustment processing
   * @param {File} file - The CSV file to upload
   * @returns {Promise<Object>} Upload and processing results
   */
  async uploadCsv(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post("/adjust/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  }

  /**
   * Download CSV master template
   * @returns {Promise<void>} Triggers file download
   */
  async downloadTemplate() {
    try {
      const response = await api.get("/adjust/template", {
        responseType: "blob",
      });

      // Create blob URL for download
      const blob = new Blob([response.data], { type: "text/csv; charset=utf-8" });
      const url = window.URL.createObjectURL(blob);

      // Create temporary link to trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = "adjust_template.csv";
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true, message: "Template downloaded successfully" };
    } catch (error) {
      console.error("Error downloading template:", error);
      throw new Error(error.response?.data?.message || "Failed to download template");
    }
  }

  /**
   * Get adjust processing history/logs (if needed in future)
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Processing history
   */
  async getProcessingHistory(params = {}) {
    // Placeholder for future implementation
    const response = await api.get("/adjust/history", { params });
    return response.data;
  }
}

export default new AdjustService();
