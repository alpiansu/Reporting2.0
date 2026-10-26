import api from "./api.js";

/**
 * Adjust Service - Handles all adjust module specific API calls
 */
class AdjustService {
  /**
   * Upload CSV file for adjustment processing
   * @param {File} file - The CSV file to upload
   * @returns {Promise<Object>} Upload and processing results
   */
  async uploadCsv(file, directIntervention = false) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("directIntervention", directIntervention ? "true" : "false");

    const response = await api.post("/adjust/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }

  /**
   * Check target stores to auto-detect single local simulation store
   * @param {string[]} storeCodes - Array of unique store codes from CSV
   * @returns {Promise<Object>} Detection results
   */
  async checkTarget(storeCodes) {
    const response = await api.post("/adjust/check-target", { storeCodes });
    return response.data;
  }

  /**
   * Confirm virtual margin adjustment status and update RECID in database
   * @param {Array} items - Array of items with status SUCCESS/FAILED
   * @returns {Promise<Object>} Confirmation results
   */
  async confirmVirtualMargin(items) {
    const response = await api.post("/adjust/confirm-virtual-margin", { items });
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
   * Get adjust processing history/logs
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Processing history
   */
  async getProcessingHistory(params = {}) {
    const response = await api.get("/adjust/history", { params });
    return response.data;
  }

  /**
   * Get history for report with month-based filter
   * @param {Object} params - { month: 'YYYY-MM', pic, kdtk, status, limit, offset }
   */
  async getHistory(params = {}) {
    const response = await api.get("/adjust/history", { params });
    return response.data;
  }

  /**
   * Get distinct filter options (PIC, KDTK)
   */
  async getFilters() {
    const response = await api.get("/adjust/history/filters");
    return response.data;
  }

  /**
   * Export history CSV according to filters
   * @param {Object} params - same as getHistory
   */
  async exportHistoryCsv(params = {}) {
    const response = await api.get("/adjust/history/export", { params, responseType: "blob" });
    const blob = new Blob([response.data], { type: "text/csv; charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const month = params.month || "all";
    link.href = url;
    link.download = `adjust_history_${month}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return { success: true };
  }

  /**
   * Get adjustment tasks (convenience method using progress service)
   * @returns {Promise<Array>} Adjustment-related tasks
   */
  async getAdjustmentTasks() {
    // Import progress service
    const progressService = await import("./progress.service.js");
    return progressService.default.getTasksByModule("adjust-module");
  }
}

export default new AdjustService();
