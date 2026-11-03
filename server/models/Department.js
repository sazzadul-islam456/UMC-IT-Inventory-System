import mongoose from 'mongoose';

// DEPARTMENT MODEL - Search: DEPARTMENT MODEL

const departmentSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        description: {
            type: String,
            trim: true,
            default: ''
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

const Department = mongoose.model('Department', departmentSchema);

export default Department;