
import mongoose from 'mongoose';

import StockItem from '../models/StockItem.js';
import StockUnit from '../models/StockUnit.js';
import StockReceipt from '../models/StockReceipt.js';
import Asset from '../models/Asset.js';
import Assignment from '../models/Assignment.js';
import DamageHistory from '../models/DamageHistory.js';
import Repair from '../models/Repair.js';
import SupplierReturn from '../models/SupplierReturn.js';
import SupplierReturnItem from '../models/SupplierReturnItem.js';
import Department from '../models/Department.js';
import Room from '../models/Room.js';
import User from '../models/User.js';

// DASHBOARD AUDIT CONTROLLER - Search: DASHBOARD AUDIT CONTROLLER

// BANGLADESH DATE HELPER
const getDhakaDate = () => {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());

    const year = parts.find(part => part.type === 'year').value;
    const month = parts.find(part => part.type === 'month').value;
    const day = parts.find(part => part.type === 'day').value;

    return `${year}-${month}-${day}`;
};

const formatDate = (date) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);

    const year = parts.find(part => part.type === 'year').value;
    const month = parts.find(part => part.type === 'month').value;
    const day = parts.find(part => part.type === 'day').value;

    return `${year}-${month}-${day}`;
};

// GET REPORT DATE RANGE
const getReportDateRange = (period, dateFrom, dateTo) => {
    const today = getDhakaDate();

    let startDate;
    let endDate;

    if (period === 'custom') {
        if (!dateFrom || !dateTo) {
            throw new Error('Custom date range requires both start and end dates');
        }

        startDate = new Date(`${dateFrom}T00:00:00+06:00`);

        const selectedEndDate = new Date(`${dateTo}T00:00:00+06:00`);

        if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(selectedEndDate.getTime()) ||
            formatDate(startDate) !== dateFrom ||
            formatDate(selectedEndDate) !== dateTo
        ) {
            throw new Error('Invalid custom date range');
        }

        if (startDate > selectedEndDate) {
            throw new Error('Start date cannot be after end date');
        }

        endDate = new Date(selectedEndDate);
        endDate.setUTCDate(endDate.getUTCDate() + 1);

    } else if (period === 'week') {
        // GET CURRENT BANGLADESH DATE
        const todayDate = new Date(`${today}T00:00:00Z`);

        const currentDay = todayDate.getUTCDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;

        // FIND MONDAY DATE
        const mondayDate = new Date(todayDate);

        mondayDate.setUTCDate(
            mondayDate.getUTCDate() - daysFromMonday
        );

        const mondayString = formatDate(mondayDate);

        // BANGLADESH LOCAL MIDNIGHT
        startDate = new Date(`${mondayString}T00:00:00+06:00`);

        endDate = new Date(startDate);
        endDate.setUTCDate(endDate.getUTCDate() + 7);

    } else {
        // CURRENT BANGLADESH YEAR AND MONTH
        const [year, month] = today.split('-').map(Number);

        const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;

        // NEXT MONTH FIRST DAY
        const nextMonthDate = new Date(
            Date.UTC(year, month, 1)
        );

        const nextMonthString = formatDate(nextMonthDate);

        // BANGLADESH LOCAL MIDNIGHT
        startDate = new Date(`${firstDay}T00:00:00+06:00`);

        endDate = new Date(`${nextMonthString}T00:00:00+06:00`);
    }

    return {
        startDate,
        endDate,
        dateFrom: formatDate(startDate),
        dateTo: formatDate(
            new Date(endDate.getTime() - 1)
        )
    };
};

// DATE FILTER
const dateFilter = (field, startDate, endDate) => ({
    [field]: {
        $gte: startDate,
        $lt: endDate
    }
});

// DASHBOARD AUDIT SUMMARY
export const getDashboardAudit = async (req, res) => {
    try {
        const period = req.query.period || 'month';
        const { dateFrom, dateTo } = req.query;

        if (!['week', 'month', 'custom'].includes(period)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid report period'
            });
        }

        const range = getReportDateRange(
            period,
            dateFrom,
            dateTo
        );

        const { startDate, endDate } = range;

        // CURRENT INVENTORY STATUS
        const [
            stockStatus,
            assetStatus,
            totalStockItems,
            totalReceipts,
            openingStockReceipts,
            normalReceipts,
            assignmentHistory,
            damageHistory,
            repairHistory,
            successfulRepairs,
            supplierReturnHistory,
            supplierReturnItems,
            departmentStats,
            roomStats,
            userStats
        ] = await Promise.all([

            // CURRENT STOCK UNIT COUNTS
            StockUnit.aggregate([
                {
                    $group: {
                        _id: '$status',
                        quantity: { $sum: 1 }
                    }
                }
            ]),

            // CURRENT ASSET COUNTS
            Asset.aggregate([
                {
                    $group: {
                        _id: '$status',
                        quantity: { $sum: 1 }
                    }
                }
            ]),

            StockItem.countDocuments({
                isActive: true
            }),

            // RECEIVING HISTORY
            StockReceipt.aggregate([
                {
                    $match: dateFilter(
                        'receivedDate',
                        startDate,
                        endDate
                    )
                },
                {
                    $group: {
                        _id: null,
                        totalQuantity: { $sum: '$quantity' },
                        totalReceipts: { $sum: 1 }
                    }
                }
            ]),

            // OPENING STOCK HISTORY
            StockReceipt.aggregate([
                {
                    $match: {
                        ...dateFilter(
                            'receivedDate',
                            startDate,
                            endDate
                        ),
                        supplier: 'Opening Stock'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalQuantity: { $sum: '$quantity' },
                        totalReceipts: { $sum: 1 }
                    }
                }
            ]),

            // NORMAL RECEIVING HISTORY
            StockReceipt.aggregate([
                {
                    $match: {
                        ...dateFilter(
                            'receivedDate',
                            startDate,
                            endDate
                        ),
                        supplier: { $ne: 'Opening Stock' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalQuantity: { $sum: '$quantity' },
                        totalReceipts: { $sum: 1 }
                    }
                }
            ]),

            // ASSIGNMENT HISTORY - MULTIPLE PRODUCTS
            Assignment.aggregate([
                {
                    $match: dateFilter(
                        'assignedDate',
                        startDate,
                        endDate
                    )
                },
                {
                    $group: {
                        _id: null,
                        totalAssignments: { $sum: 1 },

                        // SUM QUANTITY FROM ALL PRODUCTS
                        totalQuantity: {
                            $sum: {
                                $sum: {
                                    $ifNull: ['$items.quantity', []]
                                }
                            }
                        }
                    }
                }
            ]),

            // DAMAGE HISTORY
            DamageHistory.aggregate([
                {
                    $match: dateFilter(
                        'damagedAt',
                        startDate,
                        endDate
                    )
                },
                {
                    $group: {
                        _id: null,
                        totalDamageEvents: { $sum: 1 }
                    }
                }
            ]),

            // REPAIR HISTORY
            Repair.aggregate([
                {
                    $match: dateFilter(
                        'sentForRepairAt',
                        startDate,
                        endDate
                    )
                },
                {
                    $group: {
                        _id: null,
                        totalRepairs: { $sum: 1 },
                        inProgress: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', 'In Progress'] },
                                    1,
                                    0
                                ]
                            }
                        },
                        successful: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', 'Successful'] },
                                    1,
                                    0
                                ]
                            }
                        },
                        unsuccessful: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', 'Unsuccessful'] },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ]),

            // SUCCESSFUL REPAIRS COMPLETED IN SELECTED PERIOD
            Repair.countDocuments({
                status: 'Successful',
                ...dateFilter(
                    'completedAt',
                    startDate,
                    endDate
                )
            }),

            // SUPPLIER RETURN HISTORY
            SupplierReturn.aggregate([
                {
                    $match: dateFilter(
                        'returnDate',
                        startDate,
                        endDate
                    )
                },
                {
                    $group: {
                        _id: null,
                        totalReturns: { $sum: 1 },
                        totalQuantity: { $sum: '$totalItems' }
                    }
                }
            ]),

            // SUPPLIER RETURN ITEM HISTORY
            SupplierReturnItem.countDocuments({
                ...dateFilter(
                    'returnedAt',
                    startDate,
                    endDate
                )
            }),

            // DEPARTMENT COUNTS
            Department.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        active: {
                            $sum: {
                                $cond: [
                                    { $ne: ['$isActive', false] },
                                    1,
                                    0
                                ]
                            }
                        },
                        inactive: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$isActive', false] },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ]),

            // ROOM COUNTS
            Room.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        active: {
                            $sum: {
                                $cond: [
                                    { $ne: ['$isActive', false] },
                                    1,
                                    0
                                ]
                            }
                        },
                        inactive: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$isActive', false] },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ]),

            // USER COUNTS
            User.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        active: {
                            $sum: {
                                $cond: [
                                    { $ne: ['$isActive', false] },
                                    1,
                                    0
                                ]
                            }
                        },
                        inactive: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$isActive', false] },
                                    1,
                                    0
                                ]
                            }
                        },
                        admins: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$role', 'admin'] },
                                    1,
                                    0
                                ]
                            }
                        },
                        employees: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$role', 'employee'] },
                                    1,
                                    0
                                ]
                            }
                        },
                        normalUsers: {
                            $sum: {
                                $cond: [
                                    { $in: ['$role', ['user', 'customer']] },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ])
        ]);

        // CONVERT STATUS ARRAYS TO OBJECTS
        const getStatusCount = (data) => {
            const result = {};

            data.forEach(item => {
                result[item._id] = item.quantity;
            });

            return result;
        };

        const stockCounts = getStatusCount(stockStatus);
        const assetCounts = getStatusCount(assetStatus);

        const getFirst = (data) => data[0] || {};

        // RECENT DATABASE ACTIVITIES
        const [
            receipts,
            assignments,
            damages,
            repairs,
            returns,
            newUsers
        ] = await Promise.all([

            StockReceipt.find(
                dateFilter('receivedDate', startDate, endDate)
            )
                .populate('stockItem', 'name sku')
                .populate('receivedBy', 'name')
                .sort({ receivedDate: -1 })
                .limit(30)
                .lean(),

            // MULTI-PRODUCT ASSIGNMENT HISTORY
            Assignment.find(
                dateFilter('assignedDate', startDate, endDate)
            )
                .populate('items.stockItem', 'name sku')
                .populate('items.stockUnits', 'unitCode serialNumber status')
                .populate('items.assets', 'assetId serialNumber status')
                .populate('department', 'name')
                .populate('room', 'name roomNumber')
                .sort({ assignedDate: -1 })
                .limit(30)
                .lean(),

            DamageHistory.find(
                dateFilter('damagedAt', startDate, endDate)
            )
                .populate('asset', 'assetId name')
                .populate('stockItem', 'name')
                .sort({ damagedAt: -1 })
                .limit(30)
                .lean(),

            Repair.find(
                dateFilter('sentForRepairAt', startDate, endDate)
            )
                .populate('asset', 'assetId name')
                .populate('stockItem', 'name')
                .sort({ sentForRepairAt: -1 })
                .limit(30)
                .lean(),

            SupplierReturn.find(
                dateFilter('returnDate', startDate, endDate)
            )
                .populate('supplier', 'companyName')
                .sort({ returnDate: -1 })
                .limit(30)
                .lean(),

            User.find(
                dateFilter('createdAt', startDate, endDate)
            )
                .select('name email role createdAt')
                .sort({ createdAt: -1 })
                .limit(30)
                .lean()
        ]);

        // FORMAT ACTIVITIES
        const activities = [];

        receipts.forEach(item => {
            activities.push({
                type: item.supplier === 'Opening Stock'
                    ? 'Opening Stock'
                    : 'Stock Received',
                title: item.stockItem?.name || 'Stock Item',
                description: `${item.quantity} unit(s) received`,
                reference: item.receiptNumber,
                date: item.receivedDate,
                user: item.receivedBy?.name || 'System'
            });
        });

        // MULTI-PRODUCT ASSIGNMENT ACTIVITIES
        assignments.forEach(item => {

            const assignmentItems = Array.isArray(item.items)
                ? item.items
                : [];

            const totalAssignedQuantity = assignmentItems.reduce(
                (total, product) => total + (Number(product.quantity) || 0),
                0
            );

            const productNames = assignmentItems
                .map(product =>
                    product.stockItem?.name ||
                    product.productDetails?.name
                )
                .filter(Boolean);

            const uniqueProductNames = [...new Set(productNames)];

            activities.push({
                type: 'Assignment',

                title: uniqueProductNames.length
                    ? uniqueProductNames.join(', ')
                    : 'Stock Items',

                description: `${totalAssignedQuantity} unit(s) assigned across ${assignmentItems.length} product type(s)`,

                reference: item.assignmentId,
                date: item.assignedDate,
                user: item.receiver?.name || 'System',
                department: item.department?.name || '',
                room: item.room?.name || ''
            });
        });

        damages.forEach(item => {
            activities.push({
                type: 'Damage',
                title: item.asset?.assetId || item.stockItem?.name || 'Asset',
                description: item.damageDescription || 'Damage reported',
                reference: item._id,
                date: item.damagedAt,
                user: item.createdBy?.name || 'System'
            });
        });

        repairs.forEach(item => {
            activities.push({
                type: 'Repair',
                title: item.asset?.assetId || item.stockItem?.name || 'Asset',
                description: item.issueDescription || 'Repair process started',
                reference: item.repairNumber,
                date: item.sentForRepairAt,
                status: item.status
            });
        });

        returns.forEach(item => {
            activities.push({
                type: 'Supplier Return',
                title: item.supplierDetails?.companyName ||
                    item.supplier?.companyName ||
                    'Supplier',
                description: `${item.totalItems} device(s) returned`,
                reference: item.returnNumber,
                date: item.returnDate,
                status: item.status
            });
        });

        newUsers.forEach(item => {
            activities.push({
                type: 'New User',
                title: item.name,
                description: `New ${item.role} account created`,
                reference: item.email,
                date: item.createdAt
            });
        });

        activities.sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );

        return res.status(200).json({
            success: true,

            period: {
                type: period,
                dateFrom: range.dateFrom,
                dateTo: range.dateTo
            },

            current: {
                stock: {
                    totalStockItems,
                    totalUnits: Object.values(stockCounts).reduce(
                        (sum, value) => sum + value,
                        0
                    ),
                    available: stockCounts.Available || 0,
                    assigned: stockCounts.Assigned || 0,
                    damaged: stockCounts.Damaged || 0,
                    underRepair: stockCounts['Under Repair'] || 0,
                    returned: stockCounts.Returned || 0
                },

                assets: {
                    total: Object.values(assetCounts).reduce(
                        (sum, value) => sum + value,
                        0
                    ),
                    available: assetCounts.Available || 0,
                    assigned: assetCounts.Assigned || 0,
                    damaged: assetCounts.Damaged || 0,
                    underRepair: assetCounts['Under Repair'] || 0,
                    returned: assetCounts.Returned || 0
                },

                departments: getFirst(departmentStats),

                rooms: getFirst(roomStats),

                users: getFirst(userStats)
            },

            report: {
                receiving: {
                    totalReceipts: getFirst(totalReceipts).totalReceipts || 0,
                    totalQuantity: getFirst(totalReceipts).totalQuantity || 0,

                    openingStockReceipts:
                        getFirst(openingStockReceipts).totalReceipts || 0,

                    openingStockQuantity:
                        getFirst(openingStockReceipts).totalQuantity || 0,

                    normalReceipts:
                        getFirst(normalReceipts).totalReceipts || 0,

                    receivedQuantity:
                        getFirst(normalReceipts).totalQuantity || 0
                },

                assignments: {
                    total: getFirst(assignmentHistory).totalAssignments || 0,
                    quantity: getFirst(assignmentHistory).totalQuantity || 0
                },

                damages: {
                    total: getFirst(damageHistory).totalDamageEvents || 0
                },

                repairs: {
                    total: getFirst(repairHistory).totalRepairs || 0,
                    inProgress: getFirst(repairHistory).inProgress || 0,
                    successful: getFirst(repairHistory).successful || 0,
                    unsuccessful: getFirst(repairHistory).unsuccessful || 0,
                    completedInPeriod: successfulRepairs
                },

                supplierReturns: {
                    total: getFirst(supplierReturnHistory).totalReturns || 0,
                    quantity: getFirst(supplierReturnHistory).totalQuantity || 0,
                    itemRecords: supplierReturnItems
                }
            },

            activities: activities.slice(0, 50)
        });

    } catch (error) {
        console.error('DASHBOARD AUDIT ERROR:', error);

        return res.status(
            error.message.includes('date range') ||
            error.message.includes('date') ||
            error.message.includes('Start date')
                ? 400
                : 500
        ).json({
            success: false,
            message: error.message || 'Failed to load dashboard audit report'
        });
    }
};
