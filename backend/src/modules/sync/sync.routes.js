/**
 * Routes for synchronization
 */
import express from 'express';
import { triggerSync } from './sync.controller.js';
import { authenticateJWT } from '../../middlewares/index.js';

const router = express.Router();

// Protect all sync routes with authentication
router.use(authenticateJWT);

// Trigger manual synchronization
router.post('/trigger', triggerSync);

export default router;