
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import AdminSidebar from '../../components/AdminSidebar.jsx';

const ASSIGNMENT_API_URL = 'http://localhost:3001/api/assignments';
const STOCK_API_URL = 'http://localhost:3001/api/stock';
const DEPARTMENT_API_URL = 'http://localhost:3001/api/departments';
const ROOM_API_URL = 'http://localhost:3001/api/rooms';

const MAX_ASSIGNMENT_PRODUCTS = 20;
const LOW_STOCK_THRESHOLD = 5;

// GET AUTH HEADERS
const getHeaders = () => {
    const token = localStorage.getItem('pos-token');

    if (!token) {
        throw new Error('Please login again.');
    }

    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
    };
};

// FORMAT DATE
const formatDate = (date) => {
    if (!date) return 'N/A';

    return new Date(date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

// GET ASSIGNMENT ITEMS (NEW + OLD RECORD COMPATIBILITY)
const getAssignmentItems = (assignment) => {
    if (Array.isArray(assignment?.items) && assignment.items.length > 0) {
        return assignment.items;
    }

    if (assignment?.stockItem || assignment?.productDetails) {
        return [{
            stockItem: assignment.stockItem,
            productDetails: assignment.productDetails,
            quantity: assignment.quantity || 0,
            stockUnits: assignment.stockUnits || [],
            assets: assignment.assets || []
        }];
    }

    return [];
};

// GET TOTAL ASSIGNED QUANTITY
const getAssignmentQuantity = (assignment) => {
    return getAssignmentItems(assignment).reduce(
        (total, item) => total + Number(
            item.quantity ||
            item.stockUnits?.length ||
            item.assets?.length ||
            0
        ),
        0
    );
};

// GET PRODUCT NAME
const getProductName = (item) => {
    return item.productDetails?.name ||
        item.stockItem?.name ||
        'N/A';
};

// GET PRODUCT SUMMARY
const getAssignmentProductNames = (assignment) => {
    const items = getAssignmentItems(assignment);

    return items.map(item => getProductName(item)).join(', ') || 'N/A';
};

// REUSABLE STAT CARD
const StatCard = ({ title, value, icon, color, accent, description }) => (
    <div className="group relative overflow-hidden bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <div className={`absolute top-0 left-0 w-full h-1 ${accent}`} />

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

const AssignmentManagement = () => {
    const { user } = useAuth();

    // PAGE STATE
    const [activeTab, setActiveTab] = useState('Overview');

    // DATA STATES
    const [stockItems, setStockItems] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [assignments, setAssignments] = useState([]);

    // LOADING STATES
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [loadingUnits, setLoadingUnits] = useState(false);
    const [loadingProductIds, setLoadingProductIds] = useState([]);

    // STOCK UNIT CACHE
    const stockUnitsCache = useRef({});

    // ERROR AND SUCCESS
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // ASSIGNMENT FORM
    const [formData, setFormData] = useState({
        assignmentType: 'Department',
        stockItemId: '',
        departmentId: '',
        floorLevel: '',
        roomId: '',
        assignedDate: new Date().toISOString().split('T')[0],
        receiver: {
            name: '',
            employeeId: '',
            designation: '',
            phone: ''
        },
        notes: ''
    });

    // CURRENT PRODUCT STOCK UNITS
    const [availableUnits, setAvailableUnits] = useState([]);
    const [selectedUnitIds, setSelectedUnitIds] = useState([]);

    // PRODUCTS ADDED TO CURRENT ASSIGNMENT
    const [assignmentProducts, setAssignmentProducts] = useState([]);

    // PRODUCT SEARCH AND STOCK FILTERS
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [productStockFilter, setProductStockFilter] = useState('All');

    // HISTORY FILTERS
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDepartment, setFilterDepartment] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // REPORT FILTERS
    const [reportType, setReportType] = useState('Daily');
    const [reportStartDate, setReportStartDate] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [reportEndDate, setReportEndDate] = useState(
        new Date().toISOString().split('T')[0]
    );

    // PRINT
    const [printAssignment, setPrintAssignment] = useState(null);
    const originalDocumentTitle = useRef('');

    // SELECTED DEPARTMENT ROOMS
    const departmentRooms = rooms.filter(room => {
        const roomDepartmentId =
            room.department?._id || room.department;

        return roomDepartmentId === formData.departmentId;
    });

    // AVAILABLE FLOOR LEVELS
    const availableFloorLevels = [
        ...new Set(
            departmentRooms
                .map(room => room.floorLevel?.trim())
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: 'base'
    }));

    // ROOMS FILTERED BY FLOOR LEVEL
    const availableRooms = departmentRooms.filter(
        room => room.floorLevel?.trim() === formData.floorLevel
    );

    // RECEIVER INFORMATION COMPLETION
    const receiverInfoComplete = Boolean(
        formData.departmentId &&
        formData.receiver.name.trim() &&
        formData.assignedDate &&
        (
            formData.assignmentType !== 'Room' ||
            (formData.floorLevel && formData.roomId)
        )
    );

    // CURRENT ASSIGNMENT TOTALS
    const totalSelectedDevices = assignmentProducts.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
    );

    // PRODUCT STOCK COUNTS
    const productStockCounts = useMemo(() => {
        return stockItems.reduce((counts, product) => {
            const availableQuantity = Math.max(
                0,
                Number(product.availableQuantity || 0)
            );

            counts.all += 1;

            if (availableQuantity === 0) {
                counts.outOfStock += 1;
            } else if (availableQuantity <= LOW_STOCK_THRESHOLD) {
                counts.lowStock += 1;
            } else {
                counts.inStock += 1;
            }

            return counts;
        }, {
            all: 0,
            inStock: 0,
            lowStock: 0,
            outOfStock: 0
        });
    }, [stockItems]);

    // FILTER PRODUCTS BY SEARCH AND STOCK STATUS
    const filteredStockItems = useMemo(() => {
        const search = productSearchTerm.trim().toLowerCase();

        return stockItems.filter(product => {
            const availableQuantity = Math.max(
                0,
                Number(product.availableQuantity || 0)
            );

            const matchesSearch = !search || [
                product.name,
                product.sku,
                product.brand,
                product.model
            ].some(value =>
                String(value || '').toLowerCase().includes(search)
            );

            let matchesStockFilter = true;

            if (productStockFilter === 'In Stock') {
                matchesStockFilter =
                    availableQuantity > LOW_STOCK_THRESHOLD;
            } else if (productStockFilter === 'Low Stock') {
                matchesStockFilter =
                    availableQuantity > 0 &&
                    availableQuantity <= LOW_STOCK_THRESHOLD;
            } else if (productStockFilter === 'Out of Stock') {
                matchesStockFilter = availableQuantity === 0;
            }

            return matchesSearch && matchesStockFilter;
        });
    }, [stockItems, productSearchTerm, productStockFilter]);

    // LOAD STOCK
    const fetchStockItems = async () => {
        const response = await fetch(STOCK_API_URL, {
            headers: getHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to load stock items');
        }

        const items = Array.isArray(data)
            ? data
            : data.stockItems || data.items || data.stock || [];

        setStockItems(items);
    };

    // LOAD DEPARTMENTS
    const fetchDepartments = async () => {
        const response = await fetch(DEPARTMENT_API_URL, {
            headers: getHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to load departments');
        }

        const items = Array.isArray(data)
            ? data
            : data.departments || [];

        setDepartments(items.filter(item => item.isActive !== false));
    };

    // LOAD ROOMS
    const fetchRooms = async () => {
        const response = await fetch(ROOM_API_URL, {
            headers: getHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to load rooms');
        }

        const items = Array.isArray(data)
            ? data
            : data.rooms || [];

        setRooms(items.filter(item => item.isActive !== false));
    };

    // LOAD ASSIGNMENTS
    const fetchAssignments = async () => {
        const response = await fetch(ASSIGNMENT_API_URL, {
            headers: getHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to load assignments');
        }

        setAssignments(data.assignments || []);
    };

    // LOAD ALL PAGE DATA
    const loadPageData = async () => {
        setLoading(true);
        setError('');

        try {
            await Promise.all([
                fetchStockItems(),
                fetchDepartments(),
                fetchRooms(),
                fetchAssignments()
            ]);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPageData();
    }, []);

    // FORM INPUT CHANGE
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: value,
            ...(name === 'departmentId'
                ? {
                    floorLevel: '',
                    roomId: ''
                }
                : {})
        }));
    };

    // FLOOR LEVEL CHANGE
    const handleFloorLevelChange = (e) => {
        setFormData(prev => ({
            ...prev,
            floorLevel: e.target.value,
            roomId: ''
        }));
    };

    // RECEIVER INPUT CHANGE
    const handleReceiverChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            receiver: {
                ...prev.receiver,
                [name]: value
            }
        }));
    };

    // ASSIGNMENT TYPE CHANGE
    const handleAssignmentTypeChange = (type) => {
        setFormData(prev => ({
            ...prev,
            assignmentType: type,
            floorLevel: '',
            roomId: '',
            receiver: {
                name: '',
                employeeId: '',
                designation: '',
                phone: ''
            }
        }));

        setAssignmentProducts([]);
        setError('');
        setSuccess('');
    };

    // GET AVAILABLE STOCK UNITS
    const fetchAvailableProductUnits = async (product) => {
        const productId = product._id;

        if (stockUnitsCache.current[productId]) {
            return stockUnitsCache.current[productId];
        }

        const response = await fetch(
            `${STOCK_API_URL}/${productId}/units`,
            {
                headers: getHeaders()
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to load product devices');
        }

        const units = Array.isArray(data)
            ? data
            : data.units || data.stockUnits || data.items || [];

        const available = units.filter(unit =>
            unit.status === 'Available' &&
            unit.asset == null
        );

        stockUnitsCache.current[productId] = available;

        return available;
    };

    // UPDATE PRODUCT QUANTITY
    const handleProductQuantityChange = async (product, rawQuantity) => {
        setError('');
        setSuccess('');

        const availableQuantity = Math.max(
            0,
            Number(product.availableQuantity || 0)
        );

        const parsedQuantity = Number.parseInt(rawQuantity, 10);

        const quantity = Number.isNaN(parsedQuantity)
            ? 0
            : Math.min(
                Math.max(parsedQuantity, 0),
                availableQuantity
            );

        const existingProduct = assignmentProducts.find(
            item => item.stockItemId === product._id
        );

        // ZERO QUANTITY REMOVES PRODUCT
        if (quantity === 0) {
            setAssignmentProducts(prev =>
                prev.filter(item => item.stockItemId !== product._id)
            );

            return;
        }

        // MAXIMUM PRODUCT LIMIT
        if (
            !existingProduct &&
            assignmentProducts.length >= MAX_ASSIGNMENT_PRODUCTS
        ) {
            setError(
                `You can assign a maximum of ${MAX_ASSIGNMENT_PRODUCTS} different products at once.`
            );
            return;
        }

        // PREVENT MULTIPLE REQUESTS FOR SAME PRODUCT
        if (loadingProductIds.includes(product._id)) {
            return;
        }

        setLoadingProductIds(prev => [...prev, product._id]);
        setLoadingUnits(true);

        try {
            const available = await fetchAvailableProductUnits(product);

            // REAL STOCK UNIT LIMIT
            if (quantity > available.length) {
                setError(
                    `${product.name}: Only ${available.length} individually tracked stock units are available.`
                );
            }

            const finalQuantity = Math.min(quantity, available.length);

            if (finalQuantity === 0) {
                setAssignmentProducts(prev =>
                    prev.filter(item => item.stockItemId !== product._id)
                );

                return;
            }

            // RESTORE PREVIOUS SELECTED UNITS
            const previousIds = existingProduct?.stockUnitIds || [];

            const selectedIds = previousIds.filter(id =>
                available.some(unit => unit._id === id)
            ).slice(0, finalQuantity);

            // ADD MORE UNITS IF QUANTITY INCREASES
            const remainingUnits = available.filter(unit =>
                !selectedIds.includes(unit._id)
            );

            while (
                selectedIds.length < finalQuantity &&
                remainingUnits.length > 0
            ) {
                selectedIds.push(remainingUnits.shift()._id);
            }

            const selectedUnits = available.filter(unit =>
                selectedIds.includes(unit._id)
            );

            const productData = {
                stockItemId: product._id,
                productDetails: {
                    name: product.name,
                    brand: product.brand || '',
                    model: product.model || '',
                    sku: product.sku || ''
                },
                quantity: selectedIds.length,
                stockUnitIds: selectedIds,
                units: selectedUnits
            };

            setAssignmentProducts(prev => {
                const existingIndex = prev.findIndex(
                    item => item.stockItemId === product._id
                );

                if (existingIndex !== -1) {
                    return prev.map((item, index) =>
                        index === existingIndex ? productData : item
                    );
                }

                if (prev.length >= MAX_ASSIGNMENT_PRODUCTS) {
                    return prev;
                }

                return [...prev, productData];
            });

        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingProductIds(prev =>
                prev.filter(id => id !== product._id)
            );

            setLoadingUnits(false);
        }
    };

    // INCREASE PRODUCT QUANTITY
    const handleIncreaseQuantity = (product) => {
        const current = assignmentProducts.find(
            item => item.stockItemId === product._id
        );

        const nextQuantity = (current?.quantity || 0) + 1;

        handleProductQuantityChange(product, nextQuantity);
    };

    // DECREASE PRODUCT QUANTITY
    const handleDecreaseQuantity = (product) => {
        const current = assignmentProducts.find(
            item => item.stockItemId === product._id
        );

        const nextQuantity = Math.max(
            0,
            (current?.quantity || 0) - 1
        );

        handleProductQuantityChange(product, nextQuantity);
    };

    // REMOVE PRODUCT FROM ASSIGNMENT
    const handleRemoveProduct = (stockItemId) => {
        setAssignmentProducts(prev =>
            prev.filter(item => item.stockItemId !== stockItemId)
        );
    };

    // RESET ASSIGNMENT FORM
    const resetAssignmentForm = () => {
        setFormData({
            assignmentType: 'Department',
            stockItemId: '',
            departmentId: '',
            floorLevel: '',
            roomId: '',
            assignedDate: new Date().toISOString().split('T')[0],
            receiver: {
                name: '',
                employeeId: '',
                designation: '',
                phone: ''
            },
            notes: ''
        });

        setAvailableUnits([]);
        setSelectedUnitIds([]);
        setAssignmentProducts([]);
        setLoadingProductIds([]);
        setProductSearchTerm('');
        setProductStockFilter('All');
        stockUnitsCache.current = {};
    };

    // CREATE BULK ASSIGNMENT
    const handleCreateAssignment = async (e) => {
        e.preventDefault();

        setError('');
        setSuccess('');

        if (!receiverInfoComplete) {
            setError('Please complete the department, receiver and assignment information.');
            return;
        }

        if (assignmentProducts.length < 1) {
            setError('Please select at least one product.');
            return;
        }

        if (assignmentProducts.length > MAX_ASSIGNMENT_PRODUCTS) {
            setError(`A maximum of ${MAX_ASSIGNMENT_PRODUCTS} products can be assigned at once.`);
            return;
        }

        if (!formData.departmentId) {
            setError('Please select a department.');
            return;
        }

        if (
            formData.assignmentType === 'Room' &&
            (!formData.floorLevel || !formData.roomId)
        ) {
            setError('Please select floor level and room number.');
            return;
        }

        if (!formData.receiver.name.trim()) {
            setError('Receiver name is required.');
            return;
        }

        if (!formData.assignedDate) {
            setError('Please select assignment date.');
            return;
        }

        const productIds = assignmentProducts.map(item => item.stockItemId);

        if (new Set(productIds).size !== productIds.length) {
            setError('Duplicate products are not allowed in one assignment.');
            return;
        }

        const hasInvalidProduct = assignmentProducts.some(item =>
            !item.stockItemId ||
            !Array.isArray(item.stockUnitIds) ||
            item.stockUnitIds.length < 1 ||
            item.quantity !== item.stockUnitIds.length
        );

        if (hasInvalidProduct) {
            setError(
                'Every product must have at least one selected stock unit.'
            );
            return;
        }

        // CHECK DUPLICATE STOCK UNIT IDS ACROSS PRODUCTS
        const allUnitIds = assignmentProducts.flatMap(
            item => item.stockUnitIds
        );

        if (new Set(allUnitIds).size !== allUnitIds.length) {
            setError('A stock unit cannot be selected more than once.');
            return;
        }

        setSubmitting(true);

        try {
            const response = await fetch(ASSIGNMENT_API_URL, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    assignmentType: formData.assignmentType,
                    items: assignmentProducts.map(item => ({
                        stockItemId: item.stockItemId,
                        stockUnitIds: item.stockUnitIds
                    })),
                    departmentId: formData.departmentId,
                    roomId: formData.assignmentType === 'Room'
                        ? formData.roomId
                        : null,
                    assignedDate: formData.assignedDate,
                    receiver: {
                        name: formData.receiver.name.trim(),
                        employeeId: formData.receiver.employeeId.trim(),
                        designation: formData.receiver.designation.trim(),
                        phone: formData.receiver.phone.trim()
                    },
                    notes: formData.notes.trim()
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to create assignment');
            }

            setSuccess(
                data.message || 'Combined assignment created successfully!'
            );

            resetAssignmentForm();

            await Promise.all([
                fetchStockItems(),
                fetchAssignments()
            ]);

            setActiveTab('Assignment History');

        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // TOTAL STATISTICS
    const totalAssignments = assignments.length;

    const totalAssignedDevices = assignments.reduce(
        (total, item) => total + getAssignmentQuantity(item),
        0
    );

    const departmentAssignments = assignments.filter(
        item => item.assignmentType === 'Department'
    ).length;

    const individualAssignments = assignments.filter(
        item => item.assignmentType === 'Individual'
    ).length;

    const roomAssignments = assignments.filter(
        item => item.assignmentType === 'Room'
    ).length;

    // FILTER ASSIGNMENT HISTORY
    const filteredAssignments = useMemo(() => {
        return assignments.filter(item => {
            const search = searchTerm.toLowerCase();
            const productItems = getAssignmentItems(item);

            const productMatches = productItems.some(product => (
                getProductName(product).toLowerCase().includes(search) ||
                (product.productDetails?.sku || product.stockItem?.sku || '')
                    .toLowerCase().includes(search)
            ));

            const matchesSearch =
                (item.assignmentId || '').toLowerCase().includes(search) ||
                (item.receiver?.name || '').toLowerCase().includes(search) ||
                (item.receiver?.employeeId || '').toLowerCase().includes(search) ||
                productMatches ||
                (item.department?.name || '').toLowerCase().includes(search) ||
                (item.room?.roomNumber || '').toLowerCase().includes(search) ||
                (item.room?.floorLevel || '').toLowerCase().includes(search) ||
                (item.room?.name || '').toLowerCase().includes(search);

            const matchesDepartment =
                !filterDepartment ||
                item.department?._id === filterDepartment ||
                item.department === filterDepartment;

            const matchesType =
                !filterType || item.assignmentType === filterType;

            const matchesStatus =
                !filterStatus || item.status === filterStatus;

            return (
                matchesSearch &&
                matchesDepartment &&
                matchesType &&
                matchesStatus
            );
        });
    }, [
        assignments,
        searchTerm,
        filterDepartment,
        filterType,
        filterStatus
    ]);

    // REPORT DATA
    const reportAssignments = useMemo(() => {
        return assignments.filter(item => {
            const date = new Date(item.assignedDate);

            if (Number.isNaN(date.getTime())) return false;

            const dateString = date.toISOString().split('T')[0];

            if (reportType === 'Daily') {
                return dateString === reportStartDate;
            }

            if (reportType === 'Monthly') {
                const selectedMonth = reportStartDate.slice(0, 7);
                return dateString.slice(0, 7) === selectedMonth;
            }

            return (
                dateString >= reportStartDate &&
                dateString <= reportEndDate
            );
        });
    }, [
        assignments,
        reportType,
        reportStartDate,
        reportEndDate
    ]);

    const reportQuantity = reportAssignments.reduce(
        (total, item) => total + getAssignmentQuantity(item),
        0
    );

    // PRINT ASSIGNMENT
    const handlePrint = (assignment) => {
        originalDocumentTitle.current = document.title;
        document.title = ' ';
        setPrintAssignment(assignment);
    };

    // PRINT AFTER DOCUMENT RENDERS
    useEffect(() => {
        if (!printAssignment) return;

        const timer = setTimeout(() => {
            window.print();
        }, 500);

        return () => clearTimeout(timer);
    }, [printAssignment]);

    // PRINT COMPLETE
    useEffect(() => {
        const handleAfterPrint = () => {
            document.title = originalDocumentTitle.current || 'UMC IT Inventory';
            setPrintAssignment(null);
        };

        window.addEventListener('afterprint', handleAfterPrint);

        return () => {
            window.removeEventListener('afterprint', handleAfterPrint);
        };
    }, []);

    // REUSABLE INPUT CLASS
    const inputClass =
        'w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition';

    // REUSABLE LABEL
    const renderLabel = (text, required = false) => (
        <label className="block text-sm font-semibold text-slate-700 mb-2">
            {text}
            {required && <span className="text-red-500 ml-1">*</span>}
        </label>
    );

    return (
        <div className="min-h-screen bg-slate-100 flex">

            {/* PRINT STYLE */}
            <style>
                {`
                    #assignment-print {
                        display: none;
                    }

                    @page {
                        size: A4;
                        margin: 8mm;
                    }

                    @media print {
                        html,
                        body {
                            margin: 0 !important;
                            padding: 0 !important;
                            background: white !important;
                        }

                        body * {
                            visibility: hidden !important;
                        }

                        #assignment-print,
                        #assignment-print * {
                            visibility: visible !important;
                        }

                        #assignment-print {
                            display: block !important;
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 117.65% !important;
                            max-width: none !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            box-sizing: border-box !important;
                            background: white !important;
                            color: black !important;
                            font-size: 8.5pt !important;
                            line-height: 1.15 !important;
                            zoom: 0.85 !important;
                        }

                        #assignment-print h1 {
                            font-size: 18pt !important;
                            margin: 0 !important;
                        }

                        #assignment-print h2 {
                            font-size: 10pt !important;
                            margin-top: 4px !important;
                        }

                        #assignment-print h3 {
                            font-size: 10pt !important;
                            margin-top: 8px !important;
                            margin-bottom: 5px !important;
                            padding-bottom: 3px !important;
                            page-break-after: avoid !important;
                            break-after: avoid !important;
                        }

                        #assignment-print table {
                            width: 100% !important;
                            margin-bottom: 8px !important;
                            border-collapse: collapse !important;
                            page-break-inside: auto !important;
                            break-inside: auto !important;
                        }

                        #assignment-print th,
                        #assignment-print td {
                            padding: 4px !important;
                            font-size: 8.5pt !important;
                            line-height: 1.1 !important;
                        }

                        #assignment-print tr {
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                        }

                        #assignment-print thead {
                            display: table-header-group !important;
                        }

                        #assignment-print .pb-5 {
                            padding-bottom: 6px !important;
                        }

                        #assignment-print .mb-6 {
                            margin-bottom: 8px !important;
                        }

                        #assignment-print .mb-7 {
                            margin-bottom: 8px !important;
                        }

                        #assignment-print .mb-10 {
                            margin-bottom: 8px !important;
                        }

                        #assignment-print .mt-5 {
                            margin-top: 6px !important;
                        }

                        #assignment-print .mt-24 {
                            margin-top: 25px !important;
                        }

                        #assignment-print .mt-20 {
                            margin-top: 12px !important;
                        }

                        #assignment-print .gap-16 {
                            gap: 35px !important;
                        }

                        #assignment-print .text-sm {
                            font-size: 8.5pt !important;
                        }

                        #assignment-print .text-xs {
                            font-size: 7.5pt !important;
                        }

                        #assignment-print .grid {
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                        }

                        #assignment-print > div:last-child {
                            margin-top: 8px !important;
                        }

                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                    }
                `}
            </style>

            {/* ADMIN SIDEBAR */}
            <div className="no-print">
                <AdminSidebar />
            </div>

            {/* MAIN CONTENT */}
            <main className="flex-1 lg:ml-64 min-w-0">

                {/* TOPBAR */}
                <header className="no-print bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-20">

                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-slate-400 font-semibold tracking-wide">
                            UNITED MEDICAL COLLEGE / ADMIN
                        </p>

                        <h2 className="text-lg sm:text-xl font-bold text-slate-800 mt-1 truncate">
                            Assignment Management
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
                <div className="no-print p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">

                    {/* PAGE TITLE */}
                    <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="w-2 h-2 rounded-full bg-orange-500" />

                                <p className="text-sm text-orange-600 font-bold tracking-wide">
                                    IT ASSET DISTRIBUTION
                                </p>
                            </div>

                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                                Assignment Management
                            </h1>

                            <p className="text-slate-500 text-sm mt-2">
                                Manage department, individual and room IT equipment assignments.
                            </p>
                        </div>

                        <button
                            onClick={loadPageData}
                            disabled={loading}
                            className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 text-sm font-semibold shadow-sm transition disabled:opacity-50"
                        >
                            ↻ Refresh Data
                        </button>
                    </div>

                    {/* ERROR MESSAGE */}
                    {error && (
                        <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start justify-between gap-3">
                            <span>{error}</span>

                            <button
                                onClick={() => setError('')}
                                className="font-bold"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* SUCCESS MESSAGE */}
                    {success && (
                        <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-start justify-between gap-3">
                            <span>{success}</span>

                            <button
                                onClick={() => setSuccess('')}
                                className="font-bold"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* SUMMARY CARDS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

                        <StatCard
                            title="Total Assignments"
                            value={totalAssignments}
                            icon="▣"
                            color="bg-blue-50 text-blue-600"
                            accent="bg-blue-500"
                            description="Total assignment records"
                        />

                        <StatCard
                            title="Assigned Devices"
                            value={totalAssignedDevices}
                            icon="💻"
                            color="bg-emerald-50 text-emerald-600"
                            accent="bg-emerald-500"
                            description="Total devices assigned"
                        />

                        <StatCard
                            title="Department Assignments"
                            value={departmentAssignments}
                            icon="▤"
                            color="bg-violet-50 text-violet-600"
                            accent="bg-violet-500"
                            description="Department-based records"
                        />

                        <StatCard
                            title="Room Assignments"
                            value={roomAssignments}
                            icon="🚪"
                            color="bg-orange-50 text-orange-600"
                            accent="bg-orange-500"
                            description="Room-based assignment records"
                        />
                    </div>

                    {/* PAGE TABS */}
                    <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-2 flex flex-wrap gap-2">

                        {[
                            { name: 'Overview', icon: '▦' },
                            { name: 'New Assignment', icon: '+' },
                            { name: 'Assignment History', icon: '◷' },
                            { name: 'Reports', icon: '▥' }
                        ].map(tab => (
                            <button
                                key={tab.name}
                                onClick={() => {
                                    setActiveTab(tab.name);
                                    setError('');
                                    setSuccess('');
                                }}
                                className={`px-4 py-3 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                                    activeTab === tab.name
                                        ? tab.name === 'Assignment History'
                                            ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                                            : 'bg-blue-600 text-white shadow-md'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <span>{tab.icon}</span>
                                {tab.name}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-12 text-center">
                            <div className="text-3xl mb-3">⏳</div>
                            <p className="text-sm text-slate-500">
                                Loading assignment information...
                            </p>
                        </div>
                    ) : (
                        <>

                            {/* OVERVIEW TAB */}
                            {activeTab === 'Overview' && (
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">

                                    <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">

                                        <div className="flex justify-between items-center mb-6">
                                            <div>
                                                <h2 className="text-lg font-bold text-slate-800">
                                                    Assignment Overview
                                                </h2>

                                                <p className="text-xs text-slate-400 mt-1">
                                                    Distribution by assignment type
                                                </p>
                                            </div>

                                            <span className="text-xs bg-orange-50 text-orange-600 px-3 py-2 rounded-lg font-bold">
                                                {totalAssignments} Records
                                            </span>
                                        </div>

                                        {[
                                            {
                                                name: 'Department Assignments',
                                                value: departmentAssignments,
                                                color: 'bg-blue-500'
                                            },
                                            {
                                                name: 'Individual Assignments',
                                                value: individualAssignments,
                                                color: 'bg-orange-500'
                                            },
                                            {
                                                name: 'Room Assignments',
                                                value: roomAssignments,
                                                color: 'bg-violet-500'
                                            }
                                        ].map(item => {
                                            const percentage = totalAssignments
                                                ? (item.value / totalAssignments) * 100
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
                                    </div>

                                    {/* QUICK ACTIONS */}
                                    <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 p-6 rounded-2xl text-white shadow-lg flex flex-col">

                                        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full border-[25px] border-orange-400/20" />

                                        <div className="relative z-10">
                                            <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center text-3xl mb-5 shadow-lg">
                                                📦
                                            </div>

                                            <h2 className="text-xl font-bold">
                                                New Asset Assignment
                                            </h2>

                                            <p className="text-sm text-blue-100 mt-3 leading-6">
                                                Assign available IT devices to departments, individual employees or specific rooms.
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => setActiveTab('New Assignment')}
                                            className="relative z-10 mt-8 px-5 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl text-sm font-bold transition"
                                        >
                                            + Create Assignment
                                        </button>
                                    </div>

                                    {/* RECENT ASSIGNMENTS */}
                                    <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">

                                        <div className="flex justify-between items-center mb-6">
                                            <div>
                                                <h2 className="text-lg font-bold text-slate-800">
                                                    Recent Assignments
                                                </h2>

                                                <p className="text-xs text-slate-400 mt-1">
                                                    Latest assignment records
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => setActiveTab('Assignment History')}
                                                className="text-xs font-bold text-orange-600 hover:text-orange-700"
                                            >
                                                View All →
                                            </button>
                                        </div>

                                        {assignments.length === 0 ? (
                                            <p className="text-sm text-slate-400 py-6 text-center">
                                                No assignment records available.
                                            </p>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full min-w-[850px] text-left">
                                                    <thead>
                                                        <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase">
                                                            <th className="py-3 px-3">Assignment ID</th>
                                                            <th className="py-3 px-3">Products</th>
                                                            <th className="py-3 px-3">Department</th>
                                                            <th className="py-3 px-3">Location</th>
                                                            <th className="py-3 px-3">Receiver</th>
                                                            <th className="py-3 px-3">Quantity</th>
                                                            <th className="py-3 px-3">Date</th>
                                                        </tr>
                                                    </thead>

                                                    <tbody>
                                                        {assignments.slice(0, 5).map(item => (
                                                            <tr key={item._id} className="border-b border-slate-50 hover:bg-slate-50">
                                                                <td className="py-4 px-3 text-xs font-bold text-blue-600">
                                                                    {item.assignmentId}
                                                                </td>

                                                                <td className="py-4 px-3 text-sm font-semibold text-slate-700 max-w-[250px]">
                                                                    <div className="line-clamp-2">
                                                                        {getAssignmentProductNames(item)}
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-400 mt-1">
                                                                        {getAssignmentItems(item).length} Product Types
                                                                    </p>
                                                                </td>

                                                                <td className="py-4 px-3 text-sm text-slate-600">
                                                                    {item.department?.name || 'N/A'}
                                                                </td>

                                                                <td className="py-4 px-3 text-xs text-slate-600">
                                                                    {item.assignmentType === 'Room'
                                                                        ? `${item.room?.floorLevel || 'N/A'} / Room ${item.room?.roomNumber || item.room?.name || 'N/A'}`
                                                                        : item.assignmentType}
                                                                </td>

                                                                <td className="py-4 px-3 text-sm text-slate-600">
                                                                    {item.receiver?.name || 'N/A'}
                                                                </td>

                                                                <td className="py-4 px-3 text-sm font-bold text-slate-700">
                                                                    {getAssignmentQuantity(item)}
                                                                </td>

                                                                <td className="py-4 px-3 text-xs text-slate-500">
                                                                    {formatDate(item.assignedDate)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* NEW ASSIGNMENT TAB */}
                            {activeTab === 'New Assignment' && (
                                <div className="mt-8">

                                    <form
                                        onSubmit={handleCreateAssignment}
                                        className="space-y-6"
                                    >

                                        {/* ASSIGNMENT TYPE */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7">

                                            <div className="mb-6">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-6 rounded-full bg-orange-500" />

                                                    <h2 className="text-lg font-bold text-slate-800">
                                                        Assignment Type
                                                    </h2>
                                                </div>

                                                <p className="text-xs text-slate-400 mt-2 ml-4">
                                                    Select how the equipment will be assigned
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                                {[
                                                    {
                                                        type: 'Department',
                                                        icon: '🏢',
                                                        title: 'Department Assignment',
                                                        description: 'Assign equipment to a department through its receiving representative.'
                                                    },
                                                    {
                                                        type: 'Individual',
                                                        icon: '👤',
                                                        title: 'Individual Assignment',
                                                        description: 'Assign equipment directly to a specific employee under a department.'
                                                    },
                                                    {
                                                        type: 'Room',
                                                        icon: '🚪',
                                                        title: 'Room Assignment',
                                                        description: 'Assign equipment to a specific room with floor level and room number.'
                                                    }
                                                ].map(option => (
                                                    <button
                                                        key={option.type}
                                                        type="button"
                                                        onClick={() => handleAssignmentTypeChange(option.type)}
                                                        className={`p-5 rounded-2xl border-2 text-left transition ${
                                                            formData.assignmentType === option.type
                                                                ? 'border-blue-500 bg-blue-50'
                                                                : 'border-slate-200 hover:border-blue-200'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-3xl">{option.icon}</span>

                                                            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                                formData.assignmentType === option.type
                                                                    ? 'border-blue-600'
                                                                    : 'border-slate-300'
                                                            }`}>
                                                                {formData.assignmentType === option.type && (
                                                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                                                                )}
                                                            </span>
                                                        </div>

                                                        <h3 className="font-bold text-slate-800 mt-4">
                                                            {option.title}
                                                        </h3>

                                                        <p className="text-xs text-slate-500 mt-2 leading-5">
                                                            {option.description}
                                                        </p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* DEPARTMENT AND RECEIVER */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7">

                                            <div className="mb-6">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-6 rounded-full bg-orange-500" />

                                                    <h2 className="text-lg font-bold text-slate-800">
                                                        Department & Receiver Details
                                                    </h2>
                                                </div>

                                                <p className="text-xs text-slate-400 mt-2 ml-4">
                                                    Complete receiver information before selecting products
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                                                <div>
                                                    {renderLabel('Department', true)}

                                                    <select
                                                        name="departmentId"
                                                        value={formData.departmentId}
                                                        onChange={handleInputChange}
                                                        className={inputClass}
                                                        required
                                                    >
                                                        <option value="">Select Department</option>

                                                        {departments.map(department => (
                                                            <option
                                                                key={department._id}
                                                                value={department._id}
                                                            >
                                                                {department.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {formData.assignmentType === 'Room' && (
                                                    <>
                                                        <div>
                                                            {renderLabel('Floor Level', true)}

                                                            <select
                                                                value={formData.floorLevel}
                                                                onChange={handleFloorLevelChange}
                                                                className={inputClass}
                                                                required
                                                                disabled={!formData.departmentId}
                                                            >
                                                                <option value="">Select Floor Level</option>

                                                                {availableFloorLevels.map(level => (
                                                                    <option key={level} value={level}>
                                                                        {level}
                                                                    </option>
                                                                ))}
                                                            </select>

                                                            {formData.departmentId && availableFloorLevels.length === 0 && (
                                                                <p className="text-xs text-orange-500 mt-2">
                                                                    No floor levels found for this department.
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div>
                                                            {renderLabel('Room Number', true)}

                                                            <select
                                                                name="roomId"
                                                                value={formData.roomId}
                                                                onChange={handleInputChange}
                                                                className={inputClass}
                                                                required
                                                                disabled={!formData.floorLevel}
                                                            >
                                                                <option value="">Select Room Number</option>

                                                                {availableRooms.map(room => (
                                                                    <option key={room._id} value={room._id}>
                                                                        {room.roomNumber || room.name}
                                                                        {room.name && room.roomNumber
                                                                            ? ` - ${room.name}`
                                                                            : ''}
                                                                    </option>
                                                                ))}
                                                            </select>

                                                            {formData.floorLevel && availableRooms.length === 0 && (
                                                                <p className="text-xs text-orange-500 mt-2">
                                                                    No rooms found on this floor.
                                                                </p>
                                                            )}
                                                        </div>
                                                    </>
                                                )}

                                                <div>
                                                    {renderLabel(
                                                        formData.assignmentType === 'Department'
                                                            ? 'Receiving Person Name'
                                                            : formData.assignmentType === 'Room'
                                                                ? 'Room In-Charge / Receiver Name'
                                                                : 'Employee / Person Name',
                                                        true
                                                    )}

                                                    <input
                                                        type="text"
                                                        name="name"
                                                        value={formData.receiver.name}
                                                        onChange={handleReceiverChange}
                                                        placeholder={
                                                            formData.assignmentType === 'Department'
                                                                ? 'Name of department representative'
                                                                : formData.assignmentType === 'Room'
                                                                    ? 'Enter room receiver name'
                                                                    : 'Enter employee name'
                                                        }
                                                        className={inputClass}
                                                        required
                                                    />
                                                </div>

                                                <div>
                                                    {renderLabel(
                                                        formData.assignmentType === 'Department'
                                                            ? 'Representative ID'
                                                            : 'Employee ID'
                                                    )}

                                                    <input
                                                        type="text"
                                                        name="employeeId"
                                                        value={formData.receiver.employeeId}
                                                        onChange={handleReceiverChange}
                                                        placeholder="Enter ID (optional)"
                                                        className={inputClass}
                                                    />
                                                </div>

                                                <div>
                                                    {renderLabel('Designation')}

                                                    <input
                                                        type="text"
                                                        name="designation"
                                                        value={formData.receiver.designation}
                                                        onChange={handleReceiverChange}
                                                        placeholder="Enter designation"
                                                        className={inputClass}
                                                    />
                                                </div>

                                                <div>
                                                    {renderLabel('Contact Number')}

                                                    <input
                                                        type="tel"
                                                        name="phone"
                                                        value={formData.receiver.phone}
                                                        onChange={handleReceiverChange}
                                                        placeholder="Enter phone number"
                                                        className={inputClass}
                                                    />
                                                </div>

                                                <div>
                                                    {renderLabel('Assignment Date', true)}

                                                    <input
                                                        type="date"
                                                        name="assignedDate"
                                                        value={formData.assignedDate}
                                                        onChange={handleInputChange}
                                                        className={inputClass}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* PRODUCT SELECTION DASHBOARD */}
                                        {receiverInfoComplete ? (
                                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7">

                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2 h-6 rounded-full bg-orange-500" />

                                                            <h2 className="text-lg font-bold text-slate-800">
                                                                Product Selection Dashboard
                                                            </h2>
                                                        </div>

                                                        <p className="text-xs text-slate-400 mt-2 ml-4">
                                                            Select product quantities using the plus, minus or quantity input
                                                        </p>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        <span className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold">
                                                            {assignmentProducts.length} / {MAX_ASSIGNMENT_PRODUCTS} Products
                                                        </span>

                                                        <span className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold">
                                                            {totalSelectedDevices} Total Devices
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 mb-6">
                                                    <p className="text-sm font-semibold text-blue-900">
                                                        How Product Selection Works
                                                    </p>

                                                    <p className="text-xs text-blue-700 mt-1 leading-5">
                                                        Set the quantity for each product. Available stock units will be selected automatically. You can select up to 20 different product types in one assignment.
                                                    </p>
                                                </div>

                                                {/* PRODUCT SEARCH AND STOCK FILTER */}
                                                {stockItems.length > 0 && (
                                                    <div className="mb-6 space-y-4">

                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-600 mb-2">
                                                                Search Products
                                                            </label>

                                                            <div className="relative">
                                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                                                                    ⌕
                                                                </span>

                                                                <input
                                                                    type="text"
                                                                    value={productSearchTerm}
                                                                    onChange={e => setProductSearchTerm(e.target.value)}
                                                                    placeholder="Search by product name, SKU, brand or model..."
                                                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                                                                />

                                                                {productSearchTerm && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setProductSearchTerm('')}
                                                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 font-bold"
                                                                        aria-label="Clear product search"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                                                                <p className="text-xs font-bold text-slate-600">
                                                                    Filter by Stock Availability
                                                                </p>

                                                                <p className="text-xs text-slate-400">
                                                                    Showing {filteredStockItems.length} of {stockItems.length} products
                                                                </p>
                                                            </div>

                                                            <div className="flex flex-wrap gap-2">

                                                                {[
                                                                    {
                                                                        name: 'All',
                                                                        count: productStockCounts.all,
                                                                        active: 'bg-blue-600 text-white border-blue-600',
                                                                        inactive: 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                                                                    },
                                                                    {
                                                                        name: 'In Stock',
                                                                        count: productStockCounts.inStock,
                                                                        active: 'bg-emerald-600 text-white border-emerald-600',
                                                                        inactive: 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
                                                                    },
                                                                    {
                                                                        name: 'Low Stock',
                                                                        count: productStockCounts.lowStock,
                                                                        active: 'bg-amber-500 text-white border-amber-500',
                                                                        inactive: 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:text-amber-600'
                                                                    },
                                                                    {
                                                                        name: 'Out of Stock',
                                                                        count: productStockCounts.outOfStock,
                                                                        active: 'bg-red-600 text-white border-red-600',
                                                                        inactive: 'bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600'
                                                                    }
                                                                ].map(filter => (
                                                                    <button
                                                                        key={filter.name}
                                                                        type="button"
                                                                        onClick={() => setProductStockFilter(filter.name)}
                                                                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition ${
                                                                            productStockFilter === filter.name
                                                                                ? filter.active
                                                                                : filter.inactive
                                                                        }`}
                                                                    >
                                                                        {filter.name}

                                                                        <span className={`min-w-6 h-6 px-1 rounded-lg flex items-center justify-center text-[10px] ${
                                                                            productStockFilter === filter.name
                                                                                ? 'bg-white/20 text-white'
                                                                                : 'bg-slate-100 text-slate-600'
                                                                        }`}>
                                                                            {filter.count}
                                                                        </span>
                                                                    </button>
                                                                ))}
                                                            </div>

                                                            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-[11px] text-slate-400">
                                                                <span>In Stock: More than {LOW_STOCK_THRESHOLD} pcs</span>
                                                                <span>Low Stock: 1–{LOW_STOCK_THRESHOLD} pcs</span>
                                                                <span>Out of Stock: 0 pcs</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {stockItems.length === 0 ? (
                                                    <div className="p-10 text-center border border-dashed border-slate-300 rounded-xl">
                                                        <div className="text-4xl mb-3">📦</div>
                                                        <p className="font-bold text-slate-700">
                                                            No Stock Products Found
                                                        </p>
                                                        <p className="text-xs text-slate-400 mt-2">
                                                            Add products in Stock Inventory first.
                                                        </p>
                                                    </div>
                                                ) : filteredStockItems.length === 0 ? (
                                                    <div className="p-10 text-center border border-dashed border-slate-300 rounded-xl">
                                                        <div className="text-4xl mb-3">🔎</div>

                                                        <p className="font-bold text-slate-700">
                                                            No Matching Products Found
                                                        </p>

                                                        <p className="text-xs text-slate-400 mt-2">
                                                            Try another search term or stock filter.
                                                        </p>

                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setProductSearchTerm('');
                                                                setProductStockFilter('All');
                                                            }}
                                                            className="mt-4 px-4 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition"
                                                        >
                                                            Clear Product Filters
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">

                                                        {filteredStockItems.map(product => {
                                                            const selectedProduct = assignmentProducts.find(
                                                                item => item.stockItemId === product._id
                                                            );

                                                            const quantity = selectedProduct?.quantity || 0;
                                                            const availableQuantity = Math.max(
                                                                0,
                                                                Number(product.availableQuantity || 0)
                                                            );

                                                            const isLoading = loadingProductIds.includes(product._id);
                                                            const isSelected = quantity > 0;
                                                            const limitReached =
                                                                !isSelected &&
                                                                assignmentProducts.length >= MAX_ASSIGNMENT_PRODUCTS;

                                                            return (
                                                                <div
                                                                    key={product._id}
                                                                    className={`relative rounded-2xl border-2 p-5 transition-all duration-200 ${
                                                                        isSelected
                                                                            ? 'border-blue-500 bg-blue-50/60 shadow-md shadow-blue-100'
                                                                            : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-md'
                                                                    } ${
                                                                        availableQuantity === 0
                                                                            ? 'opacity-60'
                                                                            : ''
                                                                    }`}
                                                                >

                                                                    {isSelected && (
                                                                        <span className="absolute top-3 right-3 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                                                                            ✓
                                                                        </span>
                                                                    )}

                                                                    <div className="pr-8">
                                                                        <p className="text-base font-bold text-slate-800 leading-6">
                                                                            {product.name}
                                                                        </p>

                                                                        <p className="text-xs text-slate-400 mt-2">
                                                                            {product.brand || 'No Brand'}
                                                                            {product.model ? ` · ${product.model}` : ''}
                                                                        </p>
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-3 mt-5">

                                                                        <div className="bg-white rounded-xl border border-slate-100 p-3">
                                                                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                                                                                SKU
                                                                            </p>

                                                                            <p className="text-xs font-semibold text-slate-700 mt-1 break-all">
                                                                                {product.sku || 'N/A'}
                                                                            </p>
                                                                        </div>

                                                                        <div className="bg-white rounded-xl border border-slate-100 p-3">
                                                                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                                                                                Available
                                                                            </p>

                                                                            <p className={`text-lg font-bold mt-1 ${
                                                                                availableQuantity > LOW_STOCK_THRESHOLD
                                                                                    ? 'text-emerald-600'
                                                                                    : availableQuantity > 0
                                                                                        ? 'text-amber-600'
                                                                                        : 'text-red-500'
                                                                            }`}>
                                                                                {availableQuantity}
                                                                            </p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="mt-5 pt-4 border-t border-slate-200">

                                                                        <div className="flex items-center justify-between mb-3">
                                                                            <span className="text-xs font-bold text-slate-600">
                                                                                Select Quantity
                                                                            </span>

                                                                            <span className="text-[10px] font-semibold text-slate-400">
                                                                                Max: {availableQuantity}
                                                                            </span>
                                                                        </div>

                                                                        <div className="flex items-center gap-2">

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDecreaseQuantity(product)}
                                                                                disabled={
                                                                                    quantity === 0 ||
                                                                                    isLoading ||
                                                                                    submitting
                                                                                }
                                                                                className="w-11 h-11 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-700 text-xl font-bold hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                                                            >
                                                                                −
                                                                            </button>

                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                max={availableQuantity}
                                                                                value={quantity}
                                                                                disabled={
                                                                                    availableQuantity === 0 ||
                                                                                    isLoading ||
                                                                                    submitting
                                                                                }
                                                                                onChange={e =>
                                                                                    handleProductQuantityChange(
                                                                                        product,
                                                                                        e.target.value
                                                                                    )
                                                                                }
                                                                                className="w-full min-w-0 h-11 text-center rounded-xl border border-slate-200 bg-white text-lg font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                                                            />

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleIncreaseQuantity(product)}
                                                                                disabled={
                                                                                    quantity >= availableQuantity ||
                                                                                    isLoading ||
                                                                                    submitting ||
                                                                                    limitReached
                                                                                }
                                                                                className="w-11 h-11 shrink-0 rounded-xl bg-blue-600 text-white text-xl font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                                                            >
                                                                                +
                                                                            </button>
                                                                        </div>

                                                                        <div className="mt-3 flex justify-between items-center">
                                                                            {isLoading ? (
                                                                                <span className="text-xs text-blue-600 font-semibold">
                                                                                    Loading stock units...
                                                                                </span>
                                                                            ) : availableQuantity === 0 ? (
                                                                                <span className="text-xs text-red-500 font-semibold">
                                                                                    Out of Stock
                                                                                </span>
                                                                            ) : availableQuantity <= LOW_STOCK_THRESHOLD ? (
                                                                                <span className="text-xs text-amber-600 font-semibold">
                                                                                    Low Stock
                                                                                </span>
                                                                            ) : isSelected ? (
                                                                                <span className="text-xs text-emerald-600 font-semibold">
                                                                                    ✓ Added to Assignment
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-xs text-slate-400">
                                                                                    Not Selected
                                                                                </span>
                                                                            )}

                                                                            {isSelected && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleRemoveProduct(product._id)}
                                                                                    className="text-xs font-bold text-red-500 hover:text-red-700"
                                                                                >
                                                                                    Remove
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* SELECTED PRODUCTS SUMMARY */}
                                                <div className="mt-8 border-t border-slate-200 pt-6">

                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                                                        <div>
                                                            <h3 className="text-base font-bold text-slate-800">
                                                                Selected Products Summary
                                                            </h3>

                                                            <p className="text-xs text-slate-400 mt-1">
                                                                Review all selected products before confirming
                                                            </p>
                                                        </div>

                                                        <div className="flex gap-2">
                                                            <span className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                                                                {assignmentProducts.length} Product Types
                                                            </span>

                                                            <span className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">
                                                                {totalSelectedDevices} Devices
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {assignmentProducts.length === 0 ? (
                                                        <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl">
                                                            <div className="text-3xl mb-3">🛒</div>

                                                            <p className="text-sm font-semibold text-slate-600">
                                                                No Products Selected
                                                            </p>

                                                            <p className="text-xs text-slate-400 mt-2">
                                                                Increase the quantity of any product above to add it to this assignment.
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                                            <table className="w-full min-w-[650px] text-left">

                                                                <thead>
                                                                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                                                                        <th className="p-4">#</th>
                                                                        <th className="p-4">Product Details</th>
                                                                        <th className="p-4">SKU</th>
                                                                        <th className="p-4 text-center">Quantity</th>
                                                                        <th className="p-4 text-center">Action</th>
                                                                    </tr>
                                                                </thead>

                                                                <tbody>
                                                                    {assignmentProducts.map((item, index) => (
                                                                        <tr
                                                                            key={item.stockItemId}
                                                                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                                                                        >
                                                                            <td className="p-4 text-xs font-bold text-slate-500">
                                                                                {index + 1}
                                                                            </td>

                                                                            <td className="p-4">
                                                                                <p className="text-sm font-bold text-slate-800">
                                                                                    {item.productDetails.name}
                                                                                </p>

                                                                                <p className="text-xs text-slate-400 mt-1">
                                                                                    {item.productDetails.brand || 'No Brand'}
                                                                                    {item.productDetails.model
                                                                                        ? ` · ${item.productDetails.model}`
                                                                                        : ''}
                                                                                </p>
                                                                            </td>

                                                                            <td className="p-4 text-xs text-slate-500">
                                                                                {item.productDetails.sku || 'N/A'}
                                                                            </td>

                                                                            <td className="p-4 text-center">
                                                                                <span className="inline-flex min-w-10 justify-center px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-bold">
                                                                                    {item.quantity}
                                                                                </span>
                                                                            </td>

                                                                            <td className="p-4 text-center">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleRemoveProduct(item.stockItemId)}
                                                                                    className="px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition"
                                                                                >
                                                                                    Remove
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>

                                                                <tfoot>
                                                                    <tr className="bg-blue-50">
                                                                        <td colSpan="3" className="p-4 text-sm font-bold text-slate-700 text-right">
                                                                            Total Devices
                                                                        </td>

                                                                        <td className="p-4 text-center text-base font-bold text-blue-700">
                                                                            {totalSelectedDevices}
                                                                        </td>

                                                                        <td />
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-white rounded-2xl border border-dashed border-blue-300 shadow-sm p-8 sm:p-10 text-center">
                                                <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mb-4">
                                                    📦
                                                </div>

                                                <h3 className="text-base font-bold text-slate-700">
                                                    Product Selection Dashboard
                                                </h3>

                                                <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">
                                                    First complete the Department, Receiver Name and Assignment Date. For Room Assignment, select the Floor Level and Room Number too.
                                                </p>
                                            </div>
                                        )}

                                        {/* NOTES */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7">

                                            <div className="mb-5">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-6 rounded-full bg-orange-500" />

                                                    <h2 className="text-lg font-bold text-slate-800">
                                                        Additional Information
                                                    </h2>
                                                </div>
                                            </div>

                                            <textarea
                                                name="notes"
                                                value={formData.notes}
                                                onChange={handleInputChange}
                                                rows="4"
                                                placeholder="Write assignment notes..."
                                                className={`${inputClass} resize-none`}
                                            />
                                        </div>

                                        {/* FORM ACTIONS */}
                                        <div className="flex flex-col sm:flex-row justify-end gap-3">

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    resetAssignmentForm();
                                                    setError('');
                                                    setSuccess('');
                                                }}
                                                className="px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition"
                                            >
                                                Reset Form
                                            </button>

                                            <button
                                                type="submit"
                                                disabled={
                                                    submitting ||
                                                    loadingUnits ||
                                                    loadingProductIds.length > 0 ||
                                                    assignmentProducts.length === 0 ||
                                                    !receiverInfoComplete
                                                }
                                                className="px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-lg shadow-blue-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {submitting
                                                    ? 'Processing Assignment...'
                                                    : `✓ Confirm Assignment (${assignmentProducts.length} Products / ${totalSelectedDevices} Devices)`}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* ASSIGNMENT HISTORY TAB */}
                            {activeTab === 'Assignment History' && (
                                <div className="mt-8 space-y-6">

                                    {/* HISTORY HEADER */}
                                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 p-6 sm:p-8 text-white shadow-lg shadow-orange-100">

                                        <div className="absolute -right-10 -top-16 w-56 h-56 rounded-full border-[28px] border-white/10" />
                                        <div className="absolute right-24 -bottom-24 w-48 h-48 rounded-full border-[22px] border-white/10" />

                                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">

                                            <div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="w-2 h-2 rounded-full bg-white" />
                                                    <p className="text-xs font-bold tracking-[0.18em] text-orange-100 uppercase">
                                                        Asset Distribution Records
                                                    </p>
                                                </div>

                                                <h2 className="text-2xl sm:text-3xl font-bold">
                                                    Assignment History
                                                </h2>

                                                <p className="text-sm text-orange-100 mt-2">
                                                    Search, filter and review all assigned IT equipment.
                                                </p>
                                            </div>

                                            <div className="bg-white/15 border border-white/20 backdrop-blur-sm rounded-2xl px-6 py-4 min-w-[130px]">
                                                <p className="text-xs text-orange-100 font-semibold">
                                                    Total Records
                                                </p>

                                                <p className="text-3xl font-bold mt-1">
                                                    {filteredAssignments.length}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* FILTER PANEL */}
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                                        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-800">
                                                    Search & Filter Records
                                                </h3>

                                                <p className="text-xs text-slate-400 mt-1">
                                                    Find assignments using ID, product, department, room or receiver.
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    setSearchTerm('');
                                                    setFilterDepartment('');
                                                    setFilterType('');
                                                    setFilterStatus('');
                                                }}
                                                className="px-4 py-2 rounded-lg border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 text-xs font-bold transition w-fit"
                                            >
                                                ↺ Clear All Filters
                                            </button>
                                        </div>

                                        <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-2">
                                                    Search Records
                                                </label>

                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                        ⌕
                                                    </span>

                                                    <input
                                                        type="text"
                                                        value={searchTerm}
                                                        onChange={e => setSearchTerm(e.target.value)}
                                                        placeholder="ID, product, room, receiver..."
                                                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-2">
                                                    Department
                                                </label>

                                                <select
                                                    value={filterDepartment}
                                                    onChange={e => setFilterDepartment(e.target.value)}
                                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
                                                >
                                                    <option value="">All Departments</option>

                                                    {departments.map(department => (
                                                        <option key={department._id} value={department._id}>
                                                            {department.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-2">
                                                    Assignment Type
                                                </label>

                                                <select
                                                    value={filterType}
                                                    onChange={e => setFilterType(e.target.value)}
                                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
                                                >
                                                    <option value="">All Types</option>
                                                    <option value="Department">Department</option>
                                                    <option value="Individual">Individual</option>
                                                    <option value="Room">Room</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-2">
                                                    Assignment Status
                                                </label>

                                                <select
                                                    value={filterStatus}
                                                    onChange={e => setFilterStatus(e.target.value)}
                                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
                                                >
                                                    <option value="">All Statuses</option>
                                                    <option value="Active">Active</option>
                                                    <option value="Returned">Returned</option>
                                                    <option value="Cancelled">Cancelled</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="px-5 sm:px-6 py-3 bg-orange-50/60 border-t border-orange-100 flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-xs text-slate-500">
                                                Showing <strong className="text-orange-600">{filteredAssignments.length}</strong> matching records
                                            </p>

                                            <p className="text-xs text-slate-400">
                                                Total assignments: {assignments.length}
                                            </p>
                                        </div>
                                    </div>

                                    {/* HISTORY TABLE */}
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                                        <div className="px-5 sm:px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3">
                                            <div>
                                                <h3 className="text-base font-bold text-slate-800">
                                                    Assignment Records
                                                </h3>

                                                <p className="text-xs text-slate-400 mt-1">
                                                    Complete history of assigned devices
                                                </p>
                                            </div>

                                            <span className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-lg">
                                                ◷
                                            </span>
                                        </div>

                                        {filteredAssignments.length === 0 ? (
                                            <div className="py-16 px-5 text-center">
                                                <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center text-3xl mb-4">
                                                    📋
                                                </div>

                                                <p className="text-base font-bold text-slate-700">
                                                    No assignments found
                                                </p>

                                                <p className="text-sm text-slate-400 mt-2">
                                                    Try changing your search or filters to find records.
                                                </p>

                                                <button
                                                    onClick={() => {
                                                        setSearchTerm('');
                                                        setFilterDepartment('');
                                                        setFilterType('');
                                                        setFilterStatus('');
                                                    }}
                                                    className="mt-5 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition"
                                                >
                                                    Clear Filters
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full min-w-[1200px] text-left">

                                                        <thead>
                                                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-wider">
                                                                <th className="py-4 px-4 font-bold">Assignment ID</th>
                                                                <th className="py-4 px-4 font-bold">Product Details</th>
                                                                <th className="py-4 px-4 font-bold">Department</th>
                                                                <th className="py-4 px-4 font-bold">Room / Location</th>
                                                                <th className="py-4 px-4 font-bold">Receiver</th>
                                                                <th className="py-4 px-4 font-bold">Type</th>
                                                                <th className="py-4 px-4 font-bold">Quantity</th>
                                                                <th className="py-4 px-4 font-bold">Date</th>
                                                                <th className="py-4 px-4 font-bold">Status</th>
                                                                <th className="py-4 px-4 font-bold text-center">Action</th>
                                                            </tr>
                                                        </thead>

                                                        <tbody>
                                                            {filteredAssignments.map(item => (
                                                                <tr
                                                                    key={item._id}
                                                                    className="border-b border-slate-100 hover:bg-orange-50/40 transition-colors"
                                                                >
                                                                    <td className="py-4 px-4">
                                                                        <span className="inline-flex px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-700 text-[11px] font-bold border border-orange-100">
                                                                            {item.assignmentId}
                                                                        </span>
                                                                    </td>

                                                                    <td className="py-4 px-4 max-w-[280px]">
                                                                        {getAssignmentItems(item).map((product, index) => (
                                                                            <div key={product.stockItem?._id || product.stockItem || index} className="mb-2 last:mb-0">
                                                                                <p className="text-sm font-bold text-slate-700">
                                                                                    {getProductName(product)}
                                                                                </p>

                                                                                <p className="text-[11px] text-slate-400 mt-1">
                                                                                    SKU: {product.productDetails?.sku || product.stockItem?.sku || 'N/A'}
                                                                                    {' · '}Qty: {product.quantity || product.stockUnits?.length || 0}
                                                                                </p>
                                                                            </div>
                                                                        ))}
                                                                    </td>

                                                                    <td className="py-4 px-4">
                                                                        <span className="text-sm font-medium text-slate-600">
                                                                            {item.department?.name || 'N/A'}
                                                                        </span>
                                                                    </td>

                                                                    <td className="py-4 px-4">
                                                                        {item.assignmentType === 'Room' ? (
                                                                            <>
                                                                                <p className="text-sm font-semibold text-slate-700">
                                                                                    {item.room?.roomNumber || item.room?.name || 'N/A'}
                                                                                </p>

                                                                                <p className="text-[11px] text-orange-600 mt-1 font-medium">
                                                                                    {item.room?.floorLevel || 'Floor N/A'}
                                                                                </p>
                                                                            </>
                                                                        ) : (
                                                                            <span className="text-xs text-slate-400">
                                                                                {item.assignmentType === 'Department'
                                                                                    ? 'Department'
                                                                                    : 'Individual'}
                                                                            </span>
                                                                        )}
                                                                    </td>

                                                                    <td className="py-4 px-4">
                                                                        <p className="text-sm font-semibold text-slate-700">
                                                                            {item.receiver?.name || 'N/A'}
                                                                        </p>

                                                                        <p className="text-[11px] text-slate-400 mt-1">
                                                                            {item.receiver?.employeeId || 'No ID'}
                                                                        </p>
                                                                    </td>

                                                                    <td className="py-4 px-4">
                                                                        <span className={`inline-flex text-[10px] px-2.5 py-1.5 rounded-lg font-bold ${
                                                                            item.assignmentType === 'Individual'
                                                                                ? 'bg-violet-50 text-violet-700 border border-violet-100'
                                                                                : item.assignmentType === 'Room'
                                                                                    ? 'bg-orange-50 text-orange-700 border border-orange-100'
                                                                                    : 'bg-blue-50 text-blue-700 border border-blue-100'
                                                                        }`}>
                                                                            {item.assignmentType}
                                                                        </span>
                                                                    </td>

                                                                    <td className="py-4 px-4">
                                                                        <span className="inline-flex min-w-9 justify-center px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                                                                            {getAssignmentQuantity(item)}
                                                                        </span>
                                                                    </td>

                                                                    <td className="py-4 px-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                                                                        {formatDate(item.assignedDate)}
                                                                    </td>

                                                                    <td className="py-4 px-4">
                                                                        <span className={`inline-flex text-[10px] px-2.5 py-1.5 rounded-lg font-bold ${
                                                                            item.status === 'Returned'
                                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                                                : item.status === 'Cancelled'
                                                                                    ? 'bg-red-50 text-red-700 border border-red-100'
                                                                                    : 'bg-orange-50 text-orange-700 border border-orange-100'
                                                                        }`}>
                                                                            {item.status || 'Active'}
                                                                        </span>
                                                                    </td>

                                                                    <td className="py-4 px-4 text-center">
                                                                        <button
                                                                            onClick={() => handlePrint(item)}
                                                                            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-sm shadow-orange-100 transition"
                                                                        >
                                                                            🖨 Print
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                    <p className="text-xs text-slate-500">
                                                        Displaying <strong className="text-slate-700">{filteredAssignments.length}</strong> assignment records
                                                    </p>

                                                    <p className="text-xs text-slate-400">
                                                        United Medical College · IT Asset Management
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* REPORTS TAB */}
                            {activeTab === 'Reports' && (
                                <div className="mt-8 space-y-6">

                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7">

                                        <div className="mb-6">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-6 rounded-full bg-orange-500" />

                                                <h2 className="text-lg font-bold text-slate-800">
                                                    Assignment Reports
                                                </h2>
                                            </div>

                                            <p className="text-xs text-slate-400 mt-2 ml-4">
                                                Generate daily, monthly or date-range reports
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

                                            <div>
                                                {renderLabel('Report Type')}

                                                <select
                                                    value={reportType}
                                                    onChange={e => setReportType(e.target.value)}
                                                    className={inputClass}
                                                >
                                                    <option value="Daily">Daily Report</option>
                                                    <option value="Monthly">Monthly Report</option>
                                                    <option value="Range">Date Range Report</option>
                                                </select>
                                            </div>

                                            <div>
                                                {renderLabel(
                                                    reportType === 'Monthly'
                                                        ? 'Select Month'
                                                        : 'Start Date'
                                                )}

                                                <input
                                                    type={reportType === 'Monthly' ? 'month' : 'date'}
                                                    value={
                                                        reportType === 'Monthly'
                                                            ? reportStartDate.slice(0, 7)
                                                            : reportStartDate
                                                    }
                                                    onChange={e => setReportStartDate(
                                                        reportType === 'Monthly'
                                                            ? `${e.target.value}-01`
                                                            : e.target.value
                                                    )}
                                                    className={inputClass}
                                                />
                                            </div>

                                            {reportType === 'Range' && (
                                                <div>
                                                    {renderLabel('End Date')}

                                                    <input
                                                        type="date"
                                                        value={reportEndDate}
                                                        min={reportStartDate}
                                                        onChange={e => setReportEndDate(e.target.value)}
                                                        className={inputClass}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* REPORT SUMMARY */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

                                        <StatCard
                                            title="Total Assignments"
                                            value={reportAssignments.length}
                                            icon="▣"
                                            color="bg-blue-50 text-blue-600"
                                            accent="bg-blue-500"
                                            description="Matching assignment records"
                                        />

                                        <StatCard
                                            title="Total Devices"
                                            value={reportQuantity}
                                            icon="💻"
                                            color="bg-emerald-50 text-emerald-600"
                                            accent="bg-emerald-500"
                                            description="Devices assigned in this period"
                                        />

                                        <StatCard
                                            title="Departments Covered"
                                            value={new Set(
                                                reportAssignments.map(item =>
                                                    item.department?._id || item.department
                                                )
                                            ).size}
                                            icon="🏢"
                                            color="bg-violet-50 text-violet-600"
                                            accent="bg-violet-500"
                                            description="Departments with assignments"
                                        />
                                    </div>

                                    {/* REPORT TABLE */}
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">

                                        <div className="flex justify-between items-center mb-6">
                                            <div>
                                                <h2 className="text-lg font-bold text-slate-800">
                                                    Report Details
                                                </h2>

                                                <p className="text-xs text-slate-400 mt-1">
                                                    Assignment records for selected period
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => window.print()}
                                                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
                                            >
                                                🖨 Print Report
                                            </button>
                                        </div>

                                        {reportAssignments.length === 0 ? (
                                            <p className="text-sm text-slate-400 py-8 text-center">
                                                No assignment records for this period.
                                            </p>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full min-w-[1000px] text-left">
                                                    <thead>
                                                        <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase">
                                                            <th className="py-3 px-3">Assignment ID</th>
                                                            <th className="py-3 px-3">Products</th>
                                                            <th className="py-3 px-3">Department</th>
                                                            <th className="py-3 px-3">Location</th>
                                                            <th className="py-3 px-3">Receiver</th>
                                                            <th className="py-3 px-3">Type</th>
                                                            <th className="py-3 px-3">Quantity</th>
                                                            <th className="py-3 px-3">Date</th>
                                                        </tr>
                                                    </thead>

                                                    <tbody>
                                                        {reportAssignments.map(item => (
                                                            <tr key={item._id} className="border-b border-slate-50">
                                                                <td className="py-4 px-3 text-xs font-bold text-blue-600">
                                                                    {item.assignmentId}
                                                                </td>

                                                                <td className="py-4 px-3 text-sm text-slate-700 max-w-[280px]">
                                                                    {getAssignmentItems(item).map((product, index) => (
                                                                        <p key={product.stockItem?._id || product.stockItem || index} className="mb-1 last:mb-0">
                                                                            {getProductName(product)}
                                                                            <span className="text-xs text-slate-400">
                                                                                {' '}× {product.quantity || product.stockUnits?.length || 0}
                                                                            </span>
                                                                        </p>
                                                                    ))}
                                                                </td>

                                                                <td className="py-4 px-3 text-sm text-slate-600">
                                                                    {item.department?.name || 'N/A'}
                                                                </td>

                                                                <td className="py-4 px-3 text-xs text-slate-600">
                                                                    {item.assignmentType === 'Room'
                                                                        ? `${item.room?.floorLevel || 'N/A'} / Room ${item.room?.roomNumber || item.room?.name || 'N/A'}`
                                                                        : item.assignmentType}
                                                                </td>

                                                                <td className="py-4 px-3 text-sm text-slate-600">
                                                                    {item.receiver?.name || 'N/A'}
                                                                </td>

                                                                <td className="py-4 px-3 text-xs text-slate-600">
                                                                    {item.assignmentType}
                                                                </td>

                                                                <td className="py-4 px-3 text-sm font-bold text-slate-700">
                                                                    {getAssignmentQuantity(item)}
                                                                </td>

                                                                <td className="py-4 px-3 text-xs text-slate-500">
                                                                    {formatDate(item.assignedDate)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>

                                                    <tfoot>
                                                        <tr className="bg-slate-50">
                                                            <td colSpan="6" className="py-4 px-3 text-sm font-bold text-slate-700 text-right">
                                                                Total Assigned Devices
                                                            </td>

                                                            <td className="py-4 px-3 text-sm font-bold text-blue-600">
                                                                {reportQuantity}
                                                            </td>

                                                            <td />
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* FOOTER */}
                <footer className="no-print px-5 sm:px-8 py-5 border-t border-slate-200 bg-white text-center">
                    <p className="text-xs text-slate-400">
                        © 2026 United Medical College | IT Asset Management System
                    </p>
                </footer>
            </main>

            {/* PRINT DOCUMENT */}
            {printAssignment && (
                <div id="assignment-print" className="text-black">

                    <div className="text-center border-b-2 border-black pb-5 mb-6">
                        <h1 className="text-2xl font-bold">
                            UNITED MEDICAL COLLEGE
                        </h1>

                        <h2 className="text-sm font-bold mt-2">
                            IT INVENTORY & ASSET MANAGEMENT
                        </h2>

                        <h3 className="text-lg font-bold mt-5">
                            ASSET ASSIGNMENT DOCUMENT
                        </h3>
                    </div>

                    <div className="flex justify-between text-sm mb-6">
                        <p>
                            <strong>Assignment ID:</strong>{' '}
                            {printAssignment.assignmentId}
                        </p>

                        <p>
                            <strong>Date:</strong>{' '}
                            {formatDate(printAssignment.assignedDate)}
                        </p>
                    </div>

                    <h3 className="font-bold border-b border-black pb-2 mb-3">
                        ASSIGNED PRODUCT DETAILS
                    </h3>

                    <table className="w-full text-sm border-collapse mb-7">
                        <thead>
                            <tr>
                                <th className="border border-black p-2 text-left">#</th>
                                <th className="border border-black p-2 text-left">Product Name</th>
                                <th className="border border-black p-2 text-left">Brand</th>
                                <th className="border border-black p-2 text-left">Model</th>
                                <th className="border border-black p-2 text-left">SKU</th>
                                <th className="border border-black p-2 text-left">Quantity</th>
                            </tr>
                        </thead>

                        <tbody>
                            {getAssignmentItems(printAssignment).map((product, index) => (
                                <tr key={product.stockItem?._id || product.stockItem || index}>
                                    <td className="border border-black p-2">
                                        {index + 1}
                                    </td>

                                    <td className="border border-black p-2">
                                        {getProductName(product)}
                                    </td>

                                    <td className="border border-black p-2">
                                        {product.productDetails?.brand || product.stockItem?.brand || 'N/A'}
                                    </td>

                                    <td className="border border-black p-2">
                                        {product.productDetails?.model || product.stockItem?.model || 'N/A'}
                                    </td>

                                    <td className="border border-black p-2">
                                        {product.productDetails?.sku || product.stockItem?.sku || 'N/A'}
                                    </td>

                                    <td className="border border-black p-2">
                                        {product.quantity || product.stockUnits?.length || product.assets?.length || 0}
                                    </td>
                                </tr>
                            ))}
                        </tbody>

                        <tfoot>
                            <tr>
                                <td colSpan="5" className="border border-black p-2 text-right font-bold">
                                    Total Devices
                                </td>
                                <td className="border border-black p-2 font-bold">
                                    {getAssignmentQuantity(printAssignment)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    <h3 className="font-bold border-b border-black pb-2 mb-3">
                        DEVICE DETAILS
                    </h3>

                    <table className="w-full text-sm border-collapse mb-7">
                        <thead>
                            <tr>
                                <th className="border border-black p-2 text-left">#</th>
                                <th className="border border-black p-2 text-left">Product</th>
                                <th className="border border-black p-2 text-left">Asset ID</th>
                                <th className="border border-black p-2 text-left">Serial Number</th>
                                <th className="border border-black p-2 text-left">Unit Code</th>
                            </tr>
                        </thead>

                        <tbody>
                            {getAssignmentItems(printAssignment).flatMap((product, productIndex) => (
                                (product.assets || []).map((asset, assetIndex) => (
                                    <tr key={asset._id || `${productIndex}-${assetIndex}`}>
                                        <td className="border border-black p-2">
                                            {productIndex + 1}.{assetIndex + 1}
                                        </td>

                                        <td className="border border-black p-2">
                                            {getProductName(product)}
                                        </td>

                                        <td className="border border-black p-2">
                                            {asset.assetId || 'N/A'}
                                        </td>

                                        <td className="border border-black p-2">
                                            {asset.serialNumber || 'N/A'}
                                        </td>

                                        <td className="border border-black p-2">
                                            {asset.stockUnit?.unitCode || 'N/A'}
                                        </td>
                                    </tr>
                                ))
                            ))}

                            {!getAssignmentItems(printAssignment).some(
                                product => product.assets?.length > 0
                            ) && (
                                <tr>
                                    <td colSpan="5" className="border border-black p-3 text-center">
                                        No device details available in this assignment record.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <h3 className="font-bold border-b border-black pb-2 mb-3">
                        RECEIVER DETAILS
                    </h3>

                    <table className="w-full text-sm border-collapse mb-7">
                        <tbody>
                            <tr>
                                <td className="border border-black p-3 font-bold w-1/3">
                                    Assignment Type
                                </td>

                                <td className="border border-black p-3">
                                    {printAssignment.assignmentType}
                                </td>
                            </tr>

                            <tr>
                                <td className="border border-black p-3 font-bold">
                                    Department
                                </td>

                                <td className="border border-black p-3">
                                    {printAssignment.department?.name || 'N/A'}
                                </td>
                            </tr>

                            {printAssignment.assignmentType === 'Room' && (
                                <>
                                    <tr>
                                        <td className="border border-black p-3 font-bold">
                                            Floor Level
                                        </td>

                                        <td className="border border-black p-3">
                                            {printAssignment.room?.floorLevel || 'N/A'}
                                        </td>
                                    </tr>

                                    <tr>
                                        <td className="border border-black p-3 font-bold">
                                            Room Number
                                        </td>

                                        <td className="border border-black p-3">
                                            {printAssignment.room?.roomNumber || printAssignment.room?.name || 'N/A'}
                                        </td>
                                    </tr>
                                </>
                            )}

                            <tr>
                                <td className="border border-black p-3 font-bold">
                                    Receiver Name
                                </td>

                                <td className="border border-black p-3">
                                    {printAssignment.receiver?.name || 'N/A'}
                                </td>
                            </tr>

                            <tr>
                                <td className="border border-black p-3 font-bold">
                                    Employee ID
                                </td>

                                <td className="border border-black p-3">
                                    {printAssignment.receiver?.employeeId || 'N/A'}
                                </td>
                            </tr>

                            <tr>
                                <td className="border border-black p-3 font-bold">
                                    Designation
                                </td>

                                <td className="border border-black p-3">
                                    {printAssignment.receiver?.designation || 'N/A'}
                                </td>
                            </tr>

                            <tr>
                                <td className="border border-black p-3 font-bold">
                                    Contact Number
                                </td>

                                <td className="border border-black p-3">
                                    {printAssignment.receiver?.phone || 'N/A'}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {printAssignment.notes && (
                        <div className="mb-10">
                            <strong>Notes:</strong>
                            <p className="mt-2 text-sm">
                                {printAssignment.notes}
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-16 mt-24 text-center text-sm">
                        <div>
                            <div className="border-t border-black pt-2">
                                Prepared By
                            </div>
                        </div>

                        <div>
                            <div className="border-t border-black pt-2">
                                Received By
                            </div>
                        </div>
                    </div>

                    <div className="mt-20 text-center text-xs text-slate-500">
                        United Medical College | IT Inventory & Asset Management
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssignmentManagement;
