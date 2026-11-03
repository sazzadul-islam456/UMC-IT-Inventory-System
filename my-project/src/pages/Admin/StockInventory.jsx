
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import AdminSidebar from '../../components/AdminSidebar.jsx';

// STOCK INVENTORY PAGE - Search: STOCK INVENTORY PAGE

const API_URL = 'http://localhost:3000/api/stock';

const StockInventory = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // STOCK PAGE TITLE
    const activeMenu = 'Stock Inventory';

    // STOCK INVENTORY STATE - Search: STOCK INVENTORY STATE
    // EDIT STOCK STATE - Search: EDIT STOCK STATE
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

    // QR AND BARCODE SCANNER STATE - Search: QR AND BARCODE SCANNER STATE
    const [showScanner, setShowScanner] = useState(false);
    const [scannerError, setScannerError] = useState('');
    const scannerRef = useRef(null);

    const [formData, setFormData] = useState({
        name: '',
        category: '',
        brand: '',
        model: '',
        sku: '',
        unit: 'Piece',
        totalReceivedQuantity: '',
        minimumStockLevel: 5,
        description: ''
    });

    // STOCK API HEADERS - Search: STOCK API HEADERS
    const getHeaders = () => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('pos-token')}`
    });

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
                throw new Error(stockData.message || 'Failed to load stock items');
            }

            if (!statsResponse.ok) {
                throw new Error(statsData.message || 'Failed to load stock statistics');
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

    // QR AND BARCODE SCANNER - Search: QR AND BARCODE SCANNER
    useEffect(() => {
        if (!showScanner) return;

        let scanner = null;
        let cancelled = false;
        let scanCompleted = false;

        const startScanner = async () => {
            try {
                // STEP 1: Get available cameras
                const cameras = await Html5Qrcode.getCameras();

                if (cancelled) return;

                if (!cameras || cameras.length === 0) {
                    throw new Error('No camera found on this device.');
                }

                // STEP 2: Select rear camera if available.
                // Otherwise, use the first available camera.
                const selectedCamera =
                    cameras.find(camera =>
                        /back|rear|environment/i.test(camera.label)
                    ) || cameras[0];

                // STEP 3: Create scanner
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

                // STEP 4: Start camera
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

                        // Stop camera after successful scan
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

                        // Close scanner modal
                        setShowScanner(false);
                        setScannerError('');

                        // STEP 5: Check existing product SKU
                        const existingItem = stockItems.find(
                            item =>
                                item.sku?.trim().toLowerCase() ===
                                scannedCode.toLowerCase()
                        );

                        if (existingItem) {
                            alert(`Product already exists: ${existingItem.name}`);

                            // Open existing product for editing
                            handleEditStock(existingItem);
                        } else {
                            // New product: open form with scanned SKU
                            setEditingId(null);

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
                    () => {
                        // Ignore continuous scanning errors
                    }
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

        // STEP 6: Cleanup when scanner closes
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

    // HANDLE FORM INPUT - Search: HANDLE FORM INPUT
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // ADD OR UPDATE STOCK ITEM - Search: ADD OR UPDATE STOCK ITEM
    const handleAddStock = async (e) => {
        e.preventDefault();

        if (!formData.name.trim() || !formData.category.trim()) {
            alert('Product name and category are required');
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
                        totalReceivedQuantity: Number(formData.totalReceivedQuantity),
                        minimumStockLevel: Number(formData.minimumStockLevel)
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save stock item');
            }

            alert(isEditing
                ? 'Stock item updated successfully!'
                : 'Stock item added successfully!'
            );

            setFormData({
                name: '',
                category: '',
                brand: '',
                model: '',
                sku: '',
                unit: 'Piece',
                totalReceivedQuantity: '',
                minimumStockLevel: 5,
                description: ''
            });

            setEditingId(null);
            setShowForm(false);

            await fetchStockData();

        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    // EDIT STOCK ITEM - Search: EDIT STOCK ITEM
    const handleEditStock = (item) => {
        setEditingId(item._id);

        setFormData({
            name: item.name || '',
            category: item.category || '',
            brand: item.brand || '',
            model: item.model || '',
            sku: item.sku || '',
            unit: item.unit || 'Piece',
            totalReceivedQuantity: item.totalReceivedQuantity ?? 0,
            minimumStockLevel: item.minimumStockLevel ?? 5,
            description: item.description || ''
        });

        setShowForm(true);
    };

    // DELETE STOCK ITEM - Search: DELETE STOCK ITEM
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
                throw new Error(data.message || 'Failed to delete stock item');
            }

            alert('Stock item deleted successfully!');
            await fetchStockData();

        } catch (err) {
            alert(err.message);
        }
    };

    // FILTER STOCK ITEMS - Search: FILTER STOCK ITEMS
    const filteredItems = stockItems.filter(item => {
        const searchText = search.toLowerCase();

        return (
            item.name?.toLowerCase().includes(searchText) ||
            item.category?.toLowerCase().includes(searchText) ||
            item.brand?.toLowerCase().includes(searchText) ||
            item.sku?.toLowerCase().includes(searchText)
        );
    });

    // STATISTICS CARDS - Search: STATISTICS CARDS
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

    return (
        <div className="min-h-screen bg-slate-50">

            {/* REUSABLE ADMIN SIDEBAR */}
            <AdminSidebar />

            {/* STOCK INVENTORY MAIN CONTENT - Search: STOCK INVENTORY MAIN CONTENT */}
            <main className="min-w-0 flex-1 lg:ml-64">

                <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 pl-16 py-4 backdrop-blur sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                UMC / ADMIN / {activeMenu}
                            </p>
                            <p className="text-sm font-bold text-slate-800">
                                United Medical College
                            </p>
                        </div>
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

                <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">

                    {/* STOCK PAGE HEADER - Search: STOCK PAGE HEADER */}
                    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="mb-3 text-sm font-medium text-blue-600 hover:text-blue-800"
                            >
                                ← Back to Dashboard
                            </button>

                            <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
                                Stock Inventory
                            </h1>

                            <p className="mt-1 text-sm text-slate-500">
                                Manage products, quantities and stock availability
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => {
                                    setScannerError('');
                                    setShowScanner(true);
                                }}
                                className="rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-purple-700"
                            >
                                Scan QR / Barcode
                            </button>

                            <button
                                onClick={() => {
                                    setEditingId(null);
                                    setShowForm(!showForm);
                                }}
                                className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700"
                            >
                                {showForm ? 'Close Form' : '+ Manual Add Product'}
                            </button>
                        </div>
                    </div>

                    {/* QR BARCODE SCANNER MODAL - Search: QR BARCODE SCANNER MODAL */}
                    {showScanner && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4">
                            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
                                <div className="mb-5 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800">
                                            QR / Barcode Scanner
                                        </h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Place the product code in front of the camera.
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => setShowScanner(false)}
                                        className="rounded-lg bg-red-50 px-3 py-2 font-bold text-red-600 hover:bg-red-100"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div id="stock-code-reader" className="w-full overflow-hidden rounded-xl" />

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
                                    className="mt-5 w-full rounded-xl border border-slate-200 py-3 font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                    Close Scanner
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STOCK STATISTICS - Search: STOCK STATISTICS */}
                    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {statCards.map((card, index) => (
                            <div
                                key={index}
                                className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-500">
                                            {card.title}
                                        </p>

                                        <h2 className="mt-2 text-2xl font-bold text-slate-800">
                                            {card.value ?? 0}
                                        </h2>
                                    </div>

                                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl ${card.color}`}>
                                        {card.icon}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ADD STOCK FORM - Search: ADD STOCK FORM */}
                    {showForm && (
                        <div className="mb-8 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-7">
                            <h2 className="mb-6 text-xl font-bold text-slate-800">
                                {editingId ? 'Edit Stock Product' : 'Add New Stock Product'}
                            </h2>

                            <form onSubmit={handleAddStock}>
                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">

                                    {[
                                        { label: 'Product Name *', name: 'name', placeholder: 'e.g. Keyboard' },
                                        { label: 'Category *', name: 'category', placeholder: 'e.g. Accessories' },
                                        { label: 'Brand', name: 'brand', placeholder: 'e.g. Logitech' },
                                        { label: 'Model', name: 'model', placeholder: 'e.g. K120' },
                                        { label: 'SKU / Product Code', name: 'sku', placeholder: 'e.g. KEY-001' },
                                        { label: 'Received Quantity *', name: 'totalReceivedQuantity', placeholder: 'e.g. 20', type: 'number' },
                                        { label: 'Minimum Stock Level', name: 'minimumStockLevel', placeholder: 'e.g. 5', type: 'number' }
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
                                                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-500"
                                        >
                                            {['Piece', 'Box', 'Pack', 'Set', 'Meter', 'Roll'].map(unit => (
                                                <option key={unit} value={unit}>
                                                    {unit}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

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
                                            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-wrap gap-3">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
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
                                            setShowForm(false);
                                            setEditingId(null);
                                            setFormData({
                                                name: '',
                                                category: '',
                                                brand: '',
                                                model: '',
                                                sku: '',
                                                unit: 'Piece',
                                                totalReceivedQuantity: '',
                                                minimumStockLevel: 5,
                                                description: ''
                                            });
                                        }}
                                        className="rounded-xl border border-slate-200 px-6 py-3 font-semibold text-slate-600 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* STOCK PRODUCT TABLE - Search: STOCK PRODUCT TABLE */}
                    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">

                        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
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
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 sm:max-w-sm"
                            />
                        </div>

                        {loading ? (
                            <div className="p-12 text-center text-slate-500">
                                Loading stock inventory...
                            </div>
                        ) : error ? (
                            <div className="p-8 text-center">
                                <p className="mb-4 text-red-600">{error}</p>

                                <button
                                    onClick={fetchStockData}
                                    className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
                                >
                                    Try Again
                                </button>
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="mb-3 text-4xl">📦</div>

                                <h3 className="font-semibold text-slate-700">
                                    No Stock Products Found
                                </h3>

                                <p className="mt-1 text-sm text-slate-500">
                                    Add a new product to get started.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px] text-left">
                                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                        <tr>
                                            <th className="px-5 py-4">Product</th>
                                            <th className="px-5 py-4">Category</th>
                                            <th className="px-5 py-4">SKU</th>
                                            <th className="px-5 py-4">Received</th>
                                            <th className="px-5 py-4">Available</th>
                                            <th className="px-5 py-4">Assigned</th>
                                            <th className="px-5 py-4">Status</th>
                                            <th className="px-5 py-4">Action</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100">
                                        {filteredItems.map(item => {
                                            const isLowStock =
                                                item.availableQuantity <= item.minimumStockLevel;

                                            return (
                                                <tr key={item._id} className="transition hover:bg-slate-50">
                                                    <td className="px-5 py-4">
                                                        <p className="font-semibold text-slate-800">
                                                            {item.name}
                                                        </p>

                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {[item.brand, item.model].filter(Boolean).join(' / ') || '—'}
                                                        </p>
                                                    </td>

                                                    <td className="px-5 py-4 text-sm text-slate-600">
                                                        {item.category}
                                                    </td>

                                                    <td className="px-5 py-4 text-sm text-slate-600">
                                                        {item.sku || '—'}
                                                    </td>

                                                    <td className="px-5 py-4 text-sm font-medium text-slate-700">
                                                        {item.totalReceivedQuantity}
                                                    </td>

                                                    <td className="px-5 py-4 text-sm font-bold text-green-600">
                                                        {item.availableQuantity}
                                                    </td>

                                                    <td className="px-5 py-4 text-sm text-slate-700">
                                                        {item.assignedQuantity}
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                            isLowStock
                                                                ? 'bg-red-50 text-red-600'
                                                                : 'bg-green-50 text-green-600'
                                                        }`}>
                                                            {isLowStock ? 'Low Stock' : 'In Stock'}
                                                        </span>
                                                    </td>

                                                    {/* STOCK ACTION BUTTONS - Search: STOCK ACTION BUTTONS */}
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleEditStock(item)}
                                                                className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
                                                            >
                                                                Edit
                                                            </button>

                                                            <button
                                                                onClick={() => handleDeleteStock(item._id)}
                                                                className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default StockInventory;
