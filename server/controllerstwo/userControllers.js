
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';

const allowedRoles = ['admin', 'user', 'employee', 'customer'];

// Create User
const createUser = async (req, res) => {
    try {
        const { name, email, password, whatsappNumber, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: 'Name, email and password are required'
            });
        }

        if (role && !allowedRoles.includes(role)) {
            return res.status(400).json({
                message: 'Invalid user role'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                message: 'This email is already registered'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            whatsappNumber: whatsappNumber || '',
            role: role || 'user',
            isActive: true
        });

        return res.status(201).json({
            message: 'User created successfully',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                whatsappNumber: user.whatsappNumber,
                role: user.role,
                isActive: user.isActive
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: 'Failed to create user',
            error: error.message
        });
    }
};

// Get User Statistics
const getUserStats = async (req, res) => {
    try {
        const [totalUsers, totalAdmins, normalUsers] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: 'admin' }),
            User.countDocuments({
                role: { $in: ['user', 'employee', 'customer'] }
            })
        ]);

        return res.status(200).json({
            totalUsers,
            totalAdmins,
            normalUsers
        });

    } catch (error) {
        return res.status(500).json({
            message: 'Failed to load user statistics',
            error: error.message
        });
    }
};

// Get All Users
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort({ _id: -1 });

        return res.status(200).json({ users });

    } catch (error) {
        return res.status(500).json({
            message: 'Failed to load users',
            error: error.message
        });
    }
};

// Update User
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, whatsappNumber, role } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'Invalid user ID'
            });
        }

        if (!name || !email || !role) {
            return res.status(400).json({
                message: 'Name, email and role are required'
            });
        }

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                message: 'Invalid user role'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail,
            _id: { $ne: id }
        });

        if (existingUser) {
            return res.status(409).json({
                message: 'This email is already registered'
            });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        user.name = name.trim();
        user.email = normalizedEmail;
        user.whatsappNumber = whatsappNumber || '';
        user.role = role;

        await user.save();

        return res.status(200).json({
            message: 'User updated successfully',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                whatsappNumber: user.whatsappNumber,
                role: user.role,
                isActive: user.isActive
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: 'Failed to update user',
            error: error.message
        });
    }
};

// Delete User
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'Invalid user ID'
            });
        }

        // Prevent admin from deleting their own account
        if (req.user._id.toString() === id) {
            return res.status(403).json({
                message: 'You cannot delete your own admin account'
            });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        // Prevent deleting the last active admin
        if (user.role === 'admin' && user.isActive !== false) {
            const activeAdminCount = await User.countDocuments({
                role: 'admin',
                isActive: { $ne: false }
            });

            if (activeAdminCount <= 1) {
                return res.status(403).json({
                    message: 'Cannot delete the last active admin'
                });
            }
        }

        await User.findByIdAndDelete(id);

        return res.status(200).json({
            message: 'User deleted successfully'
        });

    } catch (error) {
        return res.status(500).json({
            message: 'Failed to delete user',
            error: error.message
        });
    }
};

export {
    createUser,
    getUserStats,
    getAllUsers,
    updateUser,
    deleteUser
};
