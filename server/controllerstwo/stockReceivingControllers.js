
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

import StockItem from '../models/StockItem.js';
import StockUnit from '../models/StockUnit.js';
import StockReceipt from '../models/StockReceipt.js';

// STOCK RECEIVING CONTROLLER - Search: STOCK RECEIVING CONTROLLER

// RECEIVE / RESTOCK
export const receiveStock = async (req, res) => {
    let session;

    try {
        const { id } = req.params;

        const {
            quantity,
            serialNumbers = [],
            receivedDate,
            supplier = '',
            referenceNumber = '',
            description = ''
        } = req.body;

        // STOCK ID VALIDATION
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid stock item ID'
            });
        }

        // QUANTITY VALIDATION
        const receiveQuantity = Number(quantity);

        if (
            !Number.isSafeInteger(receiveQuantity) ||
            receiveQuantity < 1
        ) {
            return res.status(400).json({
                success: false,
                message: 'Receive quantity must be a positive whole number'
            });
        }

        // SERIAL NUMBER VALIDATION
        if (!Array.isArray(serialNumbers)) {
            return res.status(400).json({
                success: false,
                message: 'Serial numbers must be an array'
            });
        }

        if (
            serialNumbers.length !== 0 &&
            serialNumbers.length !== receiveQuantity
        ) {
            return res.status(400).json({
                success: false,
                message: 'Provide one serial number entry for each device'
            });
        }

        const cleanedSerialNumbers = Array.from(
            { length: receiveQuantity },
            (_, index) => {
                const serial = serialNumbers[index];

                return typeof serial === 'string'
                    ? serial.trim()
                    : '';
            }
        );

        // CHECK DUPLICATE SERIALS IN REQUEST
        const normalizedSerialNumbers = cleanedSerialNumbers
            .filter(Boolean)
            .map(serial => serial.toLowerCase());

        if (
            new Set(normalizedSerialNumbers).size !==
            normalizedSerialNumbers.length
        ) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate serial numbers are not allowed'
            });
        }

        // TEXT VALIDATION
        if (
            typeof supplier !== 'string' ||
            typeof referenceNumber !== 'string' ||
            typeof description !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Supplier, reference number and description must be text'
            });
        }

        // RECEIVING DATE VALIDATION
        const receiptDate = receivedDate
            ? new Date(receivedDate)
            : new Date();

        if (Number.isNaN(receiptDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid receiving date'
            });
        }

        // START MONGODB TRANSACTION
        session = await mongoose.startSession();

        let updatedStock;
        let createdReceipt;
        let createdUnits;

        await session.withTransaction(async () => {

            // CHECK STOCK ITEM
            const stockItem = await StockItem.findOne({
                _id: id,
                isActive: true
            }).session(session);

            if (!stockItem) {
                const error = new Error(
                    'Stock item not found or inactive'
                );
                error.statusCode = 404;
                throw error;
            }

            // CHECK EXISTING SERIAL NUMBERS
            if (normalizedSerialNumbers.length > 0) {
                const existingUnits = await StockUnit.find({
                    serialNumber: {
                        $in: cleanedSerialNumbers.filter(Boolean)
                    }
                }).session(session);

                if (existingUnits.length > 0) {
                    const error = new Error(
                        'One or more manufacturer serial numbers already exist'
                    );
                    error.statusCode = 409;
                    throw error;
                }
            }

            // GENERATE RECEIPT NUMBER
            const receiptNumber = `REC-${randomUUID()}`;

            // CREATE RECEIVING HISTORY
            const receipt = await StockReceipt.create(
                [
                    {
                        stockItem: stockItem._id,
                        receiptNumber,
                        quantity: receiveQuantity,
                        receivedDate: receiptDate,
                        supplier: supplier.trim(),
                        referenceNumber: referenceNumber.trim(),
                        description: description.trim(),
                        receivedBy: req.user?._id || null
                    }
                ],
                { session }
            );

            createdReceipt = receipt[0];

            // PREPARE INDIVIDUAL DEVICE RECORDS
            const units = cleanedSerialNumbers.map(serial => ({
                stockItem: stockItem._id,

                unitCode: `UMC-UNIT-${randomUUID()}`,

                ...(serial ? { serialNumber: serial } : {}),

                receipt: createdReceipt._id,

                status: 'Available',

                description: ''
            }));

            // CREATE DEVICE RECORDS
            createdUnits = await StockUnit.insertMany(
                units,
                {
                    ordered: true,
                    session
                }
            );

            // ATOMIC STOCK QUANTITY UPDATE
            updatedStock = await StockItem.findOneAndUpdate(
                {
                    _id: id,
                    isActive: true
                },
                {
                    $inc: {
                        totalReceivedQuantity: receiveQuantity,
                        availableQuantity: receiveQuantity
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
                    'Stock update failed. Please try again.'
                );
                error.statusCode = 409;
                throw error;
            }
        }, {
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority' },
            readPreference: 'primary'
        });

        return res.status(201).json({
            success: true,
            message: `${receiveQuantity} device(s) received successfully`,
            receipt: createdReceipt,
            receivedQuantity: receiveQuantity,
            generatedCodes: createdUnits.map(unit => ({
                unitCode: unit.unitCode,
                serialNumber: unit.serialNumber || null
            })),
            stock: updatedStock
        });

    } catch (error) {
        console.error('RECEIVE STOCK ERROR:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Duplicate serial number or unique code detected'
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
            message: 'Failed to receive stock',
            error: error.message
        });

    } finally {
        if (session) {
            try {
                await session.endSession();
            } catch (sessionError) {
                console.error(
                    'RECEIVE STOCK SESSION CLEANUP ERROR:',
                    sessionError
                );
            }
        }
    }
};


// GET STOCK RECEIVING HISTORY
export const getStockReceipts = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid stock item ID'
            });
        }

        const receipts = await StockReceipt.find({
            stockItem: id
        })
            .populate('receivedBy', 'name email')
            .sort({ receivedDate: -1 });

        return res.status(200).json({
            success: true,
            count: receipts.length,
            receipts
        });

    } catch (error) {
        console.error('GET STOCK RECEIPTS ERROR:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch receiving history',
            error: error.message
        });
    }
};


// GET INDIVIDUAL STOCK UNITS
export const getStockUnits = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid stock item ID'
            });
        }

        const units = await StockUnit.find({
            stockItem: id
        })
            .populate('receipt', 'receiptNumber receivedDate supplier')
            .populate('asset')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: units.length,
            units
        });

    } catch (error) {
        console.error('GET STOCK UNITS ERROR:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch individual devices',
            error: error.message
        });
    }
};
