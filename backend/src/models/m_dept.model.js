import MDeptService from "../modules/m_dept/m_dept.service.js";

const mDeptService = new MDeptService();

const MDeptWrapper = {
  async findAll(options = {}) {
    return mDeptService.getAllDepartments();
  },

  async findOne(options = {}) {
    return mDeptService.getAllDepartments().then(depts => {
      if (!options.where) return depts[0] || null;
      return depts.find(dept => Object.keys(options.where).every(key => dept[key] === options.where[key])) || null;
    });
  },

  async findByPk(dep_kd) {
    await mDeptService.init();
    return mDeptService.getDepartmentByCode(dep_kd);
  },

  async create(data, options) {
    return mDeptService.createDepartment(data);
  },

  async update(data, options) {
    const dep_kd = options?.where?.dep_kd || data?.dep_kd;
    if (dep_kd) {
      const dept = await mDeptService.updateDepartment(dep_kd, data);
      return dept ? [1] : [0];
    }
    return [0];
  },

  async destroy(options) {
    const dep_kd = options?.where?.dep_kd;
    if (dep_kd) {
      const result = await mDeptService.deleteDepartment(dep_kd);
      return result ? 1 : 0;
    }
    return 0;
  },

  async count(options = {}) {
    const deptList = await mDeptService.getAllDepartments();
    return deptList.length;
  },

  async bulkCreate(dataArray, options) {
    const results = [];
    for (const data of dataArray) {
      const dept = await mDeptService.createDepartment(data);
      results.push(dept);
    }
    return results;
  },

  async upsert(data, options) {
    const existingDept = await mDeptService.getDepartmentByCode(data.dep_kd);
    if (existingDept) {
      const updated = await mDeptService.updateDepartment(data.dep_kd, data);
      return updated || existingDept;
    }
    return mDeptService.createDepartment(data);
  },

  async findOrCreate(options) {
    const { where, defaults } = options;
    const existingDept = await mDeptService.getDepartmentByCode(where.dep_kd);
    if (existingDept) {
      return [existingDept, false];
    }
    const newDept = await mDeptService.createDepartment({ ...where, ...defaults });
    return [newDept, true];
  },

  async findAndCountAll(options = {}) {
    const deptList = await mDeptService.getAllDepartments();
    return { count: deptList.length, rows: deptList };
  },

  getModel() {
    return {
      sync: async () => {
        await mDeptService.init();
        return true;
      },
    };
  },
};

export default MDeptWrapper;
