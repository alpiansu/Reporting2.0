import storeService from './storeService.js';
import StoreSyncService from './store-sync.service.js';
import logger from '../../config/logger.js';

const storeSyncService = new StoreSyncService();

/**
 * Get all stores with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getAllStores = async (req, res, next) => {
  try {
    const { page, limit, search, region, city, status } = req.query;
    
    const options = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search: search || '',
      region,
      city,
      status,
    };
    
    const result = await storeService.getAllStores(options);
    
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Removed default export - using named exports only

/**
 * Get store by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getStoreById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const store = await storeService.getStoreById(id);
    
    res.status(200).json(store);
  } catch (error) {
    if (error.message === 'Store not found') {
      return res.status(404).json({ message: 'Store not found' });
    }
    next(error);
  }
};

/**
 * Get stores by branch with pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getStoresByBranch = async (req, res, next) => {
  try {
    const { branchCode } = req.params;
    const { page, limit, search, onlyInduk, status } = req.query;
    
    const options = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search: search || '',
      onlyInduk: onlyInduk !== 'false', // default true, false only if explicitly set to 'false'
      status,
    };
    
    const result = await storeService.getStoresByBranchPaginated(branchCode, options);
    
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new store
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createStore = async (req, res, next) => {
  try {
    const storeData = req.body;
    
    // Validate required fields - only essential ones
    if (!storeData.storeCode || !storeData.storeName || !storeData.dbHost) {
      return res.status(400).json({ message: 'Missing required store information (storeCode, storeName, dbHost)' });
    }
    
    const store = await storeService.createStore(storeData);
    
    res.status(201).json(store);
  } catch (error) {
    // Handle duplicate store code
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Store code already exists' });
    }
    next(error);
  }
};

/**
 * Update store data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const storeData = req.body;
    
    const store = await storeService.updateStore(id, storeData);
    
    res.status(200).json(store);
  } catch (error) {
    if (error.message === 'Store not found') {
      return res.status(404).json({ message: 'Store not found' });
    }
    // Handle duplicate store code
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Store code already exists' });
    }
    next(error);
  }
};

/**
 * Delete a store
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await storeService.deleteStore(id);
    
    res.status(200).json({ message: 'Store deleted successfully' });
  } catch (error) {
    if (error.message === 'Store not found') {
      return res.status(404).json({ message: 'Store not found' });
    }
    next(error);
  }
};

/**
 * Test connection to a store database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const testConnection = async (req, res, next) => {
  try {
    const connectionData = req.body;
    
    // Validate required fields
    if (!connectionData.host || !connectionData.username || !connectionData.password || !connectionData.database) {
      return res.status(400).json({ message: 'Missing required connection information' });
    }
    
    const result = await storeService.testConnection(connectionData);
    
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Upload TOKOMAIN.ini from a client device. Parses only INDUK + STB rows
 * (kode toko + IP) and saves it as the latest snapshot.
 */
export const uploadTokomain = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File TOKOMAIN.ini tidak ditemukan' });
    }

    const parsed = storeService.parseTokomain(req.file.buffer);
    if (parsed.records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada data INDUK/STB yang valid ditemukan di file ini',
        stats: parsed,
      });
    }

    const snapshot = await storeService.saveTokomainSnapshot(parsed, {
      uploadedBy: req.user?.username || null,
      deviceId: req.body?.deviceId || null,
      clientIp: req.ip || req.socket?.remoteAddress || null,
      sourcePath: req.body?.sourcePath || req.file.originalname || null,
    });

    res.status(200).json({
      success: true,
      message: `Snapshot TOKOMAIN tersimpan: ${parsed.total} records (${parsed.induk} induk, ${parsed.stb} stb)`,
      snapshot: {
        updatedAt: snapshot.updatedAt,
        uploadedBy: snapshot.uploadedBy,
        deviceId: snapshot.deviceId,
        sourcePath: snapshot.sourcePath,
        stats: snapshot.stats,
        count: snapshot.records.length,
      },
    });
  } catch (error) {
    logger.error(`Upload TOKOMAIN error: ${error.message}`);
    next(error);
  }
};

/**
 * Get sync status: latest TOKOMAIN snapshot info + last master sync info
 */
export const getSyncStatus = async (req, res, next) => {
  try {
    const status = await storeSyncService.getSyncStatus();
    res.status(200).json({ success: true, ...status });
  } catch (error) {
    logger.error(`Get sync status error: ${error.message}`);
    next(error);
  }
};

/**
 * Execute master store sync (TOKOMAIN merge with WRC all cabang).
 * Body: { force: boolean } to skip the 24-hour confirmation guard.
 */
export const syncMaster = async (req, res, next) => {
  try {
    const force = Boolean(req.body?.force);
    const result = await storeSyncService.syncMaster(req.user, force);

    if (result.needsConfirmation) {
      return res.status(200).json(result);
    }
    if (result.needsSnapshot) {
      return res.status(400).json(result);
    }
    res.status(200).json(result);
  } catch (error) {
    logger.error(`Sync master toko error: ${error.message}`);
    next(error);
  }
};

/**
 * Upload master-tokomain.csv snapshot.
 * Hanya baris INDUK (is_induk=1) dan STB (station=STB) yang dipakai.
 */
export const uploadMasterCsv = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File master-tokomain.csv tidak ditemukan' });
    }

    const text = req.file.buffer.toString('utf8');
    const parsed = storeService.parseMasterTokomainCsv(text);

    if (parsed.records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada data INDUK/STB yang valid ditemukan di file ini',
        stats: parsed,
      });
    }

    const snapshot = await storeService.saveMasterCsvSnapshot(parsed, {
      uploadedBy: req.user?.username || null,
      uploadedByFullName: req.user?.fullName || null,
      clientIp: req.ip || req.socket?.remoteAddress || null,
      sourcePath: req.file.originalname || null,
    });

    res.status(200).json({
      success: true,
      message: `Snapshot master-tokomain.csv tersimpan: ${parsed.total} records (${parsed.induk} induk, ${parsed.stb} stb)`,
      snapshot: {
        updatedAt: snapshot.updatedAt,
        uploadedBy: snapshot.uploadedBy,
        uploadedByFullName: snapshot.uploadedByFullName,
        clientIp: snapshot.clientIp,
        sourcePath: snapshot.sourcePath,
        stats: snapshot.stats,
        count: snapshot.records.length,
      },
    });
  } catch (error) {
    logger.error(`Upload master CSV error: ${error.message}`);
    next(error);
  }
};

/**
 * Execute master store sync from uploaded master-tokomain.csv.
 * Body: { force: boolean } to skip the 24-hour confirmation guard.
 */
export const syncMasterCsv = async (req, res, next) => {
  try {
    const force = Boolean(req.body?.force);
    const result = await storeSyncService.syncFromMasterCsv(req.user, force);

    if (result.needsConfirmation) {
      return res.status(200).json(result);
    }
    if (result.needsSnapshot) {
      return res.status(400).json(result);
    }
    res.status(200).json(result);
  } catch (error) {
    logger.error(`Sync master CSV error: ${error.message}`);
    next(error);
  }
};