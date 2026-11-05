
import { useState, useEffect, useMemo } from 'react';
import AdminSidebar from '../../components/AdminSidebar.jsx';

// ASSET MANAGEMENT PAGE - Search: ASSET MANAGEMENT PAGE

const API_URL = 'http://localhost:3001/api/assets';
const DEPARTMENT_API_URL = 'http://localhost:3001/api/departments';
const ROOM_API_URL = 'http://localhost:3001/api/rooms';

const STATUSES = ['Assigned', 'Damaged', 'Under Repair', 'Returned'];

const getHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('pos-token')}`
});

// Get ID from populated or unpopulated MongoDB reference
const getRelationId = (value) => {
    if (!value) return '';

    if (typeof value === 'object') {
        return String(value._id || value.id || '');
    }

    return String(value);
};

// Get array from different API response formats
const getResponseList = (data, key) => {
    if (Array.isArray(data?.[key])) {
        return data[key];
    }

    if (Array.isArray(data?.data?.[key])) {
        return data.data[key];
    }

    if (Array.isArray(data?.data)) {
        return data.data;
    }

    if (Array.isArray(data)) {
        return data;
    }

    return [];
};

const formatDate = (date) => {
    if (!date) return 'N/A';

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) return 'N/A';

    return parsedDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

const getStatusStyle = (status) => {
    switch (status) {
        case 'Assigned':
            return 'bg-blue-100 text-blue-700';

        case 'Damaged':
            return 'bg-red-100 text-red-700';

        case 'Under Repair':
            return 'bg-amber-100 text-amber-700';

        case 'Returned':
            return 'bg-emerald-100 text-emerald-700';

        default:
            return 'bg-slate-100 text-slate-700';
    }
};

const AssetManagement = () => {
    const [assets, setAssets] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [rooms, setRooms] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [roomFilter, setRoomFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [selectedAsset, setSelectedAsset] = useState(null);

    // LOAD ASSET DATA - Search: LOAD ASSET DATA
    const fetchAssets = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch(API_URL, {
                method: 'GET',
                headers: getHeaders(),
                cache: 'no-store'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Failed to load assets.'
                );
            }

            if (!data.success) {
                throw new Error(
                    data.message || 'Unable to retrieve asset information.'
                );
            }

            setAssets(Array.isArray(data.assets) ? data.assets : []);

        } catch (error) {
            console.error('ASSET FETCH ERROR:', error);
            setError(error.message || 'Cannot connect to server.');

        } finally {
            setLoading(false);
        }
    };

    // LOAD ALL ACTIVE DEPARTMENTS
    const fetchDepartments = async () => {
        try {
            const response = await fetch(
                `${DEPARTMENT_API_URL}?refresh=${Date.now()}`,
                {
                    method: 'GET',
                    headers: getHeaders(),
                    cache: 'no-store'
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Failed to load departments.'
                );
            }

            const departmentList = getResponseList(
                data,
                'departments'
            );

            setDepartments(
                departmentList.filter(
                    (department) => department.isActive !== false
                )
            );

        } catch (error) {
            console.error('DEPARTMENT FETCH ERROR:', error);
        }
    };

    // LOAD ALL ACTIVE ROOMS
    const fetchRooms = async () => {
        try {
            const response = await fetch(
                `${ROOM_API_URL}?refresh=${Date.now()}`,
                {
                    method: 'GET',
                    headers: getHeaders(),
                    cache: 'no-store'
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Failed to load rooms.'
                );
            }

            const roomList = getResponseList(
                data,
                'rooms'
            );

            setRooms(
                roomList.filter(
                    (room) => room.isActive !== false
                )
            );

        } catch (error) {
            console.error('ROOM FETCH ERROR:', error);
        }
    };

    // LOAD ASSETS, DEPARTMENTS AND ROOMS
    useEffect(() => {
        fetchAssets();
        fetchDepartments();
        fetchRooms();
    }, []);

    // FILTER ROOMS BY SELECTED DEPARTMENT
    const filteredRooms = useMemo(() => {
        if (!departmentFilter) {
            return rooms;
        }

        return rooms.filter((room) => {
            return (
                getRelationId(room.department) === departmentFilter
            );
        });
    }, [rooms, departmentFilter]);

    // FILTER ASSETS
    const filteredAssets = useMemo(() => {
        return assets.filter((asset) => {
            const search = searchTerm.toLowerCase().trim();

            const matchesSearch =
                !search ||
                [
                    asset.assetId,
                    asset.name,
                    asset.serialNumber,
                    asset.sku,
                    asset.brand,
                    asset.model
                ].some((value) =>
                    String(value || '').toLowerCase().includes(search)
                );

            const matchesDepartment =
                !departmentFilter ||
                getRelationId(asset.department) === departmentFilter;

            const matchesRoom =
                !roomFilter ||
                getRelationId(asset.room) === roomFilter;

            const matchesStatus =
                !statusFilter ||
                asset.status === statusFilter;

            return (
                matchesSearch &&
                matchesDepartment &&
                matchesRoom &&
                matchesStatus
            );
        });
    }, [
        assets,
        searchTerm,
        departmentFilter,
        roomFilter,
        statusFilter
    ]);

    // ASSET STATISTICS
    const stats = useMemo(() => ({
        total: assets.length,
        assigned: assets.filter((asset) => asset.status === 'Assigned').length,
        damaged: assets.filter((asset) => asset.status === 'Damaged').length,
        underRepair: assets.filter((asset) => asset.status === 'Under Repair').length,
        returned: assets.filter((asset) => asset.status === 'Returned').length
    }), [assets]);

    // CLEAR ALL FILTERS
    const clearFilters = () => {
        setSearchTerm('');
        setDepartmentFilter('');
        setRoomFilter('');
        setStatusFilter('');
    };

    // HANDLE DEPARTMENT CHANGE
    const handleDepartmentChange = (e) => {
        setDepartmentFilter(e.target.value);

        // Reset room filter when department changes
        setRoomFilter('');
    };

    return (
        <div className="flex min-h-screen bg-slate-100">
            <AdminSidebar />

            {/* RESPONSIVE MAIN CONTENT */}
            <main className="min-w-0 w-full flex-1 px-4 pb-6 pt-20 sm:px-6 sm:pb-8 sm:pt-20 lg:ml-64 lg:px-8 lg:py-8">

                {/* PAGE HEADER */}
                <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600">
                            UMC / ADMIN
                        </p>

                        <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">
                            Asset Management
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            Manage and monitor assigned IT assets.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={fetchAssets}
                        disabled={loading}
                        className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                        {loading ? 'Refreshing...' : '↻ Refresh Assets'}
                    </button>
                </div>

                {/* ERROR MESSAGE */}
                {error && (
                    <div className="mb-6 flex flex-col justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center">
                        <p className="text-sm text-red-700">
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={fetchAssets}
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* STATISTICS */}
                <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm font-medium text-slate-500">
                            Total Assets
                        </p>
                        <h2 className="mt-2 text-3xl font-bold text-slate-800">
                            {stats.total}
                        </h2>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
                        <p className="text-sm font-medium text-blue-600">
                            Assigned
                        </p>
                        <h2 className="mt-2 text-3xl font-bold text-blue-700">
                            {stats.assigned}
                        </h2>
                    </div>

                    <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm">
                        <p className="text-sm font-medium text-red-600">
                            Damaged
                        </p>
                        <h2 className="mt-2 text-3xl font-bold text-red-700">
                            {stats.damaged}
                        </h2>
                    </div>

                    <div className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm">
                        <p className="text-sm font-medium text-amber-600">
                            Under Repair
                        </p>
                        <h2 className="mt-2 text-3xl font-bold text-amber-700">
                            {stats.underRepair}
                        </h2>
                    </div>

                    <div className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
                        <p className="text-sm font-medium text-emerald-600">
                            Returned
                        </p>
                        <h2 className="mt-2 text-3xl font-bold text-emerald-700">
                            {stats.returned}
                        </h2>
                    </div>

                </div>

                {/* ASSET LIST */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

                    <div className="border-b border-slate-200 p-4 sm:p-5">

                        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">
                                    Asset List
                                </h2>

                                <p className="mt-1 text-xs text-slate-500">
                                    View all assets assigned to departments and rooms.
                                </p>
                            </div>

                            <span className="text-sm font-semibold text-slate-600">
                                Showing {filteredAssets.length} of {assets.length} assets
                            </span>
                        </div>

                        {/* SEARCH AND FILTERS */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search Asset ID, Name, Serial..."
                                className="w-full min-w-0 rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />

                            {/* DEPARTMENT FILTER */}
                            <select
                                value={departmentFilter}
                                onChange={handleDepartmentChange}
                                className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                            >
                                <option value="">All Departments</option>

                                {departments.map((department) => (
                                    <option
                                        key={department._id}
                                        value={department._id}
                                    >
                                        {department.name}
                                    </option>
                                ))}
                            </select>

                            {/* ROOM FILTER - DEPARTMENT WISE */}
                            <select
                                value={roomFilter}
                                onChange={(e) => setRoomFilter(e.target.value)}
                                disabled={
                                    Boolean(departmentFilter) &&
                                    filteredRooms.length === 0
                                }
                                className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                            >
                                <option value="">All Rooms</option>

                                {filteredRooms.map((room) => (
                                    <option
                                        key={room._id}
                                        value={room._id}
                                    >
                                        {room.name}
                                        {room.roomNumber
                                            ? ` (${room.roomNumber})`
                                            : ''}
                                    </option>
                                ))}
                            </select>

                            {/* STATUS FILTER */}
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                            >
                                <option value="">All Statuses</option>

                                {STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>

                        </div>

                        {(searchTerm || departmentFilter || roomFilter || statusFilter) && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-800"
                            >
                                Clear All Filters
                            </button>
                        )}

                    </div>

                    {/* TABLE */}
                    <div className="overflow-x-auto">

                        <table className="w-full min-w-[950px] text-left">

                            <thead className="bg-slate-50">
                                <tr className="border-b border-slate-200">

                                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Asset ID
                                    </th>

                                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Asset Details
                                    </th>

                                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Serial Number
                                    </th>

                                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Department
                                    </th>

                                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Room
                                    </th>

                                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Status
                                    </th>

                                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Assigned Date
                                    </th>

                                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Action
                                    </th>

                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">

                                {loading && assets.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-5 py-12 text-center text-sm text-slate-500">
                                            Loading assets...
                                        </td>
                                    </tr>
                                ) : filteredAssets.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-5 py-12 text-center">
                                            <p className="font-semibold text-slate-600">
                                                No assets found
                                            </p>

                                            <p className="mt-1 text-sm text-slate-400">
                                                Assets will appear here after they are assigned from Stock Inventory.
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAssets.map((asset) => (
                                        <tr
                                            key={asset._id}
                                            className="transition-colors hover:bg-slate-50"
                                        >

                                            <td className="px-5 py-4">
                                                <span className="font-semibold text-blue-700">
                                                    {asset.assetId || 'N/A'}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4">
                                                <p className="font-semibold text-slate-800">
                                                    {asset.name || 'N/A'}
                                                </p>

                                                <p className="mt-1 text-xs text-slate-500">
                                                    {[asset.brand, asset.model].filter(Boolean).join(' / ') || 'No brand/model'}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                {asset.serialNumber || 'N/A'}
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                {asset.department?.name || 'N/A'}
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                {asset.room?.name || 'N/A'}

                                                {asset.room?.roomNumber && (
                                                    <span className="block text-xs text-slate-400">
                                                        {asset.room.roomNumber}
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-5 py-4">
                                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(asset.status)}`}>
                                                    {asset.status || 'Unknown'}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                {formatDate(asset.assignedDate)}
                                            </td>

                                            <td className="px-5 py-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedAsset(asset)}
                                                    className="whitespace-nowrap rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
                                                >
                                                    View Details
                                                </button>
                                            </td>

                                        </tr>
                                    ))
                                )}

                            </tbody>
                        </table>

                    </div>

                </div>

                {/* ASSET DETAILS MODAL */}
                {selectedAsset && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
                        onClick={() => setSelectedAsset(null)}
                    >
                        <div
                            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >

                            <div className="flex items-center justify-between border-b border-slate-200 p-5">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                                        UMC IT ASSET
                                    </p>

                                    <h2 className="mt-1 text-xl font-bold text-slate-800">
                                        Asset Details
                                    </h2>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSelectedAsset(null)}
                                    className="rounded-lg px-3 py-2 text-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">
                                        Asset ID
                                    </p>
                                    <p className="mt-1 break-all font-bold text-blue-700">
                                        {selectedAsset.assetId || 'N/A'}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">
                                        Status
                                    </p>
                                    <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(selectedAsset.status)}`}>
                                        {selectedAsset.status || 'Unknown'}
                                    </span>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">
                                        Asset Name
                                    </p>
                                    <p className="mt-1 font-semibold text-slate-800">
                                        {selectedAsset.name || 'N/A'}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">
                                        Serial Number
                                    </p>
                                    <p className="mt-1 break-all font-semibold text-slate-800">
                                        {selectedAsset.serialNumber || 'N/A'}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">
                                        Brand
                                    </p>
                                    <p className="mt-1 font-semibold text-slate-800">
                                        {selectedAsset.brand || 'N/A'}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">
                                        Model
                                    </p>
                                    <p className="mt-1 font-semibold text-slate-800">
                                        {selectedAsset.model || 'N/A'}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">
                                        SKU
                                    </p>
                                    <p className="mt-1 break-all font-semibold text-slate-800">
                                        {selectedAsset.sku || 'N/A'}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">
                                        Department
                                    </p>
                                    <p className="mt-1 font-semibold text-slate-800">
                                        {selectedAsset.department?.name || 'N/A'}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">
                                        Room
                                    </p>
                                    <p className="mt-1 font-semibold text-slate-800">
                                        {selectedAsset.room?.name || 'N/A'}
                                        {selectedAsset.room?.roomNumber
                                            ? ` (${selectedAsset.room.roomNumber})`
                                            : ''}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">
                                        Assigned Date
                                    </p>
                                    <p className="mt-1 font-semibold text-slate-800">
                                        {formatDate(selectedAsset.assignedDate)}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4 sm:col-span-2">
                                    <p className="text-xs font-medium text-slate-500">
                                        Description / Notes
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                                        {selectedAsset.description || 'No additional notes.'}
                                    </p>
                                </div>

                            </div>

                            <div className="flex justify-end border-t border-slate-200 p-5">
                                <button
                                    type="button"
                                    onClick={() => setSelectedAsset(null)}
                                    className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                                >
                                    Close
                                </button>
                            </div>

                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default AssetManagement;
