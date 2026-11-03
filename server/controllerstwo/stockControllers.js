
import mongoose from 'mongoose';
import StockItem from '../models/StockItem.js';

// Create Stock Item
const createStockItem = async (req, res) => {
    try {
        const {
            name,
            category,
            brand,
            model,
            sku,
            unit,
            totalReceivedQuantity,
            minimumStockLevel,
            description
        } = req.body;

        if (!name || !category) {
            return res.status(400).json({
                message: 'Product name and category are required'
            });
        }

        const receivedQuantity = Number(totalReceivedQuantity ?? 0);
        const minimumQuantity = Number(minimumStockLevel ?? 5);

        if (
            !Number.isInteger(receivedQuantity) ||
            receivedQuantity < 0 ||
            !Number.isInteger(minimumQuantity) ||
            minimumQuantity < 0
        ) {
            return res.status(400).json({
                message: 'Quantities must be valid non-negative whole numbers'
            });
        }

        const normalizedSku = sku?.trim() || undefined;

        if (normalizedSku) {
            const existingItem = await StockItem.findOne({
                sku: normalizedSku
            });

            if (existingItem) {
                return res.status(409).json({
                    message: 'This SKU already exists'
                });
            }
        }

        const stockItem = await StockItem.create({
            name: name.trim(),
            category: category.trim(),
            brand: brand || '',
            model: model || '',
            sku: normalizedSku,
            unit: unit || 'Piece',
            totalReceivedQuantity: receivedQuantity,
            availableQuantity: receivedQuantity,
            assignedQuantity: 0,
            damagedQuantity: 0,
            underRepairQuantity: 0,
            orderedQuantity: 0,
            minimumStockLevel: minimumQuantity,
            description: description || '',
            isActive: true
        });

        return res.status(201).json({
            message: 'Stock item created successfully',
            stockItem
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: 'This SKU already exists'
            });
        }

        return res.status(500).json({
            message: 'Failed to create stock item',
            error: error.message
        });
    }
};

// Get All Stock Items
const getAllStockItems = async (req, res) => {
    try {
        const stockItems = await StockItem.find()
            .sort({ _id: -1 });

        return res.status(200).json({
            stockItems
        });

    } catch (error) {
        return res.status(500).json({
            message: 'Failed to load stock items',
            error: error.message
        });
    }
};

// Get Stock Statistics
const getStockStats = async (req, res) => {
    try {
        const [
            totalProducts,
            totalReceived,
            available,
            assigned,
            damaged,
            underRepair,
            ordered,
            lowStock
        ] = await Promise.all([
            StockItem.countDocuments({ isActive: true }),
            StockItem.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: null, total: { $sum: '$totalReceivedQuantity' } } }
            ]),
            StockItem.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: null, total: { $sum: '$availableQuantity' } } }
            ]),
            StockItem.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: null, total: { $sum: '$assignedQuantity' } } }
            ]),
            StockItem.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: null, total: { $sum: '$damagedQuantity' } } }
            ]),
            StockItem.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: null, total: { $sum: '$underRepairQuantity' } } }
            ]),
            StockItem.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: null, total: { $sum: '$orderedQuantity' } } }
            ]),
            StockItem.countDocuments({
                isActive: true,
                $expr: {
                    $lte: ['$availableQuantity', '$minimumStockLevel']
                }
            })
        ]);

        const getTotal = (result) => result[0]?.total || 0;

        return res.status(200).json({
            totalProducts,
            totalReceived: getTotal(totalReceived),
            available: getTotal(available),
            assigned: getTotal(assigned),
            damaged: getTotal(damaged),
            underRepair: getTotal(underRepair),
            ordered: getTotal(ordered),
            lowStock
        });

    } catch (error) {
        return res.status(500).json({
            message: 'Failed to load stock statistics',
            error: error.message
        });
    }
};

// Update Stock Item Details
// STOCK QUANTITY UPDATE - Search: STOCK QUANTITY UPDATE
const updateStockItem = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            name,
            category,
            brand,
            model,
            sku,
            unit,
            totalReceivedQuantity,
            minimumStockLevel,
            description
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'Invalid stock item ID'
            });
        }

        if (!name || !category) {
            return res.status(400).json({
                message: 'Product name and category are required'
            });
        }

        if (
            minimumStockLevel !== undefined &&
            (!Number.isInteger(Number(minimumStockLevel)) ||
                Number(minimumStockLevel) < 0)
        ) {
            return res.status(400).json({
                message: 'Minimum stock level must be a non-negative whole number'
            });
        }

        // STOCK SKU VALIDATION - Search: STOCK SKU VALIDATION
        const normalizedSku = sku?.trim() || undefined;

        if (normalizedSku) {
            const existingItem = await StockItem.findOne({
                sku: normalizedSku,
                _id: { $ne: id }
            });

            if (existingItem) {
                return res.status(409).json({
                    message: 'This SKU already exists'
                });
            }
        }

        const stockItem = await StockItem.findById(id);

        if (!stockItem || !stockItem.isActive) {
            return res.status(404).json({
                message: 'Stock item not found'
            });
        }

        // STOCK RECEIVED QUANTITY UPDATE - Search: STOCK RECEIVED QUANTITY UPDATE
        if (totalReceivedQuantity !== undefined) {
            const newReceivedQuantity = Number(totalReceivedQuantity);

            if (
                !Number.isInteger(newReceivedQuantity) ||
                newReceivedQuantity < 0
            ) {
                return res.status(400).json({
                    message: 'Received quantity must be a non-negative whole number'
                });
            }

            const assigned = Number(stockItem.assignedQuantity || 0);
            const damaged = Number(stockItem.damagedQuantity || 0);
            const underRepair = Number(stockItem.underRepairQuantity || 0);

            const committedQuantity = assigned + damaged + underRepair;

            if (newReceivedQuantity < committedQuantity) {
                return res.status(400).json({
                    message: `Received quantity cannot be less than assigned, damaged and under-repair quantity (${committedQuantity})`
                });
            }

            stockItem.totalReceivedQuantity = newReceivedQuantity;

            stockItem.availableQuantity =
                newReceivedQuantity - committedQuantity;
        }

        // STOCK PRODUCT DETAILS UPDATE - Search: STOCK PRODUCT DETAILS UPDATE
        stockItem.name = name.trim();
        stockItem.category = category.trim();
        stockItem.brand = brand || '';
        stockItem.model = model || '';
        stockItem.sku = normalizedSku;
        stockItem.unit = unit || 'Piece';

        if (minimumStockLevel !== undefined) {
            stockItem.minimumStockLevel = Number(minimumStockLevel);
        }

        stockItem.description = description || '';

        await stockItem.save();

        return res.status(200).json({
            message: 'Stock item updated successfully',
            stockItem
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: 'This SKU already exists'
            });
        }

        return res.status(500).json({
            message: 'Failed to update stock item',
            error: error.message
        });
    }
};

// Delete Stock Item (Soft Delete)
// Delete Stock Item (Permanent Delete) - Search: DELETE STOCK ITEM
const deleteStockItem = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'Invalid stock item ID'
            });
        }

        const stockItem = await StockItem.findById(id);

        if (!stockItem) {
            return res.status(404).json({
                message: 'Stock item not found'
            });
        }

        if (
            stockItem.assignedQuantity > 0 ||
            stockItem.damagedQuantity > 0 ||
            stockItem.underRepairQuantity > 0
        ) {
            return res.status(400).json({
                message: 'Cannot delete an item with assigned, damaged or under-repair stock'
            });
        }

        // PERMANENTLY DELETE PRODUCT FROM MONGODB
        await StockItem.findByIdAndDelete(id);

        return res.status(200).json({
            message: 'Stock item permanently deleted successfully'
        });

    } catch (error) {
        return res.status(500).json({
            message: 'Failed to delete stock item',
            error: error.message
        });
    }
};

export {
    createStockItem,
    getAllStockItems,
    getStockStats,
    updateStockItem,
    deleteStockItem
};
