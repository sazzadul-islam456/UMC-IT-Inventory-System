
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
            className="min-h-screen relative flex items-center justify-center bg-cover bg-center bg-no-repeat px-4 py-8 sm:py-12 overflow-hidden"
            style={{
                backgroundImage:
                    "linear-gradient(120deg, rgba(7, 25, 58, 0.92), rgba(13, 55, 105, 0.76)), url('/united-medical-store.png')"
            }}
        >
            {/* Background Decorations */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-950/30 via-transparent to-orange-950/20"></div>

            <div className="absolute -top-32 -right-32 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-32 w-[500px] h-[500px] bg-blue-400/15 rounded-full blur-3xl"></div>

            {/* Main Container */}
            <div className="relative z-10 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-20 items-center">

                {/* Left Content */}
                <div className="hidden lg:block text-white">

                    {/* College Branding */}
                    <div className="flex items-center gap-4 mb-12">

                        <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-3xl shadow-xl">
                            🏥
                        </div>

                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight">
                                UNITED MEDICAL COLLEGE
                            </h1>

                            <p className="text-blue-200 text-sm tracking-[0.22em] mt-2">
                                INFORMATION TECHNOLOGY DEPARTMENT
                            </p>
                        </div>

                    </div>

                    {/* Main Heading */}
                    <div className="max-w-xl">

                        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-orange-500/15 border border-orange-300/30 text-orange-200 text-xs font-bold tracking-wider mb-7">
                            <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                            IT ASSET MANAGEMENT SYSTEM
                        </div>

                        <h2 className="text-5xl xl:text-6xl font-extrabold leading-[1.15] tracking-tight mb-7">
                            IT Inventory

                            <span className="block text-orange-400">
                                Management
                            </span>

                            <span className="block text-white">
                                Portal
                            </span>
                        </h2>

                        <p className="text-lg text-blue-100/90 leading-relaxed max-w-lg">
                            Manage computers, laptops, printers, networking
                            devices and other IT equipment efficiently.
                            Track inventory, monitor asset allocation
                            and manage all IT resources from one centralized platform.
                        </p>

                    </div>

                    {/* Features */}
                    <div className="grid grid-cols-2 gap-4 mt-12 max-w-xl">

                        <div className="group flex items-center gap-4 p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/15 hover:border-orange-300/40 transition duration-300">
                            <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-500/25 flex items-center justify-center text-2xl">
                                💻
                            </div>
                            <div>
                                <h3 className="font-bold text-white">IT Assets</h3>
                                <p className="text-xs text-blue-200 mt-1">
                                    Device Management
                                </p>
                            </div>
                        </div>

                        <div className="group flex items-center gap-4 p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/15 hover:border-orange-300/40 transition duration-300">
                            <div className="w-12 h-12 shrink-0 rounded-xl bg-orange-500/20 flex items-center justify-center text-2xl">
                                📦
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Stock Tracking</h3>
                                <p className="text-xs text-blue-200 mt-1">
                                    Inventory Control
                                </p>
                            </div>
                        </div>

                        <div className="group flex items-center gap-4 p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/15 hover:border-orange-300/40 transition duration-300">
                            <div className="w-12 h-12 shrink-0 rounded-xl bg-orange-500/20 flex items-center justify-center text-2xl">
                                🖨️
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Equipment</h3>
                                <p className="text-xs text-blue-200 mt-1">
                                    Allocation Tracking
                                </p>
                            </div>
                        </div>

                        <div className="group flex items-center gap-4 p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/15 hover:border-orange-300/40 transition duration-300">
                            <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-500/25 flex items-center justify-center text-2xl">
                                📊
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Reports</h3>
                                <p className="text-xs text-blue-200 mt-1">
                                    Asset Overview
                                </p>
                            </div>
                        </div>

                    </div>

                    <p className="text-blue-200/60 text-xs mt-12 tracking-widest">
                        UNITED MEDICAL COLLEGE • IT DEPARTMENT
                    </p>

                </div>

                {/* Login Card */}
                <div className="w-full max-w-md mx-auto">

                    <div className="bg-white rounded-[28px] shadow-[0_25px_80px_rgba(0,0,0,0.3)] border border-white/70 overflow-hidden">

                        {/* Top Accent */}
                        <div className="h-2 bg-gradient-to-r from-blue-700 via-blue-500 to-orange-500"></div>

                        <div className="p-7 sm:p-10">

                            {/* Mobile Branding */}
                            <div className="lg:hidden text-center mb-8">

                                <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-3xl mb-3">
                                    🏥
                                </div>

                                <h1 className="text-xl font-extrabold text-blue-950">
                                    UNITED MEDICAL COLLEGE
                                </h1>

                                <p className="text-xs font-semibold tracking-widest text-slate-500 mt-2">
                                    IT DEPARTMENT
                                </p>

                            </div>

                            {/* Logo */}
                            <div className="text-center mb-9">

                                <div className="relative w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-blue-700 to-blue-500 flex items-center justify-center text-white text-4xl shadow-xl shadow-blue-200/80">
                                    💻

                                    <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-orange-500 border-4 border-white flex items-center justify-center text-white text-sm font-bold">
                                        ✓
                                    </div>
                                </div>

                                <h2 className="text-3xl font-extrabold text-slate-900 mt-7">
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
                                        className="block text-sm font-bold text-slate-700 mb-2"
                                    >
                                        Email Address
                                    </label>

                                    <div className="relative">

                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 text-lg">
                                            ✉
                                        </div>

                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Enter your email"
                                            required
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition duration-200"
                                        />

                                    </div>

                                </div>

                                {/* Password */}
                                <div>

                                    <label
                                        htmlFor="password"
                                        className="block text-sm font-bold text-slate-700 mb-2"
                                    >
                                        Password
                                    </label>

                                    <div className="relative">

                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 text-lg">
                                            🔒
                                        </div>

                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            id="password"
                                            name="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Enter your password"
                                            required
                                            className="w-full pl-12 pr-20 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition duration-200"
                                        />

                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-blue-600 hover:text-orange-500 transition"
                                        >
                                            {showPassword ? 'Hide' : 'Show'}
                                        </button>

                                    </div>

                                </div>

                                {/* Error Message */}
                                {error && (
                                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                                        <span className="font-bold text-base">!</span>
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Remember Me */}
                                <div className="flex items-center justify-between text-sm">

                                    <label className="flex items-center gap-2 text-slate-600 cursor-pointer">

                                        <input
                                            type="checkbox"
                                            name="remember"
                                            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                                        />

                                        Remember me

                                    </label>

                                    <button
                                        type="button"
                                        className="text-blue-600 font-semibold hover:text-orange-500 transition"
                                    >
                                        Forgot Password?
                                    </button>

                                </div>

                                {/* Sign In */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="group relative w-full py-4 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white font-bold shadow-lg shadow-blue-200 hover:shadow-xl transition duration-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden"
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        {loading ? (
                                            <>
                                                <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                                                Signing In...
                                            </>
                                        ) : (
                                            <>
                                                Sign In
                                                <span className="text-orange-300 group-hover:translate-x-1 transition-transform">
                                                    →
                                                </span>
                                            </>
                                        )}
                                    </span>
                                </button>

                            </form>

                            {/* Security Footer */}
                            <div className="mt-9 pt-6 border-t border-slate-100">

                                <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
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

                    <p className="text-center text-white/60 text-xs mt-6 tracking-wide">
                        UNITED MEDICAL COLLEGE • IT INVENTORY PORTAL
                    </p>

                </div>

            </div>
        </div>
    );
};

export default Login;
