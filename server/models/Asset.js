
import mongoose from 'mongoose';

// ASSET MODEL - Search: ASSET MODEL

const assetSchema = new mongoose.Schema(
    {
        // STOCK PRODUCT REFERENCE
        stockItem: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StockItem',
            required: true
        },

        // UNIQUE ASSET ID
        assetId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        // SERIAL NUMBER
        serialNumber: {
            type: String,
            trim: true,
            sparse: true,
            unique: true
        },

        // PRODUCT INFORMATION SNAPSHOT
        name: {
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
            default: ''
        },

        // DEPARTMENT REFERENCE
        department: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department',
            required: true
        },

        // ROOM REFERENCE
        room: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room',
            required: true
        },

        // ASSET STATUS
        status: {
            type: String,
            enum: [
                'Assigned',
                'Damaged',
                'Under Repair',
                'Returned'
            ],
            default: 'Assigned'
        },

        // ASSIGNMENT DATE
        assignedDate: {
            type: Date,
            default: Date.now
        },

        // SUPPLIER RETURN DOCUMENT REFERENCE
        supplierReturn: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SupplierReturn',
            default: null
        },

        // SUPPLIER RETURN DATE
        supplierReturnedAt: {
            type: Date,
            default: null
        },

        // ADDITIONAL NOTES
        description: {
            type: String,
            trim: true,
            default: ''
        }
    },
    {
        timestamps: true
    }
);

const Asset = mongoose.model('Asset', assetSchema);

export default Asset;
