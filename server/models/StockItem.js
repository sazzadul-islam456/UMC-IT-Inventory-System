import mongoose from 'mongoose';

const stockItemSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        category: {
            type: String,
            required: true,
            trim: true
        },

        brand: {
            type: String,
            trim: true,
            default: ''
        },

        model: {
            type: String,
            trim: true,
            default: ''
        },

        sku: {
            type: String,
            trim: true,
            unique: true,
            sparse: true
        },

        // PRODUCT WARRANTY
        warranty: {
            type: String,
            trim: true,
            default: ''
        },

        // PRODUCT SUPPLIER
        supplierName: {
            type: String,
            trim: true,
            default: ''
        },

        unit: {
            type: String,
            enum: ['Piece', 'Box', 'Pack', 'Set', 'Meter', 'Roll'],
            default: 'Piece'
        },

        totalReceivedQuantity: {
            type: Number,
            default: 0,
            min: 0
        },

        availableQuantity: {
            type: Number,
            default: 0,
            min: 0
        },

        assignedQuantity: {
            type: Number,
            default: 0,
            min: 0
        },

        damagedQuantity: {
            type: Number,
            default: 0,
            min: 0
        },

        underRepairQuantity: {
            type: Number,
            default: 0,
            min: 0
        },

        orderedQuantity: {
            type: Number,
            default: 0,
            min: 0
        },

        minimumStockLevel: {
            type: Number,
            default: 5,
            min: 0
        },

        description: {
            type: String,
            default: ''
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

const StockItem = mongoose.model('StockItem', stockItemSchema);

export default StockItem;