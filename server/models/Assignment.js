
import mongoose from 'mongoose';

// ASSIGNMENT MODEL - Search: ASSIGNMENT MODEL

const assignmentSchema = new mongoose.Schema(
    {
        // UNIQUE ASSIGNMENT ID
        assignmentId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        // ASSIGNMENT TYPE
        assignmentType: {
            type: String,
            enum: ['Department', 'Individual', 'Room'],
            required: true
        },

        // STOCK PRODUCT REFERENCE
        stockItem: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StockItem',
            required: true
        },

        // PRODUCT INFORMATION SNAPSHOT
        productDetails: {
            name: {
                type: String,
                required: true,
                trim: true
            },
            brand: {
                type: String,
                default: ''
            },
            model: {
                type: String,
                default: ''
            },
            sku: {
                type: String,
                default: ''
            }
        },

        // ASSIGNED QUANTITY
        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        // ASSIGNED STOCK UNITS
        stockUnits: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'StockUnit'
            }
        ],

        // CREATED ASSET REFERENCES
        assets: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Asset'
            }
        ],

        // ROOM REFERENCE
        room: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room',
            required: function () {
                return this.assignmentType === 'Room';
            },
            default: null
        },

        // DEPARTMENT REFERENCE
        department: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department',
            required: true
        },

        // RECEIVER INFORMATION
        receiver: {
            name: {
                type: String,
                required: true,
                trim: true
            },
            employeeId: {
                type: String,
                trim: true,
                default: ''
            },
            designation: {
                type: String,
                trim: true,
                default: ''
            },
            phone: {
                type: String,
                trim: true,
                default: ''
            }
        },

        // ASSIGNMENT DATE
        assignedDate: {
            type: Date,
            default: Date.now
        },

        // ADDITIONAL NOTES
        notes: {
            type: String,
            trim: true,
            default: ''
        }
    },
    {
        timestamps: true
    }
);

assignmentSchema.index({ department: 1, assignedDate: -1 });
assignmentSchema.index({ assignmentType: 1, assignedDate: -1 });

const Assignment = mongoose.model('Assignment', assignmentSchema);

export default Assignment;
