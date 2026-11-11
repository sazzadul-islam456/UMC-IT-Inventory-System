
import mongoose from 'mongoose';

// STOCK UNIT MODEL - Search: STOCK UNIT MODEL

const stockUnitSchema = new mongoose.Schema(
    {
        // STOCK PRODUCT REFERENCE
        stockItem: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StockItem',
            required: true,
            index: true
        },

        // UNIQUE SYSTEM GENERATED DEVICE CODE
        unitCode: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        // MANUFACTURER SERIAL NUMBER
        serialNumber: {
            type: String,
            trim: true,
            sparse: true,
            unique: true
        },

        // RECEIVING BATCH REFERENCE
        receipt: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StockReceipt',
            required: true
        },

        // DEVICE STATUS
        status: {
            type: String,
            enum: [
                'Available',
                'Assigned',
                'Damaged',
                'Under Repair',
                'Returned'
            ],
            default: 'Available',
            index: true
        },

        // LINK TO ASSET AFTER ASSIGNMENT
        asset: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Asset',
            default: null
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

const StockUnit = mongoose.model('StockUnit', stockUnitSchema);

export default StockUnit;
