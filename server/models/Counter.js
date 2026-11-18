import mongoose from 'mongoose';

// COUNTER MODEL - Search: COUNTER MODEL

const counterSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            required: true
        },
        sequence: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        versionKey: false
    }
);

const Counter = mongoose.model('Counter', counterSchema);

export default Counter;