
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

import StockItem from '../models/StockItem.js';
import StockUnit from '../models/StockUnit.js';
import StockReceipt from '../models/StockReceipt.js';

// STOCK CONTROLLERS - Search: STOCK CONTROLLERS

// HELPER: ESCAPE REGEX
const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// HELPER: CREATE STOCK RECEIPT AND UNITS
const createReceiptAndUnits = async ({
    stockItem,
    quantity,
    serialNumbers = [],
    supplierName = '',
    description = '',
    receivedBy = null,
    session
}) => {
    if (quantity <= 0) return;

    const cleanedSerials = serialNumbers.map(serial =>
        typeof serial === 'string' ? serial.trim() : ''
    );

    const providedSerials = cleanedSerials.filter(Boolean);

    const uniqueSerials = new Set(
        providedSerials.map(serial => serial.toLowerCase())
    );

    if (uniqueSerials.size !== providedSerials.length) {
        const error = new Error('Duplicate serial numbers found');
        error.statusCode = 409;
        throw error;
    }

    // CHECK EXISTING SERIAL NUMBERS
    if (providedSerials.length > 0) {
        const serialConditions = providedSerials.map(serial => ({
            serialNumber: new RegExp(
                `^${escapeRegex(serial)}$`,
                'i'
            )
        }));

        const duplicateUnit = await StockUnit.findOne({
            $or: serialConditions
        }).session(session);

        if (duplicateUnit) {
            const error = new Error(
                'One or more serial numbers already exist'
            );
            error.statusCode = 409;
            throw error;
        }
    }

    // CREATE STOCK RECEIPT
    const receipts = await StockReceipt.create(
        [{
            stockItem: stockItem._id,
            receiptNumber: `REC-${randomUUID()}`,
            quantity,
            receivedDate: new Date(),
            supplier: supplierName || 'Stock Receiving',
            referenceNumber: 'PRODUCT-RECEIVING',
            description,
            receivedBy
        }],
        { session }
    );

    const receipt = receipts[0];

    // CREATE INDIVIDUAL STOCK UNITS
    const stockUnits = Array.from(
        { length: quantity },
        (_, index) => ({
            stockItem: stockItem._id,
            unitCode: `UMC-UNIT-${randomUUID()}`,

            ...(cleanedSerials[index]
                ? { serialNumber: cleanedSerials[index] }
                : {}),

            receipt: receipt._id,
            status: 'Available',
            asset: null
        })
    );

    await StockUnit.insertMany(stockUnits, {
        ordered: true,
        session
    });
};


// CREATE STOCK ITEM
export const createStockItem = async (req, res) => {
    let session;

    try {
        const {
            name,
            category,
            brand,
            model,
            sku,
            warranty,
            supplierName,
            unit,
            totalReceivedQuantity,
            minimumStockLevel,
            description,
            serialNumbers = []
        } = req.body;

        // VALIDATION
        if (!name?.trim() || !category?.trim()) {
            return res.status(400).json({
                message: 'Product name and category are required'
            });
        }

        const quantity = Number(totalReceivedQuantity);

        if (
            !Number.isSafeInteger(quantity) ||
            quantity <= 0
        ) {
            return res.status(400).json({
                message: 'Received quantity must be a positive whole number'
            });
        }

        const minimumLevel = Number(minimumStockLevel ?? 5);

        if (
            !Number.isSafeInteger(minimumLevel) ||
            minimumLevel < 0
        ) {
            return res.status(400).json({
                message: 'Minimum stock level must be a non-negative whole number'
            });
        }

        if (
            !Array.isArray(serialNumbers) ||
            serialNumbers.length !== quantity
        ) {
            return res.status(400).json({
                message: `Please provide ${quantity} serial number entries`
            });
        }

        const normalizedSku = sku?.trim() || undefined;

        session = await mongoose.startSession();

        let savedStockItem;
        let addedToExisting = false;

        await session.withTransaction(async () => {

            let existingItem = null;

            // FIND EXISTING PRODUCT BY SKU
            if (normalizedSku) {
                existingItem = await StockItem.findOne({
                    sku: normalizedSku,
                    isActive: true
                }).session(session);
            } else {
                // FIND EXISTING PRODUCT BY PRODUCT DETAILS
                existingItem = await StockItem.findOne({
                    name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
                    category: new RegExp(`^${escapeRegex(category.trim())}$`, 'i'),
                    brand: new RegExp(`^${escapeRegex(brand?.trim() || '')}$`, 'i'),
                    model: new RegExp(`^${escapeRegex(model?.trim() || '')}$`, 'i'),
                    isActive: true
                }).session(session);
            }

            if (existingItem) {

                // PREVENT DIFFERENT PRODUCTS USING SAME SKU
                if (
                    existingItem.name.toLowerCase() !== name.trim().toLowerCase() ||
                    existingItem.category.toLowerCase() !== category.trim().toLowerCase()
                ) {
                    const error = new Error(
                        'This SKU is already assigned to a different product'
                    );
                    error.statusCode = 409;
                    throw error;
                }

                existingItem.warranty =
                    warranty?.trim() || existingItem.warranty || '';

                existingItem.supplierName =
                    supplierName?.trim() || existingItem.supplierName || '';

                // CREATE RECEIPT AND NEW UNITS
                await createReceiptAndUnits({
                    stockItem: existingItem,
                    quantity,
                    serialNumbers,
                    supplierName: supplierName?.trim() || existingItem.supplierName,
                    description: 'Additional stock received',
                    receivedBy: req.user?._id || null,
                    session
                });

                existingItem.totalReceivedQuantity += quantity;
                existingItem.availableQuantity += quantity;

                await existingItem.save({ session });

                savedStockItem = existingItem;
                addedToExisting = true;

            } else {

                // CREATE NEW PRODUCT
                const createdItems = await StockItem.create(
                    [{
                        name: name.trim(),
                        category: category.trim(),
                        brand: brand?.trim() || '',
                        model: model?.trim() || '',
                        sku: normalizedSku,
                        warranty: warranty?.trim() || '',
                        supplierName: supplierName?.trim() || '',
                        unit: unit || 'Piece',

                        totalReceivedQuantity: 0,
                        availableQuantity: 0,
                        assignedQuantity: 0,
                        damagedQuantity: 0,
                        underRepairQuantity: 0,
                        orderedQuantity: 0,

                        minimumStockLevel: minimumLevel,
                        description: description || '',
                        isActive: true
                    }],
                    { session }
                );

                const newItem = createdItems[0];

                // CREATE RECEIPT AND NEW UNITS
                await createReceiptAndUnits({
                    stockItem: newItem,
                    quantity,
                    serialNumbers,
                    supplierName: supplierName?.trim() || '',
                    description: 'Initial stock received',
                    receivedBy: req.user?._id || null,
                    session
                });

                newItem.totalReceivedQuantity = quantity;
                newItem.availableQuantity = quantity;

                await newItem.save({ session });

                savedStockItem = newItem;
            }
        });

        return res.status(201).json({
            success: true,
            message: addedToExisting
                ? `${quantity} additional units added to existing product`
                : 'Stock product created successfully',
            stockItem: savedStockItem,
            additionalQuantity: quantity
        });

    } catch (error) {
        console.error('CREATE STOCK ITEM ERROR:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: 'Duplicate SKU, serial number or generated stock code'
            });
        }

        return res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to create stock item'
        });

    } finally {
        if (session) {
            await session.endSession();
        }
    }
};


// GET ALL STOCK ITEMS
export const getAllStockItems = async (req, res) => {
    try {
        const stockItems = await StockItem.find({
            isActive: true
        }).sort({
            createdAt: -1
        });

        return res.status(200).json({
            success: true,
            count: stockItems.length,
            stockItems
        });

    } catch (error) {
        console.error('GET STOCK ITEMS ERROR:', error);

        return res.status(500).json({
            message: 'Failed to fetch stock items'
        });
    }
};


// GET STOCK STATISTICS
export const getStockStats = async (req, res) => {
    try {
        const result = await StockItem.aggregate([
            {
                $match: {
                    isActive: true
                }
            },
            {
                $group: {
                    _id: null,

                    totalProducts: { $sum: 1 },
                    totalReceived: { $sum: '$totalReceivedQuantity' },
                    available: { $sum: '$availableQuantity' },
                    assigned: { $sum: '$assignedQuantity' },
                    damaged: { $sum: '$damagedQuantity' },
                    underRepair: { $sum: '$underRepairQuantity' },
                    ordered: { $sum: '$orderedQuantity' },

                    lowStock: {
                        $sum: {
                            $cond: [
                                {
                                    $lte: [
                                        '$availableQuantity',
                                        '$minimumStockLevel'
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const stats = result[0] || {
            totalProducts: 0,
            totalReceived: 0,
            available: 0,
            assigned: 0,
            damaged: 0,
            underRepair: 0,
            ordered: 0,
            lowStock: 0
        };

        delete stats._id;

        return res.status(200).json(stats);

    } catch (error) {
        console.error('GET STOCK STATS ERROR:', error);

        return res.status(500).json({
            message: 'Failed to fetch stock statistics'
        });
    }
};


// UPDATE STOCK ITEM DETAILS
// STOCK QUANTITY UPDATE - Search: STOCK QUANTITY UPDATE
export const updateStockItem = async (req, res) => {
    let session;

    try {
        const { id } = req.params;

        const {
            name,
            category,
            brand,
            model,
            sku,
            unit,
            minimumStockLevel,
            description,
            warranty,
            supplierName,
            totalReceivedQuantity,
            serialNumbers = []
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'Invalid stock item ID'
            });
        }

        if (!name?.trim() || !category?.trim()) {
            return res.status(400).json({
                message: 'Product name and category are required'
            });
        }

        if (!Array.isArray(serialNumbers)) {
            return res.status(400).json({
                message: 'Serial numbers must be an array'
            });
        }

        if (
            minimumStockLevel !== undefined &&
            (
                !Number.isSafeInteger(Number(minimumStockLevel)) ||
                Number(minimumStockLevel) < 0
            )
        ) {
            return res.status(400).json({
                message: 'Minimum stock level must be a non-negative whole number'
            });
        }

        const normalizedSku = sku?.trim() || undefined;

        session = await mongoose.startSession();

        let updatedStockItem;
        let addedQuantity = 0;
        let reducedQuantity = 0;

        await session.withTransaction(async () => {

            const currentItem = await StockItem.findById(id).session(session);

            if (!currentItem || !currentItem.isActive) {
                const error = new Error('Stock item not found');
                error.statusCode = 404;
                throw error;
            }

            // CHECK DUPLICATE SKU
            if (normalizedSku) {
                const existingItem = await StockItem.findOne({
                    sku: normalizedSku,
                    _id: { $ne: id }
                }).session(session);

                if (existingItem) {
                    const error = new Error('This SKU already exists');
                    error.statusCode = 409;
                    throw error;
                }
            }

            // CALCULATE QUANTITY DIFFERENCE
            const oldQuantity = Number(currentItem.totalReceivedQuantity || 0);

            const newQuantity = totalReceivedQuantity === undefined
                ? oldQuantity
                : Number(totalReceivedQuantity);

            if (
                !Number.isSafeInteger(newQuantity) ||
                newQuantity < 0
            ) {
                const error = new Error(
                    'Received quantity must be a valid non-negative whole number'
                );
                error.statusCode = 400;
                throw error;
            }

            addedQuantity = Math.max(0, newQuantity - oldQuantity);
            reducedQuantity = Math.max(0, oldQuantity - newQuantity);

            // VALIDATE SERIAL NUMBER COUNT FOR INCREASE
            if (serialNumbers.length !== addedQuantity) {
                const error = new Error(
                    `Please provide ${addedQuantity} serial number entries for the additional stock`
                );
                error.statusCode = 400;
                throw error;
            }

            const cleanedSerials = serialNumbers.map(serial =>
                typeof serial === 'string' ? serial.trim() : ''
            );

            const providedSerials = cleanedSerials.filter(Boolean);

            const uniqueSerials = new Set(
                providedSerials.map(serial => serial.toLowerCase())
            );

            if (uniqueSerials.size !== providedSerials.length) {
                const error = new Error(
                    'Duplicate serial numbers found in this submission'
                );
                error.statusCode = 409;
                throw error;
            }

            // REDUCE QUANTITY FROM AVAILABLE STOCK ONLY
            if (reducedQuantity > 0) {

                if (currentItem.availableQuantity < reducedQuantity) {
                    const error = new Error(
                        `Cannot reduce quantity by ${reducedQuantity}. Only ${currentItem.availableQuantity} units are available. Assigned, damaged and under-repair units cannot be removed.`
                    );
                    error.statusCode = 400;
                    throw error;
                }

                // FIND NEWEST AVAILABLE STOCK UNITS
                const unitsToRemove = await StockUnit.find({
                    stockItem: currentItem._id,
                    status: 'Available'
                })
                    .sort({ createdAt: -1, _id: -1 })
                    .limit(reducedQuantity)
                    .session(session);

                if (unitsToRemove.length !== reducedQuantity) {
                    const error = new Error(
                        `Stock unit records do not match available quantity. Required ${reducedQuantity}, found ${unitsToRemove.length}.`
                    );
                    error.statusCode = 409;
                    throw error;
                }

                const unitIds = unitsToRemove.map(unit => unit._id);

                // DELETE ONLY AVAILABLE UNITS
                await StockUnit.deleteMany({
                    _id: { $in: unitIds },
                    stockItem: currentItem._id,
                    status: 'Available'
                }).session(session);

                currentItem.totalReceivedQuantity -= reducedQuantity;
                currentItem.availableQuantity -= reducedQuantity;
            }

            // ADD NEW STOCK UNITS WHEN QUANTITY INCREASES
            if (addedQuantity > 0) {

                await createReceiptAndUnits({
                    stockItem: currentItem,
                    quantity: addedQuantity,
                    serialNumbers: cleanedSerials,
                    supplierName: supplierName?.trim() ||
                        currentItem.supplierName ||
                        '',
                    description: 'Additional stock received during product update',
                    receivedBy: req.user?._id || null,
                    session
                });

                currentItem.totalReceivedQuantity += addedQuantity;
                currentItem.availableQuantity += addedQuantity;
            }

            // UPDATE PRODUCT DETAILS
            currentItem.name = name.trim();
            currentItem.category = category.trim();
            currentItem.brand = brand?.trim() || '';
            currentItem.model = model?.trim() || '';
            currentItem.sku = normalizedSku;
            currentItem.unit = unit || 'Piece';

            if (minimumStockLevel !== undefined) {
                currentItem.minimumStockLevel = Number(minimumStockLevel);
            }

            currentItem.description = description || '';

            if (warranty !== undefined) {
                currentItem.warranty = warranty.trim();
            }

            if (supplierName !== undefined) {
                currentItem.supplierName = supplierName.trim();
            }

            await currentItem.save({ session });

            updatedStockItem = currentItem;
        });

        return res.status(200).json({
            success: true,
            message: addedQuantity > 0
                ? `${addedQuantity} additional units received and product updated successfully`
                : reducedQuantity > 0
                    ? `${reducedQuantity} available units removed and product updated successfully`
                    : 'Product details updated successfully',
            stockItem: updatedStockItem,
            addedQuantity,
            reducedQuantity
        });

    } catch (error) {
        console.error('UPDATE STOCK ITEM ERROR:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: 'Duplicate SKU, serial number or generated stock code'
            });
        }

        return res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to update stock item'
        });

    } finally {
        if (session) {
            await session.endSession();
        }
    }
};


// DELETE STOCK ITEM
export const deleteStockItem = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'Invalid stock item ID'
            });
        }

        const stockItem = await StockItem.findById(id);

        if (!stockItem || !stockItem.isActive) {
            return res.status(404).json({
                message: 'Stock item not found'
            });
        }

                // PREVENT DELETION IF PRODUCT HAS STOCK HISTORY

        const [hasStockUnits, hasStockReceipts] = await Promise.all([
            StockUnit.exists({ stockItem: id }),
            StockReceipt.exists({ stockItem: id })
        ]);

        if (hasStockUnits || hasStockReceipts) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete product because stock units or receiving history exists'
            });
        }

        // PREVENT DELETION IF STOCK IS IN USE
        if (
            stockItem.assignedQuantity > 0 ||
            stockItem.damagedQuantity > 0 ||
            stockItem.underRepairQuantity > 0
        ) {
            return res.status(400).json({
                message: 'Cannot delete product with assigned, damaged or under-repair stock'
            });
        }

        // SOFT DELETE
        stockItem.isActive = false;

        await stockItem.save();

        return res.status(200).json({
            success: true,
            message: 'Stock item deleted successfully'
        });

    } catch (error) {
        console.error('DELETE STOCK ITEM ERROR:', error);

        return res.status(500).json({
            message: error.message || 'Failed to delete stock item'
        });
    }
};


// DELETE INDIVIDUAL STOCK UNIT
export const deleteStockUnit = async (req, res) => {
    let session;

    try {
        const { id, unitId } = req.params;

        if (
            !mongoose.isValidObjectId(id) ||
            !mongoose.isValidObjectId(unitId)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid stock item or stock unit ID'
            });
        }

        session = await mongoose.startSession();

        let deletedUnit;
        let updatedStockItem;

        await session.withTransaction(async () => {

            // FIND PRODUCT
            const stockItem = await StockItem.findOne({
                _id: id,
                isActive: true
            }).session(session);

            if (!stockItem) {
                const error = new Error('Stock item not found');
                error.statusCode = 404;
                throw error;
            }

            // FIND EXACT AVAILABLE UNIT
            const stockUnit = await StockUnit.findOne({
                _id: unitId,
                stockItem: id,
                status: 'Available',
                asset: null
            }).session(session);

            if (!stockUnit) {
                const error = new Error(
                    'Stock unit not found or cannot be deleted. Only available units can be deleted.'
                );
                error.statusCode = 400;
                throw error;
            }

            // UPDATE STOCK QUANTITY
            updatedStockItem = await StockItem.findOneAndUpdate(
                {
                    _id: id,
                    isActive: true,
                    availableQuantity: { $gte: 1 },
                    totalReceivedQuantity: { $gte: 1 }
                },
                {
                    $inc: {
                        totalReceivedQuantity: -1,
                        availableQuantity: -1
                    }
                },
                {
                    new: true,
                    session,
                    runValidators: true
                }
            );

            if (!updatedStockItem) {
                const error = new Error(
                    'Stock quantity is inconsistent. Please refresh and try again.'
                );
                error.statusCode = 409;
                throw error;
            }

            // DELETE ONLY THE SELECTED UNIT
            const deleteResult = await StockUnit.deleteOne({
                _id: unitId,
                stockItem: id,
                status: 'Available',
                asset: null
            }).session(session);

            if (deleteResult.deletedCount !== 1) {
                const error = new Error(
                    'Stock unit could not be deleted. Please try again.'
                );
                error.statusCode = 409;
                throw error;
            }

            deletedUnit = stockUnit;
        });

        return res.status(200).json({
            success: true,
            message: 'Individual stock unit deleted successfully',
            deletedUnit: {
                _id: deletedUnit._id,
                unitCode: deletedUnit.unitCode,
                serialNumber: deletedUnit.serialNumber || ''
            },
            stockItem: updatedStockItem
        });

    } catch (error) {
        console.error('DELETE STOCK UNIT ERROR:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to delete stock unit'
        });

    } finally {
        if (session) {
            await session.endSession();
        }
    }
};
