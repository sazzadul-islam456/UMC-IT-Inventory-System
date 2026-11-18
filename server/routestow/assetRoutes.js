
import express from 'express';

import {
    getAllAssets
} from '../controllerstwo/assetControllers.js';

import {
    markAssetDamaged,
    sendAssetForRepair,
    completeRepair,
    getRepairHistory,
    getDamageHistory
} from '../controllerstwo/repairControllers.js';

import adminMiddleware from '../middleware/adminMiddleware.js';

const router = express.Router();

// GET ALL ASSETS
router.get('/', adminMiddleware, getAllAssets);

// GET DAMAGE HISTORY
router.get('/damage/history', adminMiddleware, getDamageHistory);

// GET REPAIR HISTORY
router.get('/repair/history', adminMiddleware, getRepairHistory);

// MARK ASSET AS DAMAGED
router.patch('/:assetId/damage', adminMiddleware, markAssetDamaged);

// SEND ASSET FOR REPAIR
router.post('/:assetId/repair', adminMiddleware, sendAssetForRepair);

// COMPLETE REPAIR
router.patch('/repair/:repairId/complete', adminMiddleware, completeRepair);

export default router;
