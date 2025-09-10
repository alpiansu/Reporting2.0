import express from 'express';
import { getUserActivities, logActivity } from './userActivity.controller.js';
import { authenticateJWT } from '../../middlewares/index.js';

const router = express.Router();

router.get('/', authenticateJWT, getUserActivities);
router.post('/', authenticateJWT, logActivity);

export default router;