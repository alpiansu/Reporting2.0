import express from 'express';
import progressRoutes from './progress.routes.js';
import { authenticateJWT } from '../middlewares/index.js';

const router = express.Router();

// Global progress routes
router.use('/api/progress', authenticateJWT, progressRoutes);

// Note: All other routes (auth, store, sync, userActivity, upload) are now handled by their respective modules

export default router;
