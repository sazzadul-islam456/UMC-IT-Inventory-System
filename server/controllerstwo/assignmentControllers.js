
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

import Assignment from '../models/Assignment.js';
import Asset from '../models/Asset.js';
import StockItem from '../models/StockItem.js';
import StockUnit from '../models/StockUnit.js';
import Department from '../models/Department.js';
import Room from '../models/Room.js';
import Counter from '../models/Counter.js';

// ASSIGNMENT CONTROLLERS - Search: ASSIGNMENT CONTROLLERS


// CREATE ASSIGNMENT
export const createAssignment = async (req, res) => {
    let session;

    try {
        const {
            assignmentType,
            stockItemId,
            departmentId,
            roomId,
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
            !receiver?.name ||
            (assignmentType === 'Room' && !roomId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Assignment type, stock item, department, selected devices and receiver name are required. Room is also required for Room Assignment.'
            });
        }

        // ASSIGNMENT TYPE VALIDATION
        if (!['Department', 'Individual', 'Room'].includes(assignmentType)) {
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
            !mongoose.isValidObjectId(departmentId) ||
            (assignmentType === 'Room' && !mongoose.isValidObjectId(roomId))
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid stock item, department or room ID'
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
        let assignedAssets;
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

                // CHECK ROOM FOR ROOM ASSIGNMENT
                let selectedRoom = null;

                if (assignmentType === 'Room') {
                    selectedRoom = await Room.findOne({
                        _id: roomId,
                        department: departmentId,
                        isActive: true
                    }).session(session);

                    if (!selectedRoom) {
                        const error = new Error(
                            'Room not found, inactive or does not belong to the selected department'
                        );
                        error.statusCode = 404;
                        throw error;
                    }
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
                    status: 'Available'
                }).session(session);

                // CHECK SELECTED UNIT AVAILABILITY
                if (availableUnits.length !== assignQuantity) {
                    const error = new Error(
                        'Some selected devices are unavailable or do not belong to this product. Please refresh and select again.'
                    );
                    error.statusCode = 409;
                    throw error;
                }

                // FIND EXISTING ASSETS USING BOTH REFERENCES
                const unitIds = availableUnits.map(unit => unit._id);

                const linkedAssetIds = availableUnits
                    .filter(unit => unit.asset)
                    .map(unit => unit.asset);

                const existingAssets = await Asset.find({
                    $or: [
                        { stockUnit: { $in: unitIds } },
                        ...(linkedAssetIds.length
                            ? [{ _id: { $in: linkedAssetIds } }]
                            : [])
                    ]
                }).session(session);

                // MAP ASSETS TO THEIR STOCK UNITS
                const existingAssetMap = new Map();

                for (const unit of availableUnits) {

                    const matchingAssets = existingAssets.filter(asset => (
                        (
                            asset.stockUnit &&
                            asset.stockUnit.toString() === unit._id.toString()
                        ) ||
                        (
                            unit.asset &&
                            asset._id.toString() === unit.asset.toString()
                        )
                    ));

                    // PREVENT MULTIPLE ASSETS FOR ONE STOCK UNIT
                    const uniqueAssetIds = [
                        ...new Set(
                            matchingAssets.map(asset => asset._id.toString())
                        )
                    ];

                    if (uniqueAssetIds.length > 1) {
                        const error = new Error(
                            `Multiple Assets are linked to Stock Unit ${unit.unitCode}. Please fix the duplicate records first.`
                        );
                        error.statusCode = 409;
                        throw error;
                    }

                    if (matchingAssets.length > 0) {
                        const existingAsset = matchingAssets[0];

                        // VERIFY STOCK ITEM RELATIONSHIP
                        if (
                            existingAsset.stockItem.toString() !==
                            stockItem._id.toString()
                        ) {
                            const error = new Error(
                                `Existing Asset for Unit ${unit.unitCode} belongs to another stock item`
                            );
                            error.statusCode = 409;
                            throw error;
                        }

                        // EXISTING ASSET MUST BE AVAILABLE
                        if (existingAsset.status !== 'Available') {
                            const error = new Error(
                                `Existing Asset ${existingAsset.assetId} is not available for assignment`
                            );
                            error.statusCode = 409;
                            throw error;
                        }

                        existingAssetMap.set(
                            unit._id.toString(),
                            existingAsset
                        );
                    }
                }

                // FIND STOCK UNITS THAT NEED NEW ASSETS
                const newAssetUnits = availableUnits.filter(
                    unit => !existingAssetMap.has(unit._id.toString())
                );

                // PREPARE NEW ASSETS ONLY
                const newAssetsData = [];

                for (const unit of newAssetUnits) {

                    // GENERATE SEQUENTIAL ASSET ID
                    const counter = await Counter.findOneAndUpdate(
                        { _id: 'asset' },
                        { $inc: { sequence: 1 } },
                        {
                            new: true,
                            upsert: true,
                            session,
                            setDefaultsOnInsert: true
                        }
                    );

                    newAssetsData.push({
                        stockItem: stockItem._id,

                        // LINK ASSET TO STOCK UNIT
                        stockUnit: unit._id,

                        // GENERATE READABLE ASSET ID
                        assetId: `UMC-AST-${String(counter.sequence).padStart(6, '0')}`,

                        // COPY MANUFACTURER SERIAL NUMBER
                        ...(unit.serialNumber
                            ? { serialNumber: unit.serialNumber }
                            : {}),

                        name: stockItem.name,
                        brand: stockItem.brand || '',
                        model: stockItem.model || '',
                        sku: stockItem.sku || '',

                        department: department._id,

                        // SAVE ROOM FOR ROOM ASSIGNMENT
                        room: selectedRoom ? selectedRoom._id : null,

                        status: 'Assigned',
                        assignedDate: assignmentDate,
                        description: notes.trim()
                    });
                }

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

                // CREATE ASSETS ONLY FOR NEW STOCK UNITS
                const createdNewAssets = newAssetsData.length
                    ? await Asset.insertMany(
                        newAssetsData,
                        {
                            ordered: true,
                            session
                        }
                    )
                    : [];

                // MAP NEW ASSETS TO THEIR STOCK UNITS
                const newAssetMap = new Map();

                newAssetUnits.forEach((unit, index) => {
                    newAssetMap.set(
                        unit._id.toString(),
                        createdNewAssets[index]
                    );
                });

                // REUSE OLD ASSETS OR USE NEWLY CREATED ASSETS
                assignedAssets = availableUnits.map(unit => {
                    return (
                        existingAssetMap.get(unit._id.toString()) ||
                        newAssetMap.get(unit._id.toString())
                    );
                });

                // UPDATE EXISTING ASSETS FOR REASSIGNMENT
                const existingAssetUpdates = availableUnits
                    .filter(unit => existingAssetMap.has(unit._id.toString()))
                    .map(unit => ({
                        updateOne: {
                            filter: {
                                _id: existingAssetMap.get(
                                    unit._id.toString()
                                )._id,
                                stockItem: stockItemId,
                                status: 'Available'
                            },
                            update: {
                                $set: {
                                    stockUnit: unit._id,
                                    department: department._id,
                                    room: selectedRoom
                                        ? selectedRoom._id
                                        : null,
                                    status: 'Assigned',
                                    assignedDate: assignmentDate,
                                    description: notes.trim()
                                }
                            }
                        }
                    }));

                if (existingAssetUpdates.length) {
                    const assetUpdateResult = await Asset.bulkWrite(
                        existingAssetUpdates,
                        { session }
                    );

                    // VERIFY EXISTING ASSET UPDATES
                    if (
                        assetUpdateResult.matchedCount !==
                        existingAssetUpdates.length
                    ) {
                        const error = new Error(
                            'Some existing assets could not be reassigned. Please try again.'
                        );
                        error.statusCode = 409;
                        throw error;
                    }
                }

                // VERIFY ALL ASSETS WERE FOUND OR CREATED
                if (
                    assignedAssets.length !== assignQuantity ||
                    assignedAssets.some(asset => !asset)
                ) {
                    const error = new Error(
                        'Some assets could not be linked to the selected stock units'
                    );
                    error.statusCode = 409;
                    throw error;
                }

                // UPDATE SELECTED STOCK UNIT STATUS AND ASSET REFERENCE
                const unitUpdates = availableUnits.map((unit, index) => ({
                    updateOne: {
                        filter: {
                            _id: unit._id,
                            stockItem: stockItemId,
                            status: 'Available'
                        },
                        update: {
                            $set: {
                                status: 'Assigned',
                                asset: assignedAssets[index]._id
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

                            // SAVE REUSED OR NEW ASSETS
                            assets: assignedAssets.map(asset => asset._id),

                            department: department._id,

                            // SAVE ROOM IN ASSIGNMENT RECORD
                            room: selectedRoom ? selectedRoom._id : null,

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
            assets: assignedAssets
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
            .populate('room', 'name roomNumber floorLevel')
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


// GET ROOM INVENTORY - Search: GET ROOM INVENTORY
export const getRoomInventory = async (req, res) => {
    try {
        const { roomId } = req.params;

        // VALIDATE ROOM ID
        if (!mongoose.isValidObjectId(roomId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid room ID'
            });
        }

        // FIND ACTIVE ROOM
        const room = await Room.findOne({
            _id: roomId,
            isActive: true
        })
            .populate('department', 'name');

        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found or inactive'
            });
        }

        // FIND CURRENT DEVICES IN THIS ROOM
        const assets = await Asset.find({
            room: roomId,
            status: {
                $in: ['Assigned', 'Damaged', 'Under Repair']
            }
        })
            .populate('stockItem', 'name category brand model sku')
            .populate('department', 'name')
            .sort({ name: 1, assetId: 1 });

        return res.status(200).json({
            success: true,
            room,
            count: assets.length,
            assets
        });

    } catch (error) {
        console.error('GET ROOM INVENTORY ERROR:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch room inventory',
            error: error.message
        });
    }
};
