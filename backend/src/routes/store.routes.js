const express = require('express');
const { storeController } = require('../controllers');
const { authenticateJWT, authorizeRole } = require('../middlewares');

const router = express.Router();

/**
 * @route GET /api/stores
 * @desc Get all stores with pagination
 * @access Private
 */
router.get('/', authenticateJWT, storeController.getAllStores);

/**
 * @route GET /api/stores/:id
 * @desc Get store by ID
 * @access Private
 */
router.get('/:id', authenticateJWT, storeController.getStoreById);

/**
 * @route POST /api/stores
 * @desc Create a new store
 * @access Private (Admin/Manager only)
 */
router.post('/', authenticateJWT, authorizeRole(['admin', 'manager']), storeController.createStore);

/**
 * @route PUT /api/stores/:id
 * @desc Update store data
 * @access Private (Admin/Manager only)
 */
router.put('/:id', authenticateJWT, authorizeRole(['admin', 'manager']), storeController.updateStore);

/**
 * @route DELETE /api/stores/:id
 * @desc Delete a store
 * @access Private (Admin only)
 */
router.delete('/:id', authenticateJWT, authorizeRole('admin'), storeController.deleteStore);

/**
 * @route POST /api/stores/test-connection
 * @desc Test connection to a store database
 * @access Private
 */
router.post('/test-connection', authenticateJWT, storeController.testConnection);

module.exports = router;