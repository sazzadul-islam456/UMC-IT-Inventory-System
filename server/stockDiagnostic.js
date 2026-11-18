
import mongoose from 'mongoose';

import Asset from './models/Asset.js';
import StockUnit from './models/StockUnit.js';
import StockItem from './models/StockItem.js';
import StockReceipt from './models/StockReceipt.js';

// READ ONLY STOCK DATA RECOVERY DIAGNOSTIC

const runDiagnostic = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log('\n===== CURRENT STOCK ITEMS =====\n');

        const stockItems = await StockItem.find().lean();

        stockItems.forEach(item => {
            console.log({
                id: item._id.toString(),
                name: item.name,
                category: item.category,
                brand: item.brand,
                model: item.model,
                sku: item.sku,
                supplierName: item.supplierName,
                available: item.availableQuantity,
                assigned: item.assignedQuantity
            });
        });

        const assets = await Asset.find().lean();
        const units = await StockUnit.find().lean();

        const referencedIds = new Set();

        assets.forEach(asset => {
            if (asset.stockItem) {
                referencedIds.add(asset.stockItem.toString());
            }
        });

        units.forEach(unit => {
            if (unit.stockItem) {
                referencedIds.add(unit.stockItem.toString());
            }
        });

        const existingIds = new Set(
            stockItems.map(item => item._id.toString())
        );

        const missingIds = [...referencedIds].filter(
            id => !existingIds.has(id)
        );

        console.log('\n===== MISSING PRODUCT RECOVERY REPORT =====\n');
        console.log('MISSING PRODUCT IDs:', missingIds.length);

        for (const id of missingIds) {
            const relatedAssets = assets.filter(
                asset => asset.stockItem?.toString() === id
            );

            const relatedUnits = units.filter(
                unit => unit.stockItem?.toString() === id
            );

            const receipts = await StockReceipt.find({
                stockItem: new mongoose.Types.ObjectId(id)
            }).lean();

            console.log('\n======================================');
            console.log('MISSING STOCK ITEM ID:', id);
            console.log('======================================');

            console.log('\n--- ASSET PRODUCT SNAPSHOTS ---');

            console.log(
                relatedAssets.map(asset => ({
                    assetId: asset.assetId,
                    name: asset.name,
                    brand: asset.brand,
                    model: asset.model,
                    sku: asset.sku,
                    serialNumber: asset.serialNumber,
                    status: asset.status,
                    description: asset.description,
                    createdAt: asset.createdAt
                }))
            );

            console.log('\n--- STOCK UNIT SUMMARY ---');

            const statusCounts = {};

            relatedUnits.forEach(unit => {
                statusCounts[unit.status] =
                    (statusCounts[unit.status] || 0) + 1;
            });

            console.log({
                totalUnits: relatedUnits.length,
                statusCounts
            });

            console.log('\n--- STOCK UNIT RECEIPT REFERENCES ---');

            console.log(
                relatedUnits.map(unit => ({
                    unitCode: unit.unitCode,
                    status: unit.status,
                    receiptId: unit.receipt?.toString() || null,
                    serialNumber: unit.serialNumber
                }))
            );

            console.log('\n--- RECEIPT DETAILS ---');

            console.log(
                receipts.map(receipt => ({
                    receiptId: receipt._id.toString(),
                    receiptNumber: receipt.receiptNumber,
                    quantity: receipt.quantity,
                    supplier: receipt.supplier,
                    referenceNumber: receipt.referenceNumber,
                    description: receipt.description,
                    receivedDate: receipt.receivedDate
                }))
            );
        }

        console.log('\n===== RECOVERY DIAGNOSTIC COMPLETED =====');

    } catch (error) {
        console.error('\nDiagnostic Error:', error);

    } finally {
        await mongoose.disconnect();
    }
};

runDiagnostic();
