
import express from 'express';

import {
    getDashboardAudit
} from '../controllerstwo/dashboardAuditControllers.js';

import adminMiddleware from '../middleware/adminMiddleware.js';

// DASHBOARD AUDIT ROUTES - Search: DASHBOARD AUDIT ROUTES

const router = express.Router();

// GET MASTER AUDIT DASHBOARD
router.get('/', adminMiddleware, getDashboardAudit);

export default router;
