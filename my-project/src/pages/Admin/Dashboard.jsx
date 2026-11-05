
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate, useLocation } from 'react-router';
import AdminSidebar from '../../components/AdminSidebar.jsx';

const USERS_API_URL = 'http://localhost:3001/api/users';

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [activeMenu, setActiveMenu] = useState('Dashboard');

    // User Statistics
    const [userStats, setUserStats] = useState({
        totalUsers: 0,
        totalAdmins: 0,
        normalUsers: 0
    });

    // Demo Asset Statistics
    const [stats] = useState({
        totalAssets: 250,
        availableAssets: 120,
        assignedAssets: 100,
        maintenanceAssets: 30
    });

    // User List for Recent Users
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState('');

    // Demo Activities
    const activities = [
        {
            title: 'New Computer Added',
            description: 'A new computer was added to IT inventory.',
            time: 'Today, 10:30 AM',
            icon: '💻',
            color: 'bg-blue-50'
        },
        {
            title: 'Printer Assigned',
            description: 'A printer was assigned to a department.',
            time: 'Today, 09:15 AM',
            icon: '🖨️',
            color: 'bg-emerald-50'
        },
        {
            title: 'Laptop Under Maintenance',
            description: 'A laptop was sent for maintenance.',
            time: 'Yesterday',
            icon: '🔧',
            color: 'bg-orange-50'
        }
    ];

    const menuItems = [
        { name: 'Dashboard', icon: '▦' },
        { name: 'User Management', icon: '♙' },
        { name: 'Stock Inventory', icon: '📦' },
        { name: 'Asset Management', icon: '▣' },
        { name: 'Departments', icon: '▤' },
        { name: 'Reports', icon: '▥' },
        { name: 'Settings', icon: '⚙' }
    ];

    // DASHBOARD MENU URL SYNC - Search: DASHBOARD MENU URL SYNC
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const requestedMenu = params.get('menu');

        const isValidMenu = menuItems.some(
            (item) => item.name === requestedMenu
        );

        setActiveMenu(isValidMenu ? requestedMenu : 'Dashboard');
    }, [location.search]);

    // Get Authentication Token
    const getToken = () => {
        const token = localStorage.getItem('pos-token');

        if (!token) {
            throw new Error('Please login again.');
        }

        return token;
    };

    // Load User Statistics
    const fetchUserStats = async () => {
        try {
            const token = getToken();

            const response = await fetch(
                `${USERS_API_URL}/stats`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Failed to load user statistics'
                );
            }

            setUserStats(data);

        } catch (err) {
            console.error('User statistics error:', err.message);
        }
    };

    // Load All Users for Recent Users
    const fetchAllUsers = async () => {
        setUsersLoading(true);
        setUsersError('');

        try {
            const token = getToken();

            const response = await fetch(
                USERS_API_URL,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Failed to load users'
                );
            }

            setUsers(data.users || []);

        } catch (err) {
            setUsersError(err.message);
        } finally {
            setUsersLoading(false);
        }
    };

    // Initial Dashboard Data Load
    useEffect(() => {
        fetchUserStats();
        fetchAllUsers();
    }, []);

    // Refresh Dashboard
    const handleRefreshDashboard = () => {
        fetchUserStats();
        fetchAllUsers();
    };

    // User Status Statistics
    const activeUsers = users.filter(
        (item) => item.isActive !== false
    ).length;

    const inactiveUsers = users.filter(
        (item) => item.isActive === false
    ).length;

    // Asset Chart Data
    const assetItems = [
        {
            name: 'Available Assets',
            value: stats.availableAssets,
            color: 'bg-emerald-500',
            hex: '#10b981'
        },
        {
            name: 'Assigned Assets',
            value: stats.assignedAssets,
            color: 'bg-blue-500',
            hex: '#3b82f6'
        },
        {
            name: 'Under Maintenance',
            value: stats.maintenanceAssets,
            color: 'bg-orange-500',
            hex: '#f97316'
        }
    ];

    // Asset Pie Chart Gradient
    const assetAvailablePercent =
        (stats.availableAssets / Math.max(stats.totalAssets, 1)) * 100;

    const assetAssignedPercent =
        ((stats.availableAssets + stats.assignedAssets) /
            Math.max(stats.totalAssets, 1)) * 100;

    const assetPieGradient = `conic-gradient(
        #10b981 0% ${assetAvailablePercent}%,
        #3b82f6 ${assetAvailablePercent}% ${assetAssignedPercent}%,
        #f97316 ${assetAssignedPercent}% 100%
    )`;

    // User Pie Chart Gradient
    const adminPercent =
        (userStats.totalAdmins / Math.max(userStats.totalUsers, 1)) * 100;

    const userPieGradient = `conic-gradient(
        #8b5cf6 0% ${adminPercent}%,
        #3b82f6 ${adminPercent}% 100%
    )`;

    // Dashboard Cards
    const dashboardCards = [
        {
            title: 'Total Assets',
            value: stats.totalAssets,
            icon: '💻',
            color: 'bg-blue-50 text-blue-600',
            description: 'Registered assets'
        },
        {
            title: 'Available Assets',
            value: stats.availableAssets,
            icon: '✓',
            color: 'bg-emerald-50 text-emerald-600',
            description: 'Ready to use'
        },
        {
            title: 'Assigned Assets',
            value: stats.assignedAssets,
            icon: '♙',
            color: 'bg-violet-50 text-violet-600',
            description: 'Currently assigned'
        },
        {
            title: 'Maintenance',
            value: stats.maintenanceAssets,
            icon: '⚙',
            color: 'bg-orange-50 text-orange-600',
            description: 'Under repair'
        }
    ];

    // DASHBOARD NAVIGATION - Search: DASHBOARD NAVIGATION
    const handleNavigation = (menuName) => {

        // User Management has its own separate page.
        if (menuName === 'User Management') {
            navigate('/admin/users');
            return;
        }

        // Stock Inventory has its own separate page.
        if (menuName === 'Stock Inventory') {
            navigate('/admin/stock');
            return;
        }

        // Asset Management has its own separate page.
        if (menuName === 'Asset Management') {
            navigate('/admin/assets');
            return;
        }

        // Departments has its own separate page.
        if (menuName === 'Departments') {
            navigate('/admin/departments');
            return;
        }

        // Keep other Dashboard modules on this page.
        setActiveMenu(menuName);

        navigate(
            `${location.pathname}?menu=${encodeURIComponent(menuName)}`,
            { replace: true }
        );
    };

    // Reusable Stat Card
    const StatCard = ({ title, value, icon, color, description }) => (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition duration-300">
            <div className="flex justify-between items-start">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${color}`}>
                    {icon}
                </div>

                <span className="text-xs font-medium text-slate-400">
                    Overview
                </span>
            </div>

            <h2 className="text-3xl font-bold text-slate-800 mt-5">
                {value}
            </h2>

            <p className="text-sm font-semibold text-slate-600 mt-1">
                {title}
            </p>

            <p className="text-xs text-slate-400 mt-2">
                {description}
            </p>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100 flex">

            {/* REUSABLE ADMIN SIDEBAR */}
            <AdminSidebar />

            {/* Main Content */}
            <main className="flex-1 lg:ml-64 min-w-0">

                {/* Topbar */}
                <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-20">

                    <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs text-slate-400 font-semibold tracking-wide">
                                UNITED MEDICAL COLLEGE / ADMIN
                            </p>

                            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mt-1 truncate">
                                {activeMenu}
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:block text-right">
                            <p className="text-sm font-semibold text-slate-800">
                                {user?.name || 'Administrator'}
                            </p>

                            <p className="text-xs text-slate-400">
                                System Admin
                            </p>
                        </div>

                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold uppercase">
                            {user?.name?.charAt(0) || 'A'}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">

                    {/* Dashboard Overview */}
                    {activeMenu === 'Dashboard' && (
                        <>
                            {/* Welcome Section */}
                            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <p className="text-sm text-blue-600 font-semibold mb-2">
                                        ADMIN OVERVIEW
                                    </p>

                                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                                        Welcome back, {user?.name || 'Administrator'}!
                                    </h1>

                                    <p className="text-slate-500 text-sm mt-2">
                                        Here's what's happening with your IT assets today.
                                    </p>
                                </div>

                                <button
                                    onClick={handleRefreshDashboard}
                                    disabled={usersLoading}
                                    className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold shadow-sm transition disabled:opacity-50"
                                >
                                    ↻ Refresh Dashboard
                                </button>
                            </div>

                            {/* Asset Statistics */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                                {dashboardCards.map((card) => (
                                    <StatCard
                                        key={card.title}
                                        {...card}
                                    />
                                ))}
                            </div>

                            {/* User Statistics */}
                            <div className="mt-8">
                                <div className="mb-4">
                                    <h2 className="text-lg font-bold text-slate-800">
                                        User Overview
                                    </h2>

                                    <p className="text-xs text-slate-400 mt-1">
                                        Live statistics from registered accounts
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                                    <StatCard
                                        title="Total Users"
                                        value={userStats.totalUsers}
                                        icon="♙"
                                        color="bg-blue-50 text-blue-600"
                                        description="Registered accounts"
                                    />

                                    <StatCard
                                        title="Administrators"
                                        value={userStats.totalAdmins}
                                        icon="🛡️"
                                        color="bg-violet-50 text-violet-600"
                                        description="Admin accounts"
                                    />

                                    <StatCard
                                        title="Active Users"
                                        value={activeUsers}
                                        icon="✓"
                                        color="bg-emerald-50 text-emerald-600"
                                        description="Currently active"
                                    />

                                    <StatCard
                                        title="Inactive Users"
                                        value={inactiveUsers}
                                        icon="⊘"
                                        color="bg-red-50 text-red-600"
                                        description="Inactive accounts"
                                    />
                                </div>
                            </div>

                            {/* Modern Analytics Charts */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-8">

                                {/* Asset Distribution */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800">
                                                Asset Distribution
                                            </h2>

                                            <p className="text-xs text-slate-400 mt-1">
                                                Inventory overview by asset status
                                            </p>
                                        </div>

                                        <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold">
                                            Analytics
                                        </span>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center gap-8 justify-center">

                                        <div
                                            className="w-48 h-48 rounded-full relative shrink-0 shadow-inner"
                                            style={{
                                                background: assetPieGradient
                                            }}
                                        >
                                            <div className="absolute inset-7 bg-white rounded-full flex flex-col items-center justify-center">
                                                <span className="text-3xl font-bold text-slate-800">
                                                    {stats.totalAssets}
                                                </span>

                                                <span className="text-xs text-slate-400">
                                                    Total Assets
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-5 w-full">
                                            {assetItems.map((item) => {
                                                const percentage = stats.totalAssets
                                                    ? ((item.value / stats.totalAssets) * 100).toFixed(1)
                                                    : 0;

                                                return (
                                                    <div key={item.name}>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className="w-3 h-3 rounded-full"
                                                                    style={{
                                                                        backgroundColor: item.hex
                                                                    }}
                                                                />

                                                                <span className="text-sm text-slate-600">
                                                                    {item.name}
                                                                </span>
                                                            </div>

                                                            <span className="text-sm font-bold text-slate-800">
                                                                {percentage}%
                                                            </span>
                                                        </div>

                                                        <p className="text-xs text-slate-400 ml-5">
                                                            {item.value} Assets
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* User Distribution */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800">
                                                User Distribution
                                            </h2>

                                            <p className="text-xs text-slate-400 mt-1">
                                                Accounts by user role
                                            </p>
                                        </div>

                                        <span className="px-3 py-1.5 rounded-lg bg-violet-50 text-violet-600 text-xs font-semibold">
                                            Live Data
                                        </span>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center gap-8 justify-center">

                                        <div
                                            className="w-48 h-48 rounded-full relative shrink-0 shadow-inner"
                                            style={{
                                                background: userPieGradient
                                            }}
                                        >
                                            <div className="absolute inset-7 bg-white rounded-full flex flex-col items-center justify-center">
                                                <span className="text-3xl font-bold text-slate-800">
                                                    {userStats.totalUsers}
                                                </span>

                                                <span className="text-xs text-slate-400">
                                                    Total Users
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-6 w-full">

                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-3 h-3 rounded-full bg-violet-500" />

                                                        <span className="text-sm text-slate-600">
                                                            Administrators
                                                        </span>
                                                    </div>

                                                    <span className="font-bold text-slate-800 text-sm">
                                                        {userStats.totalAdmins}
                                                    </span>
                                                </div>

                                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-violet-500 rounded-full transition-all duration-700"
                                                        style={{
                                                            width: `${adminPercent}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-3 h-3 rounded-full bg-blue-500" />

                                                        <span className="text-sm text-slate-600">
                                                            Normal Users / Employees / Customers
                                                        </span>
                                                    </div>

                                                    <span className="font-bold text-slate-800 text-sm">
                                                        {userStats.normalUsers}
                                                    </span>
                                                </div>

                                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 rounded-full transition-all duration-700"
                                                        style={{
                                                            width: `${(userStats.normalUsers / Math.max(userStats.totalUsers, 1)) * 100}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Dashboard Grid */}
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">

                                {/* Asset Overview */}
                                <div className="xl:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-7">
                                        <div>
                                            <h2 className="font-bold text-slate-800 text-lg">
                                                Asset Overview
                                            </h2>

                                            <p className="text-xs text-slate-400 mt-1">
                                                Current inventory distribution
                                            </p>
                                        </div>

                                        <span className="text-xs bg-blue-50 text-blue-600 px-3 py-2 rounded-lg font-semibold w-fit">
                                            Total: {stats.totalAssets}
                                        </span>
                                    </div>

                                    {assetItems.map((item) => {
                                        const percentage = stats.totalAssets
                                            ? (item.value / stats.totalAssets) * 100
                                            : 0;

                                        return (
                                            <div key={item.name} className="mb-7 last:mb-0">
                                                <div className="flex justify-between mb-2">
                                                    <span className="text-sm text-slate-600 font-medium">
                                                        {item.name}
                                                    </span>

                                                    <span className="text-sm font-bold text-slate-700">
                                                        {item.value} ({percentage.toFixed(1)}%)
                                                    </span>
                                                </div>

                                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`${item.color} h-full rounded-full transition-all duration-700`}
                                                        style={{
                                                            width: `${percentage}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <p className="text-[11px] text-slate-400 mt-6">
                                        Note: Asset figures are currently demo data.
                                    </p>
                                </div>

                                {/* Quick Summary */}
                                <div className="bg-gradient-to-br from-blue-700 to-blue-950 p-6 rounded-2xl text-white shadow-lg flex flex-col">
                                    <div className="text-4xl mb-5">
                                        🏥
                                    </div>

                                    <h2 className="text-xl font-bold">
                                        UMC IT Management
                                    </h2>

                                    <p className="text-sm text-blue-100 mt-3 leading-6">
                                        Manage your institution's IT assets, users and inventory from one central dashboard.
                                    </p>

                                    <div className="mt-8 pt-5 border-t border-blue-400/30">
                                        <p className="text-xs text-blue-200">
                                            Total Registered Users
                                        </p>

                                        <h3 className="text-4xl font-bold mt-2">
                                            {userStats.totalUsers}
                                        </h3>
                                    </div>

                                    <button
                                        onClick={() => handleNavigation('User Management')}
                                        className="mt-auto pt-6 text-left text-sm font-semibold text-white hover:text-blue-200 transition"
                                    >
                                        Manage Users →
                                    </button>
                                </div>
                            </div>

                            {/* Recent Users and Activities */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-8">

                                {/* Recent Users */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800">
                                                Recent Users
                                            </h2>

                                            <p className="text-xs text-slate-400 mt-1">
                                                Latest registered accounts
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => handleNavigation('User Management')}
                                            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                                        >
                                            View All →
                                        </button>
                                    </div>

                                    {usersLoading ? (
                                        <p className="text-sm text-slate-400 py-5">
                                            Loading users...
                                        </p>
                                    ) : usersError ? (
                                        <div className="py-5">
                                            <p className="text-sm text-red-500">
                                                {usersError}
                                            </p>

                                            <button
                                                onClick={fetchAllUsers}
                                                className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                                            >
                                                Try Again
                                            </button>
                                        </div>
                                    ) : users.length === 0 ? (
                                        <p className="text-sm text-slate-400 py-5">
                                            No users available.
                                        </p>
                                    ) : (
                                        <div className="space-y-4">
                                            {users.slice(0, 5).map((recentUser) => (
                                                <div
                                                    key={recentUser._id}
                                                    className="flex items-center gap-3"
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold uppercase">
                                                        {recentUser.name?.charAt(0) || 'U'}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-slate-800 truncate">
                                                            {recentUser.name}
                                                        </p>

                                                        <p className="text-xs text-slate-400 truncate">
                                                            {recentUser.email}
                                                        </p>
                                                    </div>

                                                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${
                                                        recentUser.isActive === false
                                                            ? 'bg-red-50 text-red-600'
                                                            : 'bg-emerald-50 text-emerald-600'
                                                    }`}>
                                                        {recentUser.isActive === false ? 'Inactive' : 'Active'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Recent Activities */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
                                    <h2 className="text-lg font-bold text-slate-800">
                                        Recent Activities
                                    </h2>

                                    <p className="text-xs text-slate-400 mt-1 mb-6">
                                        Sample activity timeline
                                    </p>

                                    <div className="space-y-5">
                                        {activities.map((activity, index) => (
                                            <div key={index} className="flex gap-4 items-start">
                                                <div className={`w-11 h-11 rounded-xl ${activity.color} flex items-center justify-center text-xl shrink-0`}>
                                                    {activity.icon}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-sm font-semibold text-slate-800">
                                                        {activity.title}
                                                    </h3>

                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {activity.description}
                                                    </p>

                                                    <p className="text-xs text-slate-400 mt-2">
                                                        {activity.time}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <p className="text-[11px] text-slate-400 mt-5">
                                        Activity history will be connected to backend later.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Other Menu Pages */}
                    {activeMenu !== 'Dashboard' && (
                        <div className="bg-white rounded-2xl p-8 sm:p-12 border border-slate-200 shadow-sm text-center">
                            <div className="text-5xl mb-5">
                                🚧
                            </div>

                            <h2 className="text-2xl font-bold text-slate-800">
                                {activeMenu}
                            </h2>

                            <p className="text-sm text-slate-500 mt-3 max-w-md mx-auto">
                                This module is not connected yet. It will be developed in the next phase of the IT Asset Management System.
                            </p>

                            <button
                                onClick={() => handleNavigation('Dashboard')}
                                className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
                            >
                                ← Back to Dashboard
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <footer className="px-5 sm:px-8 py-5 border-t border-slate-200 bg-white text-center">
                    <p className="text-xs text-slate-400">
                        © 2026 United Medical College | IT Asset Management System
                    </p>
                </footer>
            </main>
        </div>
    );
};

export default Dashboard;
