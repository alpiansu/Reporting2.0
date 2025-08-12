/**
 * Standard API response formatter
 */

/**
 * Send success response
 * @param {object} res - Express response object
 * @param {*} data - Response data
 * @param {number} statusCode - HTTP status code
 */
const success = (res, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
  });
};

/**
 * Send created response (HTTP 201)
 * @param {object} res - Express response object
 * @param {*} data - Response data
 */
const created = (res, data = {}) => {
  return res.status(201).json({
    success: true,
    data,
  });
};

/**
 * Send error response
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {*} errors - Error details
 */
const error = (res, message = "Error", statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send bad request response (HTTP 400)
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {*} errors - Error details
 */
const badRequest = (res, message = "Bad Request", errors = null) => {
  const response = {
    success: false,
    message,
  };
  if (errors) {
    response.errors = errors;
  }
  return res.status(400).json(response);
};

/**
 * Send not found response (HTTP 404)
 * @param {object} res - Express response object
 * @param {string} message - Error message
 */
const notFound = (res, message = "Not Found") => {
  return res.status(404).json({
    success: false,
    message,
  });
};

module.exports = {
  success,
  created,
  error,
  badRequest,
  notFound,
};