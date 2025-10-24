/**
 * Service for interacting with note categories API
 */
import api from "./api";

class NoteCategoriesService {
  /**
   * Get all note categories
   * @param {Object} params - Query parameters for pagination and filtering
   * @returns {Promise} Promise object with note categories data
   */
  getAll(params = {}) {
    return api.get("/note-categories", { params });
  }

  /**
   * Get note category by ID
   * @param {string|number} id - Note category ID
   * @returns {Promise} Promise object with note category data
   */
  getById(id) {
    return api.get(`/note-categories/${id}`);
  }

  /**
   * Create a new note category
   * @param {Object} categoryData - Note category data
   * @returns {Promise} Promise object with created note category
   */
  create(categoryData) {
    return api.post("/note-categories", categoryData);
  }

  /**
   * Update an existing note category
   * @param {string|number} id - Note category ID
   * @param {Object} categoryData - Note category data
   * @returns {Promise} Promise object with updated note category
   */
  update(id, categoryData) {
    return api.put(`/note-categories/${id}`, categoryData);
  }

  /**
   * Delete a note category
   * @param {string|number} id - Note category ID
   * @returns {Promise} Promise object with deletion status
   */
  delete(id) {
    return api.delete(`/note-categories/${id}`);
  }
}

export default new NoteCategoriesService();
