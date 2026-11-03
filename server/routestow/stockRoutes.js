
import express from 'express';

import {
    createStockItem,
    getAllStockItems,
    getStockStats,
    updateStockItem,
    deleteStockItem
} from '../controllerstwo/stockControllers.js';

import adminMiddleware from '../middleware/adminMiddleware.js';

const router = express.Router();

// Admin only: Get Stock Statistics
router.get('/stats', adminMiddleware, getStockStats);

// Admin only: Get All Stock Items
router.get('/', adminMiddleware, getAllStockItems);

// Admin only: Create New Stock Item
router.post('/', adminMiddleware, createStockItem);

// Admin only: Update Stock Item
router.put('/:id', adminMiddleware, updateStockItem);

// Admin only: Delete Stock Item
router.delete('/:id', adminMiddleware, deleteStockItem);

export default router;
