
import express from 'express';

import {
    createSupplier,
    getAllSuppliers,
    getSupplierById,
    updateSupplier,
    toggleSupplierStatus,
    deleteSupplier
} from '../controllerstwo/supplierControllers.js';

import adminMiddleware from '../middleware/adminMiddleware.js';

const router = express.Router();

// ALL ROUTES REQUIRE ADMIN ACCESS

// GET ALL SUPPLIERS
router.get('/', adminMiddleware, getAllSuppliers);

// CREATE SUPPLIER
router.post('/', adminMiddleware, createSupplier);

// GET SINGLE SUPPLIER
router.get('/:id', adminMiddleware, getSupplierById);

// UPDATE SUPPLIER
router.put('/:id', adminMiddleware, updateSupplier);

// ACTIVATE / DEACTIVATE SUPPLIER
router.patch('/:id/status', adminMiddleware, toggleSupplierStatus);

// DELETE SUPPLIER
router.delete('/:id', adminMiddleware, deleteSupplier);

export default router;
