import config from "../config/index.js";
const { resilientDb } = config;
import User from "./user.model.js";
import Store from "./store.model.js";
import SalesPerDept from "./sales_per_dept.model.js";
import MDept from "./m_dept.model.js";
import RekonWtHarian from "./rekon_wt_harian.model.js";
import RekapRemote from "./rekap_remote.model.js";
import HistAdjust from "./hist_adjust.model.js";
import HistBuatRmb from "./hist_buat_rmb.js";
import SaldoVirtual from "./saldovirtual.model.js";
import NotesEdp from "./notes.model.js";
import NoteCategories from "../modules/note_categories/noteCategories.model.js";
import Penyesuaian from "../modules/penyesuaian/penyesuaian.model.js";
import PenyesuaianSummary from "../modules/penyesuaian/penyesuaian_summary.model.js";
import PrepClosing from "../modules/prep-closing/prep_closing.model.js";
import DetailRekonSales from "../modules/rekon_sales/models/detail_rekon_sales.model.js";
import MtranVsCd from "../modules/rekon_sales/models/mtran_vs_cd.model.js";
import RekonSales from "../modules/rekon_sales/models/rekon_sales.model.js";
import SaldoRekonPersediaan from "./saldorekonpersediaan.model.js";
import { CeklistSpaceHddWrapper, CeklistSpaceTampungWrapper, CeklistImportIdtWrapper } from "../modules/ceklist-prep-closing/ceklist_prep_closing.model.js";
import modelRegistry from "./registry.js";

// Register all Sequelize models with the registry
// Priority: higher numbers are initialized first
modelRegistry.register("PrepClosing", () => PrepClosing.getModel(), { priority: 15 });
modelRegistry.register("Penyesuaian", () => Penyesuaian.getModel(), { priority: 14 });
modelRegistry.register("PenyesuaianSummary", () => PenyesuaianSummary.getModel(), { priority: 13.5 });
modelRegistry.register("NoteCategories", () => NoteCategories.getModel(), { priority: 13 });
modelRegistry.register("NotesEdp", () => NotesEdp.getModel(), { priority: 12 });
modelRegistry.register("SaldoVirtual", () => SaldoVirtual.getModel(), { priority: 11 });
modelRegistry.register("RekonWtHarian", () => RekonWtHarian.getModel(), { priority: 10 });
modelRegistry.register("RekapRemote", () => RekapRemote.getModel(), { priority: 9 });
modelRegistry.register("SalesPerDept", () => SalesPerDept.getModel(), { priority: 8 });
modelRegistry.register("MDept", () => MDept.getModel(), { priority: 7 });
modelRegistry.register("HistAdjust", () => HistAdjust.getModel(), { priority: 6 });
modelRegistry.register("HistBuatRmb", () => HistBuatRmb.getModel(), { priority: 5.5 });
modelRegistry.register("DetailRekonSales", () => DetailRekonSales.getModel(), { priority: 5 });
modelRegistry.register("MtranVsCd", () => MtranVsCd.getModel(), { priority: 4 });
modelRegistry.register("RekonSales", () => RekonSales.getModel(), { priority: 3 });
modelRegistry.register("SaldoRekonPersediaan", () => SaldoRekonPersediaan.getModel(), { priority: 2 });
modelRegistry.register("CeklistSpaceHdd", () => CeklistSpaceHddWrapper.getModel(), { priority: 1.5 });
modelRegistry.register("CeklistSpaceTampung", () => CeklistSpaceTampungWrapper.getModel(), { priority: 1.4 });
modelRegistry.register("CeklistImportIdt", () => CeklistImportIdtWrapper.getModel(), { priority: 1.3 });

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
  HistBuatRmb,
  SaldoVirtual,
  NotesEdp,
  NoteCategories,
  modelRegistry,
  Penyesuaian,
  PenyesuaianSummary,
  PrepClosing,
  DetailRekonSales,
  MtranVsCd,
  RekonSales,
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
  HistBuatRmb,
  SaldoVirtual,
  NotesEdp,
  NoteCategories,
  modelRegistry,
  Penyesuaian,
  PenyesuaianSummary,
  PrepClosing,
  DetailRekonSales,
  MtranVsCd,
  RekonSales,
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
