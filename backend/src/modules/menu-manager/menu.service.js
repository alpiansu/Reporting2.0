/**
 * Menu Service
 * Handles all menu-related data operations
 */
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { generateVueComponentIfNeeded } from '../../utils/index.js';

class MenuService {
  constructor() {
    this.initialized = false;
    this.menus = [];
    this.filePath = path.join(process.cwd(), "data/menus.json");
  }

  /**
   * Initialize the service by loading data from file
   */
  async init() {
    if (this.initialized) return;

    try {
      const data = await fs.readFile(this.filePath, "utf8");
      this.menus = JSON.parse(data);
      this.initialized = true;
    } catch (error) {
      if (error.code === "ENOENT") {
        // File doesn't exist, create it with empty array
        await this.saveMenus();
        this.initialized = true;
      } else {
        console.error("Error initializing menu service:", error);
        throw error;
      }
    }
  }

  /**
   * Save menus to file
   */
  async saveMenus() {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.menus, null, 2), "utf8");
    } catch (error) {
      console.error("Error saving menus:", error);
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
    return (
      filteredMenus
        .map(menu => {
          // Filter items that include the specified role
          const filteredItems = menu.items.filter(
            item => !item.roles || item.roles.length === 0 || item.roles.includes(role)
          );

          // Return a new menu object with filtered items
          return {
            ...menu,
            items: filteredItems,
          };
        })
        // Remove empty categories (those with no items after filtering)
        .filter(menu => menu.items.length > 0)
        // Sort by order
        .sort((a, b) => a.order - b.order)
    );
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
      updatedAt: new Date().toISOString(),
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
      updatedAt: new Date().toISOString(),
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

  // ===== CATEGORY OPERATIONS =====

  /**
   * Create a new category
   * @param {Object} categoryData - Category data
   * @returns {Object} Created category object
   */
  async createCategory(categoryData) {
    await this.init();

    const newCategory = {
      ...categoryData,
      id: categoryData.id || uuidv4(),
      items: categoryData.items || [],
      order: categoryData.order || this.menus.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.menus.push(newCategory);
    await this.saveMenus();

    return newCategory;
  }

  /**
   * Update an existing category
   * @param {string} id - Category ID
   * @param {Object} categoryData - Category data
   * @returns {Object} Updated category object
   */
  async updateCategory(id, categoryData) {
    await this.init();

    const index = this.menus.findIndex(menu => menu.id === id);

    if (index === -1) {
      throw new Error(`Category with ID ${id} not found`);
    }

    // Update category with new data, preserving existing items
    const updatedCategory = {
      ...this.menus[index],
      ...categoryData,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    };

    this.menus[index] = updatedCategory;
    await this.saveMenus();

    return updatedCategory;
  }

  /**
   * Delete a category
   * @param {string} id - Category ID
   * @returns {boolean} True if deleted, false if not found
   */
  async deleteCategory(id) {
    await this.init();

    const initialLength = this.menus.length;
    this.menus = this.menus.filter(menu => menu.id !== id);

    if (this.menus.length < initialLength) {
      await this.saveMenus();
      return true;
    }

    return false;
  }

  // ===== MENU ITEM OPERATIONS =====

  /**
   * Add a menu item to a category
   * @param {string} categoryId - Category ID
   * @param {Object} itemData - Menu item data
   * @returns {Object} Created menu item object
   */
  async addMenuItem(categoryId, itemData) {
    await this.init();

    const categoryIndex = this.menus.findIndex(menu => menu.id === categoryId);

    if (categoryIndex === -1) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    const newItem = {
      ...itemData,
      id: itemData.id || uuidv4(),
    };

    // Initialize items array if it doesn't exist
    if (!this.menus[categoryIndex].items) {
      this.menus[categoryIndex].items = [];
    }

    this.menus[categoryIndex].items.push(newItem);
    this.menus[categoryIndex].updatedAt = new Date().toISOString();

    await this.saveMenus();

    try {
      // Create missing vue files for this menu item's path (if not exists)
      if (newItem.path) {
        await generateVueComponentIfNeeded(newItem.path);
      }
    } catch (err) {
      console.error('Failed to auto-generate vue component for', newItem.path, 'err:', err);
    }

    return newItem;
  }

  /**
   * Update a menu item
   * @param {string} categoryId - Category ID
   * @param {string} itemId - Menu item ID
   * @param {Object} itemData - Menu item data
   * @returns {Object} Updated menu item object
   */
  async updateMenuItem(categoryId, itemId, itemData) {
    await this.init();

    const categoryIndex = this.menus.findIndex(menu => menu.id === categoryId);

    if (categoryIndex === -1) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    const category = this.menus[categoryIndex];
    if (!category.items) {
      throw new Error(`No items found in category ${categoryId}`);
    }

    const itemIndex = category.items.findIndex(item => item.id === itemId);

    if (itemIndex === -1) {
      throw new Error(`Menu item with ID ${itemId} not found in category ${categoryId}`);
    }

    // Update item with new data
    const updatedItem = {
      ...category.items[itemIndex],
      ...itemData,
      id: itemId, // Ensure ID doesn't change
    };

    this.menus[categoryIndex].items[itemIndex] = updatedItem;
    this.menus[categoryIndex].updatedAt = new Date().toISOString();

    await this.saveMenus();

    try {
      if (updatedItem.path) {
        await generateVueComponentIfNeeded(updatedItem.path);
      }
    } catch (err) {
      console.error('Failed to auto-generate vue component for update', updatedItem.path, 'err:', err);
    }

    return updatedItem;
  }

  /**
   * Delete a menu item
   * @param {string} categoryId - Category ID
   * @param {string} itemId - Menu item ID
   * @returns {boolean} True if deleted, false if not found
   */
  async deleteMenuItem(categoryId, itemId) {
    await this.init();

    const categoryIndex = this.menus.findIndex(menu => menu.id === categoryId);

    if (categoryIndex === -1) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    const category = this.menus[categoryIndex];
    if (!category.items) {
      return false;
    }

    const initialLength = category.items.length;
    category.items = category.items.filter(item => item.id !== itemId);

    if (category.items.length < initialLength) {
      this.menus[categoryIndex].updatedAt = new Date().toISOString();
      await this.saveMenus();
      return true;
    }

    return false;
  }

  /**
   * Move a menu item to a different category
   * @param {string} fromCategoryId - Source category ID
   * @param {string} toCategoryId - Target category ID
   * @param {string} itemId - Menu item ID
   * @returns {Object} Moved menu item object
   */
  async moveMenuItem(fromCategoryId, toCategoryId, itemId) {
    await this.init();

    const fromCategoryIndex = this.menus.findIndex(menu => menu.id === fromCategoryId);
    const toCategoryIndex = this.menus.findIndex(menu => menu.id === toCategoryId);

    if (fromCategoryIndex === -1) {
      throw new Error(`Source category with ID ${fromCategoryId} not found`);
    }

    if (toCategoryIndex === -1) {
      throw new Error(`Target category with ID ${toCategoryId} not found`);
    }

    const fromCategory = this.menus[fromCategoryIndex];
    const toCategory = this.menus[toCategoryIndex];

    if (!fromCategory.items) {
      throw new Error(`No items found in source category ${fromCategoryId}`);
    }

    const itemIndex = fromCategory.items.findIndex(item => item.id === itemId);

    if (itemIndex === -1) {
      throw new Error(`Menu item with ID ${itemId} not found in category ${fromCategoryId}`);
    }

    // Remove item from source category
    const [movedItem] = fromCategory.items.splice(itemIndex, 1);

    // Add item to target category
    if (!toCategory.items) {
      toCategory.items = [];
    }
    toCategory.items.push(movedItem);

    // Update timestamps
    this.menus[fromCategoryIndex].updatedAt = new Date().toISOString();
    this.menus[toCategoryIndex].updatedAt = new Date().toISOString();

    await this.saveMenus();

    return movedItem;
  }
}

export default MenuService;
