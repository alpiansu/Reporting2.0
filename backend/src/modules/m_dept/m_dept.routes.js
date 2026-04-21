/**
 * Routes for m_dept
 */
import express from 'express';
import { authenticateJWT } from '../../middlewares/index.js';
import { getAllDepartments, createDepartment, updateDepartment, deleteDepartment, uploadDepartments } from './m_dept.controller.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Routes
router.get("/", getAllDepartments);
router.post("/", createDepartment);
router.put("/:kddept", updateDepartment);
router.delete("/:kddept", deleteDepartment);
router.post("/upload", uploadDepartments);

export default router;