
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate, useLocation } from 'react-router';
import AdminSidebar from '../../components/AdminSidebar.jsx';

const USERS_API_URL = 'http://localhost:3001/api/users';

// REUSABLE DONUT CHART
const DonutChart = ({ segments, total, centerLabel }) => {
    const circumference = 2 * Math.PI * 68;
    let offset = 0;

    return (
        <div className="relative w-44 h-44 shrink-0">
            <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                <circle
                    cx="80"
                    cy="80"
                    r="68"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="17"
                />

                {segments.map((segment, index) => {
                    const percentage = total > 0
                        ? (segment.value / total) * 100
                        : 0;

                    const dash = (percentage / 100) * circumference;
                    const currentOffset = offset;

                    offset += dash;

                    return (
                        <circle
                            key={index}
                            cx="80"
                            cy="80"
                            r="68"
                            fill="none"
                            stroke={segment.color}
                            strokeWidth="17"
                            strokeDasharray={`${dash} ${circumference - dash}`}
                            strokeDashoffset={-currentOffset}
                            strokeLinecap="round"
                            className="transition-all duration-700"
                        />
                    );
                })}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-slate-800">
                    {total}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                    {centerLabel}
                </span>
            </div>
        </div>
    );
};

// REUSABLE STAT CARD
const StatCard = ({ title, value, icon, color, description, accent }) => (
    <div className="group relative overflow-hidden bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <div className={`absolute top-0 left-0 w-full h-1 ${accent || 'bg-blue-500'}`} />

        <div className="flex justify-between items-start">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${color}`}>
                {icon}
            </div>

            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
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

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [activeMenu, setActiveMenu] = useState('Dashboard');

    // USER STATISTICS
    const [userStats, setUserStats] = useState({
        totalUsers: 0,
        totalAdmins: 0,
        normalUsers: 0
    });

    // DEMO ASSET STATISTICS - EXISTING DATA PRESERVED
    const [stats] = useState({
        totalAssets: 250,
        availableAssets: 120,
        assignedAssets: 100,
        maintenanceAssets: 30
    });

    // USER LIST
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState('');

    // DEMO ACTIVITIES
    const activities = [
        {
            title: 'New Computer Added',
            description: 'A new computer was added to IT inventory.',
            time: 'Today, 10:30 AM',
            icon: '💻',
            color: 'bg-blue-50 text-blue-600'
        },
        {
            title: 'Printer Assigned',
            description: 'A printer was assigned to a department.',
            time: 'Today, 09:15 AM',
            icon: '🖨️',
            color: 'bg-emerald-50 text-emerald-600'
        },
        {
            title: 'Laptop Under Maintenance',
            description: 'A laptop was sent for maintenance.',
            time: 'Yesterday',
            icon: '🔧',
            color: 'bg-orange-50 text-orange-600'
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

    // DASHBOARD MENU URL SYNC
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const requestedMenu = params.get('menu');

        const isValidMenu = menuItems.some(
            (item) => item.name === requestedMenu
        );

        setActiveMenu(isValidMenu ? requestedMenu : 'Dashboard');
    }, [location.search]);

    // GET AUTH TOKEN
    const getToken = () => {
        const token = localStorage.getItem('pos-token');

        if (!token) {
            throw new Error('Please login again.');
        }

        return token;
    };

    // LOAD USER STATISTICS
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

    // LOAD ALL USERS
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

    // INITIAL DATA LOAD
    useEffect(() => {
        fetchUserStats();
        fetchAllUsers();
    }, []);

    // REFRESH DASHBOARD
    const handleRefreshDashboard = () => {
        fetchUserStats();
        fetchAllUsers();
    };

    // USER STATUS STATISTICS
    const activeUsers = users.filter(
        (item) => item.isActive !== false
    ).length;

    const inactiveUsers = users.filter(
        (item) => item.isActive === false
    ).length;

    // ASSET CHART DATA
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

    // USER CHART DATA
    const userSegments = [
        {
            label: 'Administrators',
            value: userStats.totalAdmins,
            color: '#8b5cf6'
        },
        {
            label: 'Normal Users',
            value: userStats.normalUsers,
            color: '#3b82f6'
        }
    ];

    const assetSegments = assetItems.map(item => ({
        label: item.name,
        value: item.value,
        color: item.hex
    }));

    // ASSET AVAILABILITY
    const unavailableAssets = Math.max(
        stats.totalAssets - stats.availableAssets,
        0
    );

    const availabilitySegments = [
        {
            label: 'Available',
            value: stats.availableAssets,
            color: '#10b981'
        },
        {
            label: 'Other Assets',
            value: unavailableAssets,
            color: '#f97316'
        }
    ];

    // USER ACCOUNT STATUS
    const accountSegments = [
        {
            label: 'Active Users',
            value: activeUsers,
            color: '#10b981'
        },
        {
            label: 'Inactive Users',
            value: inactiveUsers,
            color: '#f97316'
        }
    ];

    // DASHBOARD NAVIGATION
    const handleNavigation = (menuName) => {
        if (menuName === 'User Management') {
            navigate('/admin/users');
            return;
        }

        if (menuName === 'Stock Inventory') {
            navigate('/admin/stock');
            return;
        }

        if (menuName === 'Asset Management') {
            navigate('/admin/assets');
            return;
        }

        if (menuName === 'Departments') {
            navigate('/admin/departments');
            return;
        }

        setActiveMenu(menuName);

        navigate(
            `${location.pathname}?menu=${encodeURIComponent(menuName)}`,
            { replace: true }
        );
    };

    return (
        <div className="min-h-screen bg-slate-100 flex">

            {/* REUSABLE ADMIN SIDEBAR */}
            <AdminSidebar />

            {/* MAIN CONTENT */}
            <main className="flex-1 lg:ml-64 min-w-0">

                {/* TOPBAR */}
                <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-20">

                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-slate-400 font-semibold tracking-wide">
                            UNITED MEDICAL COLLEGE / ADMIN
                        </p>

                        <h2 className="text-lg sm:text-xl font-bold text-slate-800 mt-1 truncate">
                            {activeMenu}
                        </h2>
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

                        <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 border border-orange-200 flex items-center justify-center font-bold uppercase">
                            {user?.name?.charAt(0) || 'A'}
                        </div>
                    </div>
                </header>

                {/* PAGE CONTENT */}
                <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">

                    {activeMenu === 'Dashboard' && (
                        <>

                            {/* WELCOME SECTION */}
                            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                                        <p className="text-sm text-orange-600 font-bold tracking-wide">
                                            ADMIN OVERVIEW
                                        </p>
                                    </div>

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
                                    className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 text-sm font-semibold shadow-sm transition disabled:opacity-50"
                                >
                                    ↻ Refresh Dashboard
                                </button>
                            </div>

                            {/* ASSET STATISTICS */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

                                <StatCard
                                    title="Total Assets"
                                    value={stats.totalAssets}
                                    icon="💻"
                                    color="bg-blue-50 text-blue-600"
                                    accent="bg-blue-500"
                                    description="Registered assets"
                                />

                                <StatCard
                                    title="Available Assets"
                                    value={stats.availableAssets}
                                    icon="✓"
                                    color="bg-emerald-50 text-emerald-600"
                                    accent="bg-emerald-500"
                                    description="Ready to use"
                                />

                                <StatCard
                                    title="Assigned Assets"
                                    value={stats.assignedAssets}
                                    icon="♙"
                                    color="bg-violet-50 text-violet-600"
                                    accent="bg-violet-500"
                                    description="Currently assigned"
                                />

                                <StatCard
                                    title="Maintenance"
                                    value={stats.maintenanceAssets}
                                    icon="⚙"
                                    color="bg-orange-50 text-orange-600"
                                    accent="bg-orange-500"
                                    description="Under repair"
                                />
                            </div>

                            {/* USER STATISTICS */}
                            <div className="mt-9">

                                <div className="mb-5">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-6 rounded-full bg-orange-500" />

                                        <h2 className="text-lg font-bold text-slate-800">
                                            User Overview
                                        </h2>
                                    </div>

                                    <p className="text-xs text-slate-400 mt-2 ml-4">
                                        Live statistics from registered accounts
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

                                    <StatCard
                                        title="Total Users"
                                        value={userStats.totalUsers}
                                        icon="♙"
                                        color="bg-blue-50 text-blue-600"
                                        accent="bg-blue-500"
                                        description="Registered accounts"
                                    />

                                    <StatCard
                                        title="Administrators"
                                        value={userStats.totalAdmins}
                                        icon="🛡️"
                                        color="bg-violet-50 text-violet-600"
                                        accent="bg-violet-500"
                                        description="Admin accounts"
                                    />

                                    <StatCard
                                        title="Active Users"
                                        value={activeUsers}
                                        icon="✓"
                                        color="bg-emerald-50 text-emerald-600"
                                        accent="bg-emerald-500"
                                        description="Currently active"
                                    />

                                    <StatCard
                                        title="Inactive Users"
                                        value={inactiveUsers}
                                        icon="⊘"
                                        color="bg-orange-50 text-orange-600"
                                        accent="bg-orange-500"
                                        description="Inactive accounts"
                                    />
                                </div>
                            </div>

                            {/* CIRCULAR ANALYTICS */}
                            <div className="mt-9">

                                <div className="mb-5">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-6 rounded-full bg-orange-500" />

                                        <h2 className="text-lg font-bold text-slate-800">
                                            Analytics & Distribution
                                        </h2>
                                    </div>

                                    <p className="text-xs text-slate-400 mt-2 ml-4">
                                        Visual overview of assets and user accounts
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

                                    {/* ASSET DISTRIBUTION */}
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-lg transition duration-300">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="font-bold text-slate-800">
                                                    Asset Distribution
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    By asset status
                                                </p>
                                            </div>

                                            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                ◉
                                            </div>
                                        </div>

                                        <div className="flex justify-center py-5">
                                            <DonutChart
                                                segments={assetSegments}
                                                total={stats.totalAssets}
                                                centerLabel="Total Assets"
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            {assetItems.map(item => (
                                                <div key={item.name} className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                                                        <span className="text-xs text-slate-500">
                                                            {item.name}
                                                        </span>
                                                    </div>

                                                    <span className="text-xs font-bold text-slate-700">
                                                        {item.value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* USER DISTRIBUTION */}
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-lg transition duration-300">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="font-bold text-slate-800">
                                                    User Distribution
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Accounts by role
                                                </p>
                                            </div>

                                            <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                                                ♙
                                            </div>
                                        </div>

                                        <div className="flex justify-center py-5">
                                            <DonutChart
                                                segments={userSegments}
                                                total={userStats.totalUsers}
                                                centerLabel="Total Users"
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            {userSegments.map(item => (
                                                <div key={item.label} className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="w-2.5 h-2.5 rounded-full"
                                                            style={{ backgroundColor: item.color }}
                                                        />
                                                        <span className="text-xs text-slate-500">
                                                            {item.label}
                                                        </span>
                                                    </div>

                                                    <span className="text-xs font-bold text-slate-700">
                                                        {item.value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ACCOUNT STATUS */}
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-lg transition duration-300">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="font-bold text-slate-800">
                                                    Account Status
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Active vs inactive
                                                </p>
                                            </div>

                                            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                ✓
                                            </div>
                                        </div>

                                        <div className="flex justify-center py-5">
                                            <DonutChart
                                                segments={accountSegments}
                                                total={users.length}
                                                centerLabel="Accounts"
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex justify-between">
                                                <span className="text-xs text-slate-500">
                                                    <span className="text-emerald-500">●</span> Active
                                                </span>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {activeUsers}
                                                </span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span className="text-xs text-slate-500">
                                                    <span className="text-orange-500">●</span> Inactive
                                                </span>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {inactiveUsers}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ASSET AVAILABILITY */}
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-lg transition duration-300">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="font-bold text-slate-800">
                                                    Asset Availability
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Ready to use
                                                </p>
                                            </div>

                                            <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                                                ◉
                                            </div>
                                        </div>

                                        <div className="flex justify-center py-5">
                                            <DonutChart
                                                segments={availabilitySegments}
                                                total={stats.totalAssets}
                                                centerLabel="Total Assets"
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex justify-between">
                                                <span className="text-xs text-slate-500">
                                                    <span className="text-emerald-500">●</span> Available
                                                </span>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {stats.availableAssets}
                                                </span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span className="text-xs text-slate-500">
                                                    <span className="text-orange-500">●</span> Other Assets
                                                </span>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {unavailableAssets}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ASSET OVERVIEW & QUICK SUMMARY */}
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-9">

                                {/* ASSET OVERVIEW */}
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

                                        <span className="text-xs bg-orange-50 text-orange-600 px-3 py-2 rounded-lg font-bold w-fit">
                                            Total: {stats.totalAssets}
                                        </span>
                                    </div>

                                    {assetItems.map(item => {
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
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <p className="text-[11px] text-slate-400 mt-6">
                                        Note: Asset figures are currently demo data.
                                    </p>
                                </div>

                                {/* QUICK SUMMARY */}
                                <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 p-6 rounded-2xl text-white shadow-lg flex flex-col">

                                    <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full border-[25px] border-orange-400/20" />
                                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full border-[12px] border-orange-400/20" />

                                    <div className="relative z-10">
                                        <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center text-3xl mb-5 shadow-lg">
                                            🏥
                                        </div>

                                        <h2 className="text-xl font-bold">
                                            UMC IT Management
                                        </h2>

                                        <p className="text-sm text-blue-100 mt-3 leading-6">
                                            Manage your institution's IT assets, users and inventory from one central dashboard.
                                        </p>

                                        <div className="mt-8 pt-5 border-t border-white/20">
                                            <p className="text-xs text-blue-200">
                                                Total Registered Users
                                            </p>

                                            <h3 className="text-4xl font-bold mt-2">
                                                {userStats.totalUsers}
                                            </h3>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleNavigation('User Management')}
                                        className="relative z-10 mt-auto pt-7 text-left text-sm font-bold text-orange-300 hover:text-white transition"
                                    >
                                        Manage Users →
                                    </button>
                                </div>
                            </div>

                            {/* RECENT USERS & ACTIVITIES */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-9">

                                {/* RECENT USERS */}
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
                                            className="text-xs font-bold text-orange-600 hover:text-orange-700"
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
                                            {users.slice(0, 5).map(recentUser => (
                                                <div
                                                    key={recentUser._id}
                                                    className="flex items-center gap-3"
                                                >
                                                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold uppercase">
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
                                                            ? 'bg-orange-50 text-orange-600'
                                                            : 'bg-emerald-50 text-emerald-600'
                                                    }`}>
                                                        {recentUser.isActive === false ? 'Inactive' : 'Active'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* RECENT ACTIVITIES */}
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

                    {/* OTHER MENU PAGES */}
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

                {/* FOOTER */}
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
