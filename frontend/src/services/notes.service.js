import api from "./api";

class NotesService {
  /**
   * Get all notes
   * @returns {Promise<Array>} Array of notes
   */
  async getAll() {
    const response = await api.get("/notes");
    return response.data;
  }

  /**
   * Delete a note by unixKey
   * @param {string} unixKey - The unique key of the note to delete
   * @returns {Promise<Object>} Response object
   */
  async delete(unixKey) {
    const response = await api.delete(`/notes/${unixKey}`);
    return response.data;
  }
}

export default new NotesService();
