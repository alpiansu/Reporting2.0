import UserService from "../modules/user/user.service.js";

const userService = new UserService();

const UserWrapper = {
  async findAll(options = {}) {
    return userService.getAllUsers();
  },

  async findOne(options = {}) {
    const users = await userService.getAllUsers();
    const where = options.where || {};
    return users.find(user => Object.keys(where).every(key => user[key] === where[key])) || null;
  },

  async findByPk(id) {
    await userService.init();
    return userService.getUserById(id);
  },

  async findByCredentials(login) {
    await userService.init();
    return userService.findByCredentials(login);
  },

  async create(data, options) {
    return userService.createUser(data);
  },

  async update(data, options) {
    const id = options?.where?.id || data?.id;
    if (id) {
      const user = await userService.updateUser(id, data);
      return user ? [1] : [0];
    }
    return [0];
  },

  async destroy(options) {
    const id = options?.where?.id;
    if (id) {
      const result = await userService.deleteUser(id);
      return result ? 1 : 0;
    }
    return 0;
  },

  async count(options = {}) {
    const userList = await userService.getAllUsers();
    return userList.length;
  },

  async bulkCreate(dataArray, options) {
    const results = [];
    for (const data of dataArray) {
      const user = await userService.createUser(data);
      results.push(user);
    }
    return results;
  },

  async upsert(data, options) {
    const existingUser = await userService.findByCredentials(data.username || data.email);
    if (existingUser) {
      const updated = await userService.updateUser(existingUser.id, data);
      return updated || existingUser;
    }
    return userService.createUser(data);
  },

  async findOrCreate(options) {
    const { where, defaults } = options;
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
    const newUser = await userService.createUser({ ...where, ...defaults });
    return [newUser, true];
  },

  async findAndCountAll(options = {}) {
    const userList = await userService.getAllUsers();
    return { count: userList.length, rows: userList };
  },

  getModel() {
    return {
      sync: async () => {
        await userService.init();
        return true;
      },
    };
  },
};

export default UserWrapper;
