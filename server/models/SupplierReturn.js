
import mongoose from 'mongoose';

// SUPPLIER RETURN MODEL - Search: SUPPLIER RETURN MODEL

const supplierReturnSchema = new mongoose.Schema(
    {
        // UNIQUE SUPPLIER RETURN NUMBER
        returnNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        // SUPPLIER REFERENCE
        supplier: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Supplier',
            required: true,
            index: true
        },

        // SUPPLIER INFORMATION SNAPSHOT
        supplierDetails: {
            companyName: {
                type: String,
                required: true,
                trim: true
            },

            contactPerson: {
                type: String,
                trim: true,
                default: ''
            },

            phone: {
                type: String,
                trim: true,
                default: ''
            },

            email: {
                type: String,
                trim: true,
                default: ''
            },

            address: {
                type: String,
                trim: true,
                default: ''
            }
        },

        // TOTAL RETURNED DEVICE COUNT
        totalItems: {
            type: Number,
            required: true,
            min: 1,
            default: 1
        },

        // RETURN DATE
        returnDate: {
            type: Date,
            required: true,
            default: Date.now
        },

        // RETURN REASON
        returnReason: {
            type: String,
            trim: true,
            default: ''
        },

        // SUPPLIER REFERENCE / CHALLAN NUMBER
        referenceNumber: {
            type: String,
            trim: true,
            default: ''
        },

        // GENERAL RETURN NOTES
        notes: {
            type: String,
            trim: true,
            default: ''
        },

        // ADMIN WHO PREPARED THE RETURN
        preparedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        // RETURN DOCUMENT STATUS
        status: {
            type: String,
            enum: ['Completed', 'Cancelled'],
            default: 'Completed',
            index: true
        }
    },
    {
        timestamps: true
    }
);

// SUPPLIER RETURN SEARCH INDEXES
supplierReturnSchema.index({ returnDate: -1 });
supplierReturnSchema.index({ returnNumber: 1, supplier: 1 });

const SupplierReturn = mongoose.model(
    'SupplierReturn',
    supplierReturnSchema
);

export default SupplierReturn;
