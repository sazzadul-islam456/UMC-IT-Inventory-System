
import express from 'express';

import {
    createSupplierReturn,
    getEligibleStockUnits,
    getAllSupplierReturns,
    getSupplierReturnById
} from '../controllerstwo/supplierReturnControllers.js';

import adminMiddleware from '../middleware/adminMiddleware.js';

const router = express.Router();

// ALL ROUTES REQUIRE ADMIN ACCESS

// GET ELIGIBLE STOCK UNITS
router.get('/eligible-devices', adminMiddleware, getEligibleStockUnits);

// GET ALL SUPPLIER RETURNS - HISTORY
router.get('/', adminMiddleware, getAllSupplierReturns);

// GET SINGLE SUPPLIER RETURN DETAILS
router.get('/:id', adminMiddleware, getSupplierReturnById);

// CREATE BULK SUPPLIER RETURN
router.post('/', adminMiddleware, createSupplierReturn);

export default router;
