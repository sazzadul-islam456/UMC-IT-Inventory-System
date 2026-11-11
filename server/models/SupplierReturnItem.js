
import mongoose from 'mongoose';

// SUPPLIER RETURN ITEM MODEL - Search: SUPPLIER RETURN ITEM MODEL

const supplierReturnItemSchema = new mongoose.Schema(
    {
        // SUPPLIER RETURN DOCUMENT REFERENCE
        supplierReturn: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SupplierReturn',
            required: true,
            index: true
        },

        // STOCK PRODUCT REFERENCE
        stockItem: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StockItem',
            required: true,
            index: true
        },

        // STOCK UNIT REFERENCE
        stockUnit: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StockUnit',
            required: true,
            index: true
        },

        // ASSET REFERENCE
        asset: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Asset',
            default: null,
            index: true
        },

        // DEVICE INFORMATION SNAPSHOT
        productDetails: {
            name: {
                type: String,
                required: true,
                trim: true
            },

            category: {
                type: String,
                trim: true,
                default: ''
            },

            sku: {
                type: String,
                trim: true,
                default: ''
            },

            unitCode: {
                type: String,
                required: true,
                trim: true
            },

            serialNumber: {
                type: String,
                trim: true,
                default: ''
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

            warranty: {
                type: String,
                trim: true,
                default: ''
            },

            assetId: {
                type: String,
                trim: true,
                default: ''
            }
        },

        // PREVIOUS ASSIGNMENT INFORMATION
        previousAssignment: {
            department: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Department',
                default: null
            },

            departmentName: {
                type: String,
                trim: true,
                default: ''
            },

            room: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Room',
                default: null
            },

            roomName: {
                type: String,
                trim: true,
                default: ''
            },

            assignedDate: {
                type: Date,
                default: null
            }
        },

        // INDIVIDUAL DEVICE RETURN REASON
        returnReason: {
            type: String,
            trim: true,
            default: ''
        },

        // DEVICE PROBLEM DESCRIPTION
        problemDescription: {
            type: String,
            trim: true,
            default: ''
        },

        // TECHNICAL INSPECTION RESULT
        technicalInspection: {
            type: String,
            trim: true,
            default: ''
        },

        // WARRANTY CLAIM INFORMATION
        warrantyClaim: {
            status: {
                type: String,
                enum: [
                    'Not Applicable',
                    'Pending',
                    'Submitted',
                    'Approved',
                    'Rejected',
                    'Completed'
                ],
                default: 'Pending'
            },

            referenceNumber: {
                type: String,
                trim: true,
                default: ''
            },

            notes: {
                type: String,
                trim: true,
                default: ''
            }
        },

        // ADDITIONAL DEVICE RETURN NOTES
        notes: {
            type: String,
            trim: true,
            default: ''
        },

        // DEVICE RETURN DATE
        returnedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// RETURN HISTORY SEARCH INDEXES
supplierReturnItemSchema.index({ 'productDetails.unitCode': 1 });
supplierReturnItemSchema.index({ 'productDetails.serialNumber': 1 });
supplierReturnItemSchema.index({ 'productDetails.assetId': 1 });
supplierReturnItemSchema.index({ returnedAt: -1 });

// PREVENT DUPLICATE DEVICE IN SAME RETURN DOCUMENT
supplierReturnItemSchema.index(
    { supplierReturn: 1, stockUnit: 1 },
    { unique: true }
);

const SupplierReturnItem = mongoose.model(
    'SupplierReturnItem',
    supplierReturnItemSchema
);

export default SupplierReturnItem;
