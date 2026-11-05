
import express from 'express';

import {
    createStockItem,
    getAllStockItems,
    getStockStats,
    updateStockItem,
    deleteStockItem
} from '../controllerstwo/stockControllers.js';

// STOCK RECEIVING CONTROLLERS
import {
    receiveStock,
    getStockReceipts,
    getStockUnits
} from '../controllerstwo/stockReceivingControllers.js';

// OPENING STOCK REGISTRATION CONTROLLER
import {
    registerOpeningStock
} from '../controllerstwo/openingStockControllers.js';

import adminMiddleware from '../middleware/adminMiddleware.js';

const router = express.Router();

// Admin only: Get Stock Statistics
router.get('/stats', adminMiddleware, getStockStats);

// STOCK RECEIVING / RESTOCK
router.post('/:id/receive', adminMiddleware, receiveStock);

// OPENING STOCK REGISTRATION
router.post(
    '/:id/register-opening',
    adminMiddleware,
    registerOpeningStock
);

// STOCK RECEIVING HISTORY
router.get('/:id/receipts', adminMiddleware, getStockReceipts);

// INDIVIDUAL STOCK UNITS
router.get('/:id/units', adminMiddleware, getStockUnits);

// Admin only: Get All Stock Items
router.get('/', adminMiddleware, getAllStockItems);

// Admin only: Create New Stock Item
router.post('/', adminMiddleware, createStockItem);

// Admin only: Update Stock Item
router.put('/:id', adminMiddleware, updateStockItem);

// Admin only: Delete Stock Item
router.delete('/:id', adminMiddleware, deleteStockItem);

export default router;
