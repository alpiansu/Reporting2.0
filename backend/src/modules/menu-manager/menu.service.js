/**
 * Menu Service
 * Handles all menu-related data operations
 */
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class MenuService {
  constructor() {
    this.initialized = false;
    this.menus = [];
    this.filePath = path.join(__dirname, '../../data/menus.json');
  }

  /**
   * Initialize the service by loading data from file
   */
  async init() {
    if (this.initialized) return;

    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      this.menus = JSON.parse(data);
      this.initialized = true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create it with empty array
        await this.saveMenus();
        this.initialized = true;
      } else {
        console.error('Error initializing menu service:', error);
        throw error;
      }
    }
  }

  /**
   * Save menus to file
   */
  async saveMenus() {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.menus, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving menus:', error);
      throw error;
    }
  }

  /**
   * Get all menus
   * @returns {Array} Array of menu objects
   */
  async getAllMenus() {
    await this.init();
    return [...this.menus].sort((a, b) => a.order - b.order);
  }

  /**
   * Get menu by ID
   * @param {string} id - Menu ID
   * @returns {Object|null} Menu object or null if not found
   */
  async getMenuById(id) {
    await this.init();
    return this.menus.find(menu => menu.id === id) || null;
  }

  /**
   * Get menus filtered by user role
   * @param {string} role - User role
   * @returns {Array} Array of menu objects filtered by role
   */
  async getMenusByRole(role) {
    await this.init();
    
    // Create a deep copy of menus to avoid modifying the original data
    const filteredMenus = JSON.parse(JSON.stringify(this.menus));
    
    // Filter items in each menu category based on role
    return filteredMenus
      .map(menu => {
        // Filter items that include the specified role
        const filteredItems = menu.items.filter(item => 
          !item.roles || item.roles.length === 0 || item.roles.includes(role)
        );
        
        // Return a new menu object with filtered items
        return {
          ...menu,
          items: filteredItems
        };
      })
      // Remove empty categories (those with no items after filtering)
      .filter(menu => menu.items.length > 0)
      // Sort by order
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Create a new menu
   * @param {Object} menuData - Menu data
   * @returns {Object} Created menu object
   */
  async createMenu(menuData) {
    await this.init();
    
    // Generate ID if not provided
    const newMenu = {
      ...menuData,
      id: menuData.id || uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.menus.push(newMenu);
    await this.saveMenus();
    
    return newMenu;
  }

  /**
   * Update an existing menu
   * @param {Object} menuData - Menu data with ID
   * @returns {Object} Updated menu object
   */
  async updateMenu(menuData) {
    await this.init();
    
    const index = this.menus.findIndex(menu => menu.id === menuData.id);
    
    if (index === -1) {
      throw new Error(`Menu with ID ${menuData.id} not found`);
    }
    
    // Update menu with new data
    const updatedMenu = {
      ...this.menus[index],
      ...menuData,
      updatedAt: new Date().toISOString()
    };
    
    this.menus[index] = updatedMenu;
    await this.saveMenus();
    
    return updatedMenu;
  }

  /**
   * Delete a menu
   * @param {string} id - Menu ID
   * @returns {boolean} True if deleted, false if not found
   */
  async deleteMenu(id) {
    await this.init();
    
    const initialLength = this.menus.length;
    this.menus = this.menus.filter(menu => menu.id !== id);
    
    if (this.menus.length < initialLength) {
      await this.saveMenus();
      return true;
    }
    
    return false;
  }
}

module.exports = MenuService;