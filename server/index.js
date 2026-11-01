import express from 'express';
import cors from 'cors';
import connectDB from './db/connection.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routestow/userRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

// Auth Routes
app.use('/api/auth', authRoutes);

// User Routes
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Server is working!');
});

const startServer = async () => {
    try {
        await connectDB();

        console.log('MongoDB connected successfully');

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

    } catch (error) {
        console.error('Server Error:', error.message);
    }
};

startServer();