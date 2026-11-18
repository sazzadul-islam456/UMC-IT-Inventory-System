
import mongoose from 'mongoose';

// DAMAGE HISTORY MODEL - Search: DAMAGE HISTORY MODEL

const damageHistorySchema = new mongoose.Schema(
    {
        asset: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Asset',
            required: true,
            index: true
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
            enum: ['Assigned', 'Under Repair'],
            required: true
        },

        source: {
            type: String,
            enum: ['Manual', 'Repair Unsuccessful'],
            required: true
        },

        damageDescription: {
            type: String,
            trim: true,
            default: ''
        },

        damagedAt: {
            type: Date,
            default: Date.now,
            index: true
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

damageHistorySchema.index({ asset: 1, damagedAt: -1 });
damageHistorySchema.index({ source: 1, damagedAt: -1 });

const DamageHistory = mongoose.model('DamageHistory', damageHistorySchema);

export default DamageHistory;
