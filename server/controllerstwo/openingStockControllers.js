
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

import StockItem from '../models/StockItem.js';
import StockUnit from '../models/StockUnit.js';
import StockReceipt from '../models/StockReceipt.js';

// OPENING STOCK REGISTRATION - Search: OPENING STOCK REGISTRATION

export const registerOpeningStock = async (req, res) => {
    let session;

    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid stock item ID'
            });
        }

        session = await mongoose.startSession();

        let registeredUnits = 0;
        let receipt;

        await session.withTransaction(async () => {

            // FIND STOCK ITEM
            const stockItem = await StockItem.findOne({
                _id: id,
                isActive: true
            }).session(session);

            if (!stockItem) {
                const error = new Error('Stock item not found or inactive');
                error.statusCode = 404;
                throw error;
            }

            // CHECK EXISTING STOCK UNITS
            const existingUnits = await StockUnit.countDocuments({
                stockItem: id
            }).session(session);

            if (existingUnits > 0) {
                const error = new Error(
                    'Opening stock has already been registered for this product'
                );
                error.statusCode = 409;
                throw error;
            }

            // GET EXISTING QUANTITIES
            const quantities = {
                Available: Number(stockItem.availableQuantity || 0),
                Assigned: Number(stockItem.assignedQuantity || 0),
                Damaged: Number(stockItem.damagedQuantity || 0),
                'Under Repair': Number(stockItem.underRepairQuantity || 0)
            };

            // VALIDATE QUANTITIES
            const invalidQuantity = Object.values(quantities).some(
                value => !Number.isSafeInteger(value) || value < 0
            );

            if (invalidQuantity) {
                const error = new Error(
                    'Existing stock quantities are invalid'
                );
                error.statusCode = 400;
                throw error;
            }

            const totalQuantity = Object.values(quantities).reduce(
                (total, value) => total + value,
                0
            );

            if (totalQuantity < 1) {
                const error = new Error(
                    'There is no existing physical stock to register'
                );
                error.statusCode = 400;
                throw error;
            }

            // VERIFY STOCK QUANTITY CONSISTENCY
            if (Number(stockItem.totalReceivedQuantity || 0) !== totalQuantity) {
                const error = new Error(
                    `Quantity mismatch. Total received: ${stockItem.totalReceivedQuantity}, physical stock: ${totalQuantity}. Please verify stock quantities first.`
                );
                error.statusCode = 400;
                throw error;
            }

            // CREATE OPENING STOCK RECEIPT
            const receiptNumber = `OPENING-${randomUUID()}`;

            const createdReceipts = await StockReceipt.create(
                [{
                    stockItem: stockItem._id,
                    receiptNumber,
                    quantity: totalQuantity,
                    receivedDate: new Date(),
                    supplier: 'Opening Stock',
                    referenceNumber: 'INITIAL-STOCK-REGISTRATION',
                    description: 'Opening stock registration for existing inventory',
                    receivedBy: req.user?._id || null
                }],
                { session }
            );

            receipt = createdReceipts[0];

            // PREPARE INDIVIDUAL STOCK UNITS
            const units = [];

            for (const [status, quantity] of Object.entries(quantities)) {
                for (let i = 0; i < quantity; i++) {
                    units.push({
                        stockItem: stockItem._id,
                        unitCode: `UMC-UNIT-${randomUUID()}`,
                        receipt: receipt._id,
                        status,
                        asset: null,
                        description: 'Registered from existing opening stock'
                    });
                }
            }

            // CREATE STOCK UNITS
            await StockUnit.insertMany(units, {
                ordered: true,
                session
            });

            registeredUnits = units.length;
        });

        return res.status(201).json({
            success: true,
            message: 'Opening stock registered successfully',
            registeredUnits,
            receipt
        });

    } catch (error) {
        console.error('OPENING STOCK REGISTRATION ERROR:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Duplicate stock unit code or receipt number detected'
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
            message: 'Failed to register opening stock',
            error: error.message
        });

    } finally {
        if (session) {
            try {
                await session.endSession();
            } catch (sessionError) {
                console.error(
                    'OPENING STOCK SESSION CLEANUP ERROR:',
                    sessionError
                );
            }
        }
    }
};
