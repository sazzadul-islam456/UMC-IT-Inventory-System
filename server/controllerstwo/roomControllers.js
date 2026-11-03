import Room from '../models/Room.js';
import Department from '../models/Department.js';

// CREATE ROOM
export const createRoom = async (req, res) => {
    try {
        const {
            name,
            roomNumber,
            department,
            inCharge,
            description
        } = req.body;

        if (!name || !department) {
            return res.status(400).json({
                message: 'Room name and department are required'
            });
        }

        const departmentExists = await Department.findById(department);

        if (!departmentExists) {
            return res.status(404).json({
                message: 'Department not found'
            });
        }

        const room = await Room.create({
            name,
            roomNumber,
            department,
            inCharge,
            description
        });

        res.status(201).json({
            message: 'Room created successfully',
            room
        });
    } catch (error) {
        res.status(500).json({
            message: 'Failed to create room',
            error: error.message
        });
    }
};


// GET ALL ROOMS
export const getAllRooms = async (req, res) => {
    try {
        const rooms = await Room.find()
            .populate('department', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({
            rooms
        });
    } catch (error) {
        res.status(500).json({
            message: 'Failed to fetch rooms',
            error: error.message
        });
    }
};


// UPDATE ROOM
export const updateRoom = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            name,
            roomNumber,
            department,
            inCharge,
            description,
            isActive
        } = req.body;

        if (department) {
            const departmentExists = await Department.findById(department);

            if (!departmentExists) {
                return res.status(404).json({
                    message: 'Department not found'
                });
            }
        }

        const room = await Room.findByIdAndUpdate(
            id,
            {
                name,
                roomNumber,
                department,
                inCharge,
                description,
                isActive
            },
            {
                new: true,
                runValidators: true
            }
        ).populate('department', 'name');

        if (!room) {
            return res.status(404).json({
                message: 'Room not found'
            });
        }

        res.status(200).json({
            message: 'Room updated successfully',
            room
        });
    } catch (error) {
        res.status(500).json({
            message: 'Failed to update room',
            error: error.message
        });
    }
};


// DELETE ROOM
export const deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;

        const room = await Room.findByIdAndDelete(id);

        if (!room) {
            return res.status(404).json({
                message: 'Room not found'
            });
        }

        res.status(200).json({
            message: 'Room deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            message: 'Failed to delete room',
            error: error.message
        });
    }
};