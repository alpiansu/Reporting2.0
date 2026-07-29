import api from "./api";

class NotificationsService {
  /**
   * Get all notifications for a user
   * @param {string} username
   * @param {number} limit
   * @returns {Promise<Object>} { data, unread, count }
   */
  async getAll(username, limit = 50) {
    const response = await api.get("/notifications", {
      params: { username, limit },
    });
    return response.data;
  }

  /**
   * Mark a notification as read
   * @param {string} id - Notification ID
   * @returns {Promise<Object>}
   */
  async markRead(id) {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data;
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} username
   * @returns {Promise<Object>}
   */
  async markAllRead(username) {
    const response = await api.put("/notifications/read-all", { username });
    return response.data;
  }

  /**
   * Get unread count for a user
   * @param {string} username
   * @returns {Promise<number>}
   */
  async getUnreadCount(username) {
    const response = await api.get("/notifications/unread-count", {
      params: { username },
    });
    return response.data?.data?.count || 0;
  }

  /**
   * Connect to SSE stream for real-time notifications
   * @param {string} username
   * @returns {EventSource}
   */
  connectSSE(username) {
    const baseURL = api.defaults.baseURL || "http://localhost:3000/api";
    const url = `${baseURL.replace("/api", "/api/notifications/sse/")}${username}`;
    return new EventSource(url);
  }
}

export default new NotificationsService();
