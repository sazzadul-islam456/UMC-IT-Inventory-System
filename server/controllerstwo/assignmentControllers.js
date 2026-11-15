
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

import Assignment from '../models/Assignment.js';
import Asset from '../models/Asset.js';
import StockItem from '../models/StockItem.js';
import StockUnit from '../models/StockUnit.js';
import Department from '../models/Department.js';

// ASSIGNMENT CONTROLLERS - Search: ASSIGNMENT CONTROLLERS


// CREATE ASSIGNMENT
export const createAssignment = async (req, res) => {
    let session;

    try {
        const {
            assignmentType,
            stockItemId,
            departmentId,
            stockUnitIds,
            receiver,
            assignedDate,
            notes = ''
        } = req.body;

        // REQUIRED FIELD VALIDATION
        if (
            !assignmentType ||
            !stockItemId ||
            !departmentId ||
            !Array.isArray(stockUnitIds) ||
            stockUnitIds.length === 0 ||
            !receiver?.name
        ) {
            return res.status(400).json({
                success: false,
                message: 'Assignment type, stock item, department, selected devices and receiver name are required'
            });
        }

        // ASSIGNMENT TYPE VALIDATION
        if (!['Department', 'Individual'].includes(assignmentType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid assignment type'
            });
        }

        // STOCK UNIT ID VALIDATION
        if (
            stockUnitIds.some(id => !mongoose.isValidObjectId(id)) ||
            new Set(stockUnitIds.map(id => String(id))).size !== stockUnitIds.length
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or duplicate stock unit IDs'
            });
        }

        // QUANTITY FROM SELECTED STOCK UNITS
        const assignQuantity = stockUnitIds.length;

        // MONGODB ID VALIDATION
        if (
            !mongoose.isValidObjectId(stockItemId) ||
            !mongoose.isValidObjectId(departmentId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid stock item or department ID'
            });
        }

        // RECEIVER VALIDATION
        if (
            typeof receiver.name !== 'string' ||
            !receiver.name.trim() ||
            typeof notes !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid receiver information or notes'
            });
        }

        // ASSIGNMENT DATE
        const assignmentDate = assignedDate
            ? new Date(assignedDate)
            : new Date();

        if (Number.isNaN(assignmentDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid assignment date'
            });
        }

        // START MONGODB TRANSACTION
        session = await mongoose.startSession();

        let updatedStock;
        let createdAssets;
        let createdAssignment;

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

                // CHECK AVAILABLE STOCK QUANTITY
                if (stockItem.availableQuantity < assignQuantity) {
                    const error = new Error(
                        `Only ${stockItem.availableQuantity} items are available`
                    );
                    error.statusCode = 400;
                    throw error;
                }

                // FIND SELECTED AVAILABLE STOCK UNITS
                const availableUnits = await StockUnit.find({
                    _id: { $in: stockUnitIds },
                    stockItem: stockItemId,
                    status: 'Available',
                    asset: null
                }).session(session);

                // CHECK SELECTED UNIT AVAILABILITY
                if (availableUnits.length !== assignQuantity) {
                    const error = new Error(
                        'Some selected devices are unavailable, already assigned or do not belong to this product. Please refresh and select again.'
                    );
                    error.statusCode = 409;
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
                    room: null,

                    status: 'Assigned',
                    assignedDate: assignmentDate,
                    description: notes.trim()
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

                // UPDATE SELECTED STOCK UNIT STATUS
                const unitUpdates = availableUnits.map((unit, index) => ({
                    updateOne: {
                        filter: {
                            _id: unit._id,
                            stockItem: stockItemId,
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

                // GENERATE UNIQUE ASSIGNMENT ID
                const assignmentId = `ASN-${assignmentDate.getFullYear()}-${randomUUID()
                    .slice(0, 8)
                    .toUpperCase()}`;

                // CREATE ASSIGNMENT RECORD
                const assignmentRecords = await Assignment.create(
                    [
                        {
                            assignmentId,
                            assignmentType,

                            stockItem: stockItem._id,

                            productDetails: {
                                name: stockItem.name,
                                brand: stockItem.brand || '',
                                model: stockItem.model || '',
                                sku: stockItem.sku || ''
                            },

                            quantity: assignQuantity,

                            // SAVE SELECTED STOCK UNITS
                            stockUnits: availableUnits.map(unit => unit._id),

                            // SAVE CREATED ASSETS
                            assets: createdAssets.map(asset => asset._id),

                            department: department._id,

                            receiver: {
                                name: receiver.name.trim(),
                                employeeId: receiver.employeeId || '',
                                designation: receiver.designation || '',
                                phone: receiver.phone || ''
                            },

                            assignedDate: assignmentDate,
                            notes: notes.trim()
                        }
                    ],
                    { session }
                );

                createdAssignment = assignmentRecords[0];
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
            message: `${assignQuantity} selected device(s) assigned successfully`,
            assignment: createdAssignment,
            assignedQuantity: assignQuantity,
            stock: updatedStock,
            assets: createdAssets
        });

    } catch (error) {
        console.error('CREATE ASSIGNMENT ERROR:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Duplicate Assignment ID, Asset ID or Serial Number detected'
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
            message: 'Failed to create assignment',
            error: error.message
        });

    } finally {
        // SAFELY END TRANSACTION SESSION
        if (session) {
            try {
                await session.endSession();
            } catch (sessionError) {
                console.error(
                    'ASSIGNMENT TRANSACTION SESSION CLEANUP ERROR:',
                    sessionError
                );
            }
        }
    }
};


// GET ALL ASSIGNMENTS
export const getAllAssignments = async (req, res) => {
    try {
        const assignments = await Assignment.find()
            .populate('stockItem', 'name category brand model sku')
            .populate('department', 'name')
            .populate('stockUnits', 'unitCode serialNumber status')
            .populate('assets', 'assetId serialNumber status')
            .sort({ assignedDate: -1 });

        return res.status(200).json({
            success: true,
            count: assignments.length,
            assignments
        });

    } catch (error) {
        console.error('GET ALL ASSIGNMENTS ERROR:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch assignments',
            error: error.message
        });
    }
};
