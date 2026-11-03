
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate, useLocation } from 'react-router';
import AdminSidebar from '../../components/AdminSidebar.jsx';

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const loggedInUserId = user?._id;

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

    // Create User Form
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [role, setRole] = useState('user');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // User List
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState('');

    // Edit User
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({
        name: '',
        email: '',
        whatsappNumber: '',
        role: 'user'
    });
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');

    // Delete User
    const [deletingUser, setDeletingUser] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    // Search, Filter and Pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('newest');
    const [currentPage, setCurrentPage] = useState(1);
    const usersPerPage = 8;

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
    // Restore the selected menu when the Dashboard URL is opened or refreshed.
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

    // WhatsApp Link Helper
    const getWhatsAppLink = (number) => {
        const digits = String(number || '').replace(/\D/g, '');

        if (!digits) return '';

        // Convert Bangladesh local number to international format
        const internationalNumber = digits.startsWith('0')
            ? `88${digits}`
            : digits;

        return `https://wa.me/${internationalNumber}`;
    };

    // Load User Statistics
    const fetchUserStats = async () => {
        try {
            const token = getToken();

            const response = await fetch(
                'http://localhost:3000/api/users/stats',
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

    // Load All Users
    const fetchAllUsers = async () => {
        setUsersLoading(true);
        setUsersError('');

        try {
            const token = getToken();

            const response = await fetch(
                'http://localhost:3000/api/users',
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

    // Initial Data Load
    useEffect(() => {
        fetchUserStats();
        fetchAllUsers();
    }, []);

    // Create New User
    const handleCreateUser = async (e) => {
        e.preventDefault();

        setMessage('');
        setError('');
        setLoading(true);

        try {
            const token = getToken();

            const response = await fetch(
                'http://localhost:3000/api/users',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name,
                        email,
                        password,
                        whatsappNumber,
                        role
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Failed to create user'
                );
            }

            setMessage('User created successfully!');

            setName('');
            setEmail('');
            setPassword('');
            setWhatsappNumber('');
            setRole('user');

            await fetchUserStats();
            await fetchAllUsers();

            setCurrentPage(1);

            setTimeout(() => {
                setMessage('');
            }, 3000);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Open Edit User Modal
    const handleOpenEdit = (selectedUser) => {
        setEditingUser(selectedUser);

        setEditForm({
            name: selectedUser.name || '',
            email: selectedUser.email || '',
            whatsappNumber: selectedUser.whatsappNumber || '',
            role: selectedUser.role || 'user'
        });

        setEditError('');
    };

    // Update Edit Form
    const handleEditChange = (e) => {
        const { name, value } = e.target;

        setEditForm((previous) => ({
            ...previous,
            [name]: value
        }));
    };

    // Update User
    const handleUpdateUser = async (e) => {
        e.preventDefault();

        if (!editingUser) return;

        setEditError('');
        setEditLoading(true);

        try {
            const token = getToken();

            const response = await fetch(
                `http://localhost:3000/api/users/${editingUser._id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(editForm)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Failed to update user'
                );
            }

            setEditingUser(null);

            await fetchUserStats();
            await fetchAllUsers();

        } catch (err) {
            setEditError(err.message);
        } finally {
            setEditLoading(false);
        }
    };

    // Open Delete Confirmation
    const handleOpenDelete = (selectedUser) => {
        setDeletingUser(selectedUser);
        setDeleteError('');
    };

    // Delete User
    const handleDeleteUser = async () => {
        if (!deletingUser) return;

        setDeleteError('');
        setDeleteLoading(true);

        try {
            const token = getToken();

            const response = await fetch(
                `http://localhost:3000/api/users/${deletingUser._id}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Failed to delete user'
                );
            }

            setDeletingUser(null);
            setCurrentPage(1);

            await fetchUserStats();
            await fetchAllUsers();

        } catch (err) {
            setDeleteError(err.message);
        } finally {
            setDeleteLoading(false);
        }
    };

    // User Search and Filtering
    const filteredUsers = useMemo(() => {
        const search = searchTerm.toLowerCase().trim();

        let result = users.filter((item) => {
            const matchesSearch =
                item.name?.toLowerCase().includes(search) ||
                item.email?.toLowerCase().includes(search) ||
                item.whatsappNumber?.toLowerCase().includes(search);

            const matchesRole =
                roleFilter === 'all' || item.role === roleFilter;

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active'
                    ? item.isActive !== false
                    : item.isActive === false);

            return matchesSearch && matchesRole && matchesStatus;
        });

        result = [...result].sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();

            if (sortOrder === 'newest') return dateB - dateA;
            if (sortOrder === 'oldest') return dateA - dateB;

            if (sortOrder === 'name') {
                return (a.name || '').localeCompare(b.name || '');
            }

            return 0;
        });

        return result;
    }, [users, searchTerm, roleFilter, statusFilter, sortOrder]);

    // Pagination
    const totalPages = Math.max(
        1,
        Math.ceil(filteredUsers.length / usersPerPage)
    );

    const paginatedUsers = filteredUsers.slice(
        (currentPage - 1) * usersPerPage,
        currentPage * usersPerPage
    );

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, roleFilter, statusFilter, sortOrder]);

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

    // Export Users as CSV
    const handleExportUsers = () => {
        if (filteredUsers.length === 0) {
            alert('No users available to export.');
            return;
        }

        const headers = [
            'Name',
            'Email',
            'WhatsApp Number',
            'Role',
            'Status',
            'Created Date'
        ];

        const rows = filteredUsers.map((item) => [
            item.name || '',
            item.email || '',
            item.whatsappNumber || '',
            item.role || '',
            item.isActive === false ? 'Inactive' : 'Active',
            item.createdAt
                ? new Date(item.createdAt).toLocaleDateString()
                : ''
        ]);

        const csvContent = [
            headers,
            ...rows
        ].map((row) =>
            row.map((value) =>
                `"${String(value).replace(/"/g, '""')}"`
            ).join(',')
        ).join('\n');

        const blob = new Blob(
            ['\uFEFF' + csvContent],
            { type: 'text/csv;charset=utf-8;' }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = 'UMC-Users.csv';
        link.click();

        URL.revokeObjectURL(url);
    };

    // DASHBOARD NAVIGATION - Search: DASHBOARD NAVIGATION
    const handleNavigation = (menuName) => {

        // Stock Inventory has its own separate page.
        if (menuName === 'Stock Inventory') {
            navigate('/admin/stock');
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
                                    onClick={() => {
                                        fetchUserStats();
                                        fetchAllUsers();
                                    }}
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

                    {/* User Management */}
                    {activeMenu === 'User Management' && (
                        <>
                            {/* Page Heading */}
                            <div className="mb-7">
                                <p className="text-sm text-blue-600 font-semibold mb-2">
                                    USER ADMINISTRATION
                                </p>

                                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                                    User Management
                                </h1>

                                <p className="text-sm text-slate-500 mt-2">
                                    Create, search and manage system users.
                                </p>
                            </div>

                            {/* User Statistics */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-7">
                                <StatCard
                                    title="Total Users"
                                    value={userStats.totalUsers}
                                    icon="♙"
                                    color="bg-blue-50 text-blue-600"
                                    description="All registered users"
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
                                    description="Active accounts"
                                />

                                <StatCard
                                    title="Inactive Users"
                                    value={inactiveUsers}
                                    icon="⊘"
                                    color="bg-red-50 text-red-600"
                                    description="Inactive accounts"
                                />
                            </div>

                            {/* Add New User Form */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
                                <div className="mb-6">
                                    <h2 className="text-lg font-bold text-slate-800">
                                        + Add New User
                                    </h2>

                                    <p className="text-xs text-slate-400 mt-1">
                                        Only administrators can create accounts.
                                    </p>
                                </div>

                                <form onSubmit={handleCreateUser}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Full Name
                                            </label>

                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="Enter full name"
                                                required
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Email Address
                                            </label>

                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="Enter email address"
                                                required
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Password
                                            </label>

                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Create password"
                                                minLength={6}
                                                required
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                WhatsApp Number
                                            </label>

                                            <input
                                                type="tel"
                                                value={whatsappNumber}
                                                onChange={(e) => setWhatsappNumber(e.target.value)}
                                                placeholder="+8801XXXXXXXXX"
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                User Role
                                            </label>

                                            <select
                                                value={role}
                                                onChange={(e) => setRole(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                            >
                                                <option value="user">Normal User</option>
                                                <option value="admin">Administrator</option>
                                                <option value="employee">Employee</option>
                                                <option value="customer">Customer</option>
                                            </select>
                                        </div>
                                    </div>

                                    {message && (
                                        <div className="mt-5 p-4 rounded-xl bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
                                            ✓ {message}
                                        </div>
                                    )}

                                    {error && (
                                        <div className="mt-5 p-4 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
                                            {error}
                                        </div>
                                    )}

                                    <div className="mt-7 flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-7 py-3 rounded-xl font-semibold text-sm shadow-lg shadow-blue-600/20 transition disabled:opacity-50"
                                        >
                                            {loading ? 'Creating...' : '+ Create User'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* All Users */}
                            <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                                {/* User List Header */}
                                <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800">
                                            All Users
                                        </h2>

                                        <p className="text-xs text-slate-400 mt-1">
                                            Search, filter and view registered users
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={handleExportUsers}
                                            disabled={filteredUsers.length === 0}
                                            className="px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm font-semibold transition disabled:opacity-40"
                                        >
                                            ↓ Export CSV
                                        </button>

                                        <button
                                            onClick={() => {
                                                fetchUserStats();
                                                fetchAllUsers();
                                            }}
                                            disabled={usersLoading}
                                            className="px-4 py-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm font-semibold transition disabled:opacity-50"
                                        >
                                            {usersLoading ? 'Loading...' : '↻ Refresh'}
                                        </button>
                                    </div>
                                </div>

                                {/* Search and Filters */}
                                <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">

                                        {/* Search */}
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-2">
                                                Search Users
                                            </label>

                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                                    ⌕
                                                </span>

                                                <input
                                                    type="text"
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    placeholder="Name, email or WhatsApp..."
                                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition"
                                                />
                                            </div>
                                        </div>

                                        {/* Role Filter */}
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-2">
                                                Filter by Role
                                            </label>

                                            <select
                                                value={roleFilter}
                                                onChange={(e) => setRoleFilter(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none text-sm"
                                            >
                                                <option value="all">All Roles</option>
                                                <option value="admin">Administrator</option>
                                                <option value="user">Normal User</option>
                                                <option value="employee">Employee</option>
                                                <option value="customer">Customer</option>
                                            </select>
                                        </div>

                                        {/* Status Filter */}
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-2">
                                                Filter by Status
                                            </label>

                                            <select
                                                value={statusFilter}
                                                onChange={(e) => setStatusFilter(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none text-sm"
                                            >
                                                <option value="all">All Status</option>
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                            </select>
                                        </div>

                                        {/* Sorting */}
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-2">
                                                Sort Users
                                            </label>

                                            <select
                                                value={sortOrder}
                                                onChange={(e) => setSortOrder(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none text-sm"
                                            >
                                                <option value="newest">Newest First</option>
                                                <option value="oldest">Oldest First</option>
                                                <option value="name">Name A - Z</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Filter Summary */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
                                        <p className="text-xs text-slate-500">
                                            Found{' '}
                                            <span className="font-bold text-slate-800">
                                                {filteredUsers.length}
                                            </span>
                                            {' '}matching users out of{' '}
                                            <span className="font-bold text-slate-800">
                                                {users.length}
                                            </span>
                                        </p>

                                        <button
                                            onClick={() => {
                                                setSearchTerm('');
                                                setRoleFilter('all');
                                                setStatusFilter('all');
                                                setSortOrder('newest');
                                            }}
                                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 text-left"
                                        >
                                            ✕ Clear All Filters
                                        </button>
                                    </div>
                                </div>

                                {/* API Error */}
                                {usersError && (
                                    <div className="m-5 p-4 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
                                        <p className="font-semibold">
                                            Unable to load users
                                        </p>

                                        <p className="mt-1">
                                            {usersError}
                                        </p>

                                        <button
                                            onClick={fetchAllUsers}
                                            className="mt-3 font-semibold underline"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                )}

                                {/* Loading and User Table */}
                                {usersLoading ? (
                                    <div className="p-10">
                                        <div className="flex justify-center mb-4">
                                            <div className="w-9 h-9 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                        </div>

                                        <p className="text-center text-slate-500 text-sm">
                                            Loading users...
                                        </p>

                                        <div className="mt-6 space-y-3 max-w-xl mx-auto">
                                            {[1, 2, 3].map((item) => (
                                                <div
                                                    key={item}
                                                    className="h-12 rounded-lg bg-slate-100 animate-pulse"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : users.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <div className="text-4xl mb-3">
                                            👥
                                        </div>

                                        <h3 className="font-bold text-slate-700">
                                            No Users Found
                                        </h3>

                                        <p className="text-sm text-slate-400 mt-2">
                                            Create your first user to get started.
                                        </p>
                                    </div>
                                ) : filteredUsers.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <div className="text-4xl mb-3">
                                            🔎
                                        </div>

                                        <h3 className="font-bold text-slate-700">
                                            No Matching Users
                                        </h3>

                                        <p className="text-sm text-slate-400 mt-2">
                                            Try changing your search or filters.
                                        </p>

                                        <button
                                            onClick={() => {
                                                setSearchTerm('');
                                                setRoleFilter('all');
                                                setStatusFilter('all');
                                            }}
                                            className="mt-4 px-5 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-100"
                                        >
                                            Clear Filters
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Users Table */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left min-w-[1200px]">

                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                                                            #
                                                        </th>

                                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                                                            User
                                                        </th>

                                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                                                            Email
                                                        </th>

                                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                                                            WhatsApp Number
                                                        </th>

                                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                                                            Role
                                                        </th>

                                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                                                            Status
                                                        </th>

                                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                                                            Created Date
                                                        </th>

                                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                                                            Actions
                                                        </th>
                                                    </tr>
                                                </thead>

                                                <tbody className="divide-y divide-slate-100">
                                                    {paginatedUsers.map((rowUser, index) => {
                                                        const isLoggedInAdmin =
                                                            String(rowUser._id) === String(loggedInUserId);

                                                        const whatsappLink =
                                                            getWhatsAppLink(rowUser.whatsappNumber);

                                                        return (
                                                            <tr
                                                                key={rowUser._id}
                                                                className="hover:bg-blue-50/40 transition"
                                                            >
                                                                <td className="px-6 py-4 text-sm text-slate-500">
                                                                    {(currentPage - 1) * usersPerPage + index + 1}
                                                                </td>

                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold uppercase shrink-0">
                                                                            {rowUser.name?.charAt(0) || 'U'}
                                                                        </div>

                                                                        <div>
                                                                            <p className="text-sm font-semibold text-slate-800">
                                                                                {rowUser.name}
                                                                            </p>

                                                                            <p className="text-xs text-slate-400">
                                                                                User Account
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                                    {rowUser.email}
                                                                </td>

                                                                <td className="px-6 py-4 text-sm">
                                                                    {whatsappLink ? (
                                                                        <a
                                                                            href={whatsappLink}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-800 font-medium"
                                                                        >
                                                                            <span>☏</span>
                                                                            {rowUser.whatsappNumber}
                                                                        </a>
                                                                    ) : (
                                                                        <span className="text-slate-400">
                                                                            N/A
                                                                        </span>
                                                                    )}
                                                                </td>

                                                                <td className="px-6 py-4">
                                                                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                                                                        rowUser.role === 'admin'
                                                                            ? 'bg-blue-50 text-blue-700'
                                                                            : rowUser.role === 'employee'
                                                                                ? 'bg-violet-50 text-violet-700'
                                                                                : rowUser.role === 'customer'
                                                                                    ? 'bg-orange-50 text-orange-700'
                                                                                    : 'bg-slate-100 text-slate-600'
                                                                    }`}>
                                                                        {rowUser.role === 'admin'
                                                                            ? 'Administrator'
                                                                            : rowUser.role?.charAt(0).toUpperCase() + rowUser.role?.slice(1)}
                                                                    </span>
                                                                </td>

                                                                <td className="px-6 py-4">
                                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                                                                        rowUser.isActive === false
                                                                            ? 'bg-red-50 text-red-700'
                                                                            : 'bg-emerald-50 text-emerald-700'
                                                                    }`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                                                            rowUser.isActive === false
                                                                                ? 'bg-red-500'
                                                                                : 'bg-emerald-500'
                                                                        }`} />

                                                                        {rowUser.isActive === false ? 'Inactive' : 'Active'}
                                                                    </span>
                                                                </td>

                                                                <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                                                                    {rowUser.createdAt
                                                                        ? new Date(rowUser.createdAt).toLocaleDateString()
                                                                        : 'N/A'}
                                                                </td>

                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => handleOpenEdit(rowUser)}
                                                                            className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition"
                                                                        >
                                                                            ✎ Edit
                                                                        </button>

                                                                        <button
                                                                            onClick={() => handleOpenDelete(rowUser)}
                                                                            disabled={isLoggedInAdmin}
                                                                            title={
                                                                                isLoggedInAdmin
                                                                                    ? 'You cannot delete your own account'
                                                                                    : 'Delete user'
                                                                            }
                                                                            className="px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                                                                        >
                                                                            🗑 Delete
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Pagination */}
                                        <div className="px-5 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                            <p className="text-xs text-slate-500">
                                                Showing{' '}
                                                <span className="font-bold text-slate-700">
                                                    {filteredUsers.length === 0
                                                        ? 0
                                                        : (currentPage - 1) * usersPerPage + 1}
                                                </span>
                                                {' '}to{' '}
                                                <span className="font-bold text-slate-700">
                                                    {Math.min(
                                                        currentPage * usersPerPage,
                                                        filteredUsers.length
                                                    )}
                                                </span>
                                                {' '}of{' '}
                                                <span className="font-bold text-slate-700">
                                                    {filteredUsers.length}
                                                </span>
                                                {' '}users
                                            </p>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                                                    disabled={currentPage === 1}
                                                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                    Previous
                                                </button>

                                                <span className="text-xs text-slate-500 px-2">
                                                    Page {currentPage} of {totalPages}
                                                </span>

                                                <button
                                                    onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                                                    disabled={currentPage === totalPages}
                                                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}

                    {/* Other Menu Pages */}
                    {activeMenu !== 'Dashboard' &&
                        activeMenu !== 'User Management' && (
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

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">
                                    Edit User
                                </h2>

                                <p className="text-xs text-slate-400 mt-1">
                                    Update user account information
                                </p>
                            </div>

                            <button
                                onClick={() => setEditingUser(null)}
                                disabled={editLoading}
                                className="text-2xl text-slate-400 hover:text-slate-700"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleUpdateUser} className="p-6">
                            <div className="space-y-5">

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Full Name
                                    </label>

                                    <input
                                        type="text"
                                        name="name"
                                        value={editForm.name}
                                        onChange={handleEditChange}
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Email Address
                                    </label>

                                    <input
                                        type="email"
                                        name="email"
                                        value={editForm.email}
                                        onChange={handleEditChange}
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        WhatsApp Number
                                    </label>

                                    <input
                                        type="tel"
                                        name="whatsappNumber"
                                        value={editForm.whatsappNumber}
                                        onChange={handleEditChange}
                                        placeholder="+8801XXXXXXXXX"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        User Role
                                    </label>

                                    <select
                                        name="role"
                                        value={editForm.role}
                                        onChange={handleEditChange}
                                        disabled={String(editingUser._id) === String(loggedInUserId)}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none disabled:opacity-60"
                                    >
                                        <option value="user">Normal User</option>
                                        <option value="admin">Administrator</option>
                                        <option value="employee">Employee</option>
                                        <option value="customer">Customer</option>
                                    </select>

                                    {String(editingUser._id) === String(loggedInUserId) && (
                                        <p className="text-xs text-orange-600 mt-2">
                                            Your own administrator role cannot be changed here.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {editError && (
                                <div className="mt-5 p-4 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
                                    {editError}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-7">
                                <button
                                    type="button"
                                    onClick={() => setEditingUser(null)}
                                    disabled={editLoading}
                                    className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={editLoading}
                                    className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
                                >
                                    {editLoading ? 'Updating...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingUser && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6">
                        <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-2xl mx-auto mb-4">
                            🗑
                        </div>

                        <h2 className="text-xl font-bold text-slate-800 text-center">
                            Delete User?
                        </h2>

                        <p className="text-sm text-slate-500 text-center mt-3 leading-6">
                            Are you sure you want to delete{' '}
                            <span className="font-bold text-slate-800">
                                {deletingUser.name}
                            </span>
                            ? This action cannot be undone.
                        </p>

                        <div className="mt-5 p-4 bg-slate-50 rounded-xl">
                            <p className="text-sm font-semibold text-slate-700">
                                {deletingUser.name}
                            </p>

                            <p className="text-xs text-slate-500 mt-1">
                                {deletingUser.email}
                            </p>

                            {deletingUser.whatsappNumber && (
                                <p className="text-xs text-emerald-600 mt-1">
                                    WhatsApp: {deletingUser.whatsappNumber}
                                </p>
                            )}
                        </div>

                        {deleteError && (
                            <div className="mt-4 p-4 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
                                {deleteError}
                            </div>
                        )}

                        <div className="flex gap-3 mt-7">
                            <button
                                onClick={() => setDeletingUser(null)}
                                disabled={deleteLoading}
                                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={handleDeleteUser}
                                disabled={deleteLoading}
                                className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50"
                            >
                                {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
