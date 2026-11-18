
import { useState, useEffect, useMemo } from 'react';
import AdminSidebar from '../../components/AdminSidebar.jsx';

const API_URL = 'http://localhost:3001/api/assets';

// DAMAGE & REPAIR MANAGEMENT - Search: DAMAGE REPAIR MANAGEMENT

const DamageRepairManagement = () => {
    const [assets, setAssets] = useState([]);
    const [repairs, setRepairs] = useState([]);
    const [damageHistory, setDamageHistory] = useState([]);

    const [activeTab, setActiveTab] = useState('Damaged Devices');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const [selectedAsset, setSelectedAsset] = useState(null);
    const [selectedRepair, setSelectedRepair] = useState(null);

    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showActionModal, setShowActionModal] = useState(false);

    const [actionType, setActionType] = useState('');

    const [formData, setFormData] = useState({
        damageDescription: '',
        issueDescription: '',
        repairProvider: '',
        technician: '',
        estimatedCost: '0',
        actualCost: '0',
        status: 'Successful',
        notes: '',
        resultNotes: ''
    });

    // AUTH HEADERS
    const getHeaders = () => {
        const token = localStorage.getItem('pos-token');

        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        };
    };

    // API RESPONSE HELPER
    const getResponseData = (data, keys = []) => {
        if (Array.isArray(data)) return data;

        for (const key of keys) {
            if (Array.isArray(data?.[key])) {
                return data[key];
            }
        }

        return [];
    };

    // FETCH ALL MANAGEMENT DATA
    const fetchAllData = async () => {
        setLoading(true);
        setError('');

        try {
            const headers = getHeaders();

            const [
                assetsResponse,
                repairsResponse,
                damageResponse
            ] = await Promise.all([
                fetch(API_URL, { headers }),
                fetch(`${API_URL}/repair/history`, { headers }),
                fetch(`${API_URL}/damage/history`, { headers })
            ]);

            const assetsData = await assetsResponse.json();
            const repairsData = await repairsResponse.json();
            const damageData = await damageResponse.json();

            if (!assetsResponse.ok) {
                throw new Error(
                    assetsData.message || 'Failed to load assets'
                );
            }

            if (!repairsResponse.ok) {
                throw new Error(
                    repairsData.message || 'Failed to load repair history'
                );
            }

            if (!damageResponse.ok) {
                throw new Error(
                    damageData.message || 'Failed to load damage history'
                );
            }

            setAssets(getResponseData(assetsData, ['assets', 'data']));
            setRepairs(getResponseData(repairsData, ['repairs', 'data']));
            setDamageHistory(
                getResponseData(damageData, ['damageHistory', 'data'])
            );

        } catch (err) {
            console.error('Damage & Repair Fetch Error:', err);
            setError(err.message || 'Failed to load management data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // FORMAT DATE
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

    // FORMAT CURRENCY
    const formatCurrency = (amount) => {
        return `৳ ${Number(amount || 0).toLocaleString('en-BD')}`;
    };

    // GET STOCK UNIT
    const getStockUnit = (asset) => {
        if (!asset) return null;

        return typeof asset.stockUnit === 'object'
            ? asset.stockUnit
            : null;
    };

    // GET PRODUCT NAME
    const getProductName = (asset) => {
        const stockUnit = getStockUnit(asset);

        return (
            asset?.stockItem?.name ||
            stockUnit?.stockItem?.name ||
            asset?.productName ||
            asset?.name ||
            'Unknown Product'
        );
    };

    // GET SERIAL NUMBER
    const getSerialNumber = (asset) => {
        const stockUnit = getStockUnit(asset);

        return (
            stockUnit?.serialNumber ||
            asset?.serialNumber ||
            stockUnit?.unitCode ||
            asset?.assetId ||
            'N/A'
        );
    };

    // GET UNIT CODE
    const getUnitCode = (asset) => {
        const stockUnit = getStockUnit(asset);

        return (
            stockUnit?.unitCode ||
            asset?.unitCode ||
            'N/A'
        );
    };

    // GET DEPARTMENT
    const getDepartment = (asset) => {
        if (!asset?.department) return 'N/A';

        return typeof asset.department === 'object'
            ? asset.department.name || 'N/A'
            : 'N/A';
    };

    // GET ROOM
    const getRoom = (asset) => {
        if (!asset?.room) return 'N/A';

        return typeof asset.room === 'object'
            ? asset.room.name || asset.room.roomNumber || 'N/A'
            : 'N/A';
    };

    // GET ASSET ID
    const getAssetId = (asset) => {
        return asset?.assetId || 'N/A';
    };

    // GET ASSET REFERENCE ID
    const getAssetReference = (asset) => {
        return asset?._id || asset?.id;
    };

    // GET RELATED REPAIR
    const getActiveRepair = (asset) => {
        return repairs.find((repair) => {
            const repairAssetId =
                typeof repair.asset === 'object'
                    ? repair.asset?._id
                    : repair.asset;

            return (
                repairAssetId === getAssetReference(asset) &&
                repair.status === 'In Progress'
            );
        });
    };

    // STATUS BADGE
    const getStatusBadge = (status) => {
        const styles = {
            Assigned: 'bg-blue-50 text-blue-700 border-blue-200',
            Available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            Damaged: 'bg-red-50 text-red-700 border-red-200',
            'Under Repair': 'bg-amber-50 text-amber-700 border-amber-200',
            'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
            Successful: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            Unsuccessful: 'bg-red-50 text-red-700 border-red-200',
            Returned: 'bg-slate-100 text-slate-700 border-slate-200'
        };

        return (
            <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                    styles[status] || 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
            >
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                {status || 'Unknown'}
            </span>
        );
    };

    // TAB DATA
    const tabs = [
        {
            name: 'Damaged Devices',
            icon: '⚠',
            color: 'text-red-600',
            count: assets.filter((asset) => asset.status === 'Damaged').length
        },
        {
            name: 'Assigned Devices',
            icon: '▣',
            color: 'text-blue-600',
            count: assets.filter((asset) => asset.status === 'Assigned').length
        },
        {
            name: 'Repair In Progress',
            icon: '🔧',
            color: 'text-amber-600',
            count: assets.filter((asset) => asset.status === 'Under Repair').length
        },
        {
            name: 'Repair History',
            icon: '📋',
            color: 'text-emerald-600',
            count: repairs.length
        },
        {
            name: 'Damage History',
            icon: '📁',
            color: 'text-slate-600',
            count: damageHistory.length
        }
    ];

    // FILTERED DATA
    const filteredData = useMemo(() => {
        const search = searchTerm.toLowerCase().trim();

        let data = [];

        if (activeTab === 'Damaged Devices') {
            data = assets.filter(
                (asset) => asset.status === 'Damaged'
            );
        }

        if (activeTab === 'Assigned Devices') {
            data = assets.filter(
                (asset) => asset.status === 'Assigned'
            );
        }

        if (activeTab === 'Repair In Progress') {
            data = assets.filter(
                (asset) => asset.status === 'Under Repair'
            );
        }

        if (activeTab === 'Repair History') {
            data = repairs;
        }

        if (activeTab === 'Damage History') {
            data = damageHistory;
        }

        if (!search) return data;

        return data.filter((item) => {
            const asset =
                activeTab === 'Repair History' ||
                activeTab === 'Damage History'
                    ? item.asset
                    : item;

            const assetObject =
                typeof asset === 'object' ? asset : null;

            const productName = getProductName(assetObject).toLowerCase();

            const assetId = (
                assetObject?.assetId || ''
            ).toLowerCase();

            const serialNumber = getSerialNumber(assetObject).toLowerCase();

            const unitCode = getUnitCode(assetObject).toLowerCase();

            const repairNumber = (
                item.repairNumber || ''
            ).toLowerCase();

            const description = (
                item.issueDescription ||
                item.damageDescription ||
                ''
            ).toLowerCase();

            return (
                productName.includes(search) ||
                assetId.includes(search) ||
                serialNumber.includes(search) ||
                unitCode.includes(search) ||
                repairNumber.includes(search) ||
                description.includes(search)
            );
        });
    }, [
        assets,
        repairs,
        damageHistory,
        activeTab,
        searchTerm
    ]);

    // DASHBOARD STATISTICS
    const totalDamaged = assets.filter(
        (asset) => asset.status === 'Damaged'
    ).length;

    const totalUnderRepair = assets.filter(
        (asset) => asset.status === 'Under Repair'
    ).length;

    const totalSuccessful = repairs.filter(
        (repair) => repair.status === 'Successful'
    ).length;

    const totalUnsuccessful = repairs.filter(
        (repair) => repair.status === 'Unsuccessful'
    ).length;

    // RESET FORM
    const resetForm = () => {
        setFormData({
            damageDescription: '',
            issueDescription: '',
            repairProvider: '',
            technician: '',
            estimatedCost: '0',
            actualCost: '0',
            status: 'Successful',
            notes: '',
            resultNotes: ''
        });
    };

    // OPEN DETAILS
    const openDetails = (asset) => {
        setSelectedAsset(asset);
        setShowDetailsModal(true);
    };

    // CLOSE DETAILS
    const closeDetails = () => {
        setSelectedAsset(null);
        setShowDetailsModal(false);
    };

    // OPEN DAMAGE MODAL
    const openDamageModal = (asset) => {
        setSelectedAsset(asset);
        setSelectedRepair(null);
        setActionType('damage');
        resetForm();
        setShowActionModal(true);
    };

    // OPEN REPAIR MODAL
    const openRepairModal = (asset) => {
        setSelectedAsset(asset);
        setSelectedRepair(null);
        setActionType('repair');
        resetForm();
        setShowActionModal(true);
    };

    // OPEN COMPLETE REPAIR MODAL
    const openCompleteRepairModal = (asset) => {
        const repair = getActiveRepair(asset);

        if (!repair) {
            setError('Active repair record was not found for this asset.');
            return;
        }

        setSelectedAsset(asset);
        setSelectedRepair(repair);
        setActionType('complete');
        resetForm();
        setShowActionModal(true);
    };

    // CLOSE ACTION MODAL
    const closeActionModal = () => {
        if (submitting) return;

        setShowActionModal(false);
        setSelectedAsset(null);
        setSelectedRepair(null);
        setActionType('');
        resetForm();
    };

    // HANDLE INPUT
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value
        }));
    };

    // SUBMIT ACTION
    const handleSubmitAction = async (e) => {
        e.preventDefault();

        if (!selectedAsset) return;

        setSubmitting(true);
        setError('');
        setSuccessMessage('');

        try {
            const headers = getHeaders();

            let url = '';
            let method = '';
            let payload = {};

            if (actionType === 'damage') {
                url = `${API_URL}/${getAssetReference(selectedAsset)}/damage`;
                method = 'PATCH';

                payload = {
                    damageDescription: formData.damageDescription.trim(),
                    notes: formData.notes.trim()
                };

            } else if (actionType === 'repair') {
                if (!formData.issueDescription.trim()) {
                    throw new Error('Please enter the repair issue description.');
                }

                url = `${API_URL}/${getAssetReference(selectedAsset)}/repair`;
                method = 'POST';

                payload = {
                    issueDescription: formData.issueDescription.trim(),
                    repairProvider: formData.repairProvider.trim(),
                    technician: formData.technician.trim(),
                    estimatedCost: Number(formData.estimatedCost || 0),
                    notes: formData.notes.trim()
                };

            } else if (actionType === 'complete') {
                if (!selectedRepair?._id) {
                    throw new Error('Repair record not found.');
                }

                url = `${API_URL}/repair/${selectedRepair._id}/complete`;
                method = 'PATCH';

                payload = {
                    status: formData.status,
                    actualCost: Number(formData.actualCost || 0),
                    resultNotes: formData.resultNotes.trim()
                };
            }

            const response = await fetch(url, {
                method,
                headers,
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || 'Action could not be completed.'
                );
            }

            setSuccessMessage(
                result.message || 'Operation completed successfully.'
            );

            setShowActionModal(false);
            setSelectedAsset(null);
            setSelectedRepair(null);
            setActionType('');
            resetForm();

            await fetchAllData();

        } catch (err) {
            console.error('Damage & Repair Action Error:', err);
            setError(err.message || 'Something went wrong.');
        } finally {
            setSubmitting(false);
        }
    };

    // GET HISTORY FOR ASSET
    const getAssetRepairHistory = (asset) => {
        const assetId = getAssetReference(asset);

        return repairs.filter((repair) => {
            const repairAssetId =
                typeof repair.asset === 'object'
                    ? repair.asset?._id
                    : repair.asset;

            return repairAssetId === assetId;
        });
    };

    const getAssetDamageHistory = (asset) => {
        const assetId = getAssetReference(asset);

        return damageHistory.filter((damage) => {
            const damageAssetId =
                typeof damage.asset === 'object'
                    ? damage.asset?._id
                    : damage.asset;

            return damageAssetId === assetId;
        });
    };

    // TABLE ACTIONS
    const renderActions = (asset) => (
        <div className="flex flex-wrap items-center gap-2">
            <button
                type="button"
                onClick={() => openDetails(asset)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
                View Details
            </button>

            {asset.status === 'Assigned' && (
                <>
                    <button
                        type="button"
                        onClick={() => openDamageModal(asset)}
                        className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                    >
                        Mark Damaged
                    </button>

                    <button
                        type="button"
                        onClick={() => openRepairModal(asset)}
                        className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                        Send to Repair
                    </button>
                </>
            )}

            {asset.status === 'Damaged' && (
                <button
                    type="button"
                    onClick={() => openRepairModal(asset)}
                    className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                >
                    Send to Repair
                </button>
            )}

            {asset.status === 'Under Repair' && (
                <button
                    type="button"
                    onClick={() => openCompleteRepairModal(asset)}
                    className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                    Complete Repair
                </button>
            )}
        </div>
    );

    // ASSET TABLE
    const renderAssetTable = () => (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left">
                <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-4 font-bold">Product</th>
                        <th className="px-5 py-4 font-bold">Asset ID</th>
                        <th className="px-5 py-4 font-bold">Serial / Unit Code</th>
                        <th className="px-5 py-4 font-bold">Department</th>
                        <th className="px-5 py-4 font-bold">Room</th>
                        <th className="px-5 py-4 font-bold">Status</th>
                        <th className="px-5 py-4 font-bold">Actions</th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                    {filteredData.map((asset) => (
                        <tr
                            key={asset._id}
                            className="transition hover:bg-blue-50/30"
                        >
                            <td className="px-5 py-4">
                                <p className="font-semibold text-slate-800">
                                    {getProductName(asset)}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-400">
                                    Device information
                                </p>
                            </td>

                            <td className="px-5 py-4">
                                <span className="font-mono text-xs font-semibold text-blue-700">
                                    {getAssetId(asset)}
                                </span>
                            </td>

                            <td className="px-5 py-4">
                                <p className="text-xs font-medium text-slate-700">
                                    {getSerialNumber(asset)}
                                </p>
                                <p className="mt-1 font-mono text-[10px] text-slate-400">
                                    {getUnitCode(asset)}
                                </p>
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-600">
                                {getDepartment(asset)}
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-600">
                                {getRoom(asset)}
                            </td>

                            <td className="px-5 py-4">
                                {getStatusBadge(asset.status)}
                            </td>

                            <td className="px-5 py-4">
                                {renderActions(asset)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {filteredData.length === 0 && (
                <div className="px-6 py-16 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                        📂
                    </div>
                    <h3 className="font-bold text-slate-700">
                        No Records Found
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                        {searchTerm
                            ? 'No matching devices found. Try another search.'
                            : 'There are currently no devices in this section.'}
                    </p>
                </div>
            )}
        </div>
    );

    // HISTORY TABLE
    const renderHistoryTable = () => (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
                <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-4 font-bold">Product / Asset</th>
                        <th className="px-5 py-4 font-bold">
                            {activeTab === 'Repair History'
                                ? 'Repair Number'
                                : 'Damage Source'}
                        </th>
                        <th className="px-5 py-4 font-bold">Description</th>
                        <th className="px-5 py-4 font-bold">Date</th>
                        <th className="px-5 py-4 font-bold">Status</th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                    {filteredData.map((item) => {
                        const asset =
                            typeof item.asset === 'object'
                                ? item.asset
                                : null;

                        const status =
                            activeTab === 'Repair History'
                                ? item.status
                                : item.source;

                        return (
                            <tr
                                key={item._id}
                                className="transition hover:bg-blue-50/30"
                            >
                                <td className="px-5 py-4">
                                    <p className="font-semibold text-slate-800">
                                        {getProductName(asset)}
                                    </p>
                                    <p className="mt-1 font-mono text-xs text-blue-700">
                                        {getAssetId(asset)}
                                    </p>
                                </td>

                                <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                                    {activeTab === 'Repair History'
                                        ? item.repairNumber
                                        : item.source}
                                </td>

                                <td className="max-w-xs px-5 py-4 text-xs leading-5 text-slate-600">
                                    {item.issueDescription ||
                                        item.damageDescription ||
                                        item.resultNotes ||
                                        'N/A'}
                                </td>

                                <td className="px-5 py-4 text-xs text-slate-600">
                                    {formatDate(
                                        activeTab === 'Repair History'
                                            ? item.sentForRepairAt
                                            : item.damagedAt
                                    )}
                                </td>

                                <td className="px-5 py-4">
                                    {getStatusBadge(status)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {filteredData.length === 0 && (
                <div className="px-6 py-16 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                        📋
                    </div>
                    <h3 className="font-bold text-slate-700">
                        No History Found
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                        {searchTerm
                            ? 'No matching history records found.'
                            : 'No history records are available yet.'}
                    </p>
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100">
            <AdminSidebar />

            <main className="min-h-screen lg:ml-64">
                <div className="p-4 pt-20 sm:p-6 lg:p-8 lg:pt-8">

                    {/* PAGE HEADER */}
                    <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                        <div>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">
                                UMC IT INVENTORY SYSTEM
                            </p>

                            <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                                Damage & Repair Management
                            </h1>

                            <p className="mt-2 text-sm text-slate-500">
                                Monitor damaged devices, manage repairs and review service history.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={fetchAllData}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 rounded-xl bg-[#101d36] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <span className="text-lg">↻</span>
                            Refresh Data
                        </button>
                    </div>

                    {/* SUCCESS MESSAGE */}
                    {successMessage && (
                        <div className="mb-5 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 font-bold">
                                    ✓
                                </span>
                                <span>{successMessage}</span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSuccessMessage('')}
                                className="rounded-lg px-2 py-1 font-bold hover:bg-emerald-100"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* ERROR MESSAGE */}
                    {error && (
                        <div className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 font-bold">
                                    !
                                </span>
                                <span>{error}</span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setError('')}
                                className="rounded-lg px-2 py-1 font-bold hover:bg-red-100"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* STATISTICS */}
                    <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

                        {/* TOTAL DAMAGED */}
                        <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">
                                        Total Damaged
                                    </p>
                                    <h2 className="mt-2 text-3xl font-bold text-red-600">
                                        {totalDamaged}
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-400">
                                        Devices requiring attention
                                    </p>
                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-2xl">
                                    ⚠
                                </div>
                            </div>
                        </div>

                        {/* UNDER REPAIR */}
                        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">
                                        Under Repair
                                    </p>
                                    <h2 className="mt-2 text-3xl font-bold text-amber-600">
                                        {totalUnderRepair}
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-400">
                                        Currently being repaired
                                    </p>
                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-2xl">
                                    🔧
                                </div>
                            </div>
                        </div>

                        {/* SUCCESSFUL REPAIR */}
                        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">
                                        Successful Repair
                                    </p>
                                    <h2 className="mt-2 text-3xl font-bold text-emerald-600">
                                        {totalSuccessful}
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-400">
                                        Repairs completed successfully
                                    </p>
                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-2xl">
                                    ✓
                                </div>
                            </div>
                        </div>

                        {/* UNSUCCESSFUL REPAIR */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">
                                        Unsuccessful Repair
                                    </p>
                                    <h2 className="mt-2 text-3xl font-bold text-slate-700">
                                        {totalUnsuccessful}
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-400">
                                        Repairs not completed successfully
                                    </p>
                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                                    ✕
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MAIN MANAGEMENT PANEL */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                        {/* PANEL HEADER */}
                        <div className="border-b border-slate-200 p-5 sm:p-6">
                            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">
                                        Device Management
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Select a section to manage devices and view records.
                                    </p>
                                </div>

                                <div className="relative w-full lg:max-w-sm">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                                        ⌕
                                    </span>

                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search product, Asset ID, serial..."
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-10 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50"
                                    />

                                    {searchTerm && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm font-bold text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* TABS */}
                            <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.name}
                                        type="button"
                                        onClick={() => {
                                            setActiveTab(tab.name);
                                            setSearchTerm('');
                                        }}
                                        className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left text-xs font-semibold transition sm:px-4 sm:text-sm ${
                                            activeTab === tab.name
                                                ? 'border-[#101d36] bg-[#101d36] text-white shadow-sm'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50'
                                        }`}
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            <span className="text-base">
                                                {tab.icon}
                                            </span>
                                            <span className="truncate">
                                                {tab.name}
                                            </span>
                                        </span>

                                        <span
                                            className={`flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                                                activeTab === tab.name
                                                    ? 'bg-white/15 text-white'
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}
                                        >
                                            {tab.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* TABLE HEADER */}
                        <div className="flex flex-col justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center">
                            <div>
                                <h3 className="font-bold text-slate-800">
                                    {activeTab}
                                </h3>
                                <p className="mt-1 text-xs text-slate-500">
                                    {filteredData.length} record(s) found
                                    {searchTerm ? ' for your search' : ''}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">
                                    {activeTab}
                                </span>
                            </div>
                        </div>

                        {/* TABLE CONTENT */}
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
                                <p className="mt-4 text-sm font-medium text-slate-600">
                                    Loading management data...
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    Please wait a moment
                                </p>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'Repair History' ||
                                activeTab === 'Damage History'
                                    ? renderHistoryTable()
                                    : renderAssetTable()}
                            </>
                        )}
                    </div>

                    {/* FOOTER NOTE */}
                    <div className="mt-5 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">
                                UMC IT Inventory
                            </span>
                            {' '}· Damage & Repair Management
                        </p>

                        <p className="text-xs text-slate-400">
                            Use Refresh Data to load the latest records.
                        </p>
                    </div>
                </div>
            </main>

            {/* DETAILS MODAL */}
            {showDetailsModal && selectedAsset && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-[2px]"
                    onClick={closeDetails}
                >
                    <div
                        className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between bg-[#101d36] px-6 py-5 text-white">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">
                                    Device Information
                                </p>
                                <h2 className="mt-1 text-lg font-bold">
                                    Device Details
                                </h2>
                                <p className="mt-1 font-mono text-xs text-blue-200">
                                    {getAssetId(selectedAsset)}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeDetails}
                                className="rounded-lg px-3 py-2 text-xl text-white transition hover:bg-white/10"
                            >
                                ×
                            </button>
                        </div>

                        <div className="max-h-[75vh] space-y-6 overflow-y-auto p-5 sm:p-6">

                            {/* DEVICE INFORMATION */}
                            <div>
                                <h3 className="mb-3 text-sm font-bold text-slate-800">
                                    General Information
                                </h3>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {[
                                        ['Product Name', getProductName(selectedAsset)],
                                        ['Asset ID', getAssetId(selectedAsset)],
                                        ['Serial Number', getSerialNumber(selectedAsset)],
                                        ['Unit Code', getUnitCode(selectedAsset)],
                                        ['Department', getDepartment(selectedAsset)],
                                        ['Room', getRoom(selectedAsset)],
                                        ['Status', selectedAsset.status || 'N/A'],
                                        ['Assigned Date', formatDate(selectedAsset.assignedDate)]
                                    ].map(([label, value]) => (
                                        <div
                                            key={label}
                                            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                                        >
                                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                                {label}
                                            </p>
                                            <p className="mt-2 break-words text-sm font-semibold text-slate-800">
                                                {value}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* REPAIR HISTORY */}
                            <div>
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-slate-800">
                                        Repair History
                                    </h3>
                                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                        {getAssetRepairHistory(selectedAsset).length} Record(s)
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {getAssetRepairHistory(selectedAsset).map((repair) => (
                                        <div
                                            key={repair._id}
                                            className="rounded-xl border border-slate-200 p-4"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="font-mono text-xs font-bold text-blue-700">
                                                    {repair.repairNumber}
                                                </p>
                                                {getStatusBadge(repair.status)}
                                            </div>

                                            <p className="mt-3 text-sm leading-6 text-slate-700">
                                                {repair.issueDescription}
                                            </p>

                                            <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 sm:grid-cols-2">
                                                <p>
                                                    <span className="font-semibold text-slate-700">Sent:</span>
                                                    {' '}{formatDate(repair.sentForRepairAt)}
                                                </p>
                                                <p>
                                                    <span className="font-semibold text-slate-700">Completed:</span>
                                                    {' '}{formatDate(repair.completedAt)}
                                                </p>
                                                <p>
                                                    <span className="font-semibold text-slate-700">Provider:</span>
                                                    {' '}{repair.repairProvider || 'N/A'}
                                                </p>
                                                <p>
                                                    <span className="font-semibold text-slate-700">Actual Cost:</span>
                                                    {' '}{formatCurrency(repair.actualCost)}
                                                </p>
                                            </div>

                                            {repair.resultNotes && (
                                                <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                                                    {repair.resultNotes}
                                                </p>
                                            )}
                                        </div>
                                    ))}

                                    {getAssetRepairHistory(selectedAsset).length === 0 && (
                                        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                                            No repair history found.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* DAMAGE HISTORY */}
                            <div>
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-slate-800">
                                        Damage History
                                    </h3>
                                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                                        {getAssetDamageHistory(selectedAsset).length} Record(s)
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {getAssetDamageHistory(selectedAsset).map((damage) => (
                                        <div
                                            key={damage._id}
                                            className="rounded-xl border border-red-100 bg-red-50/40 p-4"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="text-xs font-bold text-red-700">
                                                    {damage.source}
                                                </p>
                                                <span className="text-xs text-slate-500">
                                                    {formatDate(damage.damagedAt)}
                                                </span>
                                            </div>

                                            <p className="mt-2 text-sm leading-6 text-slate-700">
                                                {damage.damageDescription || 'No description provided.'}
                                            </p>
                                        </div>
                                    ))}

                                    {getAssetDamageHistory(selectedAsset).length === 0 && (
                                        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                                            No damage history found.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end border-t border-slate-200 bg-slate-50/70 p-5">
                            <button
                                type="button"
                                onClick={closeDetails}
                                className="rounded-xl bg-[#101d36] px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-900"
                            >
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ACTION MODAL */}
            {showActionModal && selectedAsset && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-[2px]"
                    onClick={closeActionModal}
                >
                    <div
                        className="my-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between bg-[#101d36] px-6 py-5 text-white">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">
                                    Damage & Repair Action
                                </p>

                                <h2 className="mt-1 text-lg font-bold">
                                    {actionType === 'damage'
                                        ? 'Mark Device as Damaged'
                                        : actionType === 'repair'
                                            ? 'Send Device for Repair'
                                            : 'Complete Repair'}
                                </h2>

                                <p className="mt-1 text-xs text-blue-200">
                                    {getAssetId(selectedAsset)} · {getProductName(selectedAsset)}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeActionModal}
                                className="rounded-lg px-3 py-2 text-xl text-white transition hover:bg-white/10"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmitAction}>
                            <div className="max-h-[65vh] space-y-5 overflow-y-auto p-6">

                                {/* DAMAGE FORM */}
                                {actionType === 'damage' && (
                                    <>
                                        <div>
                                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                                Damage Description
                                            </label>

                                            <textarea
                                                name="damageDescription"
                                                value={formData.damageDescription}
                                                onChange={handleInputChange}
                                                rows="4"
                                                placeholder="Describe the damage..."
                                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                                Additional Notes
                                            </label>

                                            <textarea
                                                name="notes"
                                                value={formData.notes}
                                                onChange={handleInputChange}
                                                rows="3"
                                                placeholder="Additional notes..."
                                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                                            />
                                        </div>

                                        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs leading-5 text-red-700">
                                            This action will change the Asset and linked StockUnit status to Damaged.
                                        </div>
                                    </>
                                )}

                                {/* SEND REPAIR FORM */}
                                {actionType === 'repair' && (
                                    <>
                                        <div>
                                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                                Issue Description *
                                            </label>

                                            <textarea
                                                name="issueDescription"
                                                value={formData.issueDescription}
                                                onChange={handleInputChange}
                                                rows="3"
                                                required
                                                placeholder="Describe the problem..."
                                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                                Repair Provider
                                            </label>

                                            <input
                                                type="text"
                                                name="repairProvider"
                                                value={formData.repairProvider}
                                                onChange={handleInputChange}
                                                placeholder="Repair company / provider"
                                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                                Technician
                                            </label>

                                            <input
                                                type="text"
                                                name="technician"
                                                value={formData.technician}
                                                onChange={handleInputChange}
                                                placeholder="Technician name"
                                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                                Estimated Cost (৳)
                                            </label>

                                            <input
                                                type="number"
                                                name="estimatedCost"
                                                min="0"
                                                value={formData.estimatedCost}
                                                onChange={handleInputChange}
                                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                                Notes
                                            </label>

                                            <textarea
                                                name="notes"
                                                value={formData.notes}
                                                onChange={handleInputChange}
                                                rows="2"
                                                placeholder="Additional notes..."
                                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                                            />
                                        </div>

                                        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs leading-5 text-amber-700">
                                            The same Asset and StockUnit will be moved to Under Repair. No new record will be created.
                                        </div>
                                    </>
                                )}

                                {/* COMPLETE REPAIR FORM */}
                                {actionType === 'complete' && (
                                    <>
                                        <div>
                                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                                Repair Result *
                                            </label>

                                            <select
                                                name="status"
                                                value={formData.status}
                                                onChange={handleInputChange}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                                            >
                                                <option value="Successful">
                                                    Successful - Return to Available Inventory
                                                </option>

                                                <option value="Unsuccessful">
                                                    Unsuccessful - Keep as Damaged
                                                </option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                                Actual Repair Cost (৳)
                                            </label>

                                            <input
                                                type="number"
                                                name="actualCost"
                                                min="0"
                                                value={formData.actualCost}
                                                onChange={handleInputChange}
                                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                                Result Notes
                                            </label>

                                            <textarea
                                                name="resultNotes"
                                                value={formData.resultNotes}
                                                onChange={handleInputChange}
                                                rows="3"
                                                placeholder="Repair result details..."
                                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                                            />
                                        </div>

                                        <div className={`rounded-xl p-4 text-xs leading-5 ${
                                            formData.status === 'Successful'
                                                ? 'border border-emerald-100 bg-emerald-50 text-emerald-700'
                                                : 'border border-red-100 bg-red-50 text-red-700'
                                        }`}>
                                            {formData.status === 'Successful'
                                                ? 'Successful repair: the same StockUnit will return to Available Inventory.'
                                                : 'Unsuccessful repair: the same Asset and StockUnit will remain Damaged.'}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* MODAL FOOTER */}
                            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/70 p-5 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closeActionModal}
                                    disabled={submitting}
                                    className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`rounded-xl px-6 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                        actionType === 'damage'
                                            ? 'bg-red-600 hover:bg-red-700'
                                            : actionType === 'repair'
                                                ? 'bg-amber-600 hover:bg-amber-700'
                                                : 'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                                >
                                    {submitting
                                        ? 'Processing...'
                                        : actionType === 'damage'
                                            ? 'Confirm Damage'
                                            : actionType === 'repair'
                                                ? 'Send for Repair'
                                                : 'Complete Repair'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DamageRepairManagement;
