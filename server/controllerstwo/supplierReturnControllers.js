
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

import Supplier from '../models/Supplier.js';
import SupplierReturn from '../models/SupplierReturn.js';
import SupplierReturnItem from '../models/SupplierReturnItem.js';
import StockItem from '../models/StockItem.js';
import StockUnit from '../models/StockUnit.js';
import Asset from '../models/Asset.js';

// SUPPLIER RETURN CONTROLLERS - Search: SUPPLIER RETURN CONTROLLERS


// CREATE BULK SUPPLIER RETURN
export const createSupplierReturn = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const {
            returnDate,
            returnReason,
            referenceNumber,
            notes,
            items
        } = req.body;

        // VALIDATE DEVICE LIST
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one device is required for supplier return'
            });
        }

        // VALIDATE DEVICE IDS
        const stockUnitIds = items.map(item => item.stockUnitId);

        if (
            stockUnitIds.some(
                id => !id || !mongoose.Types.ObjectId.isValid(id)
            )
        ) {
            return res.status(400).json({
                success: false,
                message: 'Every device must have a valid Stock Unit ID'
            });
        }

        // PREVENT DUPLICATE DEVICE SELECTION
        const uniqueStockUnitIds = new Set(
            stockUnitIds.map(id => id.toString())
        );

        if (uniqueStockUnitIds.size !== stockUnitIds.length) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate devices are not allowed in one return'
            });
        }

        // VALIDATE RETURN DATE
        const finalReturnDate = returnDate
            ? new Date(returnDate)
            : new Date();

        if (Number.isNaN(finalReturnDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid return date'
            });
        }

        let createdReturn;

        await session.withTransaction(async () => {

            // FIND SELECTED STOCK UNITS
            const stockUnits = await StockUnit.find({
                _id: { $in: stockUnitIds }
            }).session(session);

            if (stockUnits.length !== stockUnitIds.length) {
                throw new Error(
                    'One or more selected devices could not be found'
                );
            }

            // ALLOWED RETURN STATUSES
            const allowedStatuses = [
                'Available',
                'Assigned',
                'Damaged',
                'Under Repair'
            ];

            // VALIDATE DEVICE STATUS
            for (const unit of stockUnits) {
                if (!allowedStatuses.includes(unit.status)) {
                    throw new Error(
                        `Device ${unit.unitCode} cannot be returned because its status is ${unit.status}`
                    );
                }
            }

            // VALIDATE STOCK PRODUCT REFERENCES
            const unitsWithoutProduct = stockUnits.filter(
                unit => !unit.stockItem
            );

            if (unitsWithoutProduct.length > 0) {
                const unitCodes = unitsWithoutProduct
                    .map(unit => unit.unitCode || unit._id.toString())
                    .join(', ');

                throw new Error(
                    `Stock product reference is missing for device(s): ${unitCodes}. Please correct the Stock Unit records before returning.`
                );
            }

            // FIND STOCK PRODUCTS
            const stockItemIds = [
                ...new Set(
                    stockUnits.map(unit => unit.stockItem.toString())
                )
            ];

            const stockItems = await StockItem.find({
                _id: { $in: stockItemIds }
            }).session(session);

            if (stockItems.length !== stockItemIds.length) {
                const foundStockItemIds = new Set(
                    stockItems.map(item => item._id.toString())
                );
                const missingStockItemIds = stockItemIds.filter(
                    id => !foundStockItemIds.has(id)
                );
                const affectedUnits = stockUnits
                    .filter(unit => missingStockItemIds.includes(unit.stockItem.toString()))
                    .map(unit => unit.unitCode || unit._id.toString());

                throw new Error(
                    `Stock product record is missing for device(s): ${affectedUnits.join(', ')}. Restore or correct the linked Stock Item before returning.`
                );
            }

            const stockItemMap = new Map(
                stockItems.map(item => [
                    item._id.toString(),
                    item
                ])
            );

            // AUTO FIND SUPPLIER FROM STOCK ITEM
            const supplierNames = [
                ...new Set(
                    stockItems.map(item =>
                        (item.supplierName || '').trim().toLowerCase()
                    )
                )
            ];

            // VALIDATE PRODUCT SUPPLIER
            if (supplierNames.some(name => !name)) {
                throw new Error(
                    'Supplier name is missing in one or more Stock Items'
                );
            }

            // PREVENT MULTIPLE SUPPLIERS IN ONE RETURN
            if (supplierNames.length !== 1) {
                throw new Error(
                    'Please select products from the same supplier in one return'
                );
            }

            const supplierName = stockItems.find(
                item => item.supplierName?.trim()
            ).supplierName.trim();

            const escapedSupplierName = supplierName.replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&'
            );

            // FIND ACTIVE SUPPLIER AUTOMATICALLY
            const supplier = await Supplier.findOne({
                companyName: {
                    $regex: `^${escapedSupplierName}$`,
                    $options: 'i'
                },
                isActive: true
            }).session(session);

            if (!supplier) {
                throw new Error(
                    `Active Supplier "${supplierName}" not found in Supplier Management`
                );
            }

            // FIND LINKED ASSETS
            const assetIds = stockUnits
                .filter(unit => unit.asset)
                .map(unit => unit.asset);

            const assets = assetIds.length
                ? await Asset.find({
                    _id: { $in: assetIds }
                })
                    .populate('department', 'name')
                    .populate('room', 'name roomNumber')
                    .session(session)
                : [];

            const assetMap = new Map(
                assets.map(asset => [
                    asset._id.toString(),
                    asset
                ])
            );

            // VALIDATE ASSET LINKS AND STATUS
            for (const unit of stockUnits) {
                if (!unit.asset) continue;

                const asset = assetMap.get(unit.asset.toString());

                if (!asset) {
                    throw new Error(
                        `Linked asset not found for device ${unit.unitCode}`
                    );
                }

                if (asset.status === 'Returned') {
                    throw new Error(
                        `Device ${unit.unitCode} has already been returned`
                    );
                }
            }

            // GROUP QUANTITY BY PRODUCT AND STATUS
            const quantityMap = new Map();

            for (const unit of stockUnits) {
                const productId = unit.stockItem.toString();

                if (!quantityMap.has(productId)) {
                    quantityMap.set(productId, {
                        Available: 0,
                        Assigned: 0,
                        Damaged: 0,
                        'Under Repair': 0
                    });
                }

                quantityMap.get(productId)[unit.status] += 1;
            }

            // VALIDATE STOCK COUNTS BEFORE RETURN
            for (const [productId, quantities] of quantityMap) {
                const stock = stockItemMap.get(productId);

                if (stock.availableQuantity < quantities.Available) {
                    throw new Error(
                        `Insufficient available quantity for ${stock.name}`
                    );
                }

                if (stock.assignedQuantity < quantities.Assigned) {
                    throw new Error(
                        `Insufficient assigned quantity for ${stock.name}`
                    );
                }

                if (stock.damagedQuantity < quantities.Damaged) {
                    throw new Error(
                        `Insufficient damaged quantity for ${stock.name}`
                    );
                }

                if (stock.underRepairQuantity < quantities['Under Repair']) {
                    throw new Error(
                        `Insufficient under repair quantity for ${stock.name}`
                    );
                }
            }

            // GENERATE UNIQUE RETURN NUMBER
            const returnNumber =
                `RET-${finalReturnDate.getFullYear()}-${randomUUID()
                    .slice(0, 8)
                    .toUpperCase()}`;

            // CREATE SUPPLIER RETURN DOCUMENT
            const returnDocuments = await SupplierReturn.create(
                [
                    {
                        returnNumber,
                        supplier: supplier._id,

                        supplierDetails: {
                            companyName: supplier.companyName,
                            contactPerson: supplier.contactPerson,
                            phone: supplier.phone,
                            email: supplier.email,
                            address: supplier.address
                        },

                        totalItems: stockUnits.length,
                        returnDate: finalReturnDate,
                        returnReason: returnReason || '',
                        referenceNumber: referenceNumber || '',
                        notes: notes || '',
                        preparedBy: req.user._id,
                        status: 'Completed'
                    }
                ],
                { session }
            );

            createdReturn = returnDocuments[0];

            // PREPARE INDIVIDUAL DEVICE RETURN RECORDS
            const returnItems = stockUnits.map(unit => {
                const stock = stockItemMap.get(
                    unit.stockItem.toString()
                );

                const asset = unit.asset
                    ? assetMap.get(unit.asset.toString())
                    : null;

                const itemInput = items.find(
                    item =>
                        item.stockUnitId.toString() ===
                        unit._id.toString()
                );

                const previousDepartment = asset?.department || null;
                const previousRoom = asset?.room || null;

                return {
                    supplierReturn: createdReturn._id,
                    stockItem: unit.stockItem,
                    stockUnit: unit._id,
                    asset: unit.asset || null,

                    productDetails: {
                        name: stock.name,
                        category: stock.category,
                        sku: stock.sku || '',
                        unitCode: unit.unitCode,
                        serialNumber: unit.serialNumber || '',
                        brand: stock.brand || '',
                        model: stock.model || '',
                        warranty: stock.warranty || '',
                        assetId: asset?.assetId || ''
                    },

                    previousAssignment: {
                        department: previousDepartment?._id || null,
                        departmentName: previousDepartment?.name || '',
                        room: previousRoom?._id || null,
                        roomName: previousRoom
                            ? (
                                previousRoom.roomNumber
                                    ? `${previousRoom.name} (${previousRoom.roomNumber})`
                                    : previousRoom.name
                            )
                            : '',
                        assignedDate: asset?.assignedDate || null
                    },

                    returnReason: itemInput?.returnReason || returnReason || '',
                    problemDescription: itemInput?.problemDescription || '',
                    technicalInspection: itemInput?.technicalInspection || '',

                    warrantyClaim: {
                        status: itemInput?.warrantyClaim?.status || 'Pending',
                        referenceNumber:
                            itemInput?.warrantyClaim?.referenceNumber || '',
                        notes: itemInput?.warrantyClaim?.notes || ''
                    },

                    notes: itemInput?.notes || '',
                    returnedAt: finalReturnDate
                };
            });

            // SAVE ALL DEVICE RETURN RECORDS
            await SupplierReturnItem.insertMany(
                returnItems,
                {
                    session,
                    ordered: true
                }
            );

            // UPDATE STOCK UNIT STATUS
            const stockUnitUpdate = await StockUnit.updateMany(
                {
                    _id: { $in: stockUnitIds },
                    status: { $in: allowedStatuses }
                },
                {
                    $set: {
                        status: 'Returned',
                        supplierReturn: createdReturn._id,
                        supplierReturnedAt: finalReturnDate
                    }
                },
                { session }
            );

            if (stockUnitUpdate.matchedCount !== stockUnitIds.length) {
                throw new Error(
                    'Some devices could not be updated. Return cancelled'
                );
            }

            // UPDATE LINKED ASSET STATUS
            if (assetIds.length > 0) {
                const assetUpdate = await Asset.updateMany(
                    {
                        _id: { $in: assetIds },
                        status: { $ne: 'Returned' }
                    },
                    {
                        $set: {
                            status: 'Returned',
                            supplierReturn: createdReturn._id,
                            supplierReturnedAt: finalReturnDate
                        }
                    },
                    { session }
                );

                if (assetUpdate.matchedCount !== assetIds.length) {
                    throw new Error(
                        'Some linked assets could not be updated. Return cancelled'
                    );
                }
            }

            // UPDATE STOCK PRODUCT QUANTITIES
            const stockOperations = [];

            for (const [productId, quantities] of quantityMap) {
                const stockUpdate = {
                    supplierReturnedQuantity: stockUnits.filter(
                        unit => unit.stockItem.toString() === productId
                    ).length
                };

                const stockFilter = {
                    _id: productId
                };

                if (quantities.Available > 0) {
                    stockFilter.availableQuantity = {
                        $gte: quantities.Available
                    };

                    stockUpdate.availableQuantity = -quantities.Available;
                }

                if (quantities.Assigned > 0) {
                    stockFilter.assignedQuantity = {
                        $gte: quantities.Assigned
                    };

                    stockUpdate.assignedQuantity = -quantities.Assigned;
                }

                if (quantities.Damaged > 0) {
                    stockFilter.damagedQuantity = {
                        $gte: quantities.Damaged
                    };

                    stockUpdate.damagedQuantity = -quantities.Damaged;
                }

                if (quantities['Under Repair'] > 0) {
                    stockFilter.underRepairQuantity = {
                        $gte: quantities['Under Repair']
                    };

                    stockUpdate.underRepairQuantity =
                        -quantities['Under Repair'];
                }

                stockOperations.push({
                    updateOne: {
                        filter: stockFilter,
                        update: {
                            $inc: stockUpdate
                        }
                    }
                });
            }

            const stockUpdateResult = await StockItem.bulkWrite(
                stockOperations,
                { session }
            );

            if (stockUpdateResult.matchedCount !== quantityMap.size) {
                throw new Error(
                    'Stock quantity update failed. Return cancelled'
                );
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Supplier return completed successfully',
            return: createdReturn,
            returnedDeviceCount: items.length
        });

    } catch (error) {
        console.error('SUPPLIER RETURN ERROR:', error);

        return res.status(400).json({
            success: false,
            message: error.message || 'Supplier return failed'
        });

    } finally {
        await session.endSession();
    }
};



// GET ELIGIBLE STOCK UNITS FOR SUPPLIER RETURN
export const getEligibleStockUnits = async (req, res) => {
    try {
        const {
            search = '',
            status = 'all',
            page = 1,
            limit = 20
        } = req.query;

        // ALLOWED RETURN STATUSES
        const allowedStatuses = [
            'Available',
            'Assigned',
            'Damaged',
            'Under Repair'
        ];

        // VALIDATE STATUS FILTER
        if (
            status !== 'all' &&
            !allowedStatuses.includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid stock unit status'
            });
        }

        // BASE FILTER
        const filter = {
            status: status === 'all'
                ? { $in: allowedStatuses }
                : status
        };

        // EXCLUDE STOCK UNITS WITH MISSING / DELETED STOCK PRODUCTS
        const validStockItemIds = await StockItem.distinct('_id');
        filter.stockItem = { $in: validStockItemIds };

        // SEARCH DEVICE INFORMATION
        if (search.trim()) {
            const searchRegex = {
                $regex: search.trim(),
                $options: 'i'
            };

            // FIND MATCHING STOCK PRODUCTS
            const matchingStockItems = await StockItem.find({
                $or: [
                    { name: searchRegex },
                    { category: searchRegex },
                    { brand: searchRegex },
                    { model: searchRegex },
                    { sku: searchRegex }
                ]
            }).select('_id');

            // FIND MATCHING ASSETS
            const matchingAssets = await Asset.find({
                assetId: searchRegex
            }).select('_id');

            filter.$or = [
                { unitCode: searchRegex },
                { serialNumber: searchRegex },
                {
                    stockItem: {
                        $in: matchingStockItems.map(item => item._id)
                    }
                },
                {
                    asset: {
                        $in: matchingAssets.map(asset => asset._id)
                    }
                }
            ];
        }

        // PAGINATION
        const currentPage = Math.max(
            1,
            Number(page) || 1
        );

        const pageLimit = Math.min(
            100,
            Math.max(1, Number(limit) || 20)
        );

        const skip = (currentPage - 1) * pageLimit;

        // GET ELIGIBLE DEVICES
        const [stockUnits, total] = await Promise.all([
            StockUnit.find(filter)
                .populate(
                    'stockItem',
                    'name category brand model sku unit warranty supplierName'
                )
                .populate({
                    path: 'asset',
                    select: 'assetId status department room assignedDate',
                    populate: [
                        {
                            path: 'department',
                            select: 'name'
                        },
                        {
                            path: 'room',
                            select: 'name roomNumber'
                        }
                    ]
                })
                .sort({ createdAt: 1 })
                .skip(skip)
                .limit(pageLimit)
                .lean(),

            StockUnit.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: stockUnits.length,
            total,
            currentPage,
            totalPages: Math.ceil(total / pageLimit),
            stockUnits
        });

    } catch (error) {
        console.error('ELIGIBLE STOCK UNITS ERROR:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch eligible stock units'
        });
    }
};



// GET ALL SUPPLIER RETURNS - HISTORY
export const getAllSupplierReturns = async (req, res) => {
    try {
        const {
            search = '',
            status = 'all',
            supplierId = '',
            dateFrom = '',
            dateTo = '',
            page = 1,
            limit = 20
        } = req.query;

        // BASE FILTER
        const filter = {};

        // STATUS FILTER
        if (status !== 'all') {
            if (!['Completed', 'Cancelled'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid return status'
                });
            }

            filter.status = status;
        }

        // SUPPLIER FILTER
        if (supplierId) {
            if (!mongoose.Types.ObjectId.isValid(supplierId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid supplier ID'
                });
            }

            filter.supplier = supplierId;
        }

        // SEARCH RETURN INFORMATION
        if (search.trim()) {
            const searchRegex = {
                $regex: search.trim(),
                $options: 'i'
            };

            filter.$or = [
                { returnNumber: searchRegex },
                { referenceNumber: searchRegex },
                { 'supplierDetails.companyName': searchRegex },
                { 'supplierDetails.phone': searchRegex }
            ];
        }

        // DATE FILTER
        if (dateFrom || dateTo) {
            filter.returnDate = {};

            if (dateFrom) {
                const fromDate = new Date(dateFrom);

                if (Number.isNaN(fromDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid start date'
                    });
                }

                fromDate.setHours(0, 0, 0, 0);
                filter.returnDate.$gte = fromDate;
            }

            if (dateTo) {
                const toDate = new Date(dateTo);

                if (Number.isNaN(toDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid end date'
                    });
                }

                toDate.setHours(23, 59, 59, 999);
                filter.returnDate.$lte = toDate;
            }
        }

        // PAGINATION
        const currentPage = Math.max(
            1,
            Number(page) || 1
        );

        const pageLimit = Math.min(
            100,
            Math.max(1, Number(limit) || 20)
        );

        const skip = (currentPage - 1) * pageLimit;

        // GET RETURN HISTORY
        const [returns, total] = await Promise.all([
            SupplierReturn.find(filter)
                .populate(
                    'supplier',
                    'companyName contactPerson phone email'
                )
                .populate(
                    'preparedBy',
                    'email role'
                )
                .sort({
                    returnDate: -1,
                    createdAt: -1
                })
                .skip(skip)
                .limit(pageLimit)
                .lean(),

            SupplierReturn.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: returns.length,
            total,
            currentPage,
            totalPages: Math.ceil(total / pageLimit),
            returns
        });

    } catch (error) {
        console.error('SUPPLIER RETURN HISTORY ERROR:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch supplier return history'
        });
    }
};



// GET SINGLE SUPPLIER RETURN DETAILS
export const getSupplierReturnById = async (req, res) => {
    try {
        const { id } = req.params;

        // VALIDATE RETURN ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid supplier return ID'
            });
        }

        // FIND RETURN DOCUMENT
        const returnDocument = await SupplierReturn.findById(id)
            .populate(
                'supplier',
                'companyName contactPerson phone email address'
            )
            .populate(
                'preparedBy',
                'email role'
            )
            .lean();

        if (!returnDocument) {
            return res.status(404).json({
                success: false,
                message: 'Supplier return document not found'
            });
        }

        // FIND RETURNED DEVICE DETAILS
        const returnItems = await SupplierReturnItem.find({
            supplierReturn: id
        })
            .populate(
                'stockItem',
                'name category brand model sku warranty'
            )
            .populate(
                'stockUnit',
                'unitCode serialNumber status'
            )
            .populate(
                'asset',
                'assetId status'
            )
            .populate({
                path: 'previousAssignment.department',
                select: 'name'
            })
            .populate({
                path: 'previousAssignment.room',
                select: 'name roomNumber'
            })
            .sort({ returnedAt: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            return: returnDocument,
            count: returnItems.length,
            items: returnItems
        });

    } catch (error) {
        console.error('SUPPLIER RETURN DETAILS ERROR:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch supplier return details'
        });
    }
};
