
import express from 'express';
import cors from 'cors';
import connectDB from './db/connection.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routestow/userRoutes.js';
import stockRoutes from './routestow/stockRoutes.js';

// DEPARTMENT ROUTES IMPORT
import departmentRoutes from './routestow/departmentRoutes.js';

// ROOM ROUTES IMPORT
import roomRoutes from './routestow/roomRoutes.js';

// ASSET ROUTES IMPORT
import assetRoutes from './routestow/assetRoutes.js';

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// REQUEST DEBUG MIDDLEWARE
app.use((req, res, next) => {
    console.log('REQUEST RECEIVED:', req.method, req.url);
    next();
});

// AUTH ROUTES
app.use('/api/auth', authRoutes);

// USER ROUTES
app.use('/api/users', userRoutes);

// STOCK INVENTORY ROUTES
app.use('/api/stock', stockRoutes);

// DEPARTMENT TEST ROUTE
app.get('/api/departments/test', (req, res) => {
    console.log('DEPARTMENT TEST REQUEST RECEIVED');

    res.status(200).json({
        success: true,
        message: 'Department test route is working!'
    });
});

// DEPARTMENT ROUTES MOUNT
app.use('/api/departments', departmentRoutes);

// ROOM TEST ROUTE
app.get('/api/rooms/test', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Room test route is working!'
    });
});

// ROOM ROUTES MOUNT
app.use('/api/rooms', roomRoutes);

// ASSET ROUTES MOUNT
app.use('/api/assets', assetRoutes);

// REGISTERED ROUTES
console.log(
    'REGISTERED ROUTES:',
    app.router.stack
        .filter(layer => layer.route)
        .map(layer => layer.route.path)
);

// ROOT ROUTE
app.get('/', (req, res) => {
    res.send('Server is working!');
});

// SERVER PORT
const PORT = 3001;

// SERVER START
const startServer = async () => {
    try {
        await connectDB();

        console.log('MongoDB connected successfully');
        console.log('DEPARTMENT TEST ROUTE REGISTERED');
        console.log('ROOM TEST ROUTE REGISTERED');
        console.log('ASSET ROUTE REGISTERED');

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

    } catch (error) {
        console.error('Server Error:', error.message);
    }
};

startServer();
