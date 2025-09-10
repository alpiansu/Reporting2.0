/**
 * Routes for m_cabang
 */
import express from 'express';
import { authenticateJWT } from '../../middlewares/index.js';
import { getAllCabang, getCabangByCode, createCabang, updateCabang, deleteCabang } from './m_cabang.controller.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Routes
router.get("/", getAllCabang);
router.get("/:kdcab", getCabangByCode);
router.post("/", createCabang);

router.put("/:kdcab", updateCabang);
router.delete("/:kdcab", deleteCabang);

export default router;