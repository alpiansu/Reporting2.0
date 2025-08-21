/**
 * Service for user data using JSON file storage
 */
const fs = require("fs").promises;
const path = require("path");
const logger = require("../../config/logger");
const bcrypt = require("bcrypt");

class UserService {
  constructor() {
    // Get the absolute path to the JSON file
    this.filePath = path.join(process.cwd(), "data/m_users.json");
    this.userList = [];
    this.initialized = false;
  }

  /**
   * Initialize the service
   * Alias for initialize() for compatibility with server.js
   */
  async init() {
    return this.initialize();
  }

  /**
   * Initialize the service by loading data from JSON file
   * Creates the file and directory if they don't exist
   */
  async initialize() {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      try {
        // Try to read the file
        const data = await fs.readFile(this.filePath, "utf8");
        this.userList = JSON.parse(data);
        logger.info(`Loaded ${this.userList.length} users from JSON file`);
      } catch (error) {
        // If file doesn't exist or is invalid, create an empty file with default admin user
        if (error.code === "ENOENT" || error instanceof SyntaxError) {
          // Create default admin user
          this.userList = [
            {
              id: 1,
              username: "admin",
              email: "admin@example.com",
              password: await this.hashPassword("admin123"),
              fullName: "Administrator",
              role: "admin",
              isActive: true,
              lastLogin: null,
              profileImage: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ];
          await this.saveToFile();
          logger.info("Created new m_users.json file with default admin user");
        } else {
          throw error;
        }
      }

      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize user service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save user data to JSON file
   */
  async saveToFile() {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.userList, null, 2));
      // logger.info(`Saved ${this.userList.length} users to JSON file`);
    } catch (error) {
      logger.error(`Failed to save users to file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensure the service is initialized before performing operations
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Hash a password
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compare a password with a hash
   * @param {string} password - Plain text password
   * @param {string} hashedPassword - Hashed password
   * @returns {Promise<boolean>} - True if password matches
   */
  async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Get all users
   * @returns {Promise<Array>} List of users with passwords removed
   */
  async getAllUsers() {
    try {
      await this.ensureInitialized();
      return this.userList.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
    } catch (error) {
      logger.error(`Error in getAllUsers: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {number} id - User ID
   * @returns {Promise<Object>} User data without password
   */
  async getUserById(id) {
    try {
      await this.ensureInitialized();
      const user = this.userList.find(user => user.id === id);
      if (!user) return null;
      
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      logger.error(`Error in getUserById: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user with password by ID (for internal use)
   * @param {number} id - User ID
   * @returns {Promise<Object>} Complete user data including password
   */
  async getUserWithPasswordById(id) {
    try {
      await this.ensureInitialized();
      return this.userList.find(user => user.id === id) || null;
    } catch (error) {
      logger.error(`Error in getUserWithPasswordById: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find user by username or email
   * @param {string} login - Username or email
   * @returns {Promise<Object>} Complete user data including password
   */
  async findByCredentials(login) {
    try {
      await this.ensureInitialized();
      return this.userList.find(
        user => (user.username === login || user.email === login) && user.isActive
      ) || null;
    } catch (error) {
      logger.error(`Error in findByCredentials: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user without password
   */
  async createUser(userData) {
    try {
      await this.ensureInitialized();

      // Check if username or email already exists
      const existingUser = this.userList.find(
        user => user.username === userData.username || user.email === userData.email
      );

      if (existingUser) {
        throw new Error("Username or email already exists");
      }

      // Generate new ID
      const newId = this.userList.length > 0 
        ? Math.max(...this.userList.map(user => user.id)) + 1 
        : 1;

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Create new user
      const newUser = {
        id: newId,
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        fullName: userData.fullName || "",
        role: userData.role || "user",
        isActive: userData.isActive !== undefined ? userData.isActive : true,
        lastLogin: null,
        profileImage: userData.profileImage || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Add to user list
      this.userList.push(newUser);

      // Save to file
      await this.saveToFile();

      // Return user without password
      const { password, ...userWithoutPassword } = newUser;
      return userWithoutPassword;
    } catch (error) {
      logger.error(`Error in createUser: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an existing user
   * @param {number} id - User ID
   * @param {Object} userData - User data to update
   * @returns {Promise<Object>} Updated user without password
   */
  async updateUser(id, userData) {
    try {
      await this.ensureInitialized();

      // Find user index
      const index = this.userList.findIndex(user => user.id === id);
      if (index === -1) {
        return null;
      }

      // Check if username or email is being changed and already exists
      if (userData.username || userData.email) {
        const existingUser = this.userList.find(
          user => user.id !== id && (
            (userData.username && user.username === userData.username) ||
            (userData.email && user.email === userData.email)
          )
        );

        if (existingUser) {
          throw new Error("Username or email already exists");
        }
      }

      // Prepare updated user data
      const updatedUser = { ...this.userList[index] };
      
      // Update allowed fields
      if (userData.username) updatedUser.username = userData.username;
      if (userData.email) updatedUser.email = userData.email;
      if (userData.fullName !== undefined) updatedUser.fullName = userData.fullName;
      if (userData.role) updatedUser.role = userData.role;
      if (userData.isActive !== undefined) updatedUser.isActive = userData.isActive;
      if (userData.profileImage !== undefined) updatedUser.profileImage = userData.profileImage;
      
      // Update password if provided
      if (userData.password) {
        updatedUser.password = await this.hashPassword(userData.password);
      }
      
      // Update timestamp
      updatedUser.updatedAt = new Date().toISOString();

      // Replace in list
      this.userList[index] = updatedUser;

      // Save to file
      await this.saveToFile();

      // Return user without password
      const { password, ...userWithoutPassword } = updatedUser;
      return userWithoutPassword;
    } catch (error) {
      logger.error(`Error in updateUser: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user's last login timestamp
   * @param {number} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  async updateLastLogin(id) {
    try {
      await this.ensureInitialized();

      // Find user index
      const index = this.userList.findIndex(user => user.id === id);
      if (index === -1) {
        return false;
      }

      // Update last login timestamp
      this.userList[index].lastLogin = new Date().toISOString();
      this.userList[index].updatedAt = new Date().toISOString();

      // Save to file
      await this.saveToFile();

      return true;
    } catch (error) {
      logger.error(`Error in updateLastLogin: ${error.message}`);
      return false;
    }
  }

  /**
   * Change user password
   * @param {number} id - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<boolean>} Success status
   */
  async changePassword(id, currentPassword, newPassword) {
    try {
      await this.ensureInitialized();

      // Find user
      const user = await this.getUserWithPasswordById(id);
      if (!user) {
        throw new Error("User not found");
      }

      // Verify current password
      const isPasswordValid = await this.comparePassword(currentPassword, user.password);
      if (!isPasswordValid) {
        throw new Error("Current password is incorrect");
      }

      // Update password
      const index = this.userList.findIndex(u => u.id === id);
      this.userList[index].password = await this.hashPassword(newPassword);
      this.userList[index].updatedAt = new Date().toISOString();

      // Save to file
      await this.saveToFile();

      return true;
    } catch (error) {
      logger.error(`Error in changePassword: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a user
   * @param {number} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteUser(id) {
    try {
      // Reload data from file to ensure we have the latest data
      await this.initialize();

      // Convert id to number if it's a string
      const userId = typeof id === 'string' ? parseInt(id, 10) : id;
      
      // Debug: Log all user IDs to see what's available
      logger.info(`Current users after reload: ${JSON.stringify(this.userList.map(u => ({ id: u.id, username: u.username })))}`); 
      logger.info(`Attempting to delete user with ID: ${userId} (type: ${typeof userId})`);

      // Find user index
      const index = this.userList.findIndex(user => user.id === userId);
      if (index === -1) {
        logger.error(`User with ID ${userId} not found for deletion`);
        return false;
      }

      // Remove from list
      this.userList.splice(index, 1);

      // Save to file
      await this.saveToFile();
      logger.info(`User with ID ${userId} deleted successfully`);

      return true;
    } catch (error) {
      logger.error(`Error in deleteUser: ${error.message}`);
      return false;
    }
  }

  /**
   * Membersihkan data pengujian dengan menyimpan hanya pengguna admin
   * @returns {Promise<Object>} Hasil pembersihan data
   */
  async cleanupTestData() {
    try {
      await this.ensureInitialized();
      
      // Hitung jumlah pengguna sebelum pembersihan
      const beforeCount = this.userList.length;
      
      // Filter hanya pengguna admin (username: "admin")
      const adminUsers = this.userList.filter(user => user.username === "admin");
      
      // Jika tidak ada admin, pertahankan data yang ada
      if (adminUsers.length === 0) {
        logger.warn("Tidak ada pengguna admin ditemukan, data tidak dibersihkan");
        return {
          success: false,
          message: "Tidak ada pengguna admin ditemukan, data tidak dibersihkan",
          beforeCount,
          afterCount: beforeCount
        };
      }
      
      // Simpan hanya pengguna admin
      this.userList = adminUsers;
      
      // Simpan ke file
      await this.saveToFile();
      
      logger.info(`Data pengujian dibersihkan: ${beforeCount - adminUsers.length} pengguna dihapus, ${adminUsers.length} pengguna admin dipertahankan`);
      
      return {
        success: true,
        message: `Data pengujian dibersihkan: ${beforeCount - adminUsers.length} pengguna dihapus, ${adminUsers.length} pengguna admin dipertahankan`,
        beforeCount,
        afterCount: adminUsers.length
      };
    } catch (error) {
      logger.error(`Error dalam cleanupTestData: ${error.message}`);
      return {
        success: false,
        message: `Error dalam cleanupTestData: ${error.message}`,
        error: error.message
      };
    }
  }
}

module.exports = UserService;