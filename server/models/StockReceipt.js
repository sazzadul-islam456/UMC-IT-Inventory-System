
import mongoose from 'mongoose';

// STOCK RECEIPT MODEL - Search: STOCK RECEIPT MODEL

const stockReceiptSchema = new mongoose.Schema(
    {
        // STOCK PRODUCT REFERENCE
        stockItem: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StockItem',
            required: true,
            index: true
        },

        // UNIQUE RECEIPT NUMBER
        receiptNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        // RECEIVED QUANTITY
        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        // RECEIVING DATE
        receivedDate: {
            type: Date,
            default: Date.now
        },

        // SUPPLIER INFORMATION
        supplier: {
            type: String,
            trim: true,
            default: ''
        },

        // PURCHASE / INVOICE REFERENCE
        referenceNumber: {
            type: String,
            trim: true,
            default: ''
        },

        // RECEIVING NOTES
        description: {
            type: String,
            trim: true,
            default: ''
        },

        // ADMIN WHO RECEIVED THE STOCK
        receivedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    {
        timestamps: true
    }
);

const StockReceipt = mongoose.model('StockReceipt', stockReceiptSchema);

export default StockReceipt;
