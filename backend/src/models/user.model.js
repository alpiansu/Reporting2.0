/**
 * User model - JSON file based implementation
 *
 * This model provides an interface similar to Sequelize models
 * but uses a JSON file as the data source instead of a database.
 *
 * The actual data operations are handled by the UserService.
 */
const UserService = require("../modules/user/user.service");

// Create a singleton instance of the service
const userService = new UserService();

// Define the User model schema for documentation and validation
const UserSchema = {
  id: { type: "number", primaryKey: true, autoIncrement: true },
  username: { type: "string", required: true },
  email: { type: "string", required: true },
  password: { type: "string", required: true },
  fullName: { type: "string" },
  role: { type: "string", enum: ["admin", "manager", "user"], default: "user" },
  isActive: { type: "boolean", default: true },
  lastLogin: { type: "date" },
  profileImage: { type: "string" },
  createdAt: { type: "date" },
  updatedAt: { type: "date" },
};

/**
 * User model with methods similar to Sequelize models
 * but using the UserService for actual data operations
 */
const User = {
  // Schema definition for documentation
  schema: UserSchema,

  /**
   * Find all users with optional where clause
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of user objects
   */
  findAll: async (options = {}) => {
    // Get all users from service
    return userService.getAllUsers();
  },

  /**
   * Count all users
   * @returns {Promise<number>} Count of users
   */
  count: async () => {
    const userList = await userService.getAllUsers();
    return userList.length;
  },

  /**
   * Find a user by primary key
   * @param {number} id - User ID
   * @returns {Promise<Object|null>} User object or null if not found
   */
  findByPk: async (id) => {
    await userService.init();
    return userService.getUserById(id);
  },

  /**
   * Find a user by credentials (username or email)
   * @param {string} login - Username or email
   * @returns {Promise<Object|null>} User object or null if not found
   */
  findByCredentials: async (login) => {
    await userService.init();
    return userService.findByCredentials(login);
  },

  /**
   * Find a user by where clause
   * @param {Object} options - Query options with where clause
   * @returns {Promise<Object|null>} User object or null if not found
   */
  findOne: async (options = {}) => {
    await userService.init();
    const users = await userService.getAllUsers();
    
    if (!options.where) {
      return users[0] || null;
    }
    
    // Simple implementation to match the first user that satisfies all conditions in where clause
    const whereConditions = options.where;
    
    return users.find(user => {
      return Object.keys(whereConditions).every(key => {
        return user[key] === whereConditions[key];
      });
    }) || null;
  },

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user
   */
  create: async (userData) => {
    return userService.createUser(userData);
  },

  /**
   * Find or create a user
   * @param {Object} options - Options containing where clause and defaults
   * @returns {Promise<Array>} Array with user object and boolean indicating if created
   */
  findOrCreate: async ({ where, defaults }) => {
    await userService.init();
    
    // Try to find by username or email
    let existingUser = null;
    if (where.username) {
      existingUser = await userService.findByCredentials(where.username);
    } else if (where.email) {
      existingUser = await userService.findByCredentials(where.email);
    } else if (where.id) {
      existingUser = await userService.getUserById(where.id);
    }
    
    if (existingUser) {
      return [existingUser, false];
    }
    
    const newUser = await userService.createUser({
      ...where,
      ...defaults,
    });
    
    return [newUser, true];
  },

  /**
   * Update users matching the where clause
   * @param {Object} values - Values to update
   * @param {Object} options - Options containing where clause
   * @returns {Promise<Array>} Array with count of updated records
   */
  update: async (values, { where }) => {
    if (where.id) {
      const user = await userService.updateUser(where.id, values);
      return user ? [1] : [0];
    }
    
    // For compatibility with Sequelize, return count of updated records
    return [0];
  },

  /**
   * Save changes to a user instance
   * @returns {Promise<Object>} Updated user
   */
  save: async function() {
    if (this.id) {
      return userService.updateUser(this.id, this);
    }
    return null;
  },

  /**
   * Compare password with stored hash
   * @param {string} candidatePassword - Password to compare
   * @returns {Promise<boolean>} True if password matches
   */
  comparePassword: async function(candidatePassword) {
    if (this.password) {
      return userService.comparePassword(candidatePassword, this.password);
    }
    return false;
  },

  /**
   * Convert user object to JSON
   * @returns {Object} User data without password
   */
  toJSON: function() {
    const { password, ...userWithoutPassword } = this;
    return userWithoutPassword;
  },
};

module.exports = User;