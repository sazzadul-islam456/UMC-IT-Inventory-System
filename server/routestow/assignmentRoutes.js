
import express from 'express';

import {
    createAssignment,
    getAllAssignments
} from '../controllerstwo/assignmentControllers.js';

import adminMiddleware from '../middleware/adminMiddleware.js';

const router = express.Router();

// GET ALL ASSIGNMENTS
router.get('/', adminMiddleware, getAllAssignments);

// CREATE ASSIGNMENT
router.post('/', adminMiddleware, createAssignment);

export default router;
