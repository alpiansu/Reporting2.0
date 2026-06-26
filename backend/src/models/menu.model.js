import MenuService from "../modules/menu-manager/menu.service.js";

const menuService = new MenuService();

const MenuWrapper = {
  async findAll(options = {}) {
    return menuService.getAllMenus();
  },

  async findOne(options = {}) {
    const { where = {} } = options;
    if (where.id) {
      await menuService.init();
      return menuService.getMenuById(where.id);
    }
    const menus = await menuService.getAllMenus();
    return menus[0] || null;
  },

  async findByPk(id) {
    await menuService.init();
    return menuService.getMenuById(id);
  },

  async findByRole(role) {
    await menuService.init();
    return menuService.getMenusByRole(role);
  },

  async create(data, options) {
    await menuService.init();
    return menuService.createMenu(data);
  },

  async update(data, options) {
    await menuService.init();
    return menuService.updateMenu(data);
  },

  async destroy(options) {
    const id = options?.where?.id;
    if (id) {
      await menuService.init();
      return menuService.deleteMenu(id);
    }
    return 0;
  },

  async count(options = {}) {
    const menus = await menuService.getAllMenus();
    return menus.length;
  },

  async bulkCreate(dataArray, options) {
    const results = [];
    for (const data of dataArray) {
      const menu = await menuService.createMenu(data);
      results.push(menu);
    }
    return results;
  },

  async upsert(data, options) {
    const existingMenu = data.id ? await menuService.getMenuById(data.id) : null;
    if (existingMenu) {
      const updated = await menuService.updateMenu(data);
      return updated || existingMenu;
    }
    return menuService.createMenu(data);
  },

  async findOrCreate(options) {
    const { where, defaults } = options;
    const existingMenu = where.id ? await menuService.getMenuById(where.id) : null;
    if (existingMenu) {
      return [existingMenu, false];
    }
    const newMenu = await menuService.createMenu({ ...where, ...defaults });
    return [newMenu, true];
  },

  async findAndCountAll(options = {}) {
    const menus = await menuService.getAllMenus();
    return { count: menus.length, rows: menus };
  },

  getModel() {
    return {
      sync: async () => {
        await menuService.init();
        return true;
      },
    };
  },
};

export default MenuWrapper;
