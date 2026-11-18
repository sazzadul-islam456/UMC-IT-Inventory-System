
import express from 'express';

import {
    createAssignment,
    getAllAssignments,
    getRoomInventory
} from '../controllerstwo/assignmentControllers.js';

import adminMiddleware from '../middleware/adminMiddleware.js';

const router = express.Router();

// GET ALL ASSIGNMENTS
router.get('/', adminMiddleware, getAllAssignments);

// GET ROOM INVENTORY
router.get('/room/:roomId', adminMiddleware, getRoomInventory);

// CREATE ASSIGNMENT
router.post('/', adminMiddleware, createAssignment);

export default router;
