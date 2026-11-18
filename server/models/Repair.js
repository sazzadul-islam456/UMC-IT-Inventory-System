
import mongoose from 'mongoose';

// REPAIR MODEL - Search: REPAIR MODEL

const repairSchema = new mongoose.Schema(
    {
        repairNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        asset: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Asset',
            required: true
        },

        stockUnit: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StockUnit',
            required: true
        },

        stockItem: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StockItem',
            required: true
        },

        previousStatus: {
            type: String,
            enum: ['Assigned', 'Damaged'],
            required: true
        },

        previousDepartment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department',
            default: null
        },

        previousRoom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room',
            default: null
        },

        issueDescription: {
            type: String,
            required: true,
            trim: true
        },

        repairProvider: {
            type: String,
            trim: true,
            default: ''
        },

        technician: {
            type: String,
            trim: true,
            default: ''
        },

        estimatedCost: {
            type: Number,
            default: 0,
            min: 0
        },

        actualCost: {
            type: Number,
            default: 0,
            min: 0
        },

        sentForRepairAt: {
            type: Date,
            default: Date.now
        },

        completedAt: {
            type: Date,
            default: null
        },

        status: {
            type: String,
            enum: ['In Progress', 'Successful', 'Unsuccessful'],
            default: 'In Progress'
        },

        resultNotes: {
            type: String,
            trim: true,
            default: ''
        },

        notes: {
            type: String,
            trim: true,
            default: ''
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    { timestamps: true }
);

// INDEXES
repairSchema.index({ asset: 1, createdAt: -1 });
repairSchema.index({ stockUnit: 1, createdAt: -1 });
repairSchema.index({ status: 1, sentForRepairAt: -1 });

const Repair = mongoose.model('Repair', repairSchema);

export default Repair;
