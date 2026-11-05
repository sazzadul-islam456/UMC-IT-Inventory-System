
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

import Asset from '../models/Asset.js';
import StockItem from '../models/StockItem.js';
import StockUnit from '../models/StockUnit.js';
import Department from '../models/Department.js';
import Room from '../models/Room.js';

// ASSET CONTROLLERS - Search: ASSET CONTROLLERS


// ASSIGN ASSETS
export const assignAssets = async (req, res) => {
    let session;

    try {
        const {
            stockItemId,
            departmentId,
            roomId,
            quantity,
            description = ''
        } = req.body;

        // REQUIRED FIELD VALIDATION
        if (!stockItemId || !departmentId || !roomId || quantity === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Stock item, department, room and quantity are required'
            });
        }

        // QUANTITY VALIDATION
        const assignQuantity = Number(quantity);

        if (!Number.isSafeInteger(assignQuantity) || assignQuantity < 1) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a positive whole number'
            });
        }

        // MONGODB ID VALIDATION
        if (
            !mongoose.isValidObjectId(stockItemId) ||
            !mongoose.isValidObjectId(departmentId) ||
            !mongoose.isValidObjectId(roomId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid stock, department or room ID'
            });
        }

        // DESCRIPTION VALIDATION
        if (typeof description !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Description must be text'
            });
        }

        // START MONGODB TRANSACTION
        session = await mongoose.startSession();

        let updatedStock;
        let createdAssets;

        await session.withTransaction(
            async () => {

                // CHECK STOCK ITEM
                const stockItem = await StockItem.findOne({
                    _id: stockItemId,
                    isActive: true
                }).session(session);

                if (!stockItem) {
                    const error = new Error('Stock item not found or inactive');
                    error.statusCode = 404;
                    throw error;
                }

                // CHECK DEPARTMENT
                const department = await Department.findOne({
                    _id: departmentId,
                    isActive: true
                }).session(session);

                if (!department) {
                    const error = new Error('Department not found or inactive');
                    error.statusCode = 404;
                    throw error;
                }

                // CHECK ROOM
                const room = await Room.findOne({
                    _id: roomId,
                    department: departmentId,
                    isActive: true
                }).session(session);

                if (!room) {
                    const error = new Error(
                        'Room not found, inactive or does not belong to this department'
                    );
                    error.statusCode = 404;
                    throw error;
                }

                // CHECK AVAILABLE STOCK QUANTITY
                if (stockItem.availableQuantity < assignQuantity) {
                    const error = new Error(
                        `Only ${stockItem.availableQuantity} items are available`
                    );
                    error.statusCode = 400;
                    throw error;
                }

                // FIND INDIVIDUAL AVAILABLE STOCK UNITS
                const availableUnits = await StockUnit.find({
                    stockItem: stockItemId,
                    status: 'Available',
                    asset: null
                })
                    .sort({ createdAt: 1 })
                    .limit(assignQuantity)
                    .session(session);

                // CHECK INDIVIDUAL UNIT AVAILABILITY
                if (availableUnits.length < assignQuantity) {
                    const error = new Error(
                        `Only ${availableUnits.length} individually tracked devices are available. Please receive or register the remaining devices first.`
                    );
                    error.statusCode = 400;
                    throw error;
                }

                // PREPARE INDIVIDUAL ASSETS
                const assets = availableUnits.map(unit => ({
                    stockItem: stockItem._id,

                    // USE STOCK UNIT CODE AS ASSET ID
                    assetId: unit.unitCode,

                    // COPY MANUFACTURER SERIAL NUMBER
                    ...(unit.serialNumber
                        ? { serialNumber: unit.serialNumber }
                        : {}),

                    name: stockItem.name,
                    brand: stockItem.brand || '',
                    model: stockItem.model || '',
                    sku: stockItem.sku || '',

                    department: department._id,
                    room: room._id,

                    status: 'Assigned',
                    assignedDate: new Date(),
                    description: description.trim()
                }));

                // ATOMIC STOCK QUANTITY UPDATE
                updatedStock = await StockItem.findOneAndUpdate(
                    {
                        _id: stockItemId,
                        isActive: true,
                        availableQuantity: { $gte: assignQuantity }
                    },
                    {
                        $inc: {
                            availableQuantity: -assignQuantity,
                            assignedQuantity: assignQuantity
                        }
                    },
                    {
                        new: true,
                        runValidators: true,
                        session
                    }
                );

                if (!updatedStock) {
                    const error = new Error(
                        'Stock availability changed. Please refresh and try again.'
                    );
                    error.statusCode = 409;
                    throw error;
                }

                // CREATE ASSETS
                createdAssets = await Asset.insertMany(
                    assets,
                    {
                        ordered: true,
                        session
                    }
                );

                // UPDATE INDIVIDUAL STOCK UNIT STATUS
                const unitUpdates = availableUnits.map((unit, index) => ({
                    updateOne: {
                        filter: {
                            _id: unit._id,
                            status: 'Available',
                            asset: null
                        },
                        update: {
                            $set: {
                                status: 'Assigned',
                                asset: createdAssets[index]._id
                            }
                        }
                    }
                }));

                const unitUpdateResult = await StockUnit.bulkWrite(
                    unitUpdates,
                    { session }
                );

                // VERIFY ALL STOCK UNITS WERE UPDATED
                if (unitUpdateResult.matchedCount !== assignQuantity) {
                    const error = new Error(
                        'Some stock units could not be updated. Please try again.'
                    );
                    error.statusCode = 409;
                    throw error;
                }
            },
            {
                readConcern: { level: 'snapshot' },
                writeConcern: { w: 'majority' },
                readPreference: 'primary'
            }
        );

        // TRANSACTION SUCCESS RESPONSE
        return res.status(201).json({
            success: true,
            message: `${assignQuantity} asset(s) assigned successfully`,
            assignedQuantity: assignQuantity,
            stock: updatedStock,
            assets: createdAssets
        });

    } catch (error) {
        console.error('ASSIGN ASSETS ERROR:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Duplicate Asset ID or Serial Number detected'
            });
        }

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to assign assets',
            error: error.message
        });

    } finally {
        // SAFELY END TRANSACTION SESSION
        if (session) {
            try {
                await session.endSession();
            } catch (sessionError) {
                console.error(
                    'ASSET TRANSACTION SESSION CLEANUP ERROR:',
                    sessionError
                );
            }
        }
    }
};


// GET ALL ASSETS
export const getAllAssets = async (req, res) => {
    try {
        const assets = await Asset.find()
            .populate('stockItem', 'name category brand model sku')
            .populate('department', 'name')
            .populate('room', 'name roomNumber')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: assets.length,
            assets
        });

    } catch (error) {
        console.error('GET ALL ASSETS ERROR:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch assets',
            error: error.message
        });
    }
};
