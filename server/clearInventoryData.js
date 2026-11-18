
import mongoose from 'mongoose';

// INVENTORY DATA RESET
// WARNING: This permanently deletes the selected inventory data.

const COLLECTIONS_TO_CLEAR = [
    'supplierreturnitems',
    'supplierreturns',
    'damagehistories',
    'repairs',
    'assignments',
    'assets',
    'stockunits',
    'stockreceipts',
    'stockitems'
];

const clearInventoryData = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is missing from .env');
        }

        await mongoose.connect(process.env.MONGO_URI);

        const db = mongoose.connection.db;

        // SAFETY CHECK: Only allow the store database
        if (mongoose.connection.name !== 'store') {
            throw new Error(
                `Wrong database: ${mongoose.connection.name}. Expected: store`
            );
        }

        console.log('\nCONNECTED DATABASE:', mongoose.connection.name);
        console.log('\nSTARTING INVENTORY DATA CLEAR...\n');

        const existingCollections = await db
            .listCollections({}, { nameOnly: true })
            .toArray();

        const existingNames = existingCollections.map(
            collection => collection.name
        );

        for (const collectionName of COLLECTIONS_TO_CLEAR) {
            if (!existingNames.includes(collectionName)) {
                console.log(`SKIPPED (not found): ${collectionName}`);
                continue;
            }

            const result = await db
                .collection(collectionName)
                .deleteMany({});

            console.log(
                `CLEARED: ${collectionName} | Deleted: ${result.deletedCount}`
            );
        }

        console.log('\nINVENTORY DATA CLEAR COMPLETED.');

        console.log(
            '\nAdmin, Users, Departments, Rooms and Suppliers were not touched.'
        );

    } catch (error) {
        console.error('\nCLEAR FAILED:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

clearInventoryData();
