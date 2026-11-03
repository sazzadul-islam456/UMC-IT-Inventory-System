import express from 'express';

import {
    createRoom,
    getAllRooms,
    updateRoom,
    deleteRoom
} from '../controllerstwo/roomControllers.js';

import adminMiddleware from '../middleware/adminMiddleware.js';

const router = express.Router();

// ROOM ROUTES LOADED SUCCESSFULLY
console.log('ROOM ROUTES LOADED SUCCESSFULLY');

// GET ALL ROOMS
router.get('/', adminMiddleware, getAllRooms);

// CREATE ROOM
router.post('/', adminMiddleware, createRoom);

// UPDATE ROOM
router.put('/:id', adminMiddleware, updateRoom);

// DELETE ROOM
router.delete('/:id', adminMiddleware, deleteRoom);

export default router;