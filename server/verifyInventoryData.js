
import mongoose from 'mongoose';

const INVENTORY_COLLECTIONS = [
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

const PRESERVED_COLLECTIONS = [
    'users',
    'departments',
    'rooms',
    'suppliers'
];

const verifyDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const db = mongoose.connection.db;

        if (mongoose.connection.name !== 'store') {
            throw new Error('Wrong database. Expected: store');
        }

        console.log('\n===== INVENTORY COLLECTIONS =====');

        for (const name of INVENTORY_COLLECTIONS) {
            const exists = await db
                .listCollections({ name }, { nameOnly: true })
                .hasNext();

            const count = exists
                ? await db.collection(name).countDocuments()
                : 0;

            console.log(`${name}: ${count}`);
        }

        console.log('\n===== PRESERVED COLLECTIONS =====');

        for (const name of PRESERVED_COLLECTIONS) {
            const exists = await db
                .listCollections({ name }, { nameOnly: true })
                .hasNext();

            const count = exists
                ? await db.collection(name).countDocuments()
                : 0;

            console.log(`${name}: ${count}`);
        }

        console.log('\nDATABASE VERIFICATION COMPLETED.');

    } catch (error) {
        console.error('VERIFICATION FAILED:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

verifyDatabase();
