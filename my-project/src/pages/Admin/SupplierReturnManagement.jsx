import { useState, useEffect, useMemo } from 'react';
import AdminSidebar from '../../components/AdminSidebar.jsx';

// SUPPLIER RETURN MANAGEMENT - Search: SUPPLIER RETURN MANAGEMENT

const API_URL = 'http://localhost:3001/api/supplier-returns';
const SUPPLIER_API_URL = 'http://localhost:3001/api/suppliers';

const getHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('pos-token')}`
});

// GET ARRAY FROM API RESPONSE
const getResponseList = (data, key) => {
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data?.[key])) return data.data[key];
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data)) return data;
    return [];
};

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

// FORMAT DATE FOR INPUT
const getToday = () => {
    const date = new Date();
    const offset = date.getTimezoneOffset() * 60000;

    return new Date(date.getTime() - offset)
        .toISOString()
        .slice(0, 10);
};

// GET RELATION NAME
const getRelationName = (value) => {
    if (!value) return 'N/A';

    if (typeof value === 'object') {
        return value.name || value.companyName || 'N/A';
    }

    return 'N/A';
};

// GET STATUS STYLE
const getStatusStyle = (status) => {
    switch (status) {
        case 'Completed':
        case 'Available':
            return 'bg-emerald-100 text-emerald-700';

        case 'Cancelled':
        case 'Damaged':
            return 'bg-red-100 text-red-700';

        case 'Assigned':
            return 'bg-blue-100 text-blue-700';

        case 'Under Repair':
            return 'bg-orange-100 text-orange-700';

        case 'Returned':
            return 'bg-slate-200 text-slate-700';

        default:
            return 'bg-slate-100 text-slate-700';
    }
};

// ESCAPE HTML FOR PRINT DOCUMENT
const escapeHtml = (value) => {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[character]);
};

const SupplierReturnManagement = () => {

    // HISTORY STATES
    const [returns, setReturns] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [supplierFilter, setSupplierFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [historyTotal, setHistoryTotal] = useState(0);

    // CREATE FORM STATES
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [returnDetails, setReturnDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState('');

    // CREATE RETURN STATES
    const [skuSearch, setSkuSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [returnDate, setReturnDate] = useState(getToday());
    const [returnReason, setReturnReason] = useState('');
    const [notes, setNotes] = useState('');

    // DEVICE SELECTION STATES
    const [stockUnits, setStockUnits] = useState([]);
    const [deviceLoading, setDeviceLoading] = useState(false);
    const [deviceError, setDeviceError] = useState('');
    const [selectedUnitIds, setSelectedUnitIds] = useState([]);

    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // AUTO MATCH SUPPLIER FROM PRODUCT SUPPLIER NAME
    const selectedSupplier = suppliers.find(
        (supplier) =>
            supplier.companyName?.trim().toLowerCase() ===
            selectedProduct?.supplierName?.trim().toLowerCase()
    );

    // LOAD SUPPLIERS
    const fetchSuppliers = async () => {
        try {
            const response = await fetch(
                `${SUPPLIER_API_URL}?status=all&limit=100`,
                {
                    method: 'GET',
                    headers: getHeaders(),
                    cache: 'no-store'
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to load suppliers.');
            }

            const supplierList = getResponseList(data, 'suppliers');

            setSuppliers(
                supplierList.filter(
                    (supplier) => supplier.isActive !== false
                )
            );

        } catch (error) {
            console.error('SUPPLIER FETCH ERROR:', error);
        }
    };

    // LOAD SUPPLIER RETURN HISTORY
    const fetchReturns = async (page = currentPage) => {
        try {
            setLoading(true);
            setError('');

            const params = new URLSearchParams();

            params.set('page', page);
            params.set('limit', 10);

            if (searchTerm.trim()) {
                params.set('search', searchTerm.trim());
            }

            if (statusFilter) {
                params.set('status', statusFilter);
            }

            if (supplierFilter) {
                params.set('supplierId', supplierFilter);
            }

            if (dateFrom) {
                params.set('dateFrom', dateFrom);
            }

            if (dateTo) {
                params.set('dateTo', dateTo);
            }

            const response = await fetch(
                `${API_URL}?${params.toString()}&refresh=${Date.now()}`,
                {
                    method: 'GET',
                    headers: getHeaders(),
                    cache: 'no-store'
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || 'Failed to load supplier return history.'
                );
            }

            setReturns(
                Array.isArray(data.returns) ? data.returns : []
            );

            setHistoryTotal(data.total || 0);
            setCurrentPage(data.currentPage || page);
            setTotalPages(data.totalPages || 1);

        } catch (error) {
            console.error('SUPPLIER RETURN HISTORY ERROR:', error);
            setError(error.message || 'Cannot connect to server.');

        } finally {
            setLoading(false);
        }
    };

    // INITIAL DATA LOAD
    useEffect(() => {
        fetchSuppliers();
        fetchReturns(1);
    }, []);

    // APPLY HISTORY FILTERS
    const applyFilters = () => {
        setCurrentPage(1);
        fetchReturns(1);
    };

    // CLEAR HISTORY FILTERS
    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilter('');
        setSupplierFilter('');
        setDateFrom('');
        setDateTo('');
        setCurrentPage(1);

        setTimeout(() => {
            fetchReturns(1);
        }, 0);
    };

    // HISTORY STATISTICS
    const stats = useMemo(() => ({
        total: historyTotal,
        completed: returns.filter(
            (item) => item.status === 'Completed'
        ).length,
        cancelled: returns.filter(
            (item) => item.status === 'Cancelled'
        ).length,
        devices: returns.reduce(
            (total, item) => total + Number(item.totalItems || 0),
            0
        )
    }), [returns, historyTotal]);

    // LOAD ELIGIBLE DEVICES
    const fetchEligibleDevices = async (search = '') => {
        try {
            setDeviceLoading(true);
            setDeviceError('');

            const params = new URLSearchParams();

            params.set('page', 1);
            params.set('limit', 100);

            if (search.trim()) {
                params.set('search', search.trim());
            }

            const response = await fetch(
                `${API_URL}/eligible-devices?${params.toString()}`,
                {
                    method: 'GET',
                    headers: getHeaders(),
                    cache: 'no-store'
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || 'Failed to load eligible devices.'
                );
            }

            const searchValue = search.trim().toLowerCase();

            let eligibleUnits = Array.isArray(data.stockUnits)
                ? data.stockUnits.filter((unit) => {
                    if (
                        !unit?._id ||
                        !unit?.stockItem?._id ||
                        !['Available', 'Assigned'].includes(unit.status)
                    ) {
                        return false;
                    }

                    if (!searchValue) return true;

                    const productCode = String(unit.unitCode || '')
                        .trim()
                        .toLowerCase();

                    const sku = String(unit.stockItem?.sku || '')
                        .trim()
                        .toLowerCase();

                    const serialNumber = String(unit.serialNumber || '')
                        .trim()
                        .toLowerCase();

                    return (
                        productCode.includes(searchValue) ||
                        sku.includes(searchValue) ||
                        serialNumber.includes(searchValue)
                    );
                })
                : [];

            setStockUnits(eligibleUnits);

            return eligibleUnits;

        } catch (error) {
            console.error('ELIGIBLE DEVICE ERROR:', error);

            setDeviceError(
                error.message || 'Cannot load eligible devices.'
            );

            setStockUnits([]);

            return [];

        } finally {
            setDeviceLoading(false);
        }
    };

    // SEARCH PRODUCT BY SKU OR SERIAL NUMBER
    const handleSkuSearch = async () => {
        const searchValue = skuSearch.trim();

        setFormError('');
        setDeviceError('');
        setSelectedProduct(null);
        setSelectedUnitIds([]);
        setStockUnits([]);

        if (!searchValue) {
            setFormError(
                'Please enter SKU / Product Code / Serial Number.'
            );
            return;
        }

        const units = await fetchEligibleDevices(searchValue);

        if (units.length > 0) {
            setSelectedProduct(units[0].stockItem);
        } else {
            setSelectedProduct(null);

            setDeviceError(
                'No Available or Assigned devices found for this SKU or Serial Number.'
            );
        }
    };

    // OPEN CREATE RETURN FORM
    const openCreateModal = () => {
        setSkuSearch('');
        setSelectedProduct(null);

        setReturnDate(getToday());
        setReturnReason('');
        setNotes('');

        setStockUnits([]);
        setSelectedUnitIds([]);

        setFormError('');
        setDeviceError('');
        setSuccessMessage('');

        setShowCreateModal(true);
    };

    // CLOSE CREATE RETURN FORM
    const closeCreateModal = () => {
        if (submitting) return;
        setShowCreateModal(false);
    };

    // SELECT / DESELECT DEVICE
    const toggleDeviceSelection = (unitId) => {
        setSelectedUnitIds((previous) => {
            if (previous.includes(unitId)) {
                return previous.filter((id) => id !== unitId);
            }

            return [...previous, unitId];
        });
    };

    // SUBMIT SUPPLIER RETURN
    const handleCreateReturn = async (e) => {
        e.preventDefault();

        setFormError('');

        if (!selectedProduct?._id) {
            setFormError('Please search and select a valid product first.');
            return;
        }

        if (!returnDate) {
            setFormError('Please select return date.');
            return;
        }

        if (!selectedUnitIds.length) {
            setFormError('Please select at least one device.');
            return;
        }

        if (!returnReason.trim()) {
            setFormError('Please select a return reason.');
            return;
        }

        const selectedUnits = stockUnits.filter(
            (unit) => selectedUnitIds.includes(unit._id)
        );

        if (selectedUnits.length !== selectedUnitIds.length) {
            setFormError(
                'Some selected devices are no longer available. Please search the product again.'
            );
            return;
        }

        if (
            selectedUnits.some(
                (unit) => !['Available', 'Assigned'].includes(unit.status)
            )
        ) {
            setFormError(
                'Only Available and Assigned devices can be returned.'
            );
            return;
        }

        try {
            setSubmitting(true);

            const matchedSupplier = suppliers.find(
                (supplier) =>
                    supplier.companyName?.trim().toLowerCase() ===
                    selectedProduct.supplierName?.trim().toLowerCase()
            );

            const payload = {
                ...(matchedSupplier?._id
                    ? { supplierId: matchedSupplier._id }
                    : {}),
                returnDate,
                returnReason: returnReason.trim(),
                notes: notes.trim(),

                items: selectedUnitIds.map((stockUnitId) => ({
                    stockUnitId,
                    returnReason: returnReason.trim(),
                    notes: notes.trim()
                }))
            };

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || 'Failed to create supplier return.'
                );
            }

            setShowCreateModal(false);
            setSelectedUnitIds([]);
            setSelectedProduct(null);
            setStockUnits([]);

            setSuccessMessage(
                `Supplier Return ${data.return?.returnNumber || ''} created successfully.`
            );

            setCurrentPage(1);
            fetchReturns(1);

        } catch (error) {
            console.error('CREATE SUPPLIER RETURN ERROR:', error);
            setFormError(error.message || 'Unable to create supplier return.');

        } finally {
            setSubmitting(false);
        }
    };

    // VIEW RETURN DETAILS
    const handleViewDetails = async (returnId) => {
        try {
            setSelectedReturn(returnId);
            setReturnDetails(null);
            setDetailsError('');
            setDetailsLoading(true);

            const response = await fetch(
                `${API_URL}/${returnId}`,
                {
                    method: 'GET',
                    headers: getHeaders(),
                    cache: 'no-store'
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || 'Failed to load return details.'
                );
            }

            setReturnDetails({
                ...data.return,
                items: Array.isArray(data.items) ? data.items : []
            });

        } catch (error) {
            console.error('RETURN DETAILS ERROR:', error);

            setDetailsError(
                error.message || 'Unable to load return details.'
            );

        } finally {
            setDetailsLoading(false);
        }
    };

    // PRINT SUPPLIER RETURN DOCUMENT
    const handlePrintReturn = () => {
        if (!returnDetails) return;

        const returnData = returnDetails;
        const supplier = returnData.supplierDetails || returnData.supplier || {};

        const rows = (returnData.items || []).map((item, index) => {
            const product = item.productDetails || {};
            const previous = item.previousAssignment || {};

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(product.name || item.stockItem?.name || 'N/A')}</td>
                    <td>${escapeHtml(product.sku || item.stockItem?.sku || 'N/A')}</td>
                    <td>${escapeHtml(product.unitCode || item.stockUnit?.unitCode || 'N/A')}</td>
                    <td>${escapeHtml(product.serialNumber || item.stockUnit?.serialNumber || 'N/A')}</td>
                    <td>${escapeHtml(product.assetId || item.asset?.assetId || 'N/A')}</td>
                    <td>${escapeHtml(previous.departmentName || getRelationName(previous.department))}</td>
                    <td>${escapeHtml(previous.roomName || getRelationName(previous.room))}</td>
                    <td>${escapeHtml(item.returnReason || returnData.returnReason || 'N/A')}</td>
                </tr>
            `;
        }).join('');

        const printWindow = window.open('', '_blank');

        if (!printWindow) {
            alert('Please allow pop-ups to print the return document.');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${escapeHtml(returnData.returnNumber || 'Supplier Return')}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        color: #1e293b;
                        padding: 30px;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 2px solid #1e293b;
                        padding-bottom: 15px;
                        margin-bottom: 20px;
                    }
                    .header h1 { margin: 0 0 6px; font-size: 24px; }
                    .header p { margin: 4px 0; color: #475569; }
                    h2 { font-size: 18px; margin-top: 25px; }
                    .info {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 10px 25px;
                        margin-bottom: 20px;
                    }
                    .info p { margin: 5px 0; font-size: 13px; }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 15px;
                        font-size: 10px;
                    }
                    th, td {
                        border: 1px solid #cbd5e1;
                        padding: 8px 5px;
                        text-align: left;
                        word-break: break-word;
                    }
                    th { background: #e2e8f0; }
                    .notes { margin-top: 20px; font-size: 13px; }
                    .signatures {
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr;
                        gap: 30px;
                        margin-top: 90px;
                        text-align: center;
                    }
                    .signatures div {
                        border-top: 1px solid #334155;
                        padding-top: 8px;
                        font-size: 12px;
                    }
                    @media print {
                        body { padding: 10px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>UNITED MEDICAL COLLEGE</h1>
                    <p>IT INVENTORY & ASSET MANAGEMENT</p>
                    <h2>SUPPLIER RETURN DOCUMENT</h2>
                </div>

                <div class="info">
                    <div>
                        <p><strong>Return Number:</strong> ${escapeHtml(returnData.returnNumber)}</p>
                        <p><strong>Supplier:</strong> ${escapeHtml(supplier.companyName || 'N/A')}</p>
                        <p><strong>Contact Person:</strong> ${escapeHtml(supplier.contactPerson || 'N/A')}</p>
                        <p><strong>Phone:</strong> ${escapeHtml(supplier.phone || 'N/A')}</p>
                        <p><strong>Address:</strong> ${escapeHtml(supplier.address || 'N/A')}</p>
                    </div>
                    <div>
                        <p><strong>Return Date:</strong> ${escapeHtml(formatDate(returnData.returnDate))}</p>
                        <p><strong>Total Devices:</strong> ${escapeHtml(returnData.totalItems || 0)}</p>
                        <p><strong>Status:</strong> ${escapeHtml(returnData.status || 'N/A')}</p>
                    </div>
                </div>

                <p><strong>Return Reason:</strong> ${escapeHtml(returnData.returnReason || 'N/A')}</p>

                <h2>Returned Device List</h2>

                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Product</th>
                            <th>SKU</th>
                            <th>Unit Code</th>
                            <th>Serial Number</th>
                            <th>Asset ID</th>
                            <th>Previous Department</th>
                            <th>Previous Room</th>
                            <th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>

                <div class="notes">
                    <p><strong>Additional Notes:</strong> ${escapeHtml(returnData.notes || 'N/A')}</p>
                    <p><strong>Prepared By:</strong> ${escapeHtml(returnData.preparedBy?.name || returnData.preparedBy?.email || 'N/A')}</p>
                </div>

                <div class="signatures">
                    <div>Prepared By</div>
                    <div>Checked By</div>
                    <div>Authorized Signature</div>
                </div>

                <script>
                    window.onload = function () {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);

        printWindow.document.close();
    };

    // CLOSE DETAILS MODAL
    const closeDetailsModal = () => {
        setSelectedReturn(null);
        setReturnDetails(null);
        setDetailsError('');
    };

    // SELECTED DEVICE COUNT
    const selectedCount = selectedUnitIds.length;

    return (
        <div className="min-h-screen bg-slate-100 flex">
            <AdminSidebar />

            <main className="flex-1 lg:ml-64 min-w-0">

                {/* TOPBAR - DASHBOARD STYLE */}
                <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-20">
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-slate-400 font-semibold tracking-wide">
                            UNITED MEDICAL COLLEGE / ADMIN
                        </p>

                        <h2 className="text-lg sm:text-xl font-bold text-slate-800 mt-1 truncate">
                            Supplier Return Management
                        </h2>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                            type="button"
                            onClick={() => fetchReturns(1)}
                            disabled={loading}
                            className="w-full rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 disabled:opacity-60 sm:w-auto"
                        >
                            {loading ? 'Refreshing...' : '↻ Refresh'}
                        </button>

                        <button
                            type="button"
                            onClick={showCreateModal ? closeCreateModal : openCreateModal}
                            className="w-full rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:w-auto"
                        >
                            {showCreateModal ? '− Close Return Form' : '+ New Supplier Return'}
                        </button>
                    </div>
                </header>

                {/* PAGE CONTENT */}
                <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">

                    {/* SUCCESS MESSAGE */}
                    {successMessage && (
                        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                            <p className="text-sm font-medium text-emerald-700">
                                {successMessage}
                            </p>

                            <button
                                type="button"
                                onClick={() => setSuccessMessage('')}
                                className="text-lg text-emerald-700"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {/* ERROR MESSAGE */}
                    {error && (
                        <div className="mb-6 flex flex-col justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center">
                            <p className="text-sm text-red-700">{error}</p>

                            <button
                                type="button"
                                onClick={() => fetchReturns(1)}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* STATISTICS */}
                    <div className="mb-7 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-6">
                            <div className="absolute left-0 top-0 h-1 w-full bg-blue-500" />
                            <p className="text-sm font-medium text-slate-500">
                                Total Return Records
                            </p>
                            <h2 className="mt-3 text-3xl font-bold text-slate-800">
                                {stats.total}
                            </h2>
                        </div>

                        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-6">
                            <div className="absolute left-0 top-0 h-1 w-full bg-emerald-500" />
                            <p className="text-sm font-medium text-emerald-600">
                                Completed (Current Page)
                            </p>
                            <h2 className="mt-3 text-3xl font-bold text-emerald-700">
                                {stats.completed}
                            </h2>
                        </div>

                        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-6">
                            <div className="absolute left-0 top-0 h-1 w-full bg-orange-500" />
                            <p className="text-sm font-medium text-orange-600">
                                Cancelled (Current Page)
                            </p>
                            <h2 className="mt-3 text-3xl font-bold text-orange-700">
                                {stats.cancelled}
                            </h2>
                        </div>

                        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-6">
                            <div className="absolute left-0 top-0 h-1 w-full bg-violet-500" />
                            <p className="text-sm font-medium text-violet-600">
                                Devices (Current Page)
                            </p>
                            <h2 className="mt-3 text-3xl font-bold text-violet-700">
                                {stats.devices}
                            </h2>
                        </div>
                    </div>

                    {/* SUPPLIER RETURN HISTORY */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 p-4 sm:p-5">
                            <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="h-6 w-1.5 rounded-full bg-orange-500" />
                                        <h2 className="text-lg font-bold text-slate-800">
                                            Supplier Return History
                                        </h2>
                                    </div>

                                    <p className="mt-2 text-xs text-slate-500 ml-4">
                                        View and manage all completed supplier return records.
                                    </p>
                                </div>

                                <span className="text-sm font-semibold text-slate-600">
                                    Total Records: {historyTotal}
                                </span>
                            </div>

                            {/* SEARCH AND FILTERS */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') applyFilters();
                                    }}
                                    placeholder="Search Return No, Supplier, Reference..."
                                    className="w-full min-w-0 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />

                                <select
                                    value={supplierFilter}
                                    onChange={(e) => setSupplierFilter(e.target.value)}
                                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                                >
                                    <option value="">All Suppliers</option>

                                    {suppliers.map((supplier) => (
                                        <option key={supplier._id} value={supplier._id}>
                                            {supplier.companyName}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                                >
                                    <option value="">All Statuses</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>

                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-500">
                                        Return Date From
                                    </label>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-500">
                                        Return Date To
                                    </label>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        min={dateFrom || undefined}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div className="flex items-end gap-2">
                                    <button
                                        type="button"
                                        onClick={applyFilters}
                                        className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                                    >
                                        Search
                                    </button>

                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* HISTORY TABLE */}
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] text-left">
                                <thead className="bg-slate-50">
                                    <tr className="border-b border-slate-200">
                                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">Return Number</th>
                                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">Supplier</th>
                                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">Return Date</th>
                                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">Total Devices</th>
                                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">Prepared By</th>
                                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
                                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">Action</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="7" className="px-5 py-12 text-center text-sm text-slate-500">
                                                Loading supplier return history...
                                            </td>
                                        </tr>
                                    ) : returns.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-5 py-12 text-center">
                                                <p className="font-semibold text-slate-600">
                                                    No supplier returns found
                                                </p>
                                                <p className="mt-1 text-sm text-slate-400">
                                                    Supplier return records will appear here after a device is returned to a supplier.
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        returns.map((item) => (
                                            <tr key={item._id} className="transition-colors hover:bg-slate-50">
                                                <td className="px-5 py-4">
                                                    <span className="font-semibold text-blue-700">
                                                        {item.returnNumber || 'N/A'}
                                                    </span>

                                                    {item.referenceNumber && (
                                                        <p className="mt-1 text-xs text-slate-400">
                                                            Ref: {item.referenceNumber}
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <p className="font-semibold text-slate-800">
                                                        {item.supplierDetails?.companyName ||
                                                            item.supplier?.companyName ||
                                                            'N/A'}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {item.supplierDetails?.phone ||
                                                            item.supplier?.phone || ''}
                                                    </p>
                                                </td>

                                                <td className="px-5 py-4 text-sm text-slate-600">
                                                    {formatDate(item.returnDate)}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span className="font-semibold text-slate-800">
                                                        {item.totalItems || 0}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 text-sm text-slate-600">
                                                    {item.preparedBy?.name ||
                                                        item.preparedBy?.email || 'N/A'}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(item.status)}`}>
                                                        {item.status || 'Unknown'}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewDetails(item._id)}
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

                        {/* HISTORY PAGINATION */}
                        <div className="flex flex-col justify-between gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                            <p className="text-sm text-slate-500">
                                Page {currentPage} of {totalPages}
                            </p>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={currentPage <= 1 || loading}
                                    onClick={() => fetchReturns(currentPage - 1)}
                                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Previous
                                </button>

                                <button
                                    type="button"
                                    disabled={currentPage >= totalPages || loading}
                                    onClick={() => fetchReturns(currentPage + 1)}
                                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* CREATE SUPPLIER RETURN FORM - INLINE PAGE SECTION */}
                    {showCreateModal && (
                        <div className="mt-7 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                            {/* FORM HEADER */}
                            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-blue-50 p-5 sm:flex-row sm:items-center sm:p-6">
                                <div>
                                    <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-blue-700">
                                        UMC IT INVENTORY
                                    </p>

                                    <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
                                        Create Supplier Return
                                    </h2>

                                    <p className="mt-1 text-sm text-slate-500">
                                        Search product, select devices and confirm return.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={closeCreateModal}
                                    disabled={submitting}
                                    className="self-start rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 sm:self-center"
                                >
                                    Close Form ×
                                </button>
                            </div>

                            <form onSubmit={handleCreateReturn}>
                                <div className="space-y-5 bg-slate-50/80 p-4 sm:p-6">

                                    {/* PRODUCT SEARCH */}
                                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                                        <div className="mb-5 flex items-center gap-3">
                                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-sm font-extrabold text-blue-700">
                                                01
                                            </span>

                                            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
                                                Search Product
                                            </h3>
                                        </div>

                                        <label className="mb-1.5 block text-sm font-semibold text-slate-600">
                                            SKU / Product Code / Serial Number *
                                        </label>

                                        <div className="flex flex-col gap-2 sm:flex-row">
                                            <input
                                                type="text"
                                                value={skuSearch}
                                                onChange={(e) => setSkuSearch(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleSkuSearch();
                                                    }
                                                }}
                                                placeholder="Enter or scan SKU / Product Code / Serial Number..."
                                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                                            />

                                            <button
                                                type="button"
                                                onClick={handleSkuSearch}
                                                disabled={deviceLoading}
                                                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                {deviceLoading ? 'Searching...' : 'Search Product'}
                                            </button>
                                        </div>

                                        {deviceError && (
                                            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                                {deviceError}
                                            </div>
                                        )}

                                        {selectedProduct && (
                                            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4">
                                                <div className="mb-3 flex items-center justify-between gap-2">
                                                    <h4 className="font-bold text-slate-800">
                                                        Product Information
                                                    </h4>

                                                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                                                        Product Found
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                    <div>
                                                        <p className="text-xs text-slate-500">Product Name</p>
                                                        <p className="font-semibold text-slate-800">
                                                            {selectedProduct.name || 'N/A'}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <p className="text-xs text-slate-500">SKU / Product Code</p>
                                                        <p className="font-semibold text-blue-700">
                                                            {selectedProduct.sku || 'N/A'}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <p className="text-xs text-slate-500">Brand</p>
                                                        <p className="font-semibold text-slate-800">
                                                            {selectedProduct.brand || 'N/A'}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <p className="text-xs text-slate-500">Model</p>
                                                        <p className="font-semibold text-slate-800">
                                                            {selectedProduct.model || 'N/A'}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <p className="text-xs text-slate-500">Category</p>
                                                        <p className="font-semibold text-slate-800">
                                                            {selectedProduct.category || 'N/A'}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <p className="text-xs text-slate-500">Supplier Name</p>
                                                        <p className="font-bold text-violet-700">
                                                            {selectedSupplier?.companyName ||
                                                                selectedProduct.supplierName || 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </section>

                                    {/* DEVICE SELECTION */}
                                    {selectedProduct && (
                                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                                            <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-sm font-extrabold text-violet-700">
                                                            02
                                                        </span>

                                                        <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
                                                            Select Devices
                                                        </h3>
                                                    </div>

                                                    <p className="mt-1 text-sm text-slate-500">
                                                        Select the individual devices you want to return.
                                                    </p>
                                                </div>

                                                <span className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-extrabold text-blue-800 shadow-sm">
                                                    Selected: {selectedCount}
                                                </span>
                                            </div>

                                            <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-500">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                                    Available
                                                </span>

                                                <span className="flex items-center gap-1.5">
                                                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                                                    Assigned
                                                </span>
                                            </div>

                                            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                                                <table className="w-full min-w-[750px] text-left">
                                                    <thead className="bg-slate-50">
                                                        <tr className="border-b border-slate-200">
                                                            <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                                                                Select
                                                            </th>
                                                            <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                                                                Unit Code
                                                            </th>
                                                            <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                                                                Serial Number
                                                            </th>
                                                            <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                                                                Asset ID
                                                            </th>
                                                            <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                                                                Status
                                                            </th>
                                                        </tr>
                                                    </thead>

                                                    <tbody className="divide-y divide-slate-100">
                                                        {deviceLoading ? (
                                                            <tr>
                                                                <td colSpan="5" className="px-4 py-10 text-center text-sm text-slate-500">
                                                                    Loading eligible devices...
                                                                </td>
                                                            </tr>
                                                        ) : stockUnits.length === 0 ? (
                                                            <tr>
                                                                <td colSpan="5" className="px-4 py-10 text-center text-sm text-slate-500">
                                                                    No Available or Assigned devices found.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            stockUnits.map((unit) => (
                                                                <tr
                                                                    key={unit._id}
                                                                    className="transition-colors hover:bg-blue-50/60"
                                                                >
                                                                    <td className="px-4 py-3">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedUnitIds.includes(unit._id)}
                                                                            onChange={() => toggleDeviceSelection(unit._id)}
                                                                            className="h-4 w-4 cursor-pointer accent-blue-600"
                                                                        />
                                                                    </td>

                                                                    <td className="px-4 py-3 text-xs font-semibold text-blue-700">
                                                                        {unit.unitCode || 'N/A'}
                                                                    </td>

                                                                    <td className="px-4 py-3 text-sm text-slate-600">
                                                                        {unit.serialNumber || 'N/A'}
                                                                    </td>

                                                                    <td className="px-4 py-3 text-sm text-slate-600">
                                                                        {unit.asset?.assetId || 'Not Assigned'}
                                                                    </td>

                                                                    <td className="px-4 py-3">
                                                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyle(unit.status)}`}>
                                                                            {unit.status || 'Unknown'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </section>
                                    )}

                                    {/* RETURN INFORMATION */}
                                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                                        <div className="mb-5 flex items-center gap-3">
                                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-sm font-extrabold text-orange-700">
                                                03
                                            </span>

                                            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
                                                Return Information
                                            </h3>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div>
                                                <label className="mb-1.5 block text-sm font-semibold text-slate-600">
                                                    Return Date *
                                                </label>

                                                <input
                                                    type="date"
                                                    value={returnDate}
                                                    onChange={(e) => setReturnDate(e.target.value)}
                                                    required
                                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-1.5 block text-sm font-semibold text-slate-600">
                                                    Return Reason *
                                                </label>

                                                <select
                                                    value={returnReason}
                                                    onChange={(e) => setReturnReason(e.target.value)}
                                                    required
                                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                                                >
                                                    <option value="">Select Return Reason</option>
                                                    <option value="Defective Product">Defective Product</option>
                                                    <option value="Warranty Claim">Warranty Claim</option>
                                                    <option value="Wrong Product Supplied">Wrong Product Supplied</option>
                                                    <option value="Damaged During Delivery">Damaged During Delivery</option>
                                                    <option value="Replacement Required">Replacement Required</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>

                                            <div className="sm:col-span-2">
                                                <label className="mb-1.5 block text-sm font-semibold text-slate-600">
                                                    Additional Notes (Optional)
                                                </label>

                                                <textarea
                                                    value={notes}
                                                    onChange={(e) => setNotes(e.target.value)}
                                                    rows="3"
                                                    placeholder="Write any additional information..."
                                                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {/* FORM ERROR */}
                                    {formError && (
                                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                            {formError}
                                        </div>
                                    )}
                                </div>

                                {/* FORM FOOTER */}
                                <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
                                    <p className="text-sm font-semibold text-slate-600">
                                        Selected Devices: <span className="text-blue-700">{selectedCount}</span>
                                    </p>

                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <button
                                            type="button"
                                            onClick={closeCreateModal}
                                            disabled={submitting}
                                            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="submit"
                                            disabled={submitting || !selectedProduct || selectedCount === 0}
                                            className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:from-blue-700 hover:to-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {submitting
                                                ? 'Processing Return...'
                                                : `Confirm Return (${selectedCount})`}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </main>

            {/* SUPPLIER RETURN DETAILS MODAL */}
            {selectedReturn && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3 sm:p-5"
                    onClick={closeDetailsModal}
                >
                    <div
                        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* DETAILS HEADER */}
                        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                                    UMC IT INVENTORY
                                </p>

                                <h2 className="mt-1 text-xl font-bold text-slate-800">
                                    Supplier Return Details
                                </h2>
                            </div>

                            <div className="flex gap-2">
                                {returnDetails && (
                                    <button
                                        type="button"
                                        onClick={handlePrintReturn}
                                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                                    >
                                        Print Document
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={closeDetailsModal}
                                    className="rounded-xl border border-slate-300 px-3 py-2 text-xl text-slate-500 transition hover:bg-slate-100"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        {detailsLoading ? (
                            <div className="px-5 py-16 text-center text-sm text-slate-500">
                                Loading return details...
                            </div>
                        ) : detailsError ? (
                            <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                {detailsError}
                            </div>
                        ) : returnDetails && (
                            <div className="space-y-6 p-5">
                                {/* RETURN SUMMARY */}
                                <section>
                                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-slate-500">
                                                Return Number
                                            </p>

                                            <h3 className="mt-1 text-xl font-bold text-blue-700">
                                                {returnDetails.returnNumber || 'N/A'}
                                            </h3>
                                        </div>

                                        <span className={`inline-flex rounded-full px-4 py-2 text-xs font-bold ${getStatusStyle(returnDetails.status)}`}>
                                            {returnDetails.status || 'Unknown'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div className="rounded-xl bg-slate-50 p-4">
                                            <p className="text-xs text-slate-500">Supplier</p>
                                            <p className="mt-1 font-semibold text-slate-800">
                                                {returnDetails.supplierDetails?.companyName ||
                                                    returnDetails.supplier?.companyName || 'N/A'}
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-slate-50 p-4">
                                            <p className="text-xs text-slate-500">Contact Person</p>
                                            <p className="mt-1 font-semibold text-slate-800">
                                                {returnDetails.supplierDetails?.contactPerson ||
                                                    returnDetails.supplier?.contactPerson || 'N/A'}
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-slate-50 p-4">
                                            <p className="text-xs text-slate-500">Supplier Phone</p>
                                            <p className="mt-1 font-semibold text-slate-800">
                                                {returnDetails.supplierDetails?.phone ||
                                                    returnDetails.supplier?.phone || 'N/A'}
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-slate-50 p-4">
                                            <p className="text-xs text-slate-500">Return Date</p>
                                            <p className="mt-1 font-semibold text-slate-800">
                                                {formatDate(returnDetails.returnDate)}
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-slate-50 p-4">
                                            <p className="text-xs text-slate-500">Total Devices</p>
                                            <p className="mt-1 font-semibold text-slate-800">
                                                {returnDetails.totalItems || 0}
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-slate-50 p-4">
                                            <p className="text-xs text-slate-500">Return Reason</p>
                                            <p className="mt-1 font-semibold text-slate-800">
                                                {returnDetails.returnReason || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                {/* RETURNED DEVICE TABLE */}
                                <section className="border-t border-slate-200 pt-5">
                                    <div className="mb-4 flex items-center gap-2">
                                        <span className="h-5 w-1.5 rounded-full bg-orange-500" />
                                        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                                            Returned Device Details
                                        </h3>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full min-w-[900px] text-left">
                                            <thead className="bg-slate-50">
                                                <tr className="border-b border-slate-200">
                                                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Product</th>
                                                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">SKU</th>
                                                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Unit Code</th>
                                                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Serial Number</th>
                                                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Asset ID</th>
                                                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Previous Department</th>
                                                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Previous Room</th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-100">
                                                {returnDetails.items?.length ? (
                                                    returnDetails.items.map((item) => {
                                                        const product = item.productDetails || {};
                                                        const previous = item.previousAssignment || {};

                                                        return (
                                                            <tr key={item._id} className="transition-colors hover:bg-slate-50">
                                                                <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                                                                    {product.name || item.stockItem?.name || 'N/A'}
                                                                </td>

                                                                <td className="px-4 py-3 text-sm text-slate-600">
                                                                    {product.sku || item.stockItem?.sku || 'N/A'}
                                                                </td>

                                                                <td className="px-4 py-3 text-xs font-semibold text-blue-700">
                                                                    {product.unitCode || item.stockUnit?.unitCode || 'N/A'}
                                                                </td>

                                                                <td className="px-4 py-3 text-sm text-slate-600">
                                                                    {product.serialNumber || item.stockUnit?.serialNumber || 'N/A'}
                                                                </td>

                                                                <td className="px-4 py-3 text-sm text-slate-600">
                                                                    {product.assetId || item.asset?.assetId || 'N/A'}
                                                                </td>

                                                                <td className="px-4 py-3 text-sm text-slate-600">
                                                                    {previous.departmentName || getRelationName(previous.department)}
                                                                </td>

                                                                <td className="px-4 py-3 text-sm text-slate-600">
                                                                    {previous.roomName || getRelationName(previous.room)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan="7" className="px-4 py-8 text-center text-sm text-slate-500">
                                                            No device details found.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>

                                {/* RETURN NOTES */}
                                <section className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
                                    <div className="rounded-xl bg-slate-50 p-4">
                                        <p className="text-xs font-medium text-slate-500">
                                            Prepared By
                                        </p>

                                        <p className="mt-1 font-semibold text-slate-800">
                                            {returnDetails.preparedBy?.name ||
                                                returnDetails.preparedBy?.email || 'N/A'}
                                        </p>
                                    </div>

                                    <div className="rounded-xl bg-slate-50 p-4">
                                        <p className="text-xs font-medium text-slate-500">
                                            Return Notes
                                        </p>

                                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                                            {returnDetails.notes || 'No additional notes.'}
                                        </p>
                                    </div>
                                </section>
                            </div>
                        )}

                        <div className="flex justify-end border-t border-slate-200 p-5">
                            <button
                                type="button"
                                onClick={closeDetailsModal}
                                className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupplierReturnManagement;