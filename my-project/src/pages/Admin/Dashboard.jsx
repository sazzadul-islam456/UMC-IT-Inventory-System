
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate, useLocation } from 'react-router';
import AdminSidebar from '../../components/AdminSidebar.jsx';

const API_URL = 'http://localhost:3001/api/dashboard-audit';
const USERS_API_URL = 'http://localhost:3001/api/users';

// REUSABLE DONUT CHART
const DonutChart = ({ segments, total, centerLabel }) => {
    const circumference = 2 * Math.PI * 68;
    let offset = 0;

    return (
        <div className="relative w-44 h-44 shrink-0">
            <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                <circle
                    cx="80"
                    cy="80"
                    r="68"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="17"
                />

                {segments.map((segment, index) => {
                    const percentage = total > 0
                        ? (segment.value / total) * 100
                        : 0;

                    const dash = (percentage / 100) * circumference;
                    const currentOffset = offset;

                    offset += dash;

                    return (
                        <circle
                            key={index}
                            cx="80"
                            cy="80"
                            r="68"
                            fill="none"
                            stroke={segment.color}
                            strokeWidth="17"
                            strokeDasharray={`${dash} ${circumference - dash}`}
                            strokeDashoffset={-currentOffset}
                            strokeLinecap="round"
                            className="transition-all duration-700"
                        />
                    );
                })}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-slate-800">
                    {total}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                    {centerLabel}
                </span>
            </div>
        </div>
    );
};

// REUSABLE STAT CARD
const StatCard = ({
    title,
    value,
    icon,
    color,
    description,
    accent
}) => (
    <div className="group relative overflow-hidden bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-[fadeIn_0.5s_ease-out]">
        <div className={`absolute top-0 left-0 w-full h-1 ${accent || 'bg-blue-500'}`} />

        <div className="flex justify-between items-start">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${color}`}>
                {icon}
            </div>

            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Live Data
            </span>
        </div>

        <h2 className="text-3xl font-bold text-slate-800 mt-5 transition-all duration-500">
            {(Number(value) || 0).toLocaleString()}
        </h2>

        <p className="text-sm font-semibold text-slate-600 mt-1">
            {title}
        </p>

        <p className="text-xs text-slate-400 mt-2">
            {description}
        </p>
    </div>
);

// SECTION TITLE
const SectionTitle = ({ title, description }) => (
    <div className="mb-5">
        <div className="flex items-center gap-2">
            <span className="w-2 h-6 rounded-full bg-orange-500" />
            <h2 className="text-lg font-bold text-slate-800">
                {title}
            </h2>
        </div>

        {description && (
            <p className="text-xs text-slate-400 mt-2 ml-4">
                {description}
            </p>
        )}
    </div>
);

// FORMAT DATE
const formatDate = (date) => {
    if (!date) return 'N/A';

    return new Date(date).toLocaleString('en-GB', {
        timeZone: 'Asia/Dhaka',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// FORMAT NUMBER
const numberFormat = (value) => {
    return (Number(value) || 0).toLocaleString('en-BD');
};

// FORMAT DATE RANGE FOR REPORT
const formatReportDate = (date) => {
    if (!date) return 'N/A';

    const parsedDate = new Date(`${date}T00:00:00+06:00`);

    if (Number.isNaN(parsedDate.getTime())) {
        return date;
    }

    return parsedDate.toLocaleDateString('en-GB', {
        timeZone: 'Asia/Dhaka',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
};

// ACTIVITY ICON
const getActivityStyle = (type) => {
    const styles = {
        'Opening Stock': 'bg-violet-50 text-violet-600',
        'Stock Received': 'bg-blue-50 text-blue-600',
        Assignment: 'bg-emerald-50 text-emerald-600',
        Damage: 'bg-red-50 text-red-600',
        Repair: 'bg-orange-50 text-orange-600',
        'Supplier Return': 'bg-amber-50 text-amber-600',
        'New User': 'bg-indigo-50 text-indigo-600'
    };

    const icons = {
        'Opening Stock': '📦',
        'Stock Received': '📥',
        Assignment: '♙',
        Damage: '⚠',
        Repair: '🔧',
        'Supplier Return': '↩',
        'New User': '👤'
    };

    return {
        color: styles[type] || 'bg-slate-100 text-slate-600',
        icon: icons[type] || '●'
    };
};

// PRINT TABLE ROW
const PrintRow = ({ label, value }) => (
    <tr>
        <td>{label}</td>
        <td className="text-right font-semibold">
            {numberFormat(value)}
        </td>
    </tr>
);

// PRINT SECTION
const PrintSection = ({ title, children }) => (
    <section className="print-section">
        <h3 className="print-section-title">{title}</h3>
        {children}
    </section>
);

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [activeMenu, setActiveMenu] = useState('Dashboard');

    // AUDIT REPORT STATE
    const [auditData, setAuditData] = useState(null);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState('');

    // REPORT FILTER
    const [period, setPeriod] = useState('month');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // PRINT REPORT STATE
    const [printAuditData, setPrintAuditData] = useState(null);
    const [printLoading, setPrintLoading] = useState(false);
    const [printError, setPrintError] = useState('');
    const [pendingPrint, setPendingPrint] = useState(false);

    // PRINT REPORT FILTER STATE
    const [printReportType, setPrintReportType] = useState('month');
    const [printDate, setPrintDate] = useState('');
    const [printMonth, setPrintMonth] = useState(
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    );
    const [printDateFrom, setPrintDateFrom] = useState('');
    const [printDateTo, setPrintDateTo] = useState('');

    // USER LIST
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState('');

    const menuItems = [
        { name: 'Dashboard', icon: '▦' },
        { name: 'User Management', icon: '♙' },
        { name: 'Stock Inventory', icon: '📦' },
        { name: 'Asset Management', icon: '▣' },
        { name: 'Departments', icon: '▤' },
        { name: 'Reports', icon: '▥' },
        { name: 'Settings', icon: '⚙' }
    ];

    // DASHBOARD MENU URL SYNC
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const requestedMenu = params.get('menu');

        const isValidMenu = menuItems.some(
            (item) => item.name === requestedMenu
        );

        setActiveMenu(isValidMenu ? requestedMenu : 'Dashboard');
    }, [location.search]);

    // GET AUTH TOKEN
    const getToken = () => {
        const token = localStorage.getItem('pos-token');

        if (!token) {
            throw new Error('Please login again.');
        }

        return token;
    };

    // LOAD MASTER AUDIT DATA
    const fetchDashboardAudit = async () => {
        setAuditLoading(true);
        setAuditError('');

        try {
            const token = getToken();

            const params = new URLSearchParams({
                period
            });

            if (period === 'custom') {
                if (!dateFrom || !dateTo) {
                    throw new Error('Please select both start and end dates.');
                }

                if (dateFrom > dateTo) {
                    throw new Error('Start date cannot be after end date.');
                }

                params.set('dateFrom', dateFrom);
                params.set('dateTo', dateTo);
            }

            const response = await fetch(
                `${API_URL}?${params.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || 'Failed to load audit dashboard.'
                );
            }

            setAuditData(data);

        } catch (err) {
            setAuditError(err.message);
        } finally {
            setAuditLoading(false);
        }
    };

    // LOAD ALL USERS
    const fetchAllUsers = async () => {
        setUsersLoading(true);
        setUsersError('');

        try {
            const token = getToken();

            const response = await fetch(
                USERS_API_URL,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || 'Failed to load users.'
                );
            }

            setUsers(data.users || []);

        } catch (err) {
            setUsersError(err.message);
        } finally {
            setUsersLoading(false);
        }
    };

    // INITIAL DATA LOAD
    useEffect(() => {
        fetchDashboardAudit();
        fetchAllUsers();
    }, []);

    // PRINT AFTER PRINT DATA IS READY
    useEffect(() => {
        if (pendingPrint && printAuditData) {
            const printTimer = setTimeout(() => {
                window.print();
                setPendingPrint(false);
            }, 300);

            return () => clearTimeout(printTimer);
        }
    }, [pendingPrint, printAuditData]);

    // REFRESH DASHBOARD
    const handleRefreshDashboard = () => {
        fetchDashboardAudit();
        fetchAllUsers();
    };

    // APPLY REPORT FILTER
    const handleApplyReport = () => {
        fetchDashboardAudit();
    };

    // GENERATE PRINT REPORT
    const handlePrintReport = async (selectedType = printReportType) => {
        setPrintLoading(true);
        setPrintError('');
        setPrintAuditData(null);

        try {
            const token = getToken();

            const params = new URLSearchParams();
            let requestPeriod = selectedType;

            // WEEKLY REPORT
            if (selectedType === 'week') {
                params.set('period', 'week');
            }

            // CURRENT MONTH REPORT
            else if (selectedType === 'month') {
                params.set('period', 'month');
            }

            // SELECTED MONTH REPORT
            else if (selectedType === 'selectedMonth') {
                if (!printMonth) {
                    throw new Error('Please select a month.');
                }

                const [year, month] = printMonth.split('-').map(Number);

                const firstDate = `${year}-${String(month).padStart(2, '0')}-01`;

                const lastDay = new Date(year, month, 0).getDate();

                const lastDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

                requestPeriod = 'custom';

                params.set('period', 'custom');
                params.set('dateFrom', firstDate);
                params.set('dateTo', lastDate);
            }

            // SINGLE DATE REPORT
            else if (selectedType === 'daily') {
                if (!printDate) {
                    throw new Error('Please select a date for the report.');
                }

                requestPeriod = 'custom';

                params.set('period', 'custom');
                params.set('dateFrom', printDate);
                params.set('dateTo', printDate);
            }

            // CUSTOM DATE RANGE REPORT
            else if (selectedType === 'custom') {
                if (!printDateFrom || !printDateTo) {
                    throw new Error('Please select both start and end dates.');
                }

                if (printDateFrom > printDateTo) {
                    throw new Error('Start date cannot be after end date.');
                }

                requestPeriod = 'custom';

                params.set('period', 'custom');
                params.set('dateFrom', printDateFrom);
                params.set('dateTo', printDateTo);
            }

            else {
                throw new Error('Please select a valid report type.');
            }

            const response = await fetch(
                `${API_URL}?${params.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || 'Unable to generate print report.'
                );
            }

            // KEEP SELECTED REPORT TYPE FOR DISPLAY
            data.printReportSelection = selectedType;

            setPrintAuditData(data);
            setPendingPrint(true);

        } catch (err) {
            setPrintError(err.message);
        } finally {
            setPrintLoading(false);
        }
    };

    // USER STATUS STATISTICS
    const activeUsers = users.filter(
        item => item.isActive !== false
    ).length;

    const inactiveUsers = users.filter(
        item => item.isActive === false
    ).length;

    // CURRENT DATABASE DATA
    const current = auditData?.current || {};
    const stock = current.stock || {};
    const assets = current.assets || {};
    const departments = current.departments || {};
    const rooms = current.rooms || {};
    const userStats = current.users || {};

    // PERIOD REPORT DATA
    const report = auditData?.report || {};
    const receiving = report.receiving || {};
    const assignments = report.assignments || {};
    const damages = report.damages || {};
    const repairs = report.repairs || {};
    const supplierReturns = report.supplierReturns || {};

    const activities = auditData?.activities || [];

    // STOCK CHART DATA
    const stockItems = [
        {
            name: 'Available',
            value: stock.available || 0,
            color: 'bg-emerald-500',
            hex: '#10b981'
        },
        {
            name: 'Assigned',
            value: stock.assigned || 0,
            color: 'bg-blue-500',
            hex: '#3b82f6'
        },
        {
            name: 'Damaged',
            value: stock.damaged || 0,
            color: 'bg-red-500',
            hex: '#ef4444'
        },
        {
            name: 'Under Repair',
            value: stock.underRepair || 0,
            color: 'bg-orange-500',
            hex: '#f97316'
        },
        {
            name: 'Returned',
            value: stock.returned || 0,
            color: 'bg-violet-500',
            hex: '#8b5cf6'
        }
    ];

    const stockSegments = stockItems.map(item => ({
        label: item.name,
        value: item.value,
        color: item.hex
    }));

    // ASSET CHART DATA
    const assetItems = [
        {
            name: 'Available',
            value: assets.available || 0,
            color: 'bg-emerald-500',
            hex: '#10b981'
        },
        {
            name: 'Assigned',
            value: assets.assigned || 0,
            color: 'bg-blue-500',
            hex: '#3b82f6'
        },
        {
            name: 'Damaged',
            value: assets.damaged || 0,
            color: 'bg-red-500',
            hex: '#ef4444'
        },
        {
            name: 'Under Repair',
            value: assets.underRepair || 0,
            color: 'bg-orange-500',
            hex: '#f97316'
        },
        {
            name: 'Returned',
            value: assets.returned || 0,
            color: 'bg-violet-500',
            hex: '#8b5cf6'
        }
    ];

    const assetSegments = assetItems.map(item => ({
        label: item.name,
        value: item.value,
        color: item.hex
    }));

    // USER CHART DATA
    const userSegments = [
        {
            label: 'Administrators',
            value: userStats.admins || 0,
            color: '#8b5cf6'
        },
        {
            label: 'Employees',
            value: userStats.employees || 0,
            color: '#f97316'
        },
        {
            label: 'Normal Users',
            value: userStats.normalUsers || 0,
            color: '#3b82f6'
        }
    ];

    // USER ACCOUNT STATUS
    const accountSegments = [
        {
            label: 'Active Users',
            value: userStats.active || 0,
            color: '#10b981'
        },
        {
            label: 'Inactive Users',
            value: userStats.inactive || 0,
            color: '#f97316'
        }
    ];

    // PRINT DATA
    const printCurrent = printAuditData?.current || {};
    const printStock = printCurrent.stock || {};
    const printAssets = printCurrent.assets || {};
    const printDepartments = printCurrent.departments || {};
    const printRooms = printCurrent.rooms || {};
    const printUsers = printCurrent.users || {};

    const printReport = printAuditData?.report || {};
    const printReceiving = printReport.receiving || {};
    const printAssignments = printReport.assignments || {};
    const printDamages = printReport.damages || {};
    const printRepairs = printReport.repairs || {};
    const printSupplierReturns = printReport.supplierReturns || {};
    const printActivities = printAuditData?.activities || [];

    // DETERMINE PRINT REPORT TITLE
    const reportDateFrom = printAuditData?.period?.dateFrom || '';
    const reportDateTo = printAuditData?.period?.dateTo || '';

    const isSingleDayReport = (
        reportDateFrom &&
        reportDateTo &&
        reportDateFrom === reportDateTo
    );

    const isFullMonthReport = (() => {
        if (!reportDateFrom || !reportDateTo) return false;

        const [year, month] = reportDateFrom.split('-').map(Number);

        if (!year || !month) return false;

        const lastDay = new Date(year, month, 0).getDate();

        const expectedLastDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        return (
            reportDateFrom.endsWith('-01') &&
            reportDateTo === expectedLastDate
        );
    })();

    const printReportTitle = (() => {
        if (printAuditData?.period?.type === 'week') {
            return 'WEEKLY AUDIT REPORT';
        }

        if (printAuditData?.printReportSelection === 'daily' || isSingleDayReport) {
            return 'DAILY AUDIT REPORT';
        }

        if (
            printAuditData?.printReportSelection === 'selectedMonth' ||
            isFullMonthReport
        ) {
            return 'MONTHLY AUDIT REPORT';
        }

        if (printAuditData?.period?.type === 'month') {
            return 'MONTHLY AUDIT REPORT';
        }

        return 'CUSTOM DATE RANGE AUDIT REPORT';
    })();

    const printReportTypeLabel = printReportTitle
        .replace(' AUDIT REPORT', '')
        .replace('CUSTOM DATE RANGE', 'CUSTOM DATE RANGE');

    // DASHBOARD NAVIGATION
    const handleNavigation = (menuName) => {
        if (menuName === 'User Management') {
            navigate('/admin/users');
            return;
        }

        if (menuName === 'Stock Inventory') {
            navigate('/admin/stock');
            return;
        }

        if (menuName === 'Asset Management') {
            navigate('/admin/assets');
            return;
        }

        if (menuName === 'Departments') {
            navigate('/admin/departments');
            return;
        }

        setActiveMenu(menuName);

        navigate(
            `${location.pathname}?menu=${encodeURIComponent(menuName)}`,
            { replace: true }
        );
    };

    return (
        <div className="dashboard-root min-h-screen bg-slate-100 flex">

            {/* REUSABLE ADMIN SIDEBAR */}
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
                            {activeMenu}
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
                <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">

                    {activeMenu === 'Dashboard' && (
                        <>

                            {/* WELCOME SECTION */}
                            <div className="no-print mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-2 h-2 rounded-full bg-orange-500" />

                                        <p className="text-sm text-orange-600 font-bold tracking-wide">
                                            CENTRAL MASTER AUDIT
                                        </p>
                                    </div>

                                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                                        Welcome back, {user?.name || 'Administrator'}!
                                    </h1>

                                    <p className="text-slate-500 text-sm mt-2">
                                        Complete IT inventory and asset audit overview.
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={handleRefreshDashboard}
                                        disabled={auditLoading || usersLoading}
                                        className="px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-orange-300 hover:text-orange-600 text-sm font-semibold shadow-sm transition disabled:opacity-50"
                                    >
                                        ↻ Refresh
                                    </button>
                                </div>
                            </div>

                            {/* PRINT REPORT OPTIONS */}
                            <div className="no-print bg-white border border-slate-200 rounded-2xl p-5 mb-8 shadow-sm">

                                <div className="flex flex-col gap-5">

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-6 rounded-full bg-orange-500" />

                                            <h2 className="text-lg font-bold text-slate-800">
                                                Print Audit Report
                                            </h2>
                                        </div>

                                        <p className="text-xs text-slate-400 mt-2 ml-4">
                                            Generate an official A4 audit report using recorded database information.
                                        </p>
                                    </div>

                                    {/* REPORT TYPE */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-2">
                                            SELECT REPORT TYPE
                                        </label>

                                        <select
                                            value={printReportType}
                                            onChange={(e) => {
                                                setPrintReportType(e.target.value);
                                                setPrintError('');
                                            }}
                                            className="w-full md:max-w-md px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-orange-500"
                                        >
                                            <option value="week">Weekly Report - Current Week</option>
                                            <option value="month">Monthly Report - Current Month</option>
                                            <option value="selectedMonth">Select Previous / Specific Month</option>
                                            <option value="daily">Specific Date Report</option>
                                            <option value="custom">Custom Date Range Report</option>
                                        </select>
                                    </div>

                                    {/* SELECTED MONTH */}
                                    {printReportType === 'selectedMonth' && (
                                        <div className="max-w-md">
                                            <label className="block text-xs font-bold text-slate-500 mb-2">
                                                SELECT MONTH
                                            </label>

                                            <input
                                                type="month"
                                                value={printMonth}
                                                onChange={(e) => setPrintMonth(e.target.value)}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500"
                                            />

                                            <p className="text-xs text-slate-400 mt-2">
                                                The report will include the first to the last day of the selected month.
                                            </p>
                                        </div>
                                    )}

                                    {/* SINGLE DATE */}
                                    {printReportType === 'daily' && (
                                        <div className="max-w-md">
                                            <label className="block text-xs font-bold text-slate-500 mb-2">
                                                SELECT REPORT DATE
                                            </label>

                                            <input
                                                type="date"
                                                value={printDate}
                                                onChange={(e) => setPrintDate(e.target.value)}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500"
                                            />

                                            <p className="text-xs text-slate-400 mt-2">
                                                Only activities recorded on the selected date will be included.
                                            </p>
                                        </div>
                                    )}

                                    {/* CUSTOM DATE RANGE */}
                                    {printReportType === 'custom' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-2">
                                                    START DATE
                                                </label>

                                                <input
                                                    type="date"
                                                    value={printDateFrom}
                                                    onChange={(e) => setPrintDateFrom(e.target.value)}
                                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-2">
                                                    END DATE
                                                </label>

                                                <input
                                                    type="date"
                                                    value={printDateTo}
                                                    min={printDateFrom || undefined}
                                                    onChange={(e) => setPrintDateTo(e.target.value)}
                                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* GENERATE BUTTON */}
                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            onClick={() => handlePrintReport()}
                                            disabled={printLoading}
                                            className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold shadow-sm transition disabled:opacity-50"
                                        >
                                            {printLoading ? 'Preparing Report...' : '🖨 Generate & Print Report'}
                                        </button>
                                    </div>
                                </div>

                                {printError && (
                                    <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
                                        <p className="text-sm text-red-600 font-semibold">
                                            {printError}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* REPORT FILTER
                            <div className="no-print bg-white border border-slate-200 rounded-2xl p-5 mb-8 shadow-sm">

                                <div className="flex flex-col lg:flex-row lg:items-end gap-4">

                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-slate-500 mb-2">
                                            DASHBOARD REPORT PERIOD
                                        </label>

                                        <select
                                            value={period}
                                            onChange={(e) => setPeriod(e.target.value)}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-blue-500"
                                        >
                                            <option value="week">This Week</option>
                                            <option value="month">This Month</option>
                                            <option value="custom">Custom Date Range</option>
                                        </select>
                                    </div>

                                    {period === 'custom' && (
                                        <>
                                            <div className="flex-1">
                                                <label className="block text-xs font-bold text-slate-500 mb-2">
                                                    START DATE
                                                </label>

                                                <input
                                                    type="date"
                                                    value={dateFrom}
                                                    onChange={(e) => setDateFrom(e.target.value)}
                                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
                                                />
                                            </div>

                                            <div className="flex-1">
                                                <label className="block text-xs font-bold text-slate-500 mb-2">
                                                    END DATE
                                                </label>

                                                <input
                                                    type="date"
                                                    value={dateTo}
                                                    min={dateFrom || undefined}
                                                    onChange={(e) => setDateTo(e.target.value)}
                                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
                                                />
                                            </div>
                                        </>
                                    )}

                                    <button
                                        onClick={handleApplyReport}
                                        disabled={auditLoading}
                                        className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition disabled:opacity-50"
                                    >
                                        {auditLoading ? 'Loading...' : 'Apply Report'}
                                    </button>
                                </div>

                                {auditData?.period && (
                                    <p className="text-xs text-slate-400 mt-4">
                                        Showing dashboard report: {auditData.period.dateFrom} to {auditData.period.dateTo}
                                    </p>
                                )}
                            </div> */}

                            {/* LOADING / ERROR */}
                            {auditLoading && !auditData && (
                                <div className="no-print bg-white rounded-2xl p-10 text-center border border-slate-200">
                                    <div className="text-3xl animate-pulse mb-3">
                                        📊
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        Loading master audit data...
                                    </p>
                                </div>
                            )}

                            {auditError && (
                                <div className="no-print bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                                    <p className="text-sm font-semibold text-red-600">
                                        {auditError}
                                    </p>

                                    <button
                                        onClick={fetchDashboardAudit}
                                        className="text-xs text-blue-700 font-bold mt-2 hover:underline"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            )}

                            {auditData && (
                                <>

                                    {/* CURRENT STOCK STATISTICS */}
                                    <SectionTitle
                                        title="Stock Inventory Overview"
                                        description="Current stock quantities from database"
                                    />

                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

                                        <StatCard
                                            title="Total Stock Items"
                                            value={stock.totalStockItems}
                                            icon="📦"
                                            color="bg-blue-50 text-blue-600"
                                            accent="bg-blue-500"
                                            description="Registered stock products"
                                        />

                                        <StatCard
                                            title="Total Stock Units"
                                            value={stock.totalUnits}
                                            icon="▦"
                                            color="bg-violet-50 text-violet-600"
                                            accent="bg-violet-500"
                                            description="All registered individual units"
                                        />

                                        <StatCard
                                            title="Available Stock"
                                            value={stock.available}
                                            icon="✓"
                                            color="bg-emerald-50 text-emerald-600"
                                            accent="bg-emerald-500"
                                            description="Ready for assignment"
                                        />

                                        <StatCard
                                            title="Assigned Stock"
                                            value={stock.assigned}
                                            icon="♙"
                                            color="bg-blue-50 text-blue-600"
                                            accent="bg-blue-500"
                                            description="Currently assigned units"
                                        />

                                        <StatCard
                                            title="Damaged Stock"
                                            value={stock.damaged}
                                            icon="⚠"
                                            color="bg-red-50 text-red-600"
                                            accent="bg-red-500"
                                            description="Currently damaged units"
                                        />

                                        <StatCard
                                            title="Under Repair"
                                            value={stock.underRepair}
                                            icon="🔧"
                                            color="bg-orange-50 text-orange-600"
                                            accent="bg-orange-500"
                                            description="Currently under repair"
                                        />

                                        <StatCard
                                            title="Supplier Returned"
                                            value={stock.returned}
                                            icon="↩"
                                            color="bg-violet-50 text-violet-600"
                                            accent="bg-violet-500"
                                            description="Returned to suppliers"
                                        />
                                    </div>

                                    {/* ASSET STATISTICS */}
                                    <div className="mt-9">
                                        <SectionTitle
                                            title="Asset Management Overview"
                                            description="Current registered asset status"
                                        />

                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

                                            <StatCard
                                                title="Total Assets"
                                                value={assets.total}
                                                icon="💻"
                                                color="bg-blue-50 text-blue-600"
                                                accent="bg-blue-500"
                                                description="Registered asset records"
                                            />

                                            <StatCard
                                                title="Available Assets"
                                                value={assets.available}
                                                icon="✓"
                                                color="bg-emerald-50 text-emerald-600"
                                                accent="bg-emerald-500"
                                                description="Ready to use"
                                            />

                                            <StatCard
                                                title="Assigned Assets"
                                                value={assets.assigned}
                                                icon="♙"
                                                color="bg-violet-50 text-violet-600"
                                                accent="bg-violet-500"
                                                description="Currently assigned"
                                            />

                                            <StatCard
                                                title="Damaged Assets"
                                                value={assets.damaged}
                                                icon="⚠"
                                                color="bg-red-50 text-red-600"
                                                accent="bg-red-500"
                                                description="Currently damaged"
                                            />

                                            <StatCard
                                                title="Under Repair Assets"
                                                value={assets.underRepair}
                                                icon="🔧"
                                                color="bg-orange-50 text-orange-600"
                                                accent="bg-orange-500"
                                                description="Currently under repair"
                                            />

                                            <StatCard
                                                title="Returned Assets"
                                                value={assets.returned}
                                                icon="↩"
                                                color="bg-slate-100 text-slate-600"
                                                accent="bg-slate-500"
                                                description="Returned to supplier"
                                            />
                                        </div>
                                    </div>

                                    {/* AUDIT ACTIVITY SUMMARY */}
                                    <div className="mt-9">
                                        <SectionTitle
                                            title="Historical Audit Summary"
                                            description="Activities recorded within the selected reporting period"
                                        />

                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

                                            <StatCard
                                                title="Stock Received"
                                                value={receiving.receivedQuantity}
                                                icon="📥"
                                                color="bg-blue-50 text-blue-600"
                                                accent="bg-blue-500"
                                                description={`${receiving.normalReceipts || 0} receipt records`}
                                            />

                                            <StatCard
                                                title="Opening Stock"
                                                value={receiving.openingStockQuantity}
                                                icon="📦"
                                                color="bg-violet-50 text-violet-600"
                                                accent="bg-violet-500"
                                                description={`${receiving.openingStockReceipts || 0} opening receipts`}
                                            />

                                            <StatCard
                                                title="Assignment Records"
                                                value={assignments.total}
                                                icon="♙"
                                                color="bg-emerald-50 text-emerald-600"
                                                accent="bg-emerald-500"
                                                description={`${assignments.quantity || 0} units assigned historically`}
                                            />

                                            <StatCard
                                                title="Damage Events"
                                                value={damages.total}
                                                icon="⚠"
                                                color="bg-red-50 text-red-600"
                                                accent="bg-red-500"
                                                description="Recorded damage history"
                                            />

                                            <StatCard
                                                title="Repair Records"
                                                value={repairs.total}
                                                icon="🔧"
                                                color="bg-orange-50 text-orange-600"
                                                accent="bg-orange-500"
                                                description="Repair processes started"
                                            />

                                            <StatCard
                                                title="Successful Repairs"
                                                value={repairs.successful}
                                                icon="✓"
                                                color="bg-emerald-50 text-emerald-600"
                                                accent="bg-emerald-500"
                                                description="Successfully completed"
                                            />

                                            <StatCard
                                                title="Unsuccessful Repairs"
                                                value={repairs.unsuccessful}
                                                icon="✕"
                                                color="bg-red-50 text-red-600"
                                                accent="bg-red-500"
                                                description="Unsuccessful repair records"
                                            />

                                            <StatCard
                                                title="Supplier Returns"
                                                value={supplierReturns.quantity}
                                                icon="↩"
                                                color="bg-amber-50 text-amber-600"
                                                accent="bg-orange-500"
                                                description={`${supplierReturns.total || 0} return records`}
                                            />
                                        </div>
                                    </div>

                                    {/* DEPARTMENT / ROOM / USER SUMMARY */}
                                    <div className="mt-9">
                                        <SectionTitle
                                            title="Institution Management Overview"
                                            description="Department, room and user records"
                                        />

                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

                                            <StatCard
                                                title="Total Departments"
                                                value={departments.total}
                                                icon="🏢"
                                                color="bg-blue-50 text-blue-600"
                                                accent="bg-blue-500"
                                                description={`${departments.active || 0} active / ${departments.inactive || 0} inactive`}
                                            />

                                            <StatCard
                                                title="Total Rooms"
                                                value={rooms.total}
                                                icon="🚪"
                                                color="bg-violet-50 text-violet-600"
                                                accent="bg-violet-500"
                                                description={`${rooms.active || 0} active / ${rooms.inactive || 0} inactive`}
                                            />

                                            <StatCard
                                                title="Total Users"
                                                value={userStats.total}
                                                icon="♙"
                                                color="bg-emerald-50 text-emerald-600"
                                                accent="bg-emerald-500"
                                                description={`${userStats.active || 0} active accounts`}
                                            />

                                            <StatCard
                                                title="Administrators"
                                                value={userStats.admins}
                                                icon="🛡️"
                                                color="bg-orange-50 text-orange-600"
                                                accent="bg-orange-500"
                                                description="Registered admin accounts"
                                            />
                                        </div>
                                    </div>

                                    {/* ANALYTICS */}
                                    <div className="mt-9">
                                        <SectionTitle
                                            title="Analytics & Distribution"
                                            description="Visual overview of current inventory and accounts"
                                        />

                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

                                            {/* STOCK DISTRIBUTION */}
                                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-lg transition duration-300">
                                                <h3 className="font-bold text-slate-800">
                                                    Stock Distribution
                                                </h3>

                                                <p className="text-xs text-slate-400 mt-1">
                                                    By stock unit status
                                                </p>

                                                <div className="flex justify-center py-5">
                                                    <DonutChart
                                                        segments={stockSegments}
                                                        total={stock.totalUnits || 0}
                                                        centerLabel="Stock Units"
                                                    />
                                                </div>

                                                <div className="space-y-3">
                                                    {stockItems.map(item => (
                                                        <div key={item.name} className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                                                                <span className="text-xs text-slate-500">
                                                                    {item.name}
                                                                </span>
                                                            </div>

                                                            <span className="text-xs font-bold text-slate-700">
                                                                {item.value}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* ASSET DISTRIBUTION */}
                                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-lg transition duration-300">
                                                <h3 className="font-bold text-slate-800">
                                                    Asset Distribution
                                                </h3>

                                                <p className="text-xs text-slate-400 mt-1">
                                                    By asset status
                                                </p>

                                                <div className="flex justify-center py-5">
                                                    <DonutChart
                                                        segments={assetSegments}
                                                        total={assets.total || 0}
                                                        centerLabel="Assets"
                                                    />
                                                </div>

                                                <div className="space-y-3">
                                                    {assetItems.map(item => (
                                                        <div key={item.name} className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                                                                <span className="text-xs text-slate-500">
                                                                    {item.name}
                                                                </span>
                                                            </div>

                                                            <span className="text-xs font-bold text-slate-700">
                                                                {item.value}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* USER DISTRIBUTION */}
                                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-lg transition duration-300">
                                                <h3 className="font-bold text-slate-800">
                                                    User Distribution
                                                </h3>

                                                <p className="text-xs text-slate-400 mt-1">
                                                    Accounts by role
                                                </p>

                                                <div className="flex justify-center py-5">
                                                    <DonutChart
                                                        segments={userSegments}
                                                        total={userStats.total || 0}
                                                        centerLabel="Users"
                                                    />
                                                </div>

                                                <div className="space-y-3">
                                                    {userSegments.map(item => (
                                                        <div key={item.label} className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className="w-2.5 h-2.5 rounded-full"
                                                                    style={{ backgroundColor: item.color }}
                                                                />
                                                                <span className="text-xs text-slate-500">
                                                                    {item.label}
                                                                </span>
                                                            </div>

                                                            <span className="text-xs font-bold text-slate-700">
                                                                {item.value}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* ACCOUNT STATUS */}
                                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-lg transition duration-300">
                                                <h3 className="font-bold text-slate-800">
                                                    Account Status
                                                </h3>

                                                <p className="text-xs text-slate-400 mt-1">
                                                    Active vs inactive
                                                </p>

                                                <div className="flex justify-center py-5">
                                                    <DonutChart
                                                        segments={accountSegments}
                                                        total={userStats.total || 0}
                                                        centerLabel="Accounts"
                                                    />
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex justify-between">
                                                        <span className="text-xs text-slate-500">
                                                            <span className="text-emerald-500">●</span> Active
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-700">
                                                            {userStats.active || 0}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between">
                                                        <span className="text-xs text-slate-500">
                                                            <span className="text-orange-500">●</span> Inactive
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-700">
                                                            {userStats.inactive || 0}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* STOCK OVERVIEW */}
                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-9">

                                        <div className="xl:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">

                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-7">
                                                <div>
                                                    <h2 className="font-bold text-slate-800 text-lg">
                                                        Stock Status Overview
                                                    </h2>

                                                    <p className="text-xs text-slate-400 mt-1">
                                                        Current stock unit distribution
                                                    </p>
                                                </div>

                                                <span className="text-xs bg-orange-50 text-orange-600 px-3 py-2 rounded-lg font-bold w-fit">
                                                    Total: {stock.totalUnits || 0}
                                                </span>
                                            </div>

                                            {stockItems.map(item => {
                                                const percentage = stock.totalUnits
                                                    ? (item.value / stock.totalUnits) * 100
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

                                        {/* QUICK SUMMARY */}
                                        <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 p-6 rounded-2xl text-white shadow-lg flex flex-col">

                                            <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full border-[25px] border-orange-400/20" />

                                            <div className="relative z-10">
                                                <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center text-3xl mb-5 shadow-lg">
                                                    🏥
                                                </div>

                                                <h2 className="text-xl font-bold">
                                                    UMC IT Management
                                                </h2>

                                                <p className="text-sm text-blue-100 mt-3 leading-6">
                                                    Central management of institutional IT assets, stock inventory, assignments and audit activities.
                                                </p>

                                                <div className="mt-8 pt-5 border-t border-white/20">
                                                    <p className="text-xs text-blue-200">
                                                        Total Registered Assets
                                                    </p>

                                                    <h3 className="text-4xl font-bold mt-2">
                                                        {assets.total || 0}
                                                    </h3>
                                                </div>

                                                <div className="mt-5">
                                                    <p className="text-xs text-blue-200">
                                                        Total Registered Users
                                                    </p>

                                                    <h3 className="text-2xl font-bold mt-1">
                                                        {userStats.total || 0}
                                                    </h3>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleNavigation('User Management')}
                                                className="relative z-10 mt-auto pt-7 text-left text-sm font-bold text-orange-300 hover:text-white transition no-print"
                                            >
                                                Manage Users →
                                            </button>
                                        </div>
                                    </div>

                                    {/* RECENT USERS & ACTIVITIES */}
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-9">

                                        {/* RECENT USERS */}
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
                                                    className="no-print text-xs font-bold text-orange-600 hover:text-orange-700"
                                                >
                                                    View All →
                                                </button>
                                            </div>

                                            {usersLoading ? (
                                                <p className="text-sm text-slate-400 py-5">
                                                    Loading users...
                                                </p>
                                            ) : usersError ? (
                                                <div className="py-5">
                                                    <p className="text-sm text-red-500">
                                                        {usersError}
                                                    </p>

                                                    <button
                                                        onClick={fetchAllUsers}
                                                        className="no-print mt-2 text-xs font-semibold text-blue-600 hover:underline"
                                                    >
                                                        Try Again
                                                    </button>
                                                </div>
                                            ) : users.length === 0 ? (
                                                <p className="text-sm text-slate-400 py-5">
                                                    No users available.
                                                </p>
                                            ) : (
                                                <div className="space-y-4">
                                                    {users.slice(0, 5).map(recentUser => (
                                                        <div
                                                            key={recentUser._id}
                                                            className="flex items-center gap-3"
                                                        >
                                                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold uppercase">
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
                                                                    ? 'bg-orange-50 text-orange-600'
                                                                    : 'bg-emerald-50 text-emerald-600'
                                                            }`}>
                                                                {recentUser.isActive === false ? 'Inactive' : 'Active'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* RECENT ACTIVITIES */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">

                                            <div className="flex justify-between items-center mb-6">
                                                <div>
                                                    <h2 className="text-lg font-bold text-slate-800">
                                                        Recent Activities
                                                    </h2>

                                                    <p className="text-xs text-slate-400 mt-1">
                                                        Real database activity history
                                                    </p>
                                                </div>

                                                <span className="text-[10px] bg-blue-50 text-blue-600 px-3 py-2 rounded-lg font-bold">
                                                    {activities.length} Records
                                                </span>
                                            </div>

                                            {activities.length === 0 ? (
                                                <p className="text-sm text-slate-400 py-5">
                                                    No activities found for this period.
                                                </p>
                                            ) : (
                                                <div className="space-y-5 max-h-[550px] overflow-y-auto pr-2">
                                                    {activities.map((activity, index) => {
                                                        const style = getActivityStyle(activity.type);

                                                        return (
                                                            <div
                                                                key={`${activity.reference}-${index}`}
                                                                className="flex gap-4 items-start"
                                                            >
                                                                <div className={`w-11 h-11 rounded-xl ${style.color} flex items-center justify-center text-xl shrink-0`}>
                                                                    {style.icon}
                                                                </div>

                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex flex-wrap justify-between gap-2">
                                                                        <h3 className="text-sm font-semibold text-slate-800">
                                                                            {activity.type}
                                                                        </h3>

                                                                        {activity.status && (
                                                                            <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 font-semibold">
                                                                                {activity.status}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    <p className="text-sm text-slate-700 mt-1 font-medium break-words">
                                                                        {activity.title}
                                                                    </p>

                                                                    <p className="text-xs text-slate-500 mt-1">
                                                                        {activity.description}
                                                                    </p>

                                                                    {activity.department && (
                                                                        <p className="text-xs text-slate-400 mt-1">
                                                                            Department: {activity.department}
                                                                            {activity.room ? ` / Room: ${activity.room}` : ''}
                                                                        </p>
                                                                    )}

                                                                    <p className="text-[11px] text-slate-400 mt-2">
                                                                        {formatDate(activity.date)}
                                                                    </p>

                                                                    {activity.reference && (
                                                                        <p className="text-[10px] text-slate-400 mt-1 break-all">
                                                                            Ref: {activity.reference}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* OTHER MENU PAGES */}
                    {activeMenu !== 'Dashboard' && (
                        <div className="no-print bg-white rounded-2xl p-8 sm:p-12 border border-slate-200 shadow-sm text-center">

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
                                className="no-print mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
                            >
                                ← Back to Dashboard
                            </button>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <footer className="no-print px-5 sm:px-8 py-5 border-t border-slate-200 bg-white text-center">
                    <p className="text-xs text-slate-400">
                        © 2026 United Medical College | IT Asset Management System
                    </p>
                </footer>
            </main>

            {/* OFFICIAL A4 PRINT REPORT SHEET */}
            {printAuditData && (
                <div className="print-report-sheet">
                    <div className="print-paper">

                        {/* REPORT HEADER */}
                        <div className="print-header">
                            <div className="print-logo">UMC</div>

                            <div className="print-header-content">
                                <h1>UNITED MEDICAL COLLEGE</h1>
                                <h2>IT INVENTORY & ASSET MANAGEMENT</h2>
                                <p>OFFICIAL MASTER AUDIT REPORT</p>
                            </div>
                        </div>

                        <div className="print-report-title">
                            <h2>{printReportTitle}</h2>

                            <p>
                                Reporting Period:
                                {' '}
                                {formatReportDate(printAuditData.period?.dateFrom)}
                                {' '} TO {' '}
                                {formatReportDate(printAuditData.period?.dateTo)}
                            </p>
                        </div>

                        {/* REPORT INFORMATION */}
                        <div className="print-meta-grid">
                            <div>
                                <span>Report Type</span>
                                <strong>{printReportTypeLabel}</strong>
                            </div>

                            <div>
                                <span>Generated By</span>
                                <strong>{user?.name || 'Administrator'}</strong>
                            </div>

                            <div>
                                <span>Generated Date</span>
                                <strong>{formatDate(new Date())}</strong>
                            </div>

                            <div>
                                <span>Report Reference</span>
                                <strong>
                                    UMC-IT-AUDIT-{printReportTypeLabel.replaceAll(' ', '-')}
                                </strong>
                            </div>
                        </div>

                        {/* OFFICIAL REPORT INTRODUCTION */}
                        <div className="print-introduction">
                            <p>
                                This document presents the inventory position and recorded
                                IT asset management activities of United Medical College
                                for the reporting period stated above. The information below
                                is compiled from the institution's IT Inventory & Asset
                                Management System.
                            </p>
                        </div>

                        {/* CURRENT STOCK */}
                        <PrintSection title="01. CURRENT STOCK INVENTORY POSITION">
                            <p className="print-section-description">
                                The following figures represent the current stock inventory
                                quantities recorded in the system at the time this report was generated.
                            </p>

                            <table className="print-table">
                                <thead>
                                    <tr>
                                        <th>Stock Information</th>
                                        <th className="text-right">Quantity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <PrintRow label="Total Stock Products" value={printStock.totalStockItems} />
                                    <PrintRow label="Total Stock Units" value={printStock.totalUnits} />
                                    <PrintRow label="Available Units" value={printStock.available} />
                                    <PrintRow label="Assigned Units" value={printStock.assigned} />
                                    <PrintRow label="Damaged Units" value={printStock.damaged} />
                                    <PrintRow label="Under Repair Units" value={printStock.underRepair} />
                                    <PrintRow label="Supplier Returned Units" value={printStock.returned} />
                                </tbody>
                            </table>
                        </PrintSection>

                        {/* CURRENT ASSETS */}
                        <PrintSection title="02. CURRENT ASSET MANAGEMENT POSITION">
                            <p className="print-section-description">
                                The table below summarises the current registered asset records
                                and their respective operational statuses.
                            </p>

                            <table className="print-table">
                                <thead>
                                    <tr>
                                        <th>Asset Information</th>
                                        <th className="text-right">Quantity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <PrintRow label="Total Assets" value={printAssets.total} />
                                    <PrintRow label="Available Assets" value={printAssets.available} />
                                    <PrintRow label="Assigned Assets" value={printAssets.assigned} />
                                    <PrintRow label="Damaged Assets" value={printAssets.damaged} />
                                    <PrintRow label="Under Repair Assets" value={printAssets.underRepair} />
                                    <PrintRow label="Returned Assets" value={printAssets.returned} />
                                </tbody>
                            </table>
                        </PrintSection>

                        {/* HISTORICAL ACTIVITIES */}
                        <PrintSection title="03. PERIOD AUDIT ACTIVITY SUMMARY">
                            <p className="print-section-description">
                                The following table records the stock and asset management
                                activities registered during the selected reporting period.
                            </p>

                            <table className="print-table">
                                <thead>
                                    <tr>
                                        <th>Activity</th>
                                        <th className="text-right">Records</th>
                                        <th className="text-right">Quantity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Normal Stock Receipts</td>
                                        <td className="text-right">{numberFormat(printReceiving.normalReceipts)}</td>
                                        <td className="text-right">{numberFormat(printReceiving.receivedQuantity)}</td>
                                    </tr>
                                    <tr>
                                        <td>Opening Stock Receipts</td>
                                        <td className="text-right">{numberFormat(printReceiving.openingStockReceipts)}</td>
                                        <td className="text-right">{numberFormat(printReceiving.openingStockQuantity)}</td>
                                    </tr>
                                    <tr>
                                        <td>Assignments</td>
                                        <td className="text-right">{numberFormat(printAssignments.total)}</td>
                                        <td className="text-right">{numberFormat(printAssignments.quantity)}</td>
                                    </tr>
                                    <tr>
                                        <td>Damage Events</td>
                                        <td className="text-right">{numberFormat(printDamages.total)}</td>
                                        <td className="text-right">-</td>
                                    </tr>
                                    <tr>
                                        <td>Repair Records</td>
                                        <td className="text-right">{numberFormat(printRepairs.total)}</td>
                                        <td className="text-right">-</td>
                                    </tr>
                                    <tr>
                                        <td>Successful Repairs</td>
                                        <td className="text-right">{numberFormat(printRepairs.successful)}</td>
                                        <td className="text-right">-</td>
                                    </tr>
                                    <tr>
                                        <td>Unsuccessful Repairs</td>
                                        <td className="text-right">{numberFormat(printRepairs.unsuccessful)}</td>
                                        <td className="text-right">-</td>
                                    </tr>
                                    <tr>
                                        <td>Repairs Completed in Period</td>
                                        <td className="text-right">{numberFormat(printRepairs.completedInPeriod)}</td>
                                        <td className="text-right">-</td>
                                    </tr>
                                    <tr>
                                        <td>Supplier Returns</td>
                                        <td className="text-right">{numberFormat(printSupplierReturns.total)}</td>
                                        <td className="text-right">{numberFormat(printSupplierReturns.quantity)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </PrintSection>

                        {/* INSTITUTION SUMMARY */}
                        <PrintSection title="04. DEPARTMENT, ROOM & USER SUMMARY">
                            <p className="print-section-description">
                                This section provides an overview of registered institutional
                                departments, rooms and user accounts.
                            </p>

                            <table className="print-table">
                                <thead>
                                    <tr>
                                        <th>Category</th>
                                        <th className="text-right">Total</th>
                                        <th className="text-right">Active</th>
                                        <th className="text-right">Inactive</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Departments</td>
                                        <td className="text-right">{numberFormat(printDepartments.total)}</td>
                                        <td className="text-right">{numberFormat(printDepartments.active)}</td>
                                        <td className="text-right">{numberFormat(printDepartments.inactive)}</td>
                                    </tr>
                                    <tr>
                                        <td>Rooms</td>
                                        <td className="text-right">{numberFormat(printRooms.total)}</td>
                                        <td className="text-right">{numberFormat(printRooms.active)}</td>
                                        <td className="text-right">{numberFormat(printRooms.inactive)}</td>
                                    </tr>
                                    <tr>
                                        <td>Users</td>
                                        <td className="text-right">{numberFormat(printUsers.total)}</td>
                                        <td className="text-right">{numberFormat(printUsers.active)}</td>
                                        <td className="text-right">{numberFormat(printUsers.inactive)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <table className="print-table print-role-table">
                                <thead>
                                    <tr>
                                        <th>User Role</th>
                                        <th className="text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <PrintRow label="Administrators" value={printUsers.admins} />
                                    <PrintRow label="Employees" value={printUsers.employees} />
                                    <PrintRow label="Normal Users" value={printUsers.normalUsers} />
                                </tbody>
                            </table>
                        </PrintSection>

                        {/* ACTIVITY REGISTER */}
                        <PrintSection title="05. DETAILED AUDIT ACTIVITY REGISTER">
                            <p className="print-section-description">
                                The following register contains the activity records returned
                                by the system for the selected reporting period.
                            </p>

                            {printActivities.length === 0 ? (
                                <p className="print-empty">
                                    No activity records were found for this reporting period.
                                </p>
                            ) : (
                                <table className="print-table print-activity-table">
                                    <thead>
                                        <tr>
                                            <th>Date & Time</th>
                                            <th>Activity</th>
                                            <th>Description</th>
                                            <th>Reference</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {printActivities.map((activity, index) => (
                                            <tr key={`${activity.reference}-${index}`}>
                                                <td>{formatDate(activity.date)}</td>
                                                <td>
                                                    <strong>{activity.type}</strong>
                                                    <br />
                                                    {activity.title}
                                                </td>
                                                <td>
                                                    {activity.description || '-'}
                                                    {activity.status && (
                                                        <div>Status: {activity.status}</div>
                                                    )}
                                                    {activity.department && (
                                                        <div>
                                                            {activity.department}
                                                            {activity.room ? ` / ${activity.room}` : ''}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="print-reference">
                                                    {activity.reference || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </PrintSection>

                        {/* DECLARATION */}
                        <div className="print-declaration">
                            <strong>OFFICIAL AUDIT DECLARATION</strong>
                            <p>
                                This report has been generated from the United Medical College
                                IT Inventory & Asset Management System database. The figures
                                represent the recorded information available for the stated
                                reporting period and the current inventory status at the time
                                of report generation. This document is intended for official
                                institutional review, verification and record-keeping.
                            </p>
                        </div>

                        {/* SIGNATURES */}
                        <div className="print-signature-heading">
                            OFFICIAL REVIEW & AUTHORIZATION
                        </div>

                        <div className="print-signature-grid">
                            <div>
                                <div className="print-signature-line"></div>
                                <strong>PREPARED BY</strong>
                                <span>{user?.name || 'Administrator'}</span>
                                <span>IT Department</span>
                                <span>Date: __________________</span>
                            </div>

                            <div>
                                <div className="print-signature-line"></div>
                                <strong>CHECKED & VERIFIED BY</strong>
                                <span>Name: __________________</span>
                                <span>Designation: ______________</span>
                                <span>Date: __________________</span>
                            </div>

                            <div>
                                <div className="print-signature-line"></div>
                                <strong>AUTHORIZED BY</strong>
                                <span>Authority Name: ____________</span>
                                <span>Designation: ______________</span>
                                <span>Date: __________________</span>
                            </div>
                        </div>

                        {/* REPORT FOOTER */}
                        <div className="print-footer">
                            <span>UNITED MEDICAL COLLEGE</span>
                            <span>IT INVENTORY & ASSET MANAGEMENT SYSTEM</span>
                            <span>CONFIDENTIAL - OFFICIAL USE ONLY</span>
                        </div>
                    </div>
                </div>
            )}

            {/* PRINT STYLES */}
            
<style>
    {`
        /* =========================================
           DASHBOARD ANIMATION
        ========================================= */

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(12px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }


        /* =========================================
           PRINT REPORT - SCREEN DEFAULT
        ========================================= */

        .print-report-sheet {
            display: none;
        }


        /* =========================================
           A4 PAGE CONFIGURATION
        ========================================= */

        @media print {

            @page {
                size: A4 portrait;
                margin: 10mm;
            }

            html,
            body {
                width: 100% !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }


            /* =====================================
               HIDE DASHBOARD, SHOW REPORT ONLY
            ===================================== */

            .dashboard-root {
                display: block !important;
                width: 100% !important;
                height: auto !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
            }

            .dashboard-root > :not(.print-report-sheet) {
                display: none !important;
            }

            .print-report-sheet {
                display: block !important;
                position: static !important;
                width: 100% !important;
                height: auto !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                background: #ffffff !important;
                color: #111827 !important;
                font-family: Arial, Helvetica, sans-serif !important;
                font-size: 10px !important;
                line-height: 1.45 !important;
            }

            .print-paper {
                width: 100% !important;
                max-width: 100% !important;
                height: auto !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                background: #ffffff !important;
                color: #111827 !important;
                font-size: 10px !important;
                line-height: 1.45 !important;
            }


            /* =====================================
               INSTITUTION HEADER
            ===================================== */

            .print-header {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 18px !important;
                padding: 0 0 12px !important;
                margin-bottom: 12px !important;
                border-bottom: 3px double #1e3a8a !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
            }

            .print-logo {
                display: flex !important;
                flex-shrink: 0 !important;
                align-items: center !important;
                justify-content: center !important;
                width: 55px !important;
                height: 55px !important;
                border: 3px solid #1e3a8a !important;
                border-radius: 50% !important;
                color: #1e3a8a !important;
                font-size: 18px !important;
                font-weight: 900 !important;
            }

            .print-header-content {
                text-align: center !important;
            }

            .print-header-content h1 {
                margin: 0 !important;
                color: #172554 !important;
                font-size: 20px !important;
                font-weight: 900 !important;
                letter-spacing: 1px !important;
            }

            .print-header-content h2 {
                margin: 4px 0 !important;
                color: #1f2937 !important;
                font-size: 11px !important;
                font-weight: 700 !important;
                letter-spacing: 1px !important;
            }

            .print-header-content p {
                margin: 5px 0 0 !important;
                color: #c2410c !important;
                font-size: 9px !important;
                font-weight: 700 !important;
                letter-spacing: 2px !important;
            }


            /* =====================================
               REPORT TITLE
            ===================================== */

            .print-report-title {
                margin: 14px 0 12px !important;
                padding: 10px !important;
                background: #f1f5f9 !important;
                border: 1px solid #cbd5e1 !important;
                text-align: center !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
            }

            .print-report-title h2 {
                margin: 0 0 5px !important;
                color: #1e3a8a !important;
                font-size: 15px !important;
                font-weight: 900 !important;
                letter-spacing: 1px !important;
            }

            .print-report-title p {
                margin: 0 !important;
                color: #374151 !important;
                font-size: 9px !important;
            }


            /* =====================================
               REPORT INFORMATION / METADATA
            ===================================== */

            .print-meta-grid {
                display: grid !important;
                grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                margin-bottom: 12px !important;
                border: 1px solid #cbd5e1 !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
            }

            .print-meta-grid div {
                min-width: 0 !important;
                padding: 7px !important;
                border-right: 1px solid #cbd5e1 !important;
            }

            .print-meta-grid div:last-child {
                border-right: 0 !important;
            }

            .print-meta-grid span {
                display: block !important;
                margin-bottom: 4px !important;
                color: #64748b !important;
                font-size: 8px !important;
            }

            .print-meta-grid strong {
                display: block !important;
                color: #111827 !important;
                font-size: 9px !important;
                overflow-wrap: anywhere !important;
            }


            /* =====================================
               INTRODUCTION
            ===================================== */

            .print-introduction {
                margin: 10px 0 14px !important;
                color: #475569 !important;
                font-size: 9px !important;
                line-height: 1.5 !important;
            }

            .print-introduction p {
                margin: 0 !important;
            }


            /* =====================================
               REPORT SECTIONS
            ===================================== */

            .print-section {
                margin: 12px 0 !important;
                break-inside: auto !important;
                page-break-inside: auto !important;
            }

            .print-section-title {
                margin: 0 0 5px !important;
                padding: 7px 9px !important;
                background: #1e3a8a !important;
                color: #ffffff !important;
                font-size: 10px !important;
                font-weight: 800 !important;
                letter-spacing: 0.4px !important;
                break-after: avoid !important;
                page-break-after: avoid !important;
            }

            .print-section-description {
                margin: 4px 0 7px !important;
                color: #64748b !important;
                font-size: 8px !important;
                line-height: 1.4 !important;
            }


            /* =====================================
               REPORT TABLES
            ===================================== */

            .print-table {
                width: 100% !important;
                margin: 0 0 7px !important;
                border-collapse: collapse !important;
                table-layout: auto !important;
                font-size: 9px !important;
            }

            .print-table thead {
                display: table-header-group !important;
            }

            .print-table tfoot {
                display: table-footer-group !important;
            }

            .print-table th {
                padding: 6px 7px !important;
                background: #e8eef8 !important;
                color: #172554 !important;
                font-weight: 800 !important;
                text-align: left !important;
                border: 1px solid #cbd5e1 !important;
            }

            .print-table td {
                padding: 5px 7px !important;
                color: #1f2937 !important;
                vertical-align: top !important;
                border: 1px solid #cbd5e1 !important;
                overflow-wrap: anywhere !important;
            }

            .print-table tbody tr:nth-child(even) {
                background: #f8fafc !important;
            }

            .print-table .text-right {
                text-align: right !important;
            }

            .print-table tr {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
            }

            .print-role-table {
                width: 55% !important;
                margin-top: 7px !important;
            }

            .print-activity-table {
                font-size: 8px !important;
            }

            .print-activity-table th,
            .print-activity-table td {
                padding: 5px !important;
            }

            .print-reference {
                max-width: 115px !important;
                overflow-wrap: anywhere !important;
            }

            .print-empty {
                padding: 12px !important;
                border: 1px solid #cbd5e1 !important;
                color: #64748b !important;
                font-size: 9px !important;
            }


            /* =====================================
               AUDIT DECLARATION
            ===================================== */

            .print-declaration {
                margin-top: 15px !important;
                padding: 9px 11px !important;
                border: 1px solid #cbd5e1 !important;
                border-left: 4px solid #ea580c !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
            }

            .print-declaration strong {
                display: block !important;
                margin-bottom: 4px !important;
                color: #172554 !important;
                font-size: 9px !important;
            }

            .print-declaration p {
                margin: 0 !important;
                color: #475569 !important;
                font-size: 8px !important;
                line-height: 1.5 !important;
            }


            /* =====================================
               SIGNATURE SECTION
            ===================================== */

            .print-signature-heading {
                margin-top: 28px !important;
                padding-bottom: 7px !important;
                border-bottom: 1px solid #cbd5e1 !important;
                color: #1e3a8a !important;
                font-size: 10px !important;
                font-weight: 800 !important;
                text-align: center !important;
                break-after: avoid !important;
                page-break-after: avoid !important;
            }

            .print-signature-grid {
                display: grid !important;
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                gap: 18px !important;
                margin: 42px 0 18px !important;
                text-align: center !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
            }

            .print-signature-grid > div {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                gap: 5px !important;
                min-width: 0 !important;
                font-size: 8px !important;
            }

            .print-signature-line {
                width: 90% !important;
                margin: 15px 0 5px !important;
                border-top: 1px solid #475569 !important;
            }

            .print-signature-grid strong {
                color: #111827 !important;
                font-size: 9px !important;
            }

            .print-signature-grid span {
                color: #64748b !important;
            }


            /* =====================================
               REPORT FOOTER
            ===================================== */

            .print-footer {
                display: flex !important;
                justify-content: space-between !important;
                gap: 8px !important;
                margin-top: 20px !important;
                padding-top: 7px !important;
                border-top: 1px solid #94a3b8 !important;
                color: #64748b !important;
                font-size: 7px !important;
                font-weight: 700 !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
            }

            .print-footer span {
                text-align: center !important;
            }


            /* =====================================
               PAGE BREAK & PRINT CLEANUP
            ===================================== */

            .print-section-title,
            .print-table th {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }

            .print-report-sheet p {
                orphans: 3;
                widows: 3;
            }

            .no-print,
            button {
                display: none !important;
            }
        }
    `}
</style>

        </div>
    );
};

export default Dashboard;
