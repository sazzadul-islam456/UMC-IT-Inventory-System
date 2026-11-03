
import express from 'express';

import {
    assignAssets,
    getAllAssets
} from '../controllerstwo/assetControllers.js';

import adminMiddleware from '../middleware/adminMiddleware.js';

const router = express.Router();

// GET ALL ASSETS
router.get('/', adminMiddleware, getAllAssets);

// ASSIGN ASSETS
router.post('/assign', adminMiddleware, assignAssets);

export default router;
