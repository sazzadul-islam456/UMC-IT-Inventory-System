
import mongoose from 'mongoose';
import Department from '../models/Department.js';

// CREATE DEPARTMENT - Search: CREATE DEPARTMENT
export const createDepartment = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                message: 'Department name is required'
            });
        }

        const existingDepartment = await Department.findOne({
            name: name.trim(),
            isActive: true
        });

        if (existingDepartment) {
            return res.status(400).json({
                message: 'Department already exists'
            });
        }

        const department = await Department.create({
            name: name.trim(),
            description
        });

        return res.status(201).json({
            message: 'Department created successfully',
            department
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

// GET ALL DEPARTMENTS - Search: GET ALL DEPARTMENTS
export const getAllDepartments = async (req, res) => {
    try {
        const departments = await Department.find({
            isActive: true
        }).sort({ name: 1 });

        return res.status(200).json({
            departments
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

// UPDATE DEPARTMENT - Search: UPDATE DEPARTMENT
export const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'Invalid department ID'
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                message: 'Department name is required'
            });
        }

        const existingDepartment = await Department.findOne({
            name: name.trim(),
            _id: { $ne: id },
            isActive: true
        });

        if (existingDepartment) {
            return res.status(400).json({
                message: 'Department name already exists'
            });
        }

        const department = await Department.findOneAndUpdate(
            { _id: id, isActive: true },
            {
                name: name.trim(),
                description
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!department) {
            return res.status(404).json({
                message: 'Department not found'
            });
        }

        return res.status(200).json({
            message: 'Department updated successfully',
            department
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

// DELETE DEPARTMENT - Search: DELETE DEPARTMENT
export const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'Invalid department ID'
            });
        }

        const department = await Department.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );

        if (!department) {
            return res.status(404).json({
                message: 'Department not found'
            });
        }

        return res.status(200).json({
            message: 'Department deleted successfully'
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};
