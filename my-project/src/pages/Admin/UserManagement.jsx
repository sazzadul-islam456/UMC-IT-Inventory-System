
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import AdminSidebar from '../../components/AdminSidebar.jsx';

const USERS_API_URL = 'http://localhost:3001/api/users';

const UserManagement = () => {
    const { user } = useAuth();
    const loggedInUserId = user?._id;

    const [userStats, setUserStats] = useState({
        totalUsers: 0,
        totalAdmins: 0,
        normalUsers: 0
    });

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [role, setRole] = useState('user');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState('');

    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({
        name: '',
        email: '',
        whatsappNumber: '',
        role: 'user'
    });
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');

    const [deletingUser, setDeletingUser] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('newest');
    const [currentPage, setCurrentPage] = useState(1);
    const usersPerPage = 8;

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

        const internationalNumber = digits.startsWith('0')
            ? `88${digits}`
            : digits;

        return `https://wa.me/${internationalNumber}`;
    };

    // Load User Statistics
    const fetchUserStats = async () => {
        try {
            const token = getToken();

            const response = await fetch(`${USERS_API_URL}/stats`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to load user statistics');
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

            const response = await fetch(USERS_API_URL, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to load users');
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

            const response = await fetch(USERS_API_URL, {
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
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to create user');
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

            const response = await fetch(`${USERS_API_URL}/${editingUser._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(editForm)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update user');
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

            const response = await fetch(`${USERS_API_URL}/${deletingUser._id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to delete user');
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
            <AdminSidebar />

            <main className="flex-1 lg:ml-64 min-w-0">
                <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-20">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs text-slate-400 font-semibold tracking-wide">
                                UNITED MEDICAL COLLEGE / ADMIN
                            </p>

                            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mt-1 truncate">
                                User Management
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

                <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-7">
                        <StatCard title="Total Users" value={userStats.totalUsers} icon="♙" color="bg-blue-50 text-blue-600" description="All registered users" />
                        <StatCard title="Administrators" value={userStats.totalAdmins} icon="🛡️" color="bg-violet-50 text-violet-600" description="Admin accounts" />
                        <StatCard title="Active Users" value={activeUsers} icon="✓" color="bg-emerald-50 text-emerald-600" description="Active accounts" />
                        <StatCard title="Inactive Users" value={inactiveUsers} icon="⊘" color="bg-red-50 text-red-600" description="Inactive accounts" />
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
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter full name" required className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter email address" required className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create password" minLength={6} required className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">WhatsApp Number</label>
                                    <input type="tel" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+8801XXXXXXXXX" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">User Role</label>
                                    <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition">
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
                                <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-7 py-3 rounded-xl font-semibold text-sm shadow-lg shadow-blue-600/20 transition disabled:opacity-50">
                                    {loading ? 'Creating...' : '+ Create User'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* All Users */}
                    <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">All Users</h2>
                                <p className="text-xs text-slate-400 mt-1">Search, filter and view registered users</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button onClick={handleExportUsers} disabled={filteredUsers.length === 0} className="px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm font-semibold transition disabled:opacity-40">
                                    ↓ Export CSV
                                </button>

                                <button onClick={() => { fetchUserStats(); fetchAllUsers(); }} disabled={usersLoading} className="px-4 py-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm font-semibold transition disabled:opacity-50">
                                    {usersLoading ? 'Loading...' : '↻ Refresh'}
                                </button>
                            </div>
                        </div>

                        <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-2">Search Users</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
                                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Name, email or WhatsApp..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-2">Filter by Role</label>
                                    <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none text-sm">
                                        <option value="all">All Roles</option>
                                        <option value="admin">Administrator</option>
                                        <option value="user">Normal User</option>
                                        <option value="employee">Employee</option>
                                        <option value="customer">Customer</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-2">Filter by Status</label>
                                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none text-sm">
                                        <option value="all">All Status</option>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-2">Sort Users</label>
                                    <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none text-sm">
                                        <option value="newest">Newest First</option>
                                        <option value="oldest">Oldest First</option>
                                        <option value="name">Name A - Z</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
                                <p className="text-xs text-slate-500">
                                    Found <span className="font-bold text-slate-800">{filteredUsers.length}</span> matching users out of <span className="font-bold text-slate-800">{users.length}</span>
                                </p>

                                <button onClick={() => { setSearchTerm(''); setRoleFilter('all'); setStatusFilter('all'); setSortOrder('newest'); }} className="text-xs font-semibold text-blue-600 hover:text-blue-800 text-left">
                                    ✕ Clear All Filters
                                </button>
                            </div>
                        </div>

                        {usersError && (
                            <div className="m-5 p-4 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
                                <p className="font-semibold">Unable to load users</p>
                                <p className="mt-1">{usersError}</p>
                                <button onClick={fetchAllUsers} className="mt-3 font-semibold underline">Try Again</button>
                            </div>
                        )}

                        {usersLoading ? (
                            <div className="p-10">
                                <div className="flex justify-center mb-4">
                                    <div className="w-9 h-9 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                </div>

                                <p className="text-center text-slate-500 text-sm">Loading users...</p>

                                <div className="mt-6 space-y-3 max-w-xl mx-auto">
                                    {[1, 2, 3].map((item) => (
                                        <div key={item} className="h-12 rounded-lg bg-slate-100 animate-pulse" />
                                    ))}
                                </div>
                            </div>
                        ) : users.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="text-4xl mb-3">👥</div>
                                <h3 className="font-bold text-slate-700">No Users Found</h3>
                                <p className="text-sm text-slate-400 mt-2">Create your first user to get started.</p>
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="text-4xl mb-3">🔎</div>
                                <h3 className="font-bold text-slate-700">No Matching Users</h3>
                                <p className="text-sm text-slate-400 mt-2">Try changing your search or filters.</p>

                                <button onClick={() => { setSearchTerm(''); setRoleFilter('all'); setStatusFilter('all'); }} className="mt-4 px-5 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-100">
                                    Clear Filters
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left min-w-[1200px]">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                {['#', 'User', 'Email', 'WhatsApp Number', 'Role', 'Status', 'Created Date', 'Actions'].map((heading) => (
                                                    <th key={heading} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{heading}</th>
                                                ))}
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100">
                                            {paginatedUsers.map((rowUser, index) => {
                                                const isLoggedInAdmin = String(rowUser._id) === String(loggedInUserId);
                                                const whatsappLink = getWhatsAppLink(rowUser.whatsappNumber);

                                                return (
                                                    <tr key={rowUser._id} className="hover:bg-blue-50/40 transition">
                                                        <td className="px-6 py-4 text-sm text-slate-500">{(currentPage - 1) * usersPerPage + index + 1}</td>

                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold uppercase shrink-0">
                                                                    {rowUser.name?.charAt(0) || 'U'}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-semibold text-slate-800">{rowUser.name}</p>
                                                                    <p className="text-xs text-slate-400">User Account</p>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="px-6 py-4 text-sm text-slate-600">{rowUser.email}</td>

                                                        <td className="px-6 py-4 text-sm">
                                                            {whatsappLink ? (
                                                                <a href={whatsappLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-800 font-medium">
                                                                    <span>☏</span>{rowUser.whatsappNumber}
                                                                </a>
                                                            ) : (
                                                                <span className="text-slate-400">N/A</span>
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
                                                                    rowUser.isActive === false ? 'bg-red-500' : 'bg-emerald-500'
                                                                }`} />
                                                                {rowUser.isActive === false ? 'Inactive' : 'Active'}
                                                            </span>
                                                        </td>

                                                        <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                                                            {rowUser.createdAt ? new Date(rowUser.createdAt).toLocaleDateString() : 'N/A'}
                                                        </td>

                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={() => handleOpenEdit(rowUser)} className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition">
                                                                    ✎ Edit
                                                                </button>

                                                                <button onClick={() => handleOpenDelete(rowUser)} disabled={isLoggedInAdmin} title={isLoggedInAdmin ? 'You cannot delete your own account' : 'Delete user'} className="px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed">
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

                                <div className="px-5 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <p className="text-xs text-slate-500">
                                        Showing <span className="font-bold text-slate-700">{filteredUsers.length === 0 ? 0 : (currentPage - 1) * usersPerPage + 1}</span> to <span className="font-bold text-slate-700">{Math.min(currentPage * usersPerPage, filteredUsers.length)}</span> of <span className="font-bold text-slate-700">{filteredUsers.length}</span> users
                                    </p>

                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
                                            Previous
                                        </button>

                                        <span className="text-xs text-slate-500 px-2">Page {currentPage} of {totalPages}</span>

                                        <button onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

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
                                <h2 className="text-xl font-bold text-slate-800">Edit User</h2>
                                <p className="text-xs text-slate-400 mt-1">Update user account information</p>
                            </div>

                            <button onClick={() => setEditingUser(null)} disabled={editLoading} className="text-2xl text-slate-400 hover:text-slate-700">×</button>
                        </div>

                        <form onSubmit={handleUpdateUser} className="p-6">
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                                    <input type="text" name="name" value={editForm.name} onChange={handleEditChange} required className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                                    <input type="email" name="email" value={editForm.email} onChange={handleEditChange} required className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">WhatsApp Number</label>
                                    <input type="tel" name="whatsappNumber" value={editForm.whatsappNumber} onChange={handleEditChange} placeholder="+8801XXXXXXXXX" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">User Role</label>
                                    <select name="role" value={editForm.role} onChange={handleEditChange} disabled={String(editingUser._id) === String(loggedInUserId)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none disabled:opacity-60">
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
                                <div className="mt-5 p-4 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">{editError}</div>
                            )}

                            <div className="flex justify-end gap-3 mt-7">
                                <button type="button" onClick={() => setEditingUser(null)} disabled={editLoading} className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold">
                                    Cancel
                                </button>

                                <button type="submit" disabled={editLoading} className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">
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
                        <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-2xl mx-auto mb-4">🗑</div>

                        <h2 className="text-xl font-bold text-slate-800 text-center">Delete User?</h2>

                        <p className="text-sm text-slate-500 text-center mt-3 leading-6">
                            Are you sure you want to delete <span className="font-bold text-slate-800">{deletingUser.name}</span>? This action cannot be undone.
                        </p>

                        <div className="mt-5 p-4 bg-slate-50 rounded-xl">
                            <p className="text-sm font-semibold text-slate-700">{deletingUser.name}</p>
                            <p className="text-xs text-slate-500 mt-1">{deletingUser.email}</p>

                            {deletingUser.whatsappNumber && (
                                <p className="text-xs text-emerald-600 mt-1">WhatsApp: {deletingUser.whatsappNumber}</p>
                            )}
                        </div>

                        {deleteError && (
                            <div className="mt-4 p-4 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">{deleteError}</div>
                        )}

                        <div className="flex gap-3 mt-7">
                            <button onClick={() => setDeletingUser(null)} disabled={deleteLoading} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold disabled:opacity-50">
                                Cancel
                            </button>

                            <button onClick={handleDeleteUser} disabled={deleteLoading} className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50">
                                {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
