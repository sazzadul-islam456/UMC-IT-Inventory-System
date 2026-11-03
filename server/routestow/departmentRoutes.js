
import express from 'express';

import {
    createDepartment,
    getAllDepartments,
    updateDepartment,
    deleteDepartment
} from '../controllerstwo/departmentControllers.js';

// DEPARTMENT ROUTES - Search: DEPARTMENT ROUTES

const router = express.Router();

// DEPARTMENT ROUTE DIAGNOSTIC - Search: DEPARTMENT ROUTE DIAGNOSTIC
console.log('DEPARTMENT ROUTES LOADED SUCCESSFULLY');

// CREATE DEPARTMENT
router.post('/', createDepartment);

// GET ALL DEPARTMENTS
router.get('/', getAllDepartments);

// UPDATE DEPARTMENT
router.put('/:id', updateDepartment);

// DELETE DEPARTMENT
router.delete('/:id', deleteDepartment);

export default router;
