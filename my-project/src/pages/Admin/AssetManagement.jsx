
import { useState, useEffect, useMemo } from 'react';
import AdminSidebar from '../../components/AdminSidebar.jsx';

// ASSET MANAGEMENT PAGE - Search: ASSET MANAGEMENT PAGE

const API_URL = 'http://localhost:3001/api/assets';
const DEPARTMENT_API_URL = 'http://localhost:3001/api/departments';
const ROOM_API_URL = 'http://localhost:3001/api/rooms';

const STATUSES = ['Assigned', 'Damaged', 'Under Repair', 'Returned'];

const DEPARTMENT_ASSET_STATUSES = ['Assigned', 'Damaged', 'Under Repair'];

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
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data?.[key])) return data.data[key];
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data)) return data;

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

const formatDateTime = (date) => {
    if (!date) return 'N/A';

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) return 'N/A';

    return parsedDate.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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
            return 'bg-slate-100 text-slate-700';

        default:
            return 'bg-slate-100 text-slate-700';
    }
};

// GET PRODUCT INFORMATION
const getProductInfo = (asset) => ({
    name: asset.name || asset.stockItem?.name || 'Unknown Product',
    brand: asset.brand || asset.stockItem?.brand || '',
    model: asset.model || asset.stockItem?.model || '',
    sku: asset.sku || asset.stockItem?.sku || '',
    category: asset.stockItem?.category || ''
});

// CREATE SAME PRODUCT GROUP KEY
const getProductGroupKey = (asset) => {
    const product = getProductInfo(asset);

    const normalize = (value) =>
        String(value || '').trim().toLowerCase();

    const name = normalize(product.name);
    const brand = normalize(product.brand);
    const model = normalize(product.model);
    const sku = normalize(product.sku);

    if (name || brand || model || sku) {
        return [name, brand, model, sku].join('|');
    }

    return getRelationId(asset.stockItem) || asset._id;
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

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedAsset, setSelectedAsset] = useState(null);

    // REPAIR AND DAMAGE STATES
    const [actionType, setActionType] = useState('');
    const [actionAsset, setActionAsset] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState('');
    const [actionSuccess, setActionSuccess] = useState('');

    const [damageDescription, setDamageDescription] = useState('');
    const [damageNotes, setDamageNotes] = useState('');

    const [issueDescription, setIssueDescription] = useState('');
    const [repairProvider, setRepairProvider] = useState('');
    const [technician, setTechnician] = useState('');
    const [estimatedCost, setEstimatedCost] = useState('0');
    const [repairNotes, setRepairNotes] = useState('');

    const [repairResult, setRepairResult] = useState('Successful');
    const [actualCost, setActualCost] = useState('0');
    const [resultNotes, setResultNotes] = useState('');

    // HISTORY STATES
    const [historyType, setHistoryType] = useState('');
    const [historyAsset, setHistoryAsset] = useState(null);
    const [repairHistory, setRepairHistory] = useState([]);
    const [damageHistory, setDamageHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState('');

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
                throw new Error(data.message || 'Failed to load assets.');
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
                throw new Error(data.message || 'Failed to load departments.');
            }

            const departmentList = getResponseList(data, 'departments');

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
                throw new Error(data.message || 'Failed to load rooms.');
            }

            const roomList = getResponseList(data, 'rooms');

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
        if (!departmentFilter) return rooms;

        return rooms.filter((room) => (
            getRelationId(room.department) === departmentFilter
        ));
    }, [rooms, departmentFilter]);

    // FILTER ASSETS
    const filteredAssets = useMemo(() => {
        return assets.filter((asset) => {
            const search = searchTerm.toLowerCase().trim();
            const product = getProductInfo(asset);

            const matchesSearch =
                !search ||
                [
                    asset.assetId,
                    product.name,
                    asset.serialNumber,
                    product.sku,
                    product.brand,
                    product.model
                ].some((value) =>
                    String(value || '').toLowerCase().includes(search)
                );

            // DEPARTMENT FILTER:
            // Only assets currently assigned to this department.
            const matchesDepartment =
                !departmentFilter ||
                (
                    getRelationId(asset.department) === departmentFilter &&
                    DEPARTMENT_ASSET_STATUSES.includes(asset.status)
                );

            const matchesRoom =
                !roomFilter ||
                getRelationId(asset.room) === roomFilter;

            const matchesStatus =
                !statusFilter ||
                asset.status === statusFilter;

            // AVAILABLE ASSETS ARE NOT DISPLAYED IN ASSET MANAGEMENT
            const matchesAssetStatus =
                STATUSES.includes(asset.status);

            return (
                matchesSearch &&
                matchesDepartment &&
                matchesRoom &&
                matchesStatus &&
                matchesAssetStatus
            );
        });
    }, [
        assets,
        searchTerm,
        departmentFilter,
        roomFilter,
        statusFilter
    ]);

    // GROUP SAME PRODUCTS TOGETHER
    const groupedAssets = useMemo(() => {
        const groups = new Map();

        filteredAssets.forEach((asset) => {
            const groupKey = getProductGroupKey(asset);

            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    key: groupKey,
                    product: getProductInfo(asset),
                    assets: []
                });
            }

            groups.get(groupKey).assets.push(asset);
        });

        return Array.from(groups.values()).sort((a, b) =>
            a.product.name.localeCompare(b.product.name)
        );
    }, [filteredAssets]);

    // FILTERED ASSET STATISTICS
    const stats = useMemo(() => ({
        total: filteredAssets.length,
        assigned: filteredAssets.filter(
            (asset) => asset.status === 'Assigned'
        ).length,
        damaged: filteredAssets.filter(
            (asset) => asset.status === 'Damaged'
        ).length,
        underRepair: filteredAssets.filter(
            (asset) => asset.status === 'Under Repair'
        ).length,
        returned: filteredAssets.filter(
            (asset) => asset.status === 'Returned'
        ).length
    }), [filteredAssets]);

    // PRODUCT GROUP STATISTICS
    const productStats = useMemo(() => ({
        products: groupedAssets.length,
        assets: filteredAssets.length
    }), [groupedAssets, filteredAssets]);

    // GET PRODUCT STATUS COUNTS
    const getProductCounts = (productAssets) => ({
        assigned: productAssets.filter(
            asset => asset.status === 'Assigned'
        ).length,

        damaged: productAssets.filter(
            asset => asset.status === 'Damaged'
        ).length,

        underRepair: productAssets.filter(
            asset => asset.status === 'Under Repair'
        ).length,

        returned: productAssets.filter(
            asset => asset.status === 'Returned'
        ).length
    });

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
        setRoomFilter('');
        setStatusFilter('');
    };

    // OPEN PRODUCT DETAILS
    const openProductDetails = (productGroup) => {
        setSelectedProduct(productGroup);
        setSelectedAsset(null);
    };

    // CLOSE PRODUCT DETAILS
    const closeProductDetails = () => {
        setSelectedProduct(null);
        setSelectedAsset(null);
    };

    // RESET ACTION FORM
    const resetActionForm = () => {
        setActionType('');
        setActionAsset(null);
        setActionError('');
        setDamageDescription('');
        setDamageNotes('');
        setIssueDescription('');
        setRepairProvider('');
        setTechnician('');
        setEstimatedCost('0');
        setRepairNotes('');
        setRepairResult('Successful');
        setActualCost('0');
        setResultNotes('');
    };

    // OPEN DAMAGE FORM
    const openDamageForm = (asset) => {
        setActionAsset(asset);
        setActionType('damage');
        setActionError('');
        setDamageDescription('');
        setDamageNotes('');
    };

    // OPEN SEND TO REPAIR FORM
    const openRepairForm = (asset) => {
        setActionAsset(asset);
        setActionType('repair');
        setActionError('');
        setIssueDescription('');
        setRepairProvider('');
        setTechnician('');
        setEstimatedCost('0');
        setRepairNotes('');
    };

    // OPEN COMPLETE REPAIR FORM
    const openCompleteRepairForm = (asset) => {
        setActionAsset(asset);
        setActionType('complete');
        setActionError('');
        setRepairResult('Successful');
        setActualCost('0');
        setResultNotes('');
    };

    // SUBMIT DAMAGE / REPAIR ACTION
    const submitAssetAction = async (e) => {
        e.preventDefault();

        if (!actionAsset) return;

        let endpoint = '';
        let method = '';
        let body = {};

        if (actionType === 'damage') {
            endpoint = `${API_URL}/${actionAsset._id}/damage`;
            method = 'PATCH';

            body = {
                damageDescription,
                notes: damageNotes
            };
        }

        if (actionType === 'repair') {
            endpoint = `${API_URL}/${actionAsset._id}/repair`;
            method = 'POST';

            body = {
                issueDescription,
                repairProvider,
                technician,
                estimatedCost: Number(estimatedCost) || 0,
                notes: repairNotes
            };
        }

        if (actionType === 'complete') {
            if (!actionAsset.activeRepairId) {
                setActionError(
                    'Repair ID পাওয়া যায়নি। Repair History থেকে Repair ID যাচাই করুন।'
                );
                return;
            }

            endpoint = `${API_URL}/repair/${actionAsset.activeRepairId}/complete`;
            method = 'PATCH';

            body = {
                status: repairResult,
                actualCost: Number(actualCost) || 0,
                resultNotes
            };
        }

        try {
            setActionLoading(true);
            setActionError('');
            setActionSuccess('');

            const response = await fetch(endpoint, {
                method,
                headers: getHeaders(),
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.message || 'Action failed.');
            }

            setActionSuccess(
                data.message || 'Operation completed successfully.'
            );

            await fetchAssets();

            setSelectedAsset(null);
            setActionType('');
            setActionAsset(null);

            window.alert(
                data.message || 'Operation completed successfully.'
            );

        } catch (error) {
            console.error('ASSET ACTION ERROR:', error);
            setActionError(error.message || 'Something went wrong.');

        } finally {
            setActionLoading(false);
        }
    };

    // LOAD REPAIR AND DAMAGE HISTORY
    const openHistory = async (asset, type) => {
        setHistoryAsset(asset);
        setHistoryType(type);
        setHistoryError('');
        setHistoryLoading(true);
        setRepairHistory([]);
        setDamageHistory([]);

        try {
            const endpoint = type === 'repair'
                ? `${API_URL}/repair/history?assetId=${asset._id}`
                : `${API_URL}/damage/history?assetId=${asset._id}`;

            const response = await fetch(endpoint, {
                method: 'GET',
                headers: getHeaders(),
                cache: 'no-store'
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.message || 'Failed to load history.');
            }

            if (type === 'repair') {
                setRepairHistory(
                    getResponseList(data, 'repairs').length
                        ? getResponseList(data, 'repairs')
                        : getResponseList(data, 'history')
                );
            } else {
                setDamageHistory(
                    getResponseList(data, 'history').length
                        ? getResponseList(data, 'history')
                        : getResponseList(data, 'damageHistory')
                );
            }

        } catch (error) {
            console.error('HISTORY FETCH ERROR:', error);
            setHistoryError(error.message || 'Unable to load history.');

        } finally {
            setHistoryLoading(false);
        }
    };

    // CLOSE HISTORY MODAL
    const closeHistory = () => {
        setHistoryType('');
        setHistoryAsset(null);
        setRepairHistory([]);
        setDamageHistory([]);
        setHistoryError('');
    };

    // GET ACTIVE REPAIR ID FROM ASSET HISTORY
    const getActiveRepairId = async (asset) => {
        try {
            const response = await fetch(
                `${API_URL}/repair/history?assetId=${asset._id}&status=In%20Progress`,
                {
                    method: 'GET',
                    headers: getHeaders(),
                    cache: 'no-store'
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Unable to find active repair.');
            }

            const repairs =
                getResponseList(data, 'repairs').length
                    ? getResponseList(data, 'repairs')
                    : getResponseList(data, 'history');

            const activeRepair = repairs.find(
                repair => repair.status === 'In Progress'
            );

            if (!activeRepair?._id) {
                window.alert('এই Asset-এর Active Repair Record পাওয়া যায়নি।');
                return;
            }

            openCompleteRepairForm({
                ...asset,
                activeRepairId: activeRepair._id
            });

        } catch (error) {
            window.alert(error.message || 'Unable to find active repair.');
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-100">
            <AdminSidebar />

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
                            Manage assigned assets, departments, damage and repair records.
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
                        <p className="text-sm text-red-700">{error}</p>

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
                <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-sm font-medium text-slate-500">
                            Total Assets
                        </p>
                        <h2 className="mt-2 text-3xl font-bold text-slate-800">
                            {stats.total}
                        </h2>
                    </div>

                    <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                        <p className="text-sm font-medium text-blue-600">Assigned</p>
                        <h2 className="mt-2 text-3xl font-bold text-blue-700">
                            {stats.assigned}
                        </h2>
                    </div>

                    <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
                        <p className="text-sm font-medium text-red-600">Damaged</p>
                        <h2 className="mt-2 text-3xl font-bold text-red-700">
                            {stats.damaged}
                        </h2>
                    </div>

                    <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                        <p className="text-sm font-medium text-amber-600">Under Repair</p>
                        <h2 className="mt-2 text-3xl font-bold text-amber-700">
                            {stats.underRepair}
                        </h2>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-sm font-medium text-slate-500">Returned</p>
                        <h2 className="mt-2 text-3xl font-bold text-slate-700">
                            {stats.returned}
                        </h2>
                    </div>

                </div>

                {/* PRODUCT INVENTORY */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                    {/* SECTION HEADER */}
                    <div className="border-b border-slate-200 p-4 sm:p-5">

                        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">
                                    Product Inventory
                                </h2>

                                <p className="mt-1 text-xs text-slate-500">
                                    {departmentFilter
                                        ? 'Showing assets assigned to the selected department.'
                                        : 'Same products are grouped together with their individual assets.'}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <span className="rounded-lg bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700">
                                    {productStats.products} Products
                                </span>

                                <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                                    {productStats.assets} Assets
                                </span>
                            </div>
                        </div>

                        {/* SEARCH AND FILTERS */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search Product, Asset ID, Serial..."
                                className="w-full min-w-0 rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />

                            <select
                                value={departmentFilter}
                                onChange={handleDepartmentChange}
                                className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                            >
                                <option value="">All Departments</option>

                                {departments.map((department) => (
                                    <option key={department._id} value={department._id}>
                                        {department.name}
                                    </option>
                                ))}
                            </select>

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
                                    <option key={room._id} value={room._id}>
                                        {room.name}
                                        {room.roomNumber ? ` (${room.roomNumber})` : ''}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                            >
                                <option value="">All Statuses</option>

                                {(departmentFilter
                                    ? DEPARTMENT_ASSET_STATUSES
                                    : STATUSES
                                ).map((status) => (
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

                        {departmentFilter && (
                            <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                                Department view shows currently assigned, damaged and under-repair assets only.
                            </p>
                        )}

                    </div>

                    {/* PRODUCT CARD CONTENT */}
                    <div className="p-4 sm:p-5">

                        {loading && assets.length === 0 ? (
                            <div className="py-16 text-center">
                                <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                                <p className="text-sm text-slate-500">Loading assets...</p>
                            </div>
                        ) : groupedAssets.length === 0 ? (
                            <div className="py-16 text-center">
                                <div className="mb-4 text-5xl">📦</div>
                                <h3 className="font-bold text-slate-700">No Assets Found</h3>
                                <p className="mt-2 text-sm text-slate-400">
                                    {departmentFilter
                                        ? 'No currently assigned assets were found in this department.'
                                        : 'No assigned, damaged, under-repair or returned assets found.'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-700">
                                        Product Groups
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        Showing {groupedAssets.length} product(s) with {filteredAssets.length} asset(s)
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">

                                    {groupedAssets.map((group) => {
                                        const product = group.product;
                                        const productAssets = group.assets;
                                        const counts = getProductCounts(productAssets);

                                        return (
                                            <div
                                                key={group.key}
                                                className="group flex flex-col overflow-hidden rounded-2xl border border-orange-200 border-l-4 border-l-orange-500 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                                            >

                                                <div className="border-b border-slate-100 bg-gradient-to-r from-orange-50/70 to-white p-5">
                                                    <div className="mb-3 flex items-start justify-between gap-3">
                                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-2xl">
                                                            💻
                                                        </div>

                                                        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                                                            {productAssets.length} Asset{productAssets.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>

                                                    <h3 className="break-words text-lg font-bold text-blue-900">
                                                        {product.name}
                                                    </h3>

                                                    <p className="mt-1 text-sm text-slate-500">
                                                        {[product.brand, product.model].filter(Boolean).join(' / ') || 'No brand/model information'}
                                                    </p>

                                                    {product.sku && (
                                                        <p className="mt-2 inline-flex rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                                                            SKU: {product.sku}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* PRODUCT STATUS COUNTS */}
                                                <div className="grid grid-cols-2 gap-2 p-4">

                                                    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                                                        <p className="text-xs font-medium text-blue-600">Assigned</p>
                                                        <p className="mt-1 text-2xl font-bold text-blue-800">
                                                            {counts.assigned}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-xl border border-red-100 bg-red-50/70 p-3">
                                                        <p className="text-xs font-medium text-red-600">Damaged</p>
                                                        <p className="mt-1 text-2xl font-bold text-red-700">
                                                            {counts.damaged}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                                                        <p className="text-xs font-medium text-amber-600">Under Repair</p>
                                                        <p className="mt-1 text-2xl font-bold text-amber-700">
                                                            {counts.underRepair}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                        <p className="text-xs font-medium text-slate-500">Returned</p>
                                                        <p className="mt-1 text-2xl font-bold text-slate-700">
                                                            {counts.returned}
                                                        </p>
                                                    </div>

                                                </div>

                                                {/* ASSET PREVIEW */}
                                                <div className="flex-1 px-4 pb-4">
                                                    <div className="mb-3 flex items-center justify-between">
                                                        <h4 className="text-sm font-bold text-slate-700">Asset Preview</h4>
                                                        <span className="text-xs text-slate-400">Latest IDs</span>
                                                    </div>

                                                    <div className="space-y-2">
                                                        {productAssets.slice(0, 2).map((asset) => (
                                                            <div
                                                                key={asset._id}
                                                                className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <p className="min-w-0 break-all text-xs font-bold text-blue-700">
                                                                        {asset.assetId || 'No Asset ID'}
                                                                    </p>

                                                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${getStatusStyle(asset.status)}`}>
                                                                        {asset.status || 'Unknown'}
                                                                    </span>
                                                                </div>

                                                                <p className="mt-1 truncate text-xs text-slate-500">
                                                                    Serial: {asset.serialNumber || 'N/A'}
                                                                </p>
                                                            </div>
                                                        ))}

                                                        {productAssets.length > 2 && (
                                                            <p className="pt-1 text-center text-xs font-medium text-slate-400">
                                                                + {productAssets.length - 2} more asset(s)
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="border-t border-slate-100 bg-slate-50 p-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => openProductDetails(group)}
                                                        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                                                    >
                                                        View All Assets →
                                                    </button>
                                                </div>

                                            </div>
                                        );
                                    })}

                                </div>
                            </>
                        )}

                    </div>
                </div>

                {/* PRODUCT ASSET DETAILS MODAL */}
                {selectedProduct && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-5"
                        onClick={closeProductDetails}
                    >
                        <div
                            className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >

                            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-5">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold uppercase tracking-wider text-orange-600">
                                        Product Asset Details
                                    </p>

                                    <h2 className="mt-1 text-xl font-bold text-blue-900">
                                        {selectedProduct.product.name}
                                    </h2>

                                    <p className="mt-1 text-sm text-slate-500">
                                        {[selectedProduct.product.brand, selectedProduct.product.model].filter(Boolean).join(' / ') || 'Product information'}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={closeProductDetails}
                                    className="shrink-0 rounded-lg px-3 py-2 text-xl text-slate-500 hover:bg-red-50 hover:text-red-600"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50 p-5 sm:grid-cols-4">

                                <div className="rounded-xl border border-orange-200 bg-white p-3">
                                    <p className="text-xs text-slate-500">Total Assets</p>
                                    <p className="mt-1 text-2xl font-bold text-blue-800">
                                        {selectedProduct.assets.length}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-blue-100 bg-white p-3">
                                    <p className="text-xs text-blue-600">Assigned</p>
                                    <p className="mt-1 text-2xl font-bold text-blue-700">
                                        {getProductCounts(selectedProduct.assets).assigned}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-red-100 bg-white p-3">
                                    <p className="text-xs text-red-600">Damaged</p>
                                    <p className="mt-1 text-2xl font-bold text-red-700">
                                        {getProductCounts(selectedProduct.assets).damaged}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-amber-100 bg-white p-3">
                                    <p className="text-xs text-amber-600">Under Repair</p>
                                    <p className="mt-1 text-2xl font-bold text-amber-700">
                                        {getProductCounts(selectedProduct.assets).underRepair}
                                    </p>
                                </div>

                            </div>

                            <div className="p-4 sm:p-5">
                                <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-800">Individual Assets</h3>
                                        <p className="mt-1 text-xs text-slate-500">All assets belonging to this product.</p>
                                    </div>

                                    <span className="text-sm font-semibold text-slate-500">
                                        {selectedProduct.assets.length} asset(s)
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

                                    {selectedProduct.assets.map((asset, index) => (
                                        <div
                                            key={asset._id}
                                            className="rounded-xl border border-slate-200 border-l-4 border-l-orange-400 bg-white p-4 transition-colors hover:bg-slate-50"
                                        >

                                            <div className="mb-3 flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-slate-400">Asset #{index + 1}</p>
                                                    <p className="mt-1 break-all text-sm font-bold text-blue-700">
                                                        {asset.assetId || 'N/A'}
                                                    </p>
                                                </div>

                                                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${getStatusStyle(asset.status)}`}>
                                                    {asset.status || 'Unknown'}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <p className="text-xs text-slate-400">Serial Number</p>
                                                    <p className="mt-1 break-all text-sm font-semibold text-slate-700">
                                                        {asset.serialNumber || 'N/A'}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-slate-400">Assigned Date</p>
                                                    <p className="mt-1 text-sm font-semibold text-slate-700">
                                                        {formatDate(asset.assignedDate)}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-slate-400">Department</p>
                                                    <p className="mt-1 text-sm font-semibold text-slate-700">
                                                        {asset.department?.name || 'N/A'}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-slate-400">Room</p>
                                                    <p className="mt-1 text-sm font-semibold text-slate-700">
                                                        {asset.room?.name || 'N/A'}
                                                        {asset.room?.roomNumber ? ` (${asset.room.roomNumber})` : ''}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-4 border-t border-slate-100 pt-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedAsset(asset)}
                                                    className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                                                >
                                                    View Full Details & Manage
                                                </button>
                                            </div>

                                        </div>
                                    ))}

                                </div>
                            </div>

                            <div className="flex justify-end border-t border-slate-200 bg-slate-50 p-5">
                                <button
                                    type="button"
                                    onClick={closeProductDetails}
                                    className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                                >
                                    Close
                                </button>
                            </div>

                        </div>
                    </div>
                )}

                {/* INDIVIDUAL ASSET DETAILS MODAL */}
                {selectedAsset && (
                    <div
                        className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4"
                        onClick={() => setSelectedAsset(null)}
                    >
                        <div
                            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >

                            <div className="flex items-center justify-between border-b border-slate-200 p-5">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-orange-600">UMC IT ASSET</p>
                                    <h2 className="mt-1 text-xl font-bold text-blue-900">Asset Details</h2>
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

                                <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-4">
                                    <p className="text-xs font-medium text-slate-500">Asset ID</p>
                                    <p className="mt-1 break-all font-bold text-blue-700">
                                        {selectedAsset.assetId || 'N/A'}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">Status</p>
                                    <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(selectedAsset.status)}`}>
                                        {selectedAsset.status || 'Unknown'}
                                    </span>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">Asset Name</p>
                                    <p className="mt-1 font-semibold text-slate-800">
                                        {selectedAsset.name || selectedAsset.stockItem?.name || 'N/A'}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">Serial Number</p>
                                    <p className="mt-1 break-all font-semibold text-slate-800">
                                        {selectedAsset.serialNumber || 'N/A'}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">Brand</p>
                                    <p className="mt-1 font-semibold text-slate-800">
                                        {selectedAsset.brand || selectedAsset.stockItem?.brand || 'N/A'}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">Model</p>
                                    <p className="mt-1 font-semibold text-slate-800">
                                        {selectedAsset.model || selectedAsset.stockItem?.model || 'N/A'}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">SKU</p>
                                    <p className="mt-1 break-all font-semibold text-slate-800">
                                        {selectedAsset.sku || selectedAsset.stockItem?.sku || 'N/A'}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">Department</p>
                                    <p className="mt-1 font-semibold text-slate-800">
                                        {selectedAsset.department?.name || 'N/A'}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">Room</p>
                                    <p className="mt-1 font-semibold text-slate-800">
                                        {selectedAsset.room?.name || 'N/A'}
                                        {selectedAsset.room?.roomNumber ? ` (${selectedAsset.room.roomNumber})` : ''}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <p className="text-xs font-medium text-slate-500">Assigned Date</p>
                                    <p className="mt-1 font-semibold text-slate-800">
                                        {formatDate(selectedAsset.assignedDate)}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4 sm:col-span-2">
                                    <p className="text-xs font-medium text-slate-500">Description / Notes</p>
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                                        {selectedAsset.description || 'No additional notes.'}
                                    </p>
                                </div>

                            </div>

                            {/* DAMAGE AND REPAIR ACTIONS */}
                            <div className="border-t border-slate-200 bg-slate-50 p-5">
                                <h3 className="mb-3 text-sm font-bold text-slate-800">
                                    Damage & Repair Management
                                </h3>

                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">

                                    {selectedAsset.status === 'Assigned' && (
                                        <button
                                            type="button"
                                            onClick={() => openDamageForm(selectedAsset)}
                                            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                                        >
                                            Mark as Damaged
                                        </button>
                                    )}

                                    {['Assigned', 'Damaged'].includes(selectedAsset.status) && (
                                        <button
                                            type="button"
                                            onClick={() => openRepairForm(selectedAsset)}
                                            className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
                                        >
                                            Send to Repair
                                        </button>
                                    )}

                                    {selectedAsset.status === 'Under Repair' && (
                                        <button
                                            type="button"
                                            onClick={() => getActiveRepairId(selectedAsset)}
                                            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                                        >
                                            Complete Repair
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => openHistory(selectedAsset, 'repair')}
                                        className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                                    >
                                        Repair History
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => openHistory(selectedAsset, 'damage')}
                                        className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                                    >
                                        Damage History
                                    </button>

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

                {/* DAMAGE / REPAIR ACTION MODAL */}
                {actionType && actionAsset && (
                    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/70 p-4">
                        <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

                            <div className="flex items-center justify-between border-b border-slate-200 p-5">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-orange-600">
                                        Asset Management
                                    </p>

                                    <h2 className="mt-1 text-xl font-bold text-slate-800">
                                        {actionType === 'damage' && 'Mark Asset as Damaged'}
                                        {actionType === 'repair' && 'Send Asset to Repair'}
                                        {actionType === 'complete' && 'Complete Repair'}
                                    </h2>

                                    <p className="mt-1 text-xs text-slate-500">
                                        {actionAsset.assetId} · {actionAsset.serialNumber || 'No Serial Number'}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={resetActionForm}
                                    className="rounded-lg px-3 py-2 text-xl text-slate-500 hover:bg-slate-100"
                                >
                                    ×
                                </button>
                            </div>

                            <form onSubmit={submitAssetAction} className="space-y-4 p-5">

                                {actionError && (
                                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                        {actionError}
                                    </div>
                                )}

                                {actionType === 'damage' && (
                                    <>
                                        <div>
                                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                                                Damage Description *
                                            </label>
                                            <textarea
                                                required
                                                rows={4}
                                                value={damageDescription}
                                                onChange={(e) => setDamageDescription(e.target.value)}
                                                placeholder="Describe what happened to this asset..."
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-red-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                                                Additional Notes
                                            </label>
                                            <textarea
                                                rows={3}
                                                value={damageNotes}
                                                onChange={(e) => setDamageNotes(e.target.value)}
                                                placeholder="Optional notes..."
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-red-500"
                                            />
                                        </div>
                                    </>
                                )}

                                {actionType === 'repair' && (
                                    <>
                                        <div>
                                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                                                Problem / Issue Description *
                                            </label>
                                            <textarea
                                                required
                                                rows={3}
                                                value={issueDescription}
                                                onChange={(e) => setIssueDescription(e.target.value)}
                                                placeholder="Describe the problem..."
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                                                Repair Provider
                                            </label>
                                            <input
                                                value={repairProvider}
                                                onChange={(e) => setRepairProvider(e.target.value)}
                                                placeholder="Repair shop / company"
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                                                Technician
                                            </label>
                                            <input
                                                value={technician}
                                                onChange={(e) => setTechnician(e.target.value)}
                                                placeholder="Technician name"
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                                                Estimated Cost
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={estimatedCost}
                                                onChange={(e) => setEstimatedCost(e.target.value)}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                                                Notes
                                            </label>
                                            <textarea
                                                rows={2}
                                                value={repairNotes}
                                                onChange={(e) => setRepairNotes(e.target.value)}
                                                placeholder="Additional notes..."
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500"
                                            />
                                        </div>
                                    </>
                                )}

                                {actionType === 'complete' && (
                                    <>
                                        <div>
                                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                                                Repair Result *
                                            </label>
                                            <select
                                                value={repairResult}
                                                onChange={(e) => setRepairResult(e.target.value)}
                                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                                            >
                                                <option value="Successful">Successful - Return to Stock</option>
                                                <option value="Unsuccessful">Unsuccessful - Mark Damaged</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                                                Actual Repair Cost
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={actualCost}
                                                onChange={(e) => setActualCost(e.target.value)}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                                                Repair Result Notes
                                            </label>
                                            <textarea
                                                rows={3}
                                                value={resultNotes}
                                                onChange={(e) => setResultNotes(e.target.value)}
                                                placeholder="Describe the repair result..."
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                                            />
                                        </div>

                                        <div className={`rounded-lg p-3 text-sm ${
                                            repairResult === 'Successful'
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-red-50 text-red-700'
                                        }`}>
                                            {repairResult === 'Successful'
                                                ? 'Successful হলে Asset Available Stock-এ ফিরে যাবে।'
                                                : 'Unsuccessful হলে Asset Damaged অবস্থায় থাকবে।'}
                                        </div>
                                    </>
                                )}

                                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={resetActionForm}
                                        disabled={actionLoading}
                                        className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
                                            actionType === 'damage'
                                                ? 'bg-red-600 hover:bg-red-700'
                                                : actionType === 'repair'
                                                    ? 'bg-amber-500 hover:bg-amber-600'
                                                    : 'bg-emerald-600 hover:bg-emerald-700'
                                        }`}
                                    >
                                        {actionLoading ? 'Processing...' : 'Confirm'}
                                    </button>
                                </div>

                            </form>
                        </div>
                    </div>
                )}

                {/* REPAIR / DAMAGE HISTORY MODAL */}
                {historyType && historyAsset && (
                    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 p-4">
                        <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

                            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-5">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-orange-600">
                                        {historyAsset.assetId}
                                    </p>

                                    <h2 className="mt-1 text-xl font-bold text-slate-800">
                                        {historyType === 'repair' ? 'Repair History' : 'Damage History'}
                                    </h2>

                                    <p className="mt-1 text-xs text-slate-500">
                                        {historyAsset.name || historyAsset.stockItem?.name || 'Asset'}
                                        {' · '}
                                        Serial: {historyAsset.serialNumber || 'N/A'}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={closeHistory}
                                    className="rounded-lg px-3 py-2 text-xl text-slate-500 hover:bg-slate-100"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="p-5">

                                {historyLoading ? (
                                    <div className="py-12 text-center">
                                        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                                        <p className="text-sm text-slate-500">Loading history...</p>
                                    </div>
                                ) : historyError ? (
                                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                        {historyError}
                                    </div>
                                ) : historyType === 'repair' ? (
                                    repairHistory.length === 0 ? (
                                        <div className="py-12 text-center">
                                            <div className="mb-3 text-4xl">🛠️</div>
                                            <p className="font-semibold text-slate-700">No Repair History</p>
                                            <p className="mt-1 text-sm text-slate-400">
                                                No repair records found for this asset.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {repairHistory.map((repair) => (
                                                <div
                                                    key={repair._id}
                                                    className="rounded-xl border border-slate-200 p-4"
                                                >
                                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                        <div>
                                                            <p className="text-sm font-bold text-blue-700">
                                                                {repair.repairNumber || 'Repair Record'}
                                                            </p>
                                                            <p className="mt-1 text-xs text-slate-500">
                                                                Sent: {formatDateTime(repair.sentForRepairAt)}
                                                            </p>
                                                        </div>

                                                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                                                            repair.status === 'Successful'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : repair.status === 'Unsuccessful'
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {repair.status || 'Unknown'}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                                        <div>
                                                            <p className="text-xs text-slate-400">Problem Description</p>
                                                            <p className="mt-1 text-slate-700">{repair.issueDescription || 'N/A'}</p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-slate-400">Repair Provider</p>
                                                            <p className="mt-1 text-slate-700">{repair.repairProvider || 'N/A'}</p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-slate-400">Technician</p>
                                                            <p className="mt-1 text-slate-700">{repair.technician || 'N/A'}</p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-slate-400">Estimated Cost / Actual Cost</p>
                                                            <p className="mt-1 text-slate-700">
                                                                {repair.estimatedCost ?? 0} / {repair.actualCost ?? 0}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-slate-400">Completed At</p>
                                                            <p className="mt-1 text-slate-700">{formatDateTime(repair.completedAt)}</p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-slate-400">Result Notes</p>
                                                            <p className="mt-1 text-slate-700">{repair.resultNotes || 'N/A'}</p>
                                                        </div>
                                                    </div>

                                                    {repair.notes && (
                                                        <div className="mt-3 border-t border-slate-100 pt-3">
                                                            <p className="text-xs text-slate-400">Additional Notes</p>
                                                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{repair.notes}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )
                                ) : (
                                    damageHistory.length === 0 ? (
                                        <div className="py-12 text-center">
                                            <div className="mb-3 text-4xl">📋</div>
                                            <p className="font-semibold text-slate-700">No Damage History</p>
                                            <p className="mt-1 text-sm text-slate-400">
                                                No damage records found for this asset.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {damageHistory.map((damage) => (
                                                <div
                                                    key={damage._id}
                                                    className="rounded-xl border border-red-100 p-4"
                                                >
                                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                        <p className="text-sm font-bold text-red-700">
                                                            {damage.source || 'Damage Record'}
                                                        </p>

                                                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                                                            {damage.source === 'Repair Unsuccessful'
                                                                ? 'Repair Failed'
                                                                : 'Manual Damage'}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                                        <div>
                                                            <p className="text-xs text-slate-400">Damage Date</p>
                                                            <p className="mt-1 text-slate-700">{formatDateTime(damage.damagedAt)}</p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-slate-400">Previous Status</p>
                                                            <p className="mt-1 text-slate-700">{damage.previousStatus || 'N/A'}</p>
                                                        </div>

                                                        <div className="sm:col-span-2">
                                                            <p className="text-xs text-slate-400">Damage Description</p>
                                                            <p className="mt-1 whitespace-pre-wrap text-slate-700">
                                                                {damage.damageDescription || 'No description provided.'}
                                                            </p>
                                                        </div>

                                                        {damage.notes && (
                                                            <div className="sm:col-span-2">
                                                                <p className="text-xs text-slate-400">Notes</p>
                                                                <p className="mt-1 whitespace-pre-wrap text-slate-700">{damage.notes}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}

                            </div>

                            <div className="flex justify-end border-t border-slate-200 bg-slate-50 p-5">
                                <button
                                    type="button"
                                    onClick={closeHistory}
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
