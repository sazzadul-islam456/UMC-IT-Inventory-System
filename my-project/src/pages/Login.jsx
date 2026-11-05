
import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();

        setLoading(true);
        setError('');

        try {
            const response = await axios.post(
                'http://localhost:3001/api/auth/login',
                {
                    email: email.trim(),
                    password
                }
            );

            console.log('Login Response:', response.data);

            const { token, user } = response.data;

            if (!token || !user) {
                throw new Error('Invalid server response.');
            }

            if (user.role === 'admin') {
                login(user, token);
                navigate('/admin/dashboard');

            } else if (user.role === 'employee') {
                login(user, token);
                navigate('/employee/dashboard');

            } else if (user.role === 'customer') {
                login(user, token);
                navigate('/customer/dashboard');

            } else {
                setError('Invalid user role. Please contact the administrator.');
            }

        } catch (error) {
            console.error('Login Error:', error);

            if (error.response) {
                setError(
                    error.response.data?.message || 'Login failed.'
                );
            } else if (error.request) {
                setError(
                    'Cannot connect to server. Please check if backend is running.'
                );
            } else {
                setError(
                    error.message || 'Something went wrong.'
                );
            }

        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen relative flex items-center justify-center bg-cover bg-center bg-no-repeat px-4 py-10"
            style={{
                backgroundImage:
                    "linear-gradient(120deg, rgba(8, 25, 55, 0.82), rgba(15, 55, 100, 0.45)), url('/united-medical-store.png')"
            }}
        >

            {/* Background Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-950/20 via-transparent to-cyan-950/30"></div>

            {/* Main Container */}
            <div className="relative z-10 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                {/* Left Content */}
                <div className="hidden lg:block text-white">

                    {/* College Branding */}
                    <div className="flex items-center gap-4 mb-12">

                        <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-3xl shadow-xl">
                            🏥
                        </div>

                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight">
                                UNITED MEDICAL COLLEGE
                            </h1>

                            <p className="text-blue-200 text-sm tracking-widest mt-1">
                                INFORMATION TECHNOLOGY DEPARTMENT
                            </p>
                        </div>

                    </div>

                    {/* Main Heading */}
                    <div className="max-w-xl">

                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-400/15 border border-cyan-300/30 text-cyan-200 text-sm font-medium mb-6">

                            <span className="w-2 h-2 bg-cyan-300 rounded-full animate-pulse"></span>

                            IT ASSET MANAGEMENT SYSTEM

                        </div>

                        <h2 className="text-5xl xl:text-6xl font-extrabold leading-tight tracking-tight mb-6">

                            IT Inventory

                            <span className="block text-cyan-300">
                                Management
                            </span>

                        </h2>

                        <p className="text-lg text-blue-100 leading-relaxed max-w-lg">
                            Manage computers, laptops, printers, networking
                            devices and other IT equipment efficiently.
                            Track inventory, monitor asset allocation
                            and manage all IT resources from one centralized platform.
                        </p>

                    </div>

                    {/* Features */}
                    <div className="grid grid-cols-2 gap-4 mt-12 max-w-xl">

                        <div className="flex items-center gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/10">
                            <span className="text-3xl">💻</span>
                            <div>
                                <h3 className="font-semibold">IT Assets</h3>
                                <p className="text-xs text-blue-200 mt-1">
                                    Device Management
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/10">
                            <span className="text-3xl">📦</span>
                            <div>
                                <h3 className="font-semibold">Stock Tracking</h3>
                                <p className="text-xs text-blue-200 mt-1">
                                    Inventory Control
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/10">
                            <span className="text-3xl">🖨️</span>
                            <div>
                                <h3 className="font-semibold">Equipment</h3>
                                <p className="text-xs text-blue-200 mt-1">
                                    Allocation Tracking
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/10">
                            <span className="text-3xl">📊</span>
                            <div>
                                <h3 className="font-semibold">Reports</h3>
                                <p className="text-xs text-blue-200 mt-1">
                                    Asset Overview
                                </p>
                            </div>
                        </div>

                    </div>

                    <p className="text-blue-200/70 text-xs mt-12 tracking-wide">
                        UNITED MEDICAL COLLEGE • IT DEPARTMENT
                    </p>

                </div>

                {/* Login Card */}
                <div className="w-full max-w-md mx-auto">

                    <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 sm:p-10">

                        {/* Mobile Branding */}
                        <div className="lg:hidden text-center mb-7">

                            <h1 className="text-xl font-extrabold text-blue-900">
                                UNITED MEDICAL COLLEGE
                            </h1>

                            <p className="text-xs text-slate-500 mt-1">
                                IT DEPARTMENT
                            </p>

                        </div>

                        {/* Logo */}
                        <div className="text-center mb-8">

                            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-4xl shadow-xl shadow-blue-200">
                                💻
                            </div>

                            <h2 className="text-3xl font-extrabold text-slate-800 mt-6">
                                Welcome <span className="text-blue-600">Back!</span>
                            </h2>

                            <p className="text-slate-500 text-sm mt-2">
                                Sign in to access the IT Inventory System
                            </p>

                        </div>

                        {/* Login Form */}
                        <form className="space-y-5" onSubmit={handleSubmit}>

                            {/* Email */}
                            <div>

                                <label
                                    htmlFor="email"
                                    className="block text-sm font-semibold text-slate-700 mb-2"
                                >
                                    Email Address
                                </label>

                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    required
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition duration-200"
                                />

                            </div>

                            {/* Password */}
                            <div>

                                <label
                                    htmlFor="password"
                                    className="block text-sm font-semibold text-slate-700 mb-2"
                                >
                                    Password
                                </label>

                                <div className="relative">

                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="password"
                                        name="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                        className="w-full px-4 py-3.5 pr-20 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition duration-200"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-blue-600 hover:text-blue-800"
                                    >
                                        {showPassword ? 'Hide' : 'Show'}
                                    </button>

                                </div>

                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
                                    {error}
                                </div>
                            )}

                            {/* Remember Me */}
                            <div className="flex items-center justify-between text-sm">

                                <label className="flex items-center gap-2 text-slate-600 cursor-pointer">

                                    <input
                                        type="checkbox"
                                        name="remember"
                                        className="w-4 h-4 accent-blue-600 rounded"
                                    />

                                    Remember me

                                </label>

                                <button
                                    type="button"
                                    className="text-blue-600 font-semibold hover:text-blue-800 hover:underline"
                                >
                                    Forgot Password?
                                </button>

                            </div>

                            {/* Sign In */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-bold shadow-lg shadow-blue-200 hover:shadow-xl transition duration-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Signing In...' : 'Sign In →'}
                            </button>

                            {import.meta.env.DEV && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEmail('admin@example.com');
                                        setPassword('admin');
                                    }}
                                    className="w-full py-3 rounded-xl border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50 transition"
                                >
                                    Fill local demo admin login
                                </button>
                            )}

                        </form>

                        {/* Security Footer */}
                        <div className="mt-8 pt-6 border-t border-slate-200">

                            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
                                <span className="text-green-500">●</span>
                                Secure IT Department Access
                            </div>

                            <p className="text-center text-xs text-slate-400 mt-4">
                                United Medical College
                            </p>

                            <p className="text-center text-xs text-slate-400 mt-1">
                                © 2026 All Rights Reserved
                            </p>

                        </div>

                    </div>

                </div>

            </div>
        </div>
    );
};

export default Login;
