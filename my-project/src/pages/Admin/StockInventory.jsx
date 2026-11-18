
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
    const [receivingStockId, setReceivingStockId] = useState(null);
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
        setReceivingStockId(null);
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

        const isEditing = Boolean(editingId);
        const isReceiving = Boolean(receivingStockId);

        const quantity = Number(formData.totalReceivedQuantity);

        if (
            !Number.isSafeInteger(quantity) ||
            quantity < (isReceiving ? 1 : 0)
        ) {
            alert(
                isReceiving
                    ? 'Please enter a valid Received Quantity (minimum 1)'
                    : 'Please enter a valid Received Quantity'
            );
            return;
        }

        const additionalQuantity = getAdditionalQuantity();

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
            let requestUrl = API_URL;
            let requestMethod = 'POST';
            let requestBody = {};

            if (isReceiving) {
                // RECEIVE STOCK INTO AN EXISTING PRODUCT
                requestUrl = `${API_URL}/${receivingStockId}/receive`;
                requestMethod = 'POST';

                requestBody = {
                    quantity,
                    serialNumbers: serialNumbers.map(serial =>
                        serial.trim()
                    ),
                    supplier: formData.supplierName.trim(),
                    description: formData.description.trim()
                };

            } else if (isEditing) {
                // UPDATE EXISTING PRODUCT
                requestUrl = `${API_URL}/${editingId}`;
                requestMethod = 'PUT';

                requestBody = {
                    ...formData,
                    totalReceivedQuantity: quantity,
                    minimumStockLevel: Number(
                        formData.minimumStockLevel
                    ),
                    serialNumbers: serialNumbers.map(serial =>
                        serial.trim()
                    )
                };

            } else {
                // CREATE NEW PRODUCT
                requestUrl = API_URL;
                requestMethod = 'POST';

                requestBody = {
                    ...formData,
                    totalReceivedQuantity: quantity,
                    minimumStockLevel: Number(
                        formData.minimumStockLevel
                    ),
                    serialNumbers: serialNumbers.map(serial =>
                        serial.trim()
                    )
                };
            }

            const response = await fetch(requestUrl, {
                method: requestMethod,
                headers: getHeaders(),
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Failed to save stock item'
                );
            }

            alert(
                data.message ||
                (
                    isReceiving
                        ? 'Stock received successfully!'
                        : isEditing
                            ? 'Stock item updated successfully!'
                            : 'Stock item added successfully!'
                )
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
        setReceivingStockId(null);
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
            color: 'bg-orange-50 text-orange-600'
        },
        {
            title: 'Available Stock',
            value: stats.available,
            icon: '✅',
            color: 'bg-blue-50 text-blue-600'
        },
        {
            title: 'Assigned',
            value: stats.assigned,
            icon: '🏢',
            color: 'bg-blue-50 text-blue-600'
        },
        {
            title: 'Damaged',
            value: stats.damaged,
            icon: '⚠️',
            color: 'bg-orange-50 text-orange-600'
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
            color: 'bg-orange-50 text-orange-600'
        },
        {
            title: 'Low Stock',
            value: stats.lowStock,
            icon: '📉',
            color: 'bg-orange-50 text-orange-600'
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
            color: 'text-blue-700',
            background: 'bg-blue-50'
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
            color: 'text-orange-700',
            background: 'bg-orange-50'
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
            color: 'text-orange-700',
            background: 'bg-orange-50'
        }
    ];

    return (
        <div className="flex min-h-screen min-w-0 bg-slate-50">

            <AdminSidebar />

            <main className="min-w-0 flex-1 lg:ml-64">

                {/* TOP HEADER */}
                <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b-2 border-orange-500 bg-white px-4 py-4 sm:px-6 lg:px-8">
                    <div className="min-w-0">
                        <p className="break-words text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">
                            UMC / ADMIN / {activeMenu}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                            United Medical College
                        </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                        <div className="hidden text-right sm:block">
                            <p className="text-sm font-semibold text-slate-800">
                                {user?.name || 'Administrator'}
                            </p>
                            <p className="text-xs text-slate-500">
                                IT Administrator
                            </p>
                        </div>

                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-orange-200 bg-orange-100 font-bold text-orange-600">
                            {user?.name?.charAt(0) || 'A'}
                        </div>
                    </div>
                </header>

                <div className="mx-auto min-w-0 max-w-[1600px] p-3 sm:p-6 lg:p-8">

                    {/* PAGE TITLE */}
                    <div className="mb-7 rounded-2xl border border-blue-100 border-t-4 border-t-orange-500 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                            <div className="min-w-0">
                                <button
                                    onClick={() => navigate('/admin/dashboard')}
                                    className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-orange-600 transition-colors hover:text-orange-700"
                                >
                                    <span>←</span>
                                    Back to Dashboard
                                </button>

                                <h1 className="break-words text-2xl font-bold tracking-tight text-blue-950 sm:text-3xl">
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
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
                                >
                                    <span>▦</span>
                                    Scan QR / Barcode
                                </button>

                                <button
                                    onClick={() => {
                                        resetForm();
                                        setShowForm(!showForm);
                                    }}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800"
                                >
                                    {showForm ? 'Close Form' : '+ Manual Add Product'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* SCANNER MODAL */}
                    {showScanner && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-4">
                            <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-2xl">
                                <div className="flex items-center justify-between gap-3 border-b border-orange-100 bg-blue-950 p-4 text-white sm:p-5">
                                    <div className="min-w-0">
                                        <h2 className="break-words text-lg font-bold">
                                            QR / Barcode Scanner
                                        </h2>
                                        <p className="mt-1 text-sm text-blue-100">
                                            Place the product code in front of the camera.
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => setShowScanner(false)}
                                        className="shrink-0 rounded-lg bg-orange-500 px-3 py-2 font-bold text-white transition-colors hover:bg-orange-600"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="p-4 sm:p-5">
                                    <div
                                        id="stock-code-reader"
                                        className="w-full overflow-hidden rounded-xl border border-slate-200"
                                    />

                                    {scannerError && (
                                        <p className="mt-4 break-words rounded-lg bg-orange-50 p-3 text-sm text-orange-700">
                                            {scannerError}
                                        </p>
                                    )}

                                    <p className="mt-4 text-center text-xs text-slate-500">
                                        Supports QR Code, Code 128, EAN-13, UPC and other common formats.
                                    </p>

                                    <button
                                        onClick={() => setShowScanner(false)}
                                        className="mt-5 w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
                                    >
                                        Close Scanner
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* INDIVIDUAL STOCK UNITS MODAL */}
                    {selectedUnitProduct && (
                        <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-slate-950/75 p-2 backdrop-blur-sm sm:items-center sm:p-4">
                            <div className="my-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl min-w-0 flex-col overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-2xl sm:max-h-[94dvh]">

                                {/* MODAL HEADER */}
                                <div className="relative shrink-0 overflow-hidden border-b-4 border-orange-500 bg-gradient-to-r from-blue-700 via-blue-900 to-blue-950 px-4 py-5 text-white sm:px-7 sm:py-6">
                                    <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5" />
                                    <div className="absolute -bottom-20 right-32 h-40 w-40 rounded-full bg-orange-400/10" />

                                    <div className="relative flex items-start justify-between gap-3 sm:gap-4">
                                        <div className="min-w-0 flex-1">
                                            <h2 className="break-words text-lg font-bold leading-snug sm:text-2xl">
                                                {selectedUnitProduct.name}
                                            </h2>

                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <span className="rounded-lg bg-orange-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                                                    Stock Inventory
                                                </span>

                                                <span className="break-words text-xs text-blue-100">
                                                    Individual Devices
                                                </span>
                                            </div>

                                            <p className="mt-2 break-words text-sm font-medium text-blue-100">
                                                {[selectedUnitProduct.brand, selectedUnitProduct.model].filter(Boolean).join(' / ') || 'Device Management'}
                                            </p>

                                            {selectedUnitProduct.sku && (
                                                <p className="mt-1 break-all text-xs text-blue-200">
                                                    SKU: {selectedUnitProduct.sku}
                                                </p>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedUnitProduct(null);
                                                setUnitSearch('');
                                            }}
                                            className="relative shrink-0 rounded-xl border border-orange-300/40 bg-orange-500 px-3.5 py-2.5 font-bold text-white transition-colors hover:bg-orange-600"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>

                                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6">

                                    {/* UNIT SUMMARY */}
                                    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">

                                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 sm:p-4">
                                            <p className="break-words text-xs font-medium text-blue-700">
                                                Total Received
                                            </p>
                                            <p className="mt-2 text-2xl font-bold text-blue-950">
                                                {selectedUnitProduct.totalReceivedQuantity ?? 0}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-blue-100 bg-white p-3 sm:p-4">
                                            <p className="text-xs font-medium text-blue-700">
                                                Available
                                            </p>
                                            <p className="mt-2 text-2xl font-bold text-blue-700">
                                                {selectedUnitProduct.availableQuantity ?? 0}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 sm:p-4">
                                            <p className="text-xs font-medium text-blue-700">
                                                Assigned
                                            </p>
                                            <p className="mt-2 text-2xl font-bold text-blue-700">
                                                {selectedUnitProduct.assignedQuantity ?? 0}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-orange-100 bg-orange-50 p-3 sm:p-4">
                                            <p className="text-xs font-medium text-orange-700">
                                                Damaged
                                            </p>
                                            <p className="mt-2 text-2xl font-bold text-orange-700">
                                                {selectedUnitProduct.damagedQuantity ?? 0}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 sm:p-4">
                                            <p className="break-words text-xs font-medium text-orange-700">
                                                Under Repair
                                            </p>
                                            <p className="mt-2 text-2xl font-bold text-orange-700">
                                                {selectedUnitProduct.underRepairQuantity ?? 0}
                                            </p>
                                        </div>
                                    </div>

                                    {/* DEVICE LIST HEADER */}
                                    <div className="mb-4 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="min-w-0">
                                            <h3 className="text-base font-bold text-blue-950">
                                                Individual Device List
                                            </h3>

                                            <p className="mt-1 break-words text-xs text-slate-500">
                                                Search by Unit Code, Serial Number or Status.
                                            </p>
                                        </div>

                                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                                            <div className="relative w-full sm:w-80">
                                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                    🔍
                                                </span>

                                                <input
                                                    type="text"
                                                    value={unitSearch}
                                                    onChange={(e) => setUnitSearch(e.target.value)}
                                                    placeholder="Search Unit Code / Serial Number..."
                                                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                                                />

                                                {unitSearch && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setUnitSearch('')}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 hover:text-orange-600"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>

                                            <span className="whitespace-nowrap rounded-xl bg-orange-50 px-4 py-3 text-center text-xs font-bold text-orange-700">
                                                {filteredStockUnits.length} / {stockUnits.length} Devices
                                            </span>
                                        </div>
                                    </div>

                                    {/* DELETE INFORMATION */}
                                    <div className="mb-4 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3.5">
                                        <span className="text-lg">ℹ️</span>
                                        <p className="break-words text-xs leading-5 text-orange-800">
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
                                        <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 text-center">
                                            <p className="break-words text-sm text-orange-700">
                                                {unitsError}
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() => handleViewUnits(selectedUnitProduct)}
                                                className="mt-4 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
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

                                            <p className="mt-1 break-words text-sm text-slate-500">
                                                No device matches "{unitSearch}".
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() => setUnitSearch('')}
                                                className="mt-4 rounded-lg bg-orange-50 px-4 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100"
                                            >
                                                Clear Search
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-full max-w-full overflow-x-auto rounded-xl border border-slate-200">
                                            <table className="w-full min-w-[950px] text-left text-sm">
                                                <thead className="bg-blue-950">
                                                    <tr>
                                                        <th className="whitespace-nowrap px-4 py-4 font-bold text-white">#</th>
                                                        <th className="whitespace-nowrap px-4 py-4 font-bold text-white">Unit Code</th>
                                                        <th className="whitespace-nowrap px-4 py-4 font-bold text-white">Serial Number</th>
                                                        <th className="whitespace-nowrap px-4 py-4 font-bold text-white">Status</th>
                                                        <th className="whitespace-nowrap px-4 py-4 font-bold text-white">Warranty</th>
                                                        <th className="whitespace-nowrap px-4 py-4 font-bold text-white">Receiving Date</th>
                                                        <th className="whitespace-nowrap px-4 py-4 font-bold text-white">Supplier</th>
                                                        <th className="whitespace-nowrap px-4 py-4 text-right font-bold text-white">Action</th>
                                                    </tr>
                                                </thead>

                                                <tbody className="divide-y divide-slate-100">
                                                    {filteredStockUnits.map((unit, index) => {
                                                        const canDelete =
                                                            unit.status === 'Available' &&
                                                            !unit.asset;

                                                        const statusStyle = {
                                                            Available: 'bg-blue-50 text-blue-700',
                                                            Assigned: 'bg-blue-100 text-blue-800',
                                                            Damaged: 'bg-orange-100 text-orange-700',
                                                            'Under Repair': 'bg-orange-50 text-orange-700',
                                                            Returned: 'bg-blue-50 text-blue-700'
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
                                                                className="transition-colors hover:bg-blue-50/50"
                                                            >
                                                                <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                                                                    {index + 1}
                                                                </td>

                                                                <td className="px-4 py-4">
                                                                    <p className="break-all font-semibold text-slate-800">
                                                                        {unit.unitCode || '—'}
                                                                    </p>
                                                                </td>

                                                                <td className="px-4 py-4">
                                                                    <p className="break-all text-slate-600">
                                                                        {unit.serialNumber || 'Not provided'}
                                                                    </p>
                                                                </td>

                                                                <td className="px-4 py-4">
                                                                    <div className="flex flex-row flex-wrap items-center gap-2">
                                                                        <span
                                                                            className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                                                                                statusStyle[unit.status] ||
                                                                                'bg-slate-100 text-slate-600'
                                                                            }`}
                                                                        >
                                                                            {unit.status || 'Unknown'}
                                                                        </span>

                                                                        {/* REPAIRED BADGE */}
                                                                        {unit.isRepaired && (
                                                                            <span
                                                                                title={
                                                                                    unit.repairedAt
                                                                                        ? `Repaired on ${new Date(unit.repairedAt).toLocaleDateString()}`
                                                                                        : 'This device has been repaired'
                                                                                }
                                                                                className="inline-flex whitespace-nowrap rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700"
                                                                            >
                                                                                🔧 Repaired
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>

                                                                <td className="px-4 py-4">
                                                                    <span className="break-words text-slate-600">
                                                                        {selectedUnitProduct.warranty || 'Not specified'}
                                                                    </span>
                                                                </td>

                                                                <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                                                                    {receivedDate &&
                                                                    !Number.isNaN(new Date(receivedDate).getTime())
                                                                        ? new Date(receivedDate).toLocaleDateString()
                                                                        : '—'}
                                                                </td>

                                                                <td className="px-4 py-4">
                                                                    <span className="break-words text-slate-600">
                                                                        {supplier || '—'}
                                                                    </span>
                                                                </td>

                                                                <td className="whitespace-nowrap px-4 py-4 text-right">
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
                                                                        className="rounded-lg bg-orange-50 px-3.5 py-2 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-orange-50"
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
                                        <p className="break-words text-xs text-slate-400">
                                            Showing {filteredStockUnits.length} of {stockUnits.length} devices
                                        </p>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedUnitProduct(null);
                                                setUnitSearch('');
                                            }}
                                            className="w-full rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 sm:w-auto"
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
                            <h2 className="text-base font-bold text-blue-950">
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
                                    className="group rounded-2xl border border-blue-100 border-l-4 border-l-orange-400 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">
                                                {card.title}
                                            </p>

                                            <h2 className="mt-2 text-2xl font-bold tracking-tight text-blue-950">
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
                        <section className="mb-7 overflow-hidden rounded-2xl border border-blue-100 border-t-4 border-t-orange-500 bg-white shadow-sm">
                            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                                <h2 className="text-lg font-bold text-blue-950">
                                    {receivingStockId
                                        ? 'Receive Stock'
                                        : editingId
                                            ? 'Update Stock Product'
                                            : 'Add New Stock Product'}
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
                                                min={field.type === 'number' ? (receivingStockId && field.name === 'totalReceivedQuantity' ? 1 : 0) : undefined}
                                                required={
                                                    field.name === 'name' ||
                                                    field.name === 'category' ||
                                                    field.name === 'totalReceivedQuantity'
                                                }
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
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
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
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
                                        <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4 md:col-span-2 lg:col-span-3">
                                            <div className="mb-4">
                                                <label className="block text-sm font-semibold text-blue-950">
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
                                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
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
                                            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                                        />
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {saving
                                            ? 'Saving...'
                                            : receivingStockId
                                                ? 'Receive Stock'
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
                                        className="rounded-xl border border-orange-200 px-6 py-3 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </section>
                    )}

                    {/* PRODUCTS AND SKU LIST */}
                    <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_230px]">

                        {/* PRODUCT LIST */}
                        <section className="min-w-0 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">

                            <div className="border-b border-orange-100 p-5 sm:p-6">
                                <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-bold text-blue-950">
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
                                        className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 xl:max-w-sm"
                                    />
                                </div>

                                {selectedSku && (
                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-orange-700">
                                                Filtered by SKU
                                            </p>
                                            <p className="mt-0.5 break-all text-sm font-bold text-blue-900">
                                                {selectedSku}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setSelectedSku('')}
                                            className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-100"
                                        >
                                            Show All Products
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="min-w-0 p-3 sm:p-5">
                                {loading ? (
                                    <div className="p-12 text-center text-sm text-slate-500">
                                        Loading stock inventory...
                                    </div>
                                ) : error ? (
                                    <div className="p-8 text-center">
                                        <p className="mb-4 break-words text-sm text-orange-700">
                                            {error}
                                        </p>

                                        <button
                                            onClick={fetchStockData}
                                            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
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
                                    <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
                                        {filteredItems.map(item => {
                                            const isLowStock =
                                                item.availableQuantity <= item.minimumStockLevel;

                                            const details = quantityDetails(item);

                                            return (
                                                <article
                                                    key={item._id}
                                                    className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white transition-shadow hover:shadow-md"
                                                >
                                                    {/* PRODUCT HEADER */}
                                                    <div className="border-b border-orange-100 bg-blue-50/60 p-4 sm:p-5">
                                                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                                    <h3 className="min-w-0 break-words text-lg font-bold text-blue-950">
                                                                        {item.name}
                                                                    </h3>

                                                                    <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                                                                        isLowStock
                                                                            ? 'bg-orange-100 text-orange-700'
                                                                            : 'bg-blue-100 text-blue-700'
                                                                    }`}>
                                                                        {isLowStock ? 'Low Stock' : 'In Stock'}
                                                                    </span>
                                                                </div>

                                                                <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                                                                    {[item.brand, item.model].filter(Boolean).join(' / ') || 'No brand or model'}
                                                                </p>
                                                            </div>

                                                            <div className="w-full min-w-0 rounded-xl border border-blue-200 bg-white px-3 py-2.5 sm:w-auto sm:shrink-0 sm:min-w-[115px] sm:text-center">
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                                                                    SKU / Code
                                                                </p>

                                                                <p className="mt-1 break-all text-sm font-bold text-blue-900">
                                                                    {item.sku || 'Not set'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* PRODUCT DETAILS */}
                                                    <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
                                                        <div className="mb-5 grid min-w-0 grid-cols-2 gap-4 sm:grid-cols-3">
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-medium text-slate-400">
                                                                    Category
                                                                </p>
                                                                <p className="mt-1 break-words text-sm font-semibold text-slate-700">
                                                                    {item.category || '—'}
                                                                </p>
                                                            </div>

                                                            <div className="min-w-0">
                                                                <p className="text-xs font-medium text-slate-400">
                                                                    Unit
                                                                </p>
                                                                <p className="mt-1 break-words text-sm font-semibold text-slate-700">
                                                                    {item.unit || 'Piece'}
                                                                </p>
                                                            </div>

                                                            <div className="min-w-0">
                                                                <p className="text-xs font-medium text-slate-400">
                                                                    Minimum Stock
                                                                </p>
                                                                <p className="mt-1 break-words text-sm font-semibold text-slate-700">
                                                                    {item.minimumStockLevel ?? 0}
                                                                </p>
                                                            </div>

                                                            <div className="min-w-0">
                                                                <p className="text-xs font-medium text-slate-400">
                                                                    Warranty
                                                                </p>
                                                                <p className="mt-1 break-words text-sm font-semibold text-slate-700">
                                                                    {item.warranty || 'Not specified'}
                                                                </p>
                                                            </div>

                                                            <div className="col-span-2 min-w-0">
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
                                                            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-blue-700">
                                                                Quantity Overview
                                                            </p>

                                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                                                {details.map(detail => (
                                                                    <div
                                                                        key={detail.label}
                                                                        className={`min-w-0 rounded-xl p-3 ${detail.background}`}
                                                                    >
                                                                        <p className="break-words text-xs font-medium text-slate-500">
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
                                                        <div className="mt-4 min-h-[100px] max-h-40 shrink-0 overflow-y-auto rounded-xl border border-orange-100 bg-orange-50/40 p-3">
                                                            <p className="text-xs font-semibold text-blue-800">
                                                                Description
                                                            </p>

                                                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                                                                {item.description || 'No description available.'}
                                                            </p>
                                                        </div>

                                                        {/* ACTION BUTTONS */}
                                                        <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-4">

                                                            {/* VIEW INDIVIDUAL DEVICES */}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleViewUnits(item)}
                                                                className="rounded-lg bg-orange-50 px-3.5 py-2.5 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-100"
                                                            >
                                                                View Units ({item.totalReceivedQuantity ?? 0})
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingId(null);
                                                                    setReceivingStockId(item._id);
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
                                                                className="rounded-lg bg-blue-700 px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-800"
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
                                                                className="rounded-lg bg-orange-50 px-3.5 py-2.5 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-100"
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
                        <aside className="min-w-0 overflow-hidden rounded-2xl border border-blue-100 border-t-4 border-t-orange-500 bg-white shadow-sm lg:sticky lg:top-24">
                            <div className="border-b border-orange-100 p-5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <h2 className="text-base font-bold text-blue-950">
                                            SKU List
                                        </h2>

                                        <p className="mt-1 text-xs text-slate-500">
                                            Select a SKU to filter products
                                        </p>
                                    </div>

                                    <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 px-2 text-xs font-bold text-orange-700">
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
                                                        ? 'border-blue-700 bg-blue-700 text-white'
                                                        : 'border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700'
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
                                        className="mt-4 w-full rounded-xl border border-orange-200 px-3 py-2.5 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-50"
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
