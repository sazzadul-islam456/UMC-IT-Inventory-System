
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

import Repair from '../models/Repair.js';
import Asset from '../models/Asset.js';
import StockUnit from '../models/StockUnit.js';
import StockItem from '../models/StockItem.js';
import DamageHistory from '../models/DamageHistory.js';

// REPAIR CONTROLLERS - Search: REPAIR CONTROLLERS


// FIND LINKED STOCK UNIT
const findLinkedStockUnit = async (asset, status, session, preferredUnitId = null) => {

    const conditions = [];

    // ASSET STOCK UNIT REFERENCE
    if (asset.stockUnit) {
        conditions.push({ _id: asset.stockUnit });
    }

    // STOCK UNIT ASSET REFERENCE
    conditions.push({ asset: asset._id });

    // REPAIR RECORD STOCK UNIT REFERENCE
    if (preferredUnitId) {
        conditions.push({ _id: preferredUnitId });
    }

    const units = await StockUnit.find({
        $or: conditions,
        stockItem: asset.stockItem,
        status
    }).session(session);

    // PREVENT AMBIGUOUS STOCK UNIT LINKS
    if (units.length > 1) {
        const error = new Error(
            `Multiple Stock Units are linked to Asset ${asset.assetId}. Please check the device references.`
        );
        error.statusCode = 409;
        throw error;
    }

    return units[0] || null;
};


// MARK ASSET AS DAMAGED
export const markAssetDamaged = async (req, res) => {
    let session;

    try {
        const assetId = req.params.assetId || req.params.id;

        const {
            damageDescription = '',
            notes = ''
        } = req.body || {};

        if (!mongoose.isValidObjectId(assetId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid asset ID'
            });
        }

        session = await mongoose.startSession();

        let updatedAsset;

        await session.withTransaction(async () => {

            // FIND ASSIGNED ASSET
            const asset = await Asset.findOne({
                _id: assetId,
                status: 'Assigned'
            }).session(session);

            if (!asset) {
                const error = new Error(
                    'Asset not found or is not currently assigned'
                );
                error.statusCode = 404;
                throw error;
            }

            // FIND LINKED STOCK UNIT USING BOTH REFERENCES
            const stockUnit = await findLinkedStockUnit(
                asset,
                'Assigned',
                session
            );

            if (!stockUnit) {
                const error = new Error(
                    'Linked stock unit not found or status mismatch. Please check Asset and StockUnit references.'
                );
                error.statusCode = 409;
                throw error;
            }

            // UPDATE STOCK QUANTITIES
            const updatedStock = await StockItem.findOneAndUpdate(
                {
                    _id: asset.stockItem,
                    assignedQuantity: { $gte: 1 }
                },
                {
                    $inc: {
                        assignedQuantity: -1,
                        damagedQuantity: 1
                    }
                },
                {
                    new: true,
                    session,
                    runValidators: true
                }
            );

            if (!updatedStock) {
                const stockItem = await StockItem.findById(
                    asset.stockItem
                ).session(session);

                const error = new Error(
                    stockItem
                        ? `Assigned quantity is ${stockItem.assignedQuantity}. At least 1 is required to mark this device as damaged. Please reconcile StockItem quantities.`
                        : 'Linked stock item not found'
                );

                error.statusCode = 409;
                throw error;
            }

            // UPDATE ASSET STATUS
            updatedAsset = await Asset.findOneAndUpdate(
                {
                    _id: asset._id,
                    status: 'Assigned'
                },
                {
                    $set: {
                        status: 'Damaged'
                    }
                },
                {
                    new: true,
                    session,
                    runValidators: true
                }
            );

            if (!updatedAsset) {
                const error = new Error(
                    'Asset status could not be updated'
                );
                error.statusCode = 409;
                throw error;
            }

            // UPDATE STOCK UNIT STATUS AND REFERENCE
            const unitUpdate = await StockUnit.updateOne(
                {
                    _id: stockUnit._id,
                    status: 'Assigned'
                },
                {
                    $set: {
                        status: 'Damaged',
                        asset: asset._id
                    }
                },
                { session }
            );

            if (unitUpdate.matchedCount !== 1) {
                const error = new Error(
                    'Stock unit status could not be updated'
                );
                error.statusCode = 409;
                throw error;
            }

            // KEEP ASSET AND STOCK UNIT REFERENCES SYNCED
            await Asset.updateOne(
                { _id: asset._id },
                {
                    $set: {
                        stockUnit: stockUnit._id
                    }
                },
                { session }
            );

            // SAVE DAMAGE HISTORY
            await DamageHistory.create(
                [
                    {
                        asset: asset._id,
                        stockUnit: stockUnit._id,
                        stockItem: asset.stockItem,
                        previousStatus: 'Assigned',
                        source: 'Manual',
                        damageDescription: String(
                            damageDescription || ''
                        ).trim(),
                        damagedAt: new Date(),
                        notes: String(notes || '').trim(),
                        createdBy: req.user?._id || null
                    }
                ],
                { session }
            );
        });

        return res.status(200).json({
            success: true,
            message: 'Asset marked as damaged successfully',
            asset: updatedAsset
        });

    } catch (error) {
        console.error('MARK ASSET DAMAGED ERROR:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : 'Failed to mark asset as damaged',
            error: error.statusCode ? undefined : error.message
        });

    } finally {
        if (session) {
            await session.endSession();
        }
    }
};


// SEND ASSET FOR REPAIR
export const sendAssetForRepair = async (req, res) => {
    let session;

    try {
        const assetId = req.params.assetId || req.params.id;

        const {
            issueDescription,
            repairProvider = '',
            technician = '',
            estimatedCost = 0,
            notes = ''
        } = req.body || {};

        // VALIDATION
        if (!mongoose.isValidObjectId(assetId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid asset ID'
            });
        }

        if (
            typeof issueDescription !== 'string' ||
            !issueDescription.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: 'Issue description is required'
            });
        }

        if (
            !Number.isFinite(Number(estimatedCost)) ||
            Number(estimatedCost) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid estimated repair cost'
            });
        }

        session = await mongoose.startSession();

        let createdRepair;
        let updatedAsset;

        await session.withTransaction(async () => {

            // FIND ASSIGNED OR DAMAGED ASSET
            const asset = await Asset.findOne({
                _id: assetId,
                status: { $in: ['Assigned', 'Damaged'] }
            }).session(session);

            if (!asset) {
                const error = new Error(
                    'Asset not found or is not eligible for repair'
                );
                error.statusCode = 404;
                throw error;
            }

            // FIND LINKED STOCK UNIT USING BOTH REFERENCES
            const stockUnit = await findLinkedStockUnit(
                asset,
                asset.status,
                session
            );

            if (!stockUnit) {
                const error = new Error(
                    'Linked stock unit not found or status mismatch. Please check Asset and StockUnit references.'
                );
                error.statusCode = 409;
                throw error;
            }

            // SAVE PREVIOUS STATUS
            const previousStatus = asset.status;

            // PREPARE STOCK QUANTITY TRANSITION
            const quantityUpdate = {
                underRepairQuantity: 1
            };

            const quantityFilter = {
                _id: asset.stockItem
            };

            if (previousStatus === 'Assigned') {
                quantityUpdate.assignedQuantity = -1;
                quantityFilter.assignedQuantity = { $gte: 1 };
            } else {
                quantityUpdate.damagedQuantity = -1;
                quantityFilter.damagedQuantity = { $gte: 1 };
            }

            // UPDATE STOCK QUANTITIES
            const updatedStock = await StockItem.findOneAndUpdate(
                quantityFilter,
                {
                    $inc: quantityUpdate
                },
                {
                    new: true,
                    session,
                    runValidators: true
                }
            );

            if (!updatedStock) {
                const stockItem = await StockItem.findById(
                    asset.stockItem
                ).session(session);

                const requiredQuantity = previousStatus === 'Assigned'
                    ? stockItem?.assignedQuantity
                    : stockItem?.damagedQuantity;

                const quantityName = previousStatus === 'Assigned'
                    ? 'Assigned'
                    : 'Damaged';

                const error = new Error(
                    stockItem
                        ? `${quantityName} quantity is ${requiredQuantity}. At least 1 is required to send this device for repair. Please reconcile StockItem quantities.`
                        : 'Linked stock item not found'
                );

                error.statusCode = 409;
                throw error;
            }

            // GENERATE REPAIR NUMBER
            const repairNumber = `RPR-${new Date().getFullYear()}-${randomUUID()
                .slice(0, 8)
                .toUpperCase()}`;

            // CREATE REPAIR HISTORY
            const repairRecords = await Repair.create(
                [
                    {
                        repairNumber,
                        asset: asset._id,
                        stockUnit: stockUnit._id,
                        stockItem: asset.stockItem,

                        previousStatus,

                        previousDepartment: asset.department || null,
                        previousRoom: asset.room || null,

                        issueDescription: issueDescription.trim(),
                        repairProvider: String(repairProvider).trim(),
                        technician: String(technician).trim(),

                        estimatedCost: Number(estimatedCost),

                        sentForRepairAt: new Date(),
                        status: 'In Progress',

                        notes: String(notes).trim(),

                        createdBy: req.user?._id || null
                    }
                ],
                { session }
            );

            createdRepair = repairRecords[0];

            // UPDATE ASSET STATUS
            updatedAsset = await Asset.findOneAndUpdate(
                {
                    _id: asset._id,
                    status: previousStatus
                },
                {
                    $set: {
                        status: 'Under Repair',
                        stockUnit: stockUnit._id
                    }
                },
                {
                    new: true,
                    session,
                    runValidators: true
                }
            );

            if (!updatedAsset) {
                const error = new Error(
                    'Asset status could not be updated'
                );
                error.statusCode = 409;
                throw error;
            }

            // UPDATE STOCK UNIT STATUS
            const unitUpdate = await StockUnit.updateOne(
                {
                    _id: stockUnit._id,
                    status: previousStatus
                },
                {
                    $set: {
                        status: 'Under Repair',
                        asset: asset._id
                    }
                },
                { session }
            );

            if (unitUpdate.matchedCount !== 1) {
                const error = new Error(
                    'Stock unit status could not be updated'
                );
                error.statusCode = 409;
                throw error;
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Asset sent for repair successfully',
            repair: createdRepair,
            asset: updatedAsset
        });

    } catch (error) {
        console.error('SEND ASSET FOR REPAIR ERROR:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : 'Failed to send asset for repair',
            error: error.statusCode ? undefined : error.message
        });

    } finally {
        if (session) {
            await session.endSession();
        }
    }
};


// COMPLETE REPAIR
export const completeRepair = async (req, res) => {
    let session;

    try {
        const { repairId } = req.params;

        const {
            status,
            actualCost = 0,
            resultNotes = ''
        } = req.body || {};

        // VALIDATION
        if (!mongoose.isValidObjectId(repairId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid repair ID'
            });
        }

        if (!['Successful', 'Unsuccessful'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Repair status must be Successful or Unsuccessful'
            });
        }

        if (
            !Number.isFinite(Number(actualCost)) ||
            Number(actualCost) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid actual repair cost'
            });
        }

        session = await mongoose.startSession();

        let updatedRepair;
        let updatedAsset;

        await session.withTransaction(async () => {

            // FIND ACTIVE REPAIR
            const repair = await Repair.findOne({
                _id: repairId,
                status: 'In Progress'
            }).session(session);

            if (!repair) {
                const error = new Error(
                    'Repair record not found or already completed'
                );
                error.statusCode = 404;
                throw error;
            }

            // FIND ASSET
            const asset = await Asset.findOne({
                _id: repair.asset,
                status: 'Under Repair'
            }).session(session);

            if (!asset) {
                const error = new Error(
                    'Asset not found or is not under repair'
                );
                error.statusCode = 409;
                throw error;
            }

            // FIND STOCK UNIT
            const stockUnit = await findLinkedStockUnit(
                asset,
                'Under Repair',
                session,
                repair.stockUnit
            );

            if (!stockUnit || (
                repair.stockUnit &&
                stockUnit._id.toString() !== repair.stockUnit.toString()
            )) {
                const error = new Error(
                    'Stock unit not found or repair reference mismatch'
                );
                error.statusCode = 409;
                throw error;
            }

            // PREPARE QUANTITY TRANSITION
            const quantityChanges = {
                underRepairQuantity: -1
            };

            let newDeviceStatus;

            if (status === 'Successful') {
                newDeviceStatus = 'Available';
                quantityChanges.availableQuantity = 1;
            } else {
                newDeviceStatus = 'Damaged';
                quantityChanges.damagedQuantity = 1;
            }

            // UPDATE STOCK QUANTITIES
            const updatedStock = await StockItem.findOneAndUpdate(
                {
                    _id: repair.stockItem,
                    underRepairQuantity: { $gte: 1 }
                },
                {
                    $inc: quantityChanges
                },
                {
                    new: true,
                    session,
                    runValidators: true
                }
            );

            if (!updatedStock) {
                const stockItem = await StockItem.findById(
                    repair.stockItem
                ).session(session);

                const error = new Error(
                    stockItem
                        ? `Under Repair quantity is ${stockItem.underRepairQuantity}. At least 1 is required to complete this repair. Please reconcile StockItem quantities.`
                        : 'Linked stock item not found'
                );

                error.statusCode = 409;
                throw error;
            }

            // UPDATE EXISTING ASSET
            updatedAsset = await Asset.findOneAndUpdate(
                {
                    _id: asset._id,
                    status: 'Under Repair'
                },
                {
                    $set: {
                        status: newDeviceStatus,

                        // REMOVE OLD ASSIGNMENT LOCATION
                        department: null,
                        room: null,

                        // KEEP STOCK UNIT REFERENCE
                        stockUnit: stockUnit._id
                    }
                },
                {
                    new: true,
                    session,
                    runValidators: true
                }
            );

            if (!updatedAsset) {
                const error = new Error(
                    'Asset status could not be updated'
                );
                error.statusCode = 409;
                throw error;
            }

            // UPDATE EXISTING STOCK UNIT
            const unitUpdate = await StockUnit.updateOne(
                {
                    _id: stockUnit._id,
                    status: 'Under Repair'
                },
                {
                    $set: {
                        status: newDeviceStatus,
                        asset: asset._id,

                        // MARK UNIT AS REPAIRED AFTER SUCCESSFUL REPAIR
                        ...(status === 'Successful'
                            ? {
                                isRepaired: true,
                                repairedAt: new Date()
                            }
                            : {})
                    }
                },
                { session }
            );

            if (unitUpdate.matchedCount !== 1) {
                const error = new Error(
                    'Stock unit status could not be updated'
                );
                error.statusCode = 409;
                throw error;
            }

            // UPDATE REPAIR HISTORY
            updatedRepair = await Repair.findOneAndUpdate(
                {
                    _id: repair._id,
                    status: 'In Progress'
                },
                {
                    $set: {
                        status,
                        actualCost: Number(actualCost),
                        resultNotes: String(resultNotes).trim(),
                        completedAt: new Date()
                    }
                },
                {
                    new: true,
                    session,
                    runValidators: true
                }
            );

            if (!updatedRepair) {
                const error = new Error(
                    'Repair history could not be updated'
                );
                error.statusCode = 409;
                throw error;
            }

            // SAVE DAMAGE HISTORY IF REPAIR UNSUCCESSFUL
            if (status === 'Unsuccessful') {
                await DamageHistory.create(
                    [
                        {
                            asset: asset._id,
                            stockUnit: stockUnit._id,
                            stockItem: repair.stockItem,
                            previousStatus: 'Under Repair',
                            source: 'Repair Unsuccessful',
                            damageDescription: String(
                                resultNotes || repair.issueDescription || ''
                            ).trim(),
                            damagedAt: new Date(),
                            notes: String(resultNotes || '').trim(),
                            createdBy: req.user?._id || repair.createdBy || null
                        }
                    ],
                    { session }
                );
            }
        });

        return res.status(200).json({
            success: true,
            message: status === 'Successful'
                ? 'Repair completed successfully. Device returned to available stock.'
                : 'Repair unsuccessful. Device marked as damaged.',
            repair: updatedRepair,
            asset: updatedAsset
        });

    } catch (error) {
        console.error('COMPLETE REPAIR ERROR:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.statusCode
                ? error.message
                : 'Failed to complete repair',
            error: error.statusCode ? undefined : error.message
        });

    } finally {
        if (session) {
            await session.endSession();
        }
    }
};


// GET REPAIR HISTORY
export const getRepairHistory = async (req, res) => {
    try {
        const assetId = req.params.assetId || req.query.assetId;
        const { status } = req.query;

        const filter = {};

        // OPTIONAL ASSET FILTER
        if (assetId) {
            if (!mongoose.isValidObjectId(assetId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid asset ID'
                });
            }

            filter.asset = assetId;
        }

        // OPTIONAL STATUS FILTER
        if (status) {
            if (
                !['In Progress', 'Successful', 'Unsuccessful'].includes(status)
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid repair status'
                });
            }

            filter.status = status;
        }

        const repairs = await Repair.find(filter)
            .populate('asset', 'assetId serialNumber name brand model sku status')
            .populate('stockUnit', 'unitCode serialNumber status')
            .populate('stockItem', 'name category brand model sku')
            .populate('previousDepartment', 'name')
            .populate('previousRoom', 'name roomNumber')
            .populate('createdBy', 'name')
            .sort({ sentForRepairAt: -1 });

        return res.status(200).json({
            success: true,
            count: repairs.length,
            repairs
        });

    } catch (error) {
        console.error('GET REPAIR HISTORY ERROR:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch repair history',
            error: error.message
        });
    }
};


// GET DAMAGE HISTORY
export const getDamageHistory = async (req, res) => {
    try {
        const { assetId, source } = req.query;

        const filter = {};

        // OPTIONAL ASSET FILTER
        if (assetId) {
            if (!mongoose.isValidObjectId(assetId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid asset ID'
                });
            }

            filter.asset = assetId;
        }

        // OPTIONAL SOURCE FILTER
        if (source) {
            if (!['Manual', 'Repair Unsuccessful'].includes(source)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid damage history source'
                });
            }

            filter.source = source;
        }

        const damageHistory = await DamageHistory.find(filter)
            .populate('asset', 'assetId serialNumber name brand model sku status')
            .populate('stockUnit', 'unitCode serialNumber status')
            .populate('stockItem', 'name category brand model sku')
            .populate('createdBy', 'name')
            .sort({ damagedAt: -1 });

        return res.status(200).json({
            success: true,
            count: damageHistory.length,
            damageHistory
        });

    } catch (error) {
        console.error('GET DAMAGE HISTORY ERROR:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch damage history',
            error: error.message
        });
    }
};
