
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import AdminSidebar from '../../components/AdminSidebar.jsx';

const API_URL = 'http://localhost:3001/api/stock';

const StockInventory = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const activeMenu = 'Stock Inventory';

    // STOCK INVENTORY STATE
    const [editingId, setEditingId] = useState(null);
    const [stockItems, setStockItems] = useState([]);

    const [stats, setStats] = useState({
        totalProducts: 0,
        totalReceived: 0,
        available: 0,
        assigned: 0,
        damaged: 0,
        underRepair: 0,
        ordered: 0,
        lowStock: 0
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    const [selectedSku, setSelectedSku] = useState('');

    // INDIVIDUAL STOCK UNIT MANAGEMENT
    const [selectedUnitProduct, setSelectedUnitProduct] = useState(null);
    const [stockUnits, setStockUnits] = useState([]);
    const [unitsLoading, setUnitsLoading] = useState(false);
    const [unitsError, setUnitsError] = useState('');
    const [deletingUnitId, setDeletingUnitId] = useState(null);

    // VIEW UNITS SEARCH
    const [unitSearch, setUnitSearch] = useState('');

    // SCANNER STATE
    const [showScanner, setShowScanner] = useState(false);
    const [scannerError, setScannerError] = useState('');
    const scannerRef = useRef(null);

    // FORM DATA
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        brand: '',
        model: '',
        sku: '',
        warranty: '',
        supplierName: '',
        unit: 'Piece',
        totalReceivedQuantity: '',
        minimumStockLevel: 5,
        description: ''
    });

    // ONLY ADDITIONAL UNITS' SERIAL NUMBERS
    const [serialNumbers, setSerialNumbers] = useState([]);

    // API HEADERS
    const getHeaders = () => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('pos-token')}`
    });

    // GET CURRENT PRODUCT QUANTITY
    const getExistingQuantity = () => {
        if (!editingId) return 0;

        const existingItem = stockItems.find(
            item => item._id === editingId
        );

        return Number(existingItem?.totalReceivedQuantity ?? 0);
    };

    // CALCULATE ADDITIONAL QUANTITY
    const getAdditionalQuantity = () => {
        const newQuantity = Number(formData.totalReceivedQuantity) || 0;

        return Math.max(
            0,
            newQuantity - getExistingQuantity()
        );
    };

    // LOAD STOCK DATA - Search: LOAD STOCK DATA
    const fetchStockData = async () => {
        setLoading(true);
        setError('');

        try {
            const [stockResponse, statsResponse] = await Promise.all([
                fetch(API_URL, {
                    headers: getHeaders()
                }),
                fetch(`${API_URL}/stats`, {
                    headers: getHeaders()
                })
            ]);

            const stockData = await stockResponse.json();
            const statsData = await statsResponse.json();

            if (!stockResponse.ok) {
                throw new Error(
                    stockData.message || 'Failed to load stock items'
                );
            }

            if (!statsResponse.ok) {
                throw new Error(
                    statsData.message || 'Failed to load stock statistics'
                );
            }

            setStockItems(stockData.stockItems || []);
            setStats(statsData);

        } catch (err) {
            setError(err.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStockData();
    }, []);

    // QR AND BARCODE SCANNER
    useEffect(() => {
        if (!showScanner) return;

        let scanner = null;
        let cancelled = false;
        let scanCompleted = false;

        const startScanner = async () => {
            try {
                const cameras = await Html5Qrcode.getCameras();

                if (cancelled) return;

                if (!cameras || cameras.length === 0) {
                    throw new Error('No camera found on this device.');
                }

                const selectedCamera =
                    cameras.find(camera =>
                        /back|rear|environment/i.test(camera.label)
                    ) || cameras[0];

                scanner = new Html5Qrcode('stock-code-reader', {
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.QR_CODE,
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.CODE_39,
                        Html5QrcodeSupportedFormats.CODE_93,
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.EAN_8,
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E,
                        Html5QrcodeSupportedFormats.ITF,
                        Html5QrcodeSupportedFormats.CODABAR,
                        Html5QrcodeSupportedFormats.DATA_MATRIX,
                        Html5QrcodeSupportedFormats.PDF_417,
                        Html5QrcodeSupportedFormats.AZTEC
                    ]
                });

                scannerRef.current = scanner;

                if (cancelled) return;

                await scanner.start(
                    selectedCamera.id,
                    {
                        fps: 10,
                        qrbox: {
                            width: 250,
                            height: 180
                        }
                    },
                    async (decodedText) => {
                        if (cancelled || scanCompleted) return;

                        scanCompleted = true;

                        try {
                            if (scanner && scanner.isScanning) {
                                await scanner.stop();
                            }

                            scanner?.clear();
                        } catch (cleanupError) {
                            console.log('Scanner cleanup:', cleanupError);
                        }

                        scannerRef.current = null;

                        if (cancelled) return;

                        const scannedCode = decodedText.trim();

                        setShowScanner(false);
                        setScannerError('');

                        const existingItem = stockItems.find(
                            item =>
                                item.sku?.trim().toLowerCase() ===
                                scannedCode.toLowerCase()
                        );

                        if (existingItem) {
                            alert(`Product already exists: ${existingItem.name}`);
                            handleEditStock(existingItem);
                        } else {
                            resetForm();

                            setFormData(prev => ({
                                ...prev,
                                sku: scannedCode
                            }));

                            setShowForm(true);

                            alert(
                                'New product code scanned! Complete the product information.'
                            );
                        }
                    },
                    () => {}
                );

                if (cancelled && scanner?.isScanning) {
                    await scanner.stop();
                    scanner.clear();
                }

            } catch (startError) {
                console.error('Camera Scanner Error:', startError);

                if (!cancelled) {
                    setScannerError(
                        startError.message ||
                        'Camera could not start. Check camera permission and try again.'
                    );
                }
            }
        };

        startScanner();

        return () => {
            cancelled = true;

            if (scanner) {
                if (scanner.isScanning) {
                    scanner.stop()
                        .then(() => scanner.clear())
                        .catch(error => {
                            console.log('Scanner cleanup:', error);
                        });
                } else {
                    try {
                        scanner.clear();
                    } catch (cleanupError) {
                        console.log('Scanner cleanup:', cleanupError);
                    }
                }
            }

            scannerRef.current = null;
        };

    }, [showScanner, stockItems]);

    // RESET FORM
    const resetForm = () => {
        setFormData({
            name: '',
            category: '',
            brand: '',
            model: '',
            sku: '',
            warranty: '',
            supplierName: '',
            unit: 'Piece',
            totalReceivedQuantity: '',
            minimumStockLevel: 5,
            description: ''
        });

        setEditingId(null);
        setSerialNumbers([]);
    };

    // HANDLE FORM INPUT
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        if (name === 'totalReceivedQuantity') {
            const newQuantity = Math.max(
                0,
                Math.floor(Number(value) || 0)
            );

            const existingQuantity = getExistingQuantity();

            const additionalQuantity = Math.max(
                0,
                newQuantity - existingQuantity
            );

            setSerialNumbers(prev =>
                Array.from(
                    { length: additionalQuantity },
                    (_, index) => prev[index] || ''
                )
            );
        }
    };

    // HANDLE SERIAL NUMBER INPUT
    const handleSerialNumberChange = (index, value) => {
        setSerialNumbers(prev =>
            prev.map((serial, serialIndex) =>
                serialIndex === index ? value : serial
            )
        );
    };

    // ADD OR UPDATE STOCK ITEM
    const handleAddStock = async (e) => {
        e.preventDefault();

        if (!formData.name.trim() || !formData.category.trim()) {
            alert('Product name and category are required');
            return;
        }

        const additionalQuantity = getAdditionalQuantity();

        if (
            !Number.isSafeInteger(Number(formData.totalReceivedQuantity)) ||
            Number(formData.totalReceivedQuantity) < 0
        ) {
            alert('Please enter a valid Received Quantity');
            return;
        }

        if (serialNumbers.length !== additionalQuantity) {
            alert('Serial number inputs do not match additional quantity');
            return;
        }

        // CHECK DUPLICATE SERIAL NUMBERS BEFORE SUBMISSION
        const providedSerials = serialNumbers
            .map(serial => serial.trim())
            .filter(Boolean);

        const normalizedSerials = providedSerials.map(serial =>
            serial.toLowerCase()
        );

        const duplicateSerials = [
            ...new Set(
                normalizedSerials.filter(
                    (serial, index) =>
                        normalizedSerials.indexOf(serial) !== index
                )
            )
        ];

        if (duplicateSerials.length > 0) {
            alert(
                `Duplicate Serial Number found: ${duplicateSerials.join(', ')}\n\nPlease enter unique serial numbers.`
            );
            return;
        }

        setSaving(true);

        try {
            const isEditing = Boolean(editingId);

            const response = await fetch(
                isEditing ? `${API_URL}/${editingId}` : API_URL,
                {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: getHeaders(),

                    body: JSON.stringify({
                        ...formData,

                        totalReceivedQuantity: Number(
                            formData.totalReceivedQuantity
                        ),

                        minimumStockLevel: Number(
                            formData.minimumStockLevel
                        ),

                        // SEND ONLY NEW UNITS' SERIAL NUMBERS
                        serialNumbers: serialNumbers.map(serial =>
                            serial.trim()
                        )
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Failed to save stock item'
                );
            }

            alert(
                isEditing
                    ? data.message || 'Stock item updated successfully!'
                    : data.message || 'Stock item added successfully!'
            );

            resetForm();
            setShowForm(false);

            await fetchStockData();

        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    // EDIT STOCK ITEM
    const handleEditStock = (item) => {
        setEditingId(item._id);

        setFormData({
            name: item.name || '',
            category: item.category || '',
            brand: item.brand || '',
            model: item.model || '',
            sku: item.sku || '',
            warranty: item.warranty || '',
            supplierName: item.supplierName || '',
            unit: item.unit || 'Piece',
            totalReceivedQuantity: item.totalReceivedQuantity ?? 0,
            minimumStockLevel: item.minimumStockLevel ?? 5,
            description: item.description || ''
        });

        setSerialNumbers([]);
        setShowForm(true);
    };

    // DELETE STOCK ITEM
    const handleDeleteStock = async (id) => {
        const confirmed = window.confirm(
            'Are you sure you want to delete this stock item?'
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Failed to delete stock item'
                );
            }

            alert('Stock item deleted successfully!');
            await fetchStockData();

        } catch (err) {
            alert(err.message);
        }
    };

    // VIEW INDIVIDUAL STOCK UNITS
    const handleViewUnits = async (item) => {
        setSelectedUnitProduct(item);
        setStockUnits([]);
        setUnitSearch('');
        setUnitsError('');
        setUnitsLoading(true);

        try {
            const response = await fetch(
                `${API_URL}/${item._id}/units`,
                {
                    headers: getHeaders()
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Failed to load individual devices'
                );
            }

            setStockUnits(data.units || []);

        } catch (err) {
            setUnitsError(
                err.message || 'Failed to load individual devices'
            );
        } finally {
            setUnitsLoading(false);
        }
    };

    // DELETE INDIVIDUAL STOCK UNIT
    const handleDeleteStockUnit = async (unitId) => {
        const selectedUnit = stockUnits.find(
            unit => unit._id === unitId
        );

        if (
            !selectedUnit ||
            selectedUnit.status !== 'Available' ||
            selectedUnit.asset
        ) {
            alert('Only available and unassigned devices can be deleted.');
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to delete this device?\n\n` +
            `SKU: ${selectedUnitProduct?.sku || 'N/A'}\n` +
            `Unit Code: ${selectedUnit.unitCode || 'N/A'}\n` +
            `Serial Number: ${selectedUnit.serialNumber || 'Not available'}`
        );

        if (!confirmed) return;

        setDeletingUnitId(unitId);

        try {
            const response = await fetch(
                `${API_URL}/${selectedUnitProduct._id}/units/${unitId}`,
                {
                    method: 'DELETE',
                    headers: getHeaders()
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Failed to delete individual device'
                );
            }

            // REMOVE DELETED UNIT FROM THE LIST
            setStockUnits(prev =>
                prev.filter(unit => unit._id !== unitId)
            );

            // UPDATE SELECTED PRODUCT QUANTITY
            setSelectedUnitProduct(prev => prev ? {
                ...prev,
                totalReceivedQuantity: Math.max(
                    0,
                    Number(prev.totalReceivedQuantity || 0) - 1
                ),
                availableQuantity: Math.max(
                    0,
                    Number(prev.availableQuantity || 0) - 1
                )
            } : prev);

            alert(data.message || 'Device deleted successfully!');

            // REFRESH STOCK DATA AND STATISTICS
            await fetchStockData();

        } catch (err) {
            alert(err.message);
        } finally {
            setDeletingUnitId(null);
        }
    };

    // FILTER INDIVIDUAL STOCK UNITS
    const filteredStockUnits = stockUnits.filter(unit => {
        const searchText = unitSearch.trim().toLowerCase();

        if (!searchText) return true;

        return (
            unit.unitCode?.toLowerCase().includes(searchText) ||
            unit.serialNumber?.toLowerCase().includes(searchText) ||
            unit.status?.toLowerCase().includes(searchText)
        );
    });

    // UNIQUE SKU LIST
    const uniqueSkus = [
        ...new Set(
            stockItems
                .map(item => item.sku?.trim())
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b));

    // FILTER STOCK ITEMS
    const filteredItems = stockItems.filter(item => {
        const searchText = search.toLowerCase();

        const matchesSearch =
            item.name?.toLowerCase().includes(searchText) ||
            item.category?.toLowerCase().includes(searchText) ||
            item.brand?.toLowerCase().includes(searchText) ||
            item.sku?.toLowerCase().includes(searchText);

        const matchesSku = selectedSku
            ? item.sku?.trim().toLowerCase() === selectedSku.toLowerCase()
            : true;

        return matchesSearch && matchesSku;
    });

    // SKU FILTER
    const handleSkuClick = (sku) => {
        if (selectedSku === sku) {
            setSelectedSku('');
        } else {
            setSelectedSku(sku);
            setSearch('');
        }
    };

    // STATISTICS CARDS
    const statCards = [
        {
            title: 'Total Products',
            value: stats.totalProducts,
            icon: '📦',
            color: 'bg-blue-50 text-blue-600'
        },
        {
            title: 'Total Received',
            value: stats.totalReceived,
            icon: '📥',
            color: 'bg-purple-50 text-purple-600'
        },
        {
            title: 'Available Stock',
            value: stats.available,
            icon: '✅',
            color: 'bg-green-50 text-green-600'
        },
        {
            title: 'Assigned',
            value: stats.assigned,
            icon: '🏢',
            color: 'bg-indigo-50 text-indigo-600'
        },
        {
            title: 'Damaged',
            value: stats.damaged,
            icon: '⚠️',
            color: 'bg-red-50 text-red-600'
        },
        {
            title: 'Under Repair',
            value: stats.underRepair,
            icon: '🔧',
            color: 'bg-orange-50 text-orange-600'
        },
        {
            title: 'Ordered',
            value: stats.ordered,
            icon: '🛒',
            color: 'bg-yellow-50 text-yellow-700'
        },
        {
            title: 'Low Stock',
            value: stats.lowStock,
            icon: '📉',
            color: 'bg-pink-50 text-pink-600'
        }
    ];

    // PRODUCT QUANTITY DETAILS
    const quantityDetails = (item) => [
        {
            label: 'Total Received',
            value: item.totalReceivedQuantity ?? 0,
            color: 'text-slate-800',
            background: 'bg-slate-50'
        },
        {
            label: 'Available',
            value: item.availableQuantity ?? 0,
            color: 'text-green-700',
            background: 'bg-green-50'
        },
        {
            label: 'Assigned',
            value: item.assignedQuantity ?? 0,
            color: 'text-blue-700',
            background: 'bg-blue-50'
        },
        {
            label: 'Damaged',
            value: item.damagedQuantity ?? 0,
            color: 'text-red-700',
            background: 'bg-red-50'
        },
        {
            label: 'Under Repair',
            value: item.underRepairQuantity ?? 0,
            color: 'text-orange-700',
            background: 'bg-orange-50'
        },
        {
            label: 'Ordered',
            value: item.orderedQuantity ?? 0,
            color: 'text-purple-700',
            background: 'bg-purple-50'
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50">

            <AdminSidebar />

            <main className="min-w-0 flex-1 lg:ml-64">

                {/* TOP HEADER */}
                <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-4 pl-16 backdrop-blur sm:px-6 lg:px-8">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                            UMC / ADMIN / {activeMenu}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                            United Medical College
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden text-right sm:block">
                            <p className="text-sm font-semibold text-slate-800">
                                {user?.name || 'Administrator'}
                            </p>
                            <p className="text-xs text-slate-500">
                                IT Administrator
                            </p>
                        </div>

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                            {user?.name?.charAt(0) || 'A'}
                        </div>
                    </div>
                </header>

                <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">

                    {/* PAGE TITLE */}
                    <div className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                            <div>
                                <button
                                    onClick={() => navigate('/admin/dashboard')}
                                    className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-800"
                                >
                                    <span>←</span>
                                    Back to Dashboard
                                </button>

                                <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                                    Stock Inventory
                                </h1>

                                <p className="mt-2 text-sm text-slate-500">
                                    Manage products, quantities and stock availability
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => {
                                        setScannerError('');
                                        setShowScanner(true);
                                    }}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700"
                                >
                                    <span>▦</span>
                                    Scan QR / Barcode
                                </button>

                                <button
                                    onClick={() => {
                                        resetForm();
                                        setShowForm(!showForm);
                                    }}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                                >
                                    {showForm ? 'Close Form' : '+ Manual Add Product'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* SCANNER MODAL */}
                    {showScanner && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
                            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                                <div className="flex items-center justify-between border-b border-slate-100 p-5">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800">
                                            QR / Barcode Scanner
                                        </h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Place the product code in front of the camera.
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => setShowScanner(false)}
                                        className="rounded-lg bg-red-50 px-3 py-2 font-bold text-red-600 transition-colors hover:bg-red-100"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="p-5">
                                    <div
                                        id="stock-code-reader"
                                        className="w-full overflow-hidden rounded-xl border border-slate-200"
                                    />

                                    {scannerError && (
                                        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                                            {scannerError}
                                        </p>
                                    )}

                                    <p className="mt-4 text-center text-xs text-slate-500">
                                        Supports QR Code, Code 128, EAN-13, UPC and other common formats.
                                    </p>

                                    <button
                                        onClick={() => setShowScanner(false)}
                                        className="mt-5 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                                    >
                                        Close Scanner
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* INDIVIDUAL STOCK UNITS MODAL */}
                    {selectedUnitProduct && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5">
                            <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">

                                {/* MODERN MODAL HEADER */}
<div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950 to-blue-800 px-5 py-6 text-white sm:px-7">
    <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5" />
    <div className="absolute -bottom-20 right-32 h-40 w-40 rounded-full bg-blue-400/10" />

    <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">

            {/* SELECTED PRODUCT NAME - TOP */}
            <h2 className="text-xl font-bold sm:text-2xl">
                {selectedUnitProduct.name}
            </h2>

            {/* MODAL INFORMATION */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-100">
                    Stock Inventory
                </span>

                <span className="text-xs text-blue-200">
                    Individual Devices
                </span>
            </div>

            <p className="mt-2 text-sm font-medium text-blue-100">
                Device Management
            </p>
        </div>

        <button
            type="button"
            onClick={() => {
                setSelectedUnitProduct(null);
                setUnitSearch('');
            }}
            className="relative shrink-0 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 font-bold text-white transition-colors hover:bg-white/20"
        >
            ✕
        </button>
    </div>
</div>

<div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">

                                    {/* UNIT SUMMARY */}
                                    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">

                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-xs font-medium text-slate-500">
                                                Total Received
                                            </p>
                                            <p className="mt-2 text-2xl font-bold text-slate-800">
                                                {selectedUnitProduct.totalReceivedQuantity ?? 0}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                                            <p className="text-xs font-medium text-green-700">
                                                Available
                                            </p>
                                            <p className="mt-2 text-2xl font-bold text-green-700">
                                                {selectedUnitProduct.availableQuantity ?? 0}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                                            <p className="text-xs font-medium text-blue-700">
                                                Assigned
                                            </p>
                                            <p className="mt-2 text-2xl font-bold text-blue-700">
                                                {selectedUnitProduct.assignedQuantity ?? 0}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                                            <p className="text-xs font-medium text-red-700">
                                                Damaged
                                            </p>
                                            <p className="mt-2 text-2xl font-bold text-red-700">
                                                {selectedUnitProduct.damagedQuantity ?? 0}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                                            <p className="text-xs font-medium text-orange-700">
                                                Under Repair
                                            </p>
                                            <p className="mt-2 text-2xl font-bold text-orange-700">
                                                {selectedUnitProduct.underRepairQuantity ?? 0}
                                            </p>
                                        </div>
                                    </div>

                                    {/* DEVICE LIST HEADER */}
                                    <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <h3 className="text-base font-bold text-slate-800">
                                                Individual Device List
                                            </h3>

                                            <p className="mt-1 text-xs text-slate-500">
                                                Search by Unit Code, Serial Number or Status.
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

                                            {/* UNIT SEARCH */}
                                            <div className="relative w-full sm:w-80">
                                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                    🔍
                                                </span>

                                                <input
                                                    type="text"
                                                    value={unitSearch}
                                                    onChange={(e) => setUnitSearch(e.target.value)}
                                                    placeholder="Search Unit Code / Serial Number..."
                                                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                />

                                                {unitSearch && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setUnitSearch('')}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 hover:text-red-500"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>

                                            <span className="whitespace-nowrap rounded-xl bg-blue-50 px-4 py-3 text-center text-xs font-bold text-blue-700">
                                                {filteredStockUnits.length} / {stockUnits.length} Devices
                                            </span>
                                        </div>
                                    </div>

                                    {/* DELETE INFORMATION */}
                                    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3.5">
                                        <span className="text-lg">ℹ️</span>
                                        <p className="text-xs leading-5 text-amber-800">
                                            Only Available and unassigned devices can be deleted. Assigned, Damaged and Under Repair devices cannot be deleted from this list.
                                        </p>
                                    </div>

                                    {/* LOADING */}
                                    {unitsLoading ? (
                                        <div className="rounded-xl border border-slate-200 p-12 text-center">
                                            <div className="mb-3 text-3xl">⏳</div>
                                            <p className="text-sm font-medium text-slate-500">
                                                Loading individual devices...
                                            </p>
                                        </div>
                                    ) : unitsError ? (
                                        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center">
                                            <p className="text-sm text-red-600">
                                                {unitsError}
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() => handleViewUnits(selectedUnitProduct)}
                                                className="mt-4 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                                            >
                                                Try Again
                                            </button>
                                        </div>
                                    ) : stockUnits.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">
                                            <div className="mb-3 text-4xl">📦</div>

                                            <h3 className="font-semibold text-slate-700">
                                                No Individual Devices Found
                                            </h3>

                                            <p className="mt-1 text-sm text-slate-500">
                                                No device units are registered under this product.
                                            </p>
                                        </div>
                                    ) : filteredStockUnits.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">
                                            <div className="mb-3 text-4xl">🔎</div>

                                            <h3 className="font-semibold text-slate-700">
                                                No Matching Devices Found
                                            </h3>

                                            <p className="mt-1 text-sm text-slate-500">
                                                No device matches "{unitSearch}".
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() => setUnitSearch('')}
                                                className="mt-4 rounded-lg bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                            >
                                                Clear Search
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                                            <table className="w-full min-w-[1050px] text-left text-sm">

                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-4 py-4 font-bold text-slate-600">
                                                            #
                                                        </th>

                                                        <th className="px-4 py-4 font-bold text-slate-600">
                                                            Unit Code
                                                        </th>

                                                        <th className="px-4 py-4 font-bold text-slate-600">
                                                            Serial Number
                                                        </th>

                                                        <th className="px-4 py-4 font-bold text-slate-600">
                                                            Status
                                                        </th>

                                                        <th className="px-4 py-4 font-bold text-slate-600">
                                                            Warranty
                                                        </th>

                                                        <th className="px-4 py-4 font-bold text-slate-600">
                                                            Receiving Date
                                                        </th>

                                                        <th className="px-4 py-4 font-bold text-slate-600">
                                                            Supplier
                                                        </th>

                                                        <th className="px-4 py-4 text-right font-bold text-slate-600">
                                                            Action
                                                        </th>
                                                    </tr>
                                                </thead>

                                                <tbody className="divide-y divide-slate-100">
                                                    {filteredStockUnits.map((unit, index) => {
                                                        const canDelete =
                                                            unit.status === 'Available' &&
                                                            !unit.asset;

                                                        const statusStyle = {
                                                            Available: 'bg-green-50 text-green-700',
                                                            Assigned: 'bg-blue-50 text-blue-700',
                                                            Damaged: 'bg-red-50 text-red-700',
                                                            'Under Repair': 'bg-orange-50 text-orange-700',
                                                            Returned: 'bg-purple-50 text-purple-700'
                                                        };

                                                        const receivedDate =
                                                            unit.receipt?.receivedDate ||
                                                            unit.createdAt;

                                                        const supplier =
                                                            unit.receipt?.supplier ||
                                                            selectedUnitProduct.supplierName;

                                                        return (
                                                            <tr
                                                                key={unit._id}
                                                                className="transition-colors hover:bg-slate-50"
                                                            >
                                                                <td className="px-4 py-4 text-slate-500">
                                                                    {index + 1}
                                                                </td>

                                                                <td className="px-4 py-4">
                                                                    <p className="font-semibold text-slate-800">
                                                                        {unit.unitCode || '—'}
                                                                    </p>
                                                                </td>

                                                                <td className="px-4 py-4">
                                                                    <p className="text-slate-600">
                                                                        {unit.serialNumber || 'Not provided'}
                                                                    </p>
                                                                </td>

                                                                <td className="px-4 py-4">
                                                                    <span
                                                                        className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                                                                            statusStyle[unit.status] ||
                                                                            'bg-slate-100 text-slate-600'
                                                                        }`}
                                                                    >
                                                                        {unit.status || 'Unknown'}
                                                                    </span>
                                                                </td>

                                                                <td className="px-4 py-4">
                                                                    <span className="text-slate-600">
                                                                        {selectedUnitProduct.warranty || 'Not specified'}
                                                                    </span>
                                                                </td>

                                                                <td className="px-4 py-4 text-slate-500">
                                                                    {receivedDate &&
                                                                    !Number.isNaN(new Date(receivedDate).getTime())
                                                                        ? new Date(receivedDate).toLocaleDateString()
                                                                        : '—'}
                                                                </td>

                                                                <td className="px-4 py-4">
                                                                    <span className="text-slate-600">
                                                                        {supplier || '—'}
                                                                    </span>
                                                                </td>

                                                                <td className="px-4 py-4 text-right">
                                                                    <button
                                                                        type="button"
                                                                        disabled={
                                                                            !canDelete ||
                                                                            deletingUnitId === unit._id
                                                                        }
                                                                        onClick={() => handleDeleteStockUnit(unit._id)}
                                                                        title={
                                                                            canDelete
                                                                                ? 'Delete this device'
                                                                                : 'Only available and unassigned devices can be deleted'
                                                                        }
                                                                        className="rounded-lg bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-red-50"
                                                                    >
                                                                        {deletingUnitId === unit._id
                                                                            ? 'Deleting...'
                                                                            : 'Delete'}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* MODAL FOOTER */}
                                    <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-xs text-slate-400">
                                            Showing {filteredStockUnits.length} of {stockUnits.length} devices
                                        </p>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedUnitProduct(null);
                                                setUnitSearch('');
                                            }}
                                            className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STOCK STATISTICS */}
                    <section className="mb-7">
                        <div className="mb-4">
                            <h2 className="text-base font-bold text-slate-800">
                                Stock Overview
                            </h2>
                            <p className="mt-1 text-xs text-slate-500">
                                Current inventory summary
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            {statCards.map((card, index) => (
                                <div
                                    key={index}
                                    className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">
                                                {card.title}
                                            </p>

                                            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-800">
                                                {card.value ?? 0}
                                            </h2>
                                        </div>

                                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${card.color}`}>
                                            {card.icon}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ADD / UPDATE FORM */}
                    {showForm && (
                        <section className="mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                                <h2 className="text-lg font-bold text-slate-800">
                                    {editingId ? 'Update Stock Product' : 'Add New Stock Product'}
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    Enter product information, warranty, supplier and stock quantity.
                                </p>
                            </div>

                            <form onSubmit={handleAddStock} className="p-5 sm:p-6">
                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">

                                    {[
                                        { label: 'Product Name *', name: 'name', placeholder: 'e.g. Keyboard' },
                                        { label: 'Category *', name: 'category', placeholder: 'e.g. Accessories' },
                                        { label: 'Brand', name: 'brand', placeholder: 'e.g. Logitech' },
                                        { label: 'Model', name: 'model', placeholder: 'e.g. K120' },
                                        { label: 'SKU / Product Code', name: 'sku', placeholder: 'e.g. KEY-001' },
                                        { label: 'Received Quantity *', name: 'totalReceivedQuantity', placeholder: 'e.g. 20', type: 'number' },
                                        { label: 'Minimum Stock Level', name: 'minimumStockLevel', placeholder: 'e.g. 5', type: 'number' },
                                        { label: 'Warranty', name: 'warranty', placeholder: 'e.g. 1 Year / 2 Years' },
                                        { label: 'Supplier Name', name: 'supplierName', placeholder: 'e.g. ABC Technology Ltd.' }
                                    ].map(field => (
                                        <div key={field.name}>
                                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                                {field.label}
                                            </label>

                                            <input
                                                type={field.type || 'text'}
                                                name={field.name}
                                                value={formData[field.name]}
                                                onChange={handleInputChange}
                                                placeholder={field.placeholder}
                                                min={field.type === 'number' ? 0 : undefined}
                                                required={
                                                    field.name === 'name' ||
                                                    field.name === 'category' ||
                                                    field.name === 'totalReceivedQuantity'
                                                }
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </div>
                                    ))}

                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                                            Unit
                                        </label>

                                        <select
                                            name="unit"
                                            value={formData.unit}
                                            onChange={handleInputChange}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        >
                                            {['Piece', 'Box', 'Pack', 'Set', 'Meter', 'Roll'].map(unit => (
                                                <option key={unit} value={unit}>
                                                    {unit}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* SERIAL NUMBER INPUTS */}
                                    {getAdditionalQuantity() > 0 && (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2 lg:col-span-3">
                                            <div className="mb-4">
                                                <label className="block text-sm font-semibold text-slate-700">
                                                    Individual Serial Numbers (Optional)
                                                </label>

                                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                                    {editingId
                                                        ? `You are adding ${getAdditionalQuantity()} new units. Enter serial numbers only for these additional units.`
                                                        : `Enter serial numbers for ${getAdditionalQuantity()} new units.`
                                                    }
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                {serialNumbers.map((serial, index) => (
                                                    <div key={index}>
                                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                                                            New Device {index + 1} Serial Number
                                                        </label>

                                                        <input
                                                            type="text"
                                                            value={serial}
                                                            onChange={(e) =>
                                                                handleSerialNumberChange(
                                                                    index,
                                                                    e.target.value
                                                                )
                                                            }
                                                            placeholder={`Serial number ${index + 1}`}
                                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="md:col-span-2 lg:col-span-3">
                                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                                            Description
                                        </label>

                                        <textarea
                                            name="description"
                                            value={formData.description}
                                            onChange={handleInputChange}
                                            rows="3"
                                            placeholder="Write product details..."
                                            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {saving
                                            ? 'Saving...'
                                            : editingId
                                                ? 'Update Product'
                                                : 'Save Product'
                                        }
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            resetForm();
                                            setShowForm(false);
                                        }}
                                        className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </section>
                    )}

                    {/* PRODUCTS AND SKU LIST */}
                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_230px]">

                        {/* PRODUCT LIST */}
                        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                            <div className="border-b border-slate-100 p-5 sm:p-6">
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800">
                                            All Stock Products
                                        </h2>

                                        <p className="mt-1 text-sm text-slate-500">
                                            {filteredItems.length} products found
                                        </p>
                                    </div>

                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search product, category, SKU..."
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 xl:max-w-sm"
                                    />
                                </div>

                                {selectedSku && (
                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                                        <div>
                                            <p className="text-xs font-medium text-blue-600">
                                                Filtered by SKU
                                            </p>
                                            <p className="mt-0.5 text-sm font-bold text-blue-800">
                                                {selectedSku}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setSelectedSku('')}
                                            className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                                        >
                                            Show All Products
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 sm:p-5">
                                {loading ? (
                                    <div className="p-12 text-center text-sm text-slate-500">
                                        Loading stock inventory...
                                    </div>
                                ) : error ? (
                                    <div className="p-8 text-center">
                                        <p className="mb-4 text-sm text-red-600">
                                            {error}
                                        </p>

                                        <button
                                            onClick={fetchStockData}
                                            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                ) : filteredItems.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center">
                                        <div className="mb-3 text-4xl">📦</div>

                                        <h3 className="font-semibold text-slate-700">
                                            No Stock Products Found
                                        </h3>

                                        <p className="mt-1 text-sm text-slate-500">
                                            Add a new product to get started.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                                        {filteredItems.map(item => {
                                            const isLowStock =
                                                item.availableQuantity <= item.minimumStockLevel;

                                            const details = quantityDetails(item);

                                            return (
                                                <article
                                                    key={item._id}
                                                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-md"
                                                >
                                                    {/* PRODUCT HEADER */}
                                                    <div className="border-b border-slate-100 bg-slate-50 p-5">
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <h3 className="text-lg font-bold text-slate-800">
                                                                        {item.name}
                                                                    </h3>

                                                                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                                                                        isLowStock
                                                                            ? 'bg-red-50 text-red-600'
                                                                            : 'bg-green-50 text-green-700'
                                                                    }`}>
                                                                        {isLowStock ? 'Low Stock' : 'In Stock'}
                                                                    </span>
                                                                </div>

                                                                <p className="mt-2 text-sm text-slate-500">
                                                                    {[item.brand, item.model].filter(Boolean).join(' / ') || 'No brand or model'}
                                                                </p>
                                                            </div>

                                                            <div className="shrink-0 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 sm:min-w-[115px] sm:text-center">
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                                                                    SKU / Code
                                                                </p>

                                                                <p className="mt-1 break-all text-sm font-bold text-blue-800">
                                                                    {item.sku || 'Not set'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* PRODUCT DETAILS */}
                                                    <div className="p-5">
                                                        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                                                            <div>
                                                                <p className="text-xs font-medium text-slate-400">
                                                                    Category
                                                                </p>
                                                                <p className="mt-1 text-sm font-semibold text-slate-700">
                                                                    {item.category || '—'}
                                                                </p>
                                                            </div>

                                                            <div>
                                                                <p className="text-xs font-medium text-slate-400">
                                                                    Unit
                                                                </p>
                                                                <p className="mt-1 text-sm font-semibold text-slate-700">
                                                                    {item.unit || 'Piece'}
                                                                </p>
                                                            </div>

                                                            <div>
                                                                <p className="text-xs font-medium text-slate-400">
                                                                    Minimum Stock
                                                                </p>
                                                                <p className="mt-1 text-sm font-semibold text-slate-700">
                                                                    {item.minimumStockLevel ?? 0}
                                                                </p>
                                                            </div>

                                                            <div>
                                                                <p className="text-xs font-medium text-slate-400">
                                                                    Warranty
                                                                </p>
                                                                <p className="mt-1 text-sm font-semibold text-slate-700">
                                                                    {item.warranty || 'Not specified'}
                                                                </p>
                                                            </div>

                                                            <div className="col-span-2">
                                                                <p className="text-xs font-medium text-slate-400">
                                                                    Supplier Name
                                                                </p>
                                                                <p className="mt-1 break-words text-sm font-semibold text-slate-700">
                                                                    {item.supplierName || 'Not specified'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* QUANTITY OVERVIEW */}
                                                        <div className="border-t border-slate-100 pt-4">
                                                            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                                                                Quantity Overview
                                                            </p>

                                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                                                {details.map(detail => (
                                                                    <div
                                                                        key={detail.label}
                                                                        className={`rounded-xl p-3 ${detail.background}`}
                                                                    >
                                                                        <p className="text-xs font-medium text-slate-500">
                                                                            {detail.label}
                                                                        </p>

                                                                        <p className={`mt-1 text-xl font-bold ${detail.color}`}>
                                                                            {detail.value}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* DESCRIPTION */}
                                                        {item.description && (
                                                            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                                                                <p className="text-xs font-semibold text-slate-500">
                                                                    Description
                                                                </p>

                                                                <p className="mt-1 text-sm leading-6 text-slate-600">
                                                                    {item.description}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* ACTION BUTTONS */}
                                                        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">

                                                            {/* VIEW INDIVIDUAL DEVICES */}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleViewUnits(item)}
                                                                className="rounded-lg bg-purple-50 px-3.5 py-2.5 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100"
                                                            >
                                                                View Units ({item.totalReceivedQuantity ?? 0})
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingId(null);
                                                                    setSerialNumbers([]);

                                                                    setFormData({
                                                                        name: item.name || '',
                                                                        category: item.category || '',
                                                                        brand: item.brand || '',
                                                                        model: item.model || '',
                                                                        sku: item.sku || '',
                                                                        warranty: item.warranty || '',
                                                                        supplierName: item.supplierName || '',
                                                                        unit: item.unit || 'Piece',
                                                                        totalReceivedQuantity: '',
                                                                        minimumStockLevel: item.minimumStockLevel ?? 5,
                                                                        description: item.description || ''
                                                                    });

                                                                    setShowForm(true);

                                                                    window.scrollTo({
                                                                        top: 0,
                                                                        behavior: 'smooth'
                                                                    });
                                                                }}
                                                                className="rounded-lg bg-green-600 px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-700"
                                                            >
                                                                + Receive Stock
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    handleEditStock(item);

                                                                    window.scrollTo({
                                                                        top: 0,
                                                                        behavior: 'smooth'
                                                                    });
                                                                }}
                                                                className="rounded-lg bg-blue-50 px-3.5 py-2.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                                                            >
                                                                Update Product
                                                            </button>

                                                            <button
                                                                onClick={() => handleDeleteStock(item._id)}
                                                                className="rounded-lg bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* SKU LIST */}
                        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24">
                            <div className="border-b border-slate-100 p-5">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <h2 className="text-base font-bold text-slate-800">
                                            SKU List
                                        </h2>

                                        <p className="mt-1 text-xs text-slate-500">
                                            Select a SKU to filter products
                                        </p>
                                    </div>

                                    <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-slate-100 px-2 text-xs font-bold text-slate-600">
                                        {uniqueSkus.length}
                                    </span>
                                </div>
                            </div>

                            <div className="p-4">
                                {loading ? (
                                    <p className="py-5 text-center text-sm text-slate-400">
                                        Loading...
                                    </p>
                                ) : uniqueSkus.length === 0 ? (
                                    <p className="py-5 text-center text-sm text-slate-400">
                                        No SKU available
                                    </p>
                                ) : (
                                    <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto pr-1">
                                        {uniqueSkus.map(sku => (
                                            <button
                                                key={sku}
                                                type="button"
                                                onClick={() => handleSkuClick(sku)}
                                                title={sku}
                                                className={`w-full break-all rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors ${
                                                    selectedSku === sku
                                                        ? 'border-blue-600 bg-blue-600 text-white'
                                                        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                                                }`}
                                            >
                                                {sku}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {selectedSku && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedSku('')}
                                        className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                                    >
                                        Clear SKU Filter
                                    </button>
                                )}
                            </div>
                        </aside>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default StockInventory;
