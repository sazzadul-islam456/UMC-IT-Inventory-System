
import bcrypt from 'bcryptjs';
import connectDB from './db/connection.js';
import User from './models/User.js';

const register = async () => {
    try {
        await connectDB();

        const hashpassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

        const user = new User({
            name: 'admin',
            email: 'admin@example.com',
            password: hashpassword,
            address: 'admin address',
            role: 'admin'
        });

        await user.save();

        console.log('Admin user created successfully');
    } catch (error) {
        console.error('Error creating admin user:', error.message);
    }
};

register();
