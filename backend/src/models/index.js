import config from "../config/index.js";
const { resilientDb } = config;
import User from "./user.model.js";
import Store from "./store.model.js";
import SalesPerDept from "./sales_per_dept.model.js";
import MDept from "./m_dept.model.js";
import RekonWtHarian from "./rekon_wt_harian.model.js";
import RekapRemote from "./rekap_remote.model.js";
import HistAdjust from "./hist_adjust.model.js";
import SaldoVirtual from "./saldovirtual.model.js";
import NotesEdp from "./notes.model.js";
import NoteCategories from "../modules/note_categories/noteCategories.model.js";
import Penyesuaian from "../modules/penyesuaian/penyesuaian.model.js";
import PrepClosing from "../modules/prep-closing/prep_closing.model.js";
import modelRegistry from "./registry.js";

// Register all Sequelize models with the registry
// Priority: higher numbers are initialized first
modelRegistry.register("PrepClosing", () => PrepClosing.getModel(), { priority: 15 });
modelRegistry.register("Penyesuaian", () => Penyesuaian.getModel(), { priority: 14 });
modelRegistry.register("NoteCategories", () => NoteCategories.getModel(), { priority: 13 });
modelRegistry.register("NotesEdp", () => NotesEdp.getModel(), { priority: 12 });
modelRegistry.register("SaldoVirtual", () => SaldoVirtual.getModel(), { priority: 11 });
modelRegistry.register("RekonWtHarian", () => RekonWtHarian.getModel(), { priority: 10 });
modelRegistry.register("RekapRemote", () => RekapRemote.getModel(), { priority: 9 });
modelRegistry.register("SalesPerDept", () => SalesPerDept.getModel(), { priority: 8 });
modelRegistry.register("MDept", () => MDept.getModel(), { priority: 7 });
modelRegistry.register("HistAdjust", () => HistAdjust.getModel(), { priority: 6 });

// Note: User and Store are JSON-based models, not Sequelize models
// They don't need to be registered for database sync

// Define relationships between models
// Note: Store is now a JSON-based model, so Sequelize relationships don't apply to it

// Note: Store relationships are now handled manually in the service layer
// since Store is no longer a Sequelize model

// Export models
export default {
  getDatabase: () => resilientDb.getDatabase(),
  closeDatabase: () => resilientDb.close(),
  initializeModels: async () => {
    const sequelize = await resilientDb.getDatabase();
    return await modelRegistry.initializeAllModels(sequelize);
  },
  getModel: name => modelRegistry.getModel(name),
  User,
  Store,
  SalesPerDept,
  MDept,
  RekonWtHarian,
  RekapRemote,
  HistAdjust,
  SaldoVirtual,
  NotesEdp,
  NoteCategories,
  modelRegistry,
  Penyesuaian,
  PrepClosing,
};

// Named exports for backward compatibility
export {
  User,
  Store,
  SalesPerDept,
  MDept,
  RekonWtHarian,
  RekapRemote,
  HistAdjust,
  SaldoVirtual,
  NotesEdp,
  NoteCategories,
  modelRegistry,
  Penyesuaian,
  PrepClosing,
};

// Database connection functions
export const getDatabase = () => resilientDb.getDatabase();
export const closeDatabase = () => resilientDb.close();
export const initializeModels = async () => {
  const sequelize = await resilientDb.getDatabase();
  return await modelRegistry.initializeAllModels(sequelize);
};
export const getModel = name => modelRegistry.getModel(name);

// Helper function to manually associate store with manager
// This replaces the Sequelize relationship that was removed
export const getStoreManager = async managerId => {
  if (!managerId) return null;
  return await User.findByPk(managerId);
};
