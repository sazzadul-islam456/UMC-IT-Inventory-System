
import mongoose from 'mongoose';

// SUPPLIER MODEL - Search: SUPPLIER MODEL

const supplierSchema = new mongoose.Schema(
    {
        // SUPPLIER / COMPANY NAME
        companyName: {
            type: String,
            required: true,
            trim: true
        },

        // CONTACT PERSON
        contactPerson: {
            type: String,
            trim: true,
            default: ''
        },

        // SUPPLIER PHONE NUMBER
        phone: {
            type: String,
            trim: true,
            default: ''
        },

        // SUPPLIER EMAIL
        email: {
            type: String,
            trim: true,
            lowercase: true,
            default: ''
        },

        // SUPPLIER ADDRESS
        address: {
            type: String,
            trim: true,
            default: ''
        },

        // ADDITIONAL NOTES
        notes: {
            type: String,
            trim: true,
            default: ''
        },

        // SUPPLIER STATUS
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

// SUPPLIER SEARCH INDEX
supplierSchema.index({ companyName: 1 });

const Supplier = mongoose.model('Supplier', supplierSchema);

export default Supplier;
