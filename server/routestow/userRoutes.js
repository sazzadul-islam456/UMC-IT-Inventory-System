
import express from 'express';

import {
    createUser,
    getUserStats,
    getAllUsers,
    updateUser,
    deleteUser
} from '../controllerstwo/userControllers.js';

import adminMiddleware from '../middleware/adminMiddleware.js';

const router = express.Router();

// Admin only: Get User Statistics
router.get('/stats', adminMiddleware, getUserStats);

// Admin only: Get All Users
router.get('/', adminMiddleware, getAllUsers);

// Admin only: Create New User
router.post('/', adminMiddleware, createUser);

// Admin only: Update User
router.put('/:id', adminMiddleware, updateUser);

// Admin only: Delete User
router.delete('/:id', adminMiddleware, deleteUser);

export default router;
