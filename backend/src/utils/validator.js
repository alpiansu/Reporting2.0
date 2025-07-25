/**
 * Validation utility functions
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - Validation result with isValid and message
 */
const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long',
    };
  }

  // Check for at least one uppercase letter, one lowercase letter, and one number
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    };
  }

  return {
    isValid: true,
    message: 'Password is valid',
  };
};

/**
 * Validate database connection parameters
 * @param {object} connectionParams - Database connection parameters
 * @returns {object} - Validation result with isValid and errors
 */
const validateConnectionParams = (connectionParams) => {
  const errors = {};
  const requiredFields = ['host', 'port', 'database', 'username', 'password'];

  requiredFields.forEach((field) => {
    if (!connectionParams[field]) {
      errors[field] = `${field} is required`;
    }
  });

  // Validate port is a number
  if (connectionParams.port && isNaN(parseInt(connectionParams.port, 10))) {
    errors.port = 'Port must be a number';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validate screening parameters
 * @param {object} screeningParams - Screening parameters
 * @returns {object} - Validation result with isValid and errors
 */
const validateScreeningParams = (screeningParams) => {
  const errors = {};
  const { storeId, screeningType } = screeningParams;

  if (!storeId) {
    errors.storeId = 'Store ID is required';
  }

  if (!screeningType) {
    errors.screeningType = 'Screening type is required';
  } else {
    const validTypes = ['full', 'quick', 'custom'];
    if (!validTypes.includes(screeningType)) {
      errors.screeningType = `Screening type must be one of: ${validTypes.join(', ')}`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

module.exports = {
  isValidEmail,
  validatePassword,
  validateConnectionParams,
  validateScreeningParams,
};