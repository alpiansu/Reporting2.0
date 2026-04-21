import api from './api';

const mDeptService = {
  /**
   * Get all departments
   * @param {Object} params - Query parameters
   * @returns {Promise} Axios response promise
   */
  getAll: (params) => {
    return api.get('/m-dept', { params });
  },
  
  /**
   * Create a new department
   * @param {Object} data - Department data
   * @returns {Promise} Axios response promise
   */
  create: (data) => {
    return api.post('/m-dept', data);
  },
  
  /**
   * Update an existing department
   * @param {string} kddept - Department code
   * @param {Object} data - Department data
   * @returns {Promise} Axios response promise
   */
  update: (kddept, data) => {
    return api.put(`/m-dept/${kddept}`, data);
  },
  
  /**
   * Delete a department
   * @param {string} kddept - Department code
   * @returns {Promise} Axios response promise
   */
  delete: (kddept) => {
    return api.delete(`/m-dept/${kddept}`);
  },
  
  /**
   * Upload departments via CSV
   * @param {Object} data - Form data with departments array
   * @returns {Promise} Axios response promise
   */
  upload: (data) => {
    return api.post('/m-dept/upload', data);
  }
};

export default mDeptService;
