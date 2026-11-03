import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        roomNumber: {
            type: String,
            trim: true,
            default: ''
        },

        department: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department',
            required: true
        },

        inCharge: {
            type: String,
            trim: true,
            default: ''
        },

        description: {
            type: String,
            trim: true,
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

const Room = mongoose.model('Room', roomSchema);

export default Room;