
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext.jsx';

const AdminSidebar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [sidebarOpen, setSidebarOpen] = useState(false);

    const menuItems = [
        { name: 'Dashboard', icon: '▦' },
        { name: 'User Management', icon: '♙' },
        { name: 'Stock Inventory', icon: '📦' },
        { name: 'Supplier Return', icon: '↩' },
        { name: 'Asset Management', icon: '▣' },
        { name: 'Departments', icon: '▤' },
        { name: 'Room Management', icon: '🚪' },
        { name: 'Reports', icon: '▥' },
        { name: 'Settings', icon: '⚙' }
    ];

    const params = new URLSearchParams(location.search);

    // ACTIVE MENU - Search: ACTIVE MENU
    const activeMenu = location.pathname === '/admin/stock'
        ? 'Stock Inventory'
        : location.pathname === '/admin/supplier-returns'
            ? 'Supplier Return'
            : location.pathname === '/admin/assets'
                ? 'Asset Management'
                : location.pathname === '/admin/departments'
                    ? 'Departments'
                    : location.pathname === '/admin/rooms'
                        ? 'Room Management'
                        : location.pathname === '/admin/users'
                            ? 'User Management'
                            : location.pathname === '/admin/dashboard'
                                ? (params.get('menu') || 'Dashboard')
                                : '';

    // MENU NAVIGATION - Search: MENU NAVIGATION
    const handleNavigation = (menuName) => {
        setSidebarOpen(false);

        if (menuName === 'Stock Inventory') {
            navigate('/admin/stock');
            return;
        }

        if (menuName === 'Supplier Return') {
            navigate('/admin/supplier-returns');
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

        if (menuName === 'Room Management') {
            navigate('/admin/rooms');
            return;
        }

        if (menuName === 'User Management') {
            navigate('/admin/users');
            return;
        }

        if (menuName === 'Dashboard') {
            navigate('/admin/dashboard');
            return;
        }

        navigate(
            `/admin/dashboard?menu=${encodeURIComponent(menuName)}`
        );
    };

    const handleLogout = () => {
        const confirmed = window.confirm('Are you sure you want to logout?');

        if (!confirmed) return;

        logout();
        navigate('/login', { replace: true });
    };

    return (
        <>
            {/* MOBILE SIDEBAR BUTTON */}
            <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-xl bg-[#101d36] text-xl text-white shadow-lg lg:hidden"
                aria-label="Open sidebar"
            >
                ☰
            </button>

            {/* MOBILE OVERLAY */}
            {sidebarOpen && (
                <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Close sidebar"
                    className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
                />
            )}

            {/* ADMIN SIDEBAR */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#101d36] text-white transition-transform duration-300 ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                } lg:translate-x-0`}
            >
                {/* SIDEBAR LOGO */}
                <div className="border-b border-blue-900/60 px-6 py-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">
                            U
                        </div>

                        <div className="min-w-0">
                            <h2 className="whitespace-nowrap text-sm font-bold tracking-wide">
                                UMC IT PORTAL
                            </h2>

                            <p className="mt-1 whitespace-nowrap text-xs text-blue-200/70">
                                Inventory Management
                            </p>
                        </div>
                    </div>
                </div>

                {/* SIDEBAR NAVIGATION */}
                <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
                    <p className="mb-4 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300/60">
                        Main Menu
                    </p>

                    {menuItems.map((item) => {
                        const isActive = activeMenu === item.name;

                        return (
                            <button
                                key={item.name}
                                type="button"
                                onClick={() => handleNavigation(item.name)}
                                aria-current={isActive ? 'page' : undefined}
                                className={`relative flex w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors duration-200 ${
                                    isActive
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-transparent text-slate-300 hover:bg-blue-900/60 hover:text-white'
                                }`}
                            >
                                {isActive && (
                                    <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-white/90" />
                                )}

                                <span className="flex w-6 shrink-0 items-center justify-center text-lg">
                                    {item.icon}
                                </span>

                                <span className="truncate">
                                    {item.name}
                                </span>
                            </button>
                        );
                    })}
                </nav>

                {/* USER PROFILE & LOGOUT */}
                <div className="mt-auto border-t border-blue-900/60 p-5">
                    <div className="mb-4 flex items-center gap-3 rounded-xl bg-blue-900/30 p-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold">
                            {user?.name?.charAt(0) || 'A'}
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">
                                {user?.name || 'Administrator'}
                            </p>

                            <p className="truncate text-xs text-blue-200/60">
                                {user?.email || 'Full Access'}
                            </p>
                        </div>

                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
                    </div>

                    <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition-colors duration-200 hover:bg-red-500 hover:text-white"
                    >
                        <span>↪</span>
                        Logout
                    </button>
                </div>
            </aside>
        </>
    );
};

export default AdminSidebar;
