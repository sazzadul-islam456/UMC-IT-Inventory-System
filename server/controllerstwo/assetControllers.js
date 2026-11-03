
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

import Asset from '../models/Asset.js';
import StockItem from '../models/StockItem.js';
import Department from '../models/Department.js';
import Room from '../models/Room.js';

// ASSET CONTROLLERS - Search: ASSET CONTROLLERS


// ASSIGN ASSETS
export const assignAssets = async (req, res) => {
    try {
        const {
            stockItemId,
            departmentId,
            roomId,
            quantity,
            serialNumbers = [],
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

        if (!Number.isInteger(assignQuantity) || assignQuantity < 1) {
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

        // SERIAL NUMBER VALIDATION
        if (!Array.isArray(serialNumbers)) {
            return res.status(400).json({
                success: false,
                message: 'Serial numbers must be an array'
            });
        }

        if (serialNumbers.length !== 0 && serialNumbers.length !== assignQuantity) {
            return res.status(400).json({
                success: false,
                message: 'Provide one serial number for each asset, or leave them empty'
            });
        }

        const cleanedSerialNumbers = serialNumbers.map(serial =>
            typeof serial === 'string' ? serial.trim() : ''
        );

        if (cleanedSerialNumbers.some(serial => !serial)) {
            return res.status(400).json({
                success: false,
                message: 'Serial numbers cannot be empty'
            });
        }

        if (new Set(cleanedSerialNumbers).size !== cleanedSerialNumbers.length) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate serial numbers are not allowed'
            });
        }

        // CHECK STOCK ITEM
        const stockItem = await StockItem.findOne({
            _id: stockItemId,
            isActive: true
        });

        if (!stockItem) {
            return res.status(404).json({
                success: false,
                message: 'Stock item not found or inactive'
            });
        }

        // CHECK DEPARTMENT
        const department = await Department.findOne({
            _id: departmentId,
            isActive: true
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found or inactive'
            });
        }

        // CHECK ROOM
        const room = await Room.findOne({
            _id: roomId,
            department: departmentId,
            isActive: true
        });

        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found, inactive or does not belong to this department'
            });
        }

        // CHECK AVAILABLE QUANTITY
        if (stockItem.availableQuantity < assignQuantity) {
            return res.status(400).json({
                success: false,
                message: `Only ${stockItem.availableQuantity} items are available`
            });
        }

        // CHECK EXISTING SERIAL NUMBERS
        if (cleanedSerialNumbers.length > 0) {
            const existingSerial = await Asset.findOne({
                serialNumber: { $in: cleanedSerialNumbers }
            });

            if (existingSerial) {
                return res.status(409).json({
                    success: false,
                    message: 'One or more serial numbers already exist'
                });
            }
        }

        // PREPARE INDIVIDUAL ASSETS
        const assets = Array.from({ length: assignQuantity }, (_, index) => ({
            stockItem: stockItem._id,

            assetId: `UMC-AST-${randomUUID()}`,

            ...(cleanedSerialNumbers[index]
                ? { serialNumber: cleanedSerialNumbers[index] }
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
        // Prevents assigning more than available stock.
        const updatedStock = await StockItem.findOneAndUpdate(
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
                runValidators: true
            }
        );

        if (!updatedStock) {
            return res.status(409).json({
                success: false,
                message: 'Stock availability changed. Please refresh and try again.'
            });
        }

        // CREATE ASSETS
        try {
            const createdAssets = await Asset.insertMany(assets, {
                ordered: true
            });

            return res.status(201).json({
                success: true,
                message: `${assignQuantity} asset(s) assigned successfully`,
                assignedQuantity: assignQuantity,
                stock: updatedStock,
                assets: createdAssets
            });

        } catch (assetError) {
            // ROLLBACK STOCK QUANTITY IF ASSET CREATION FAILS
            await StockItem.updateOne(
                { _id: stockItemId },
                {
                    $inc: {
                        availableQuantity: assignQuantity,
                        assignedQuantity: -assignQuantity
                    }
                }
            );

            throw assetError;
        }

    } catch (error) {
        console.error('ASSIGN ASSETS ERROR:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Duplicate Asset ID or Serial Number detected'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to assign assets',
            error: error.message
        });
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
