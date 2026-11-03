
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

import AdminSidebar from '../../components/AdminSidebar.jsx';

// DEPARTMENT MANAGEMENT PAGE - Search: DEPARTMENT MANAGEMENT PAGE

const API_URL = 'http://localhost:3000/api/departments';

const DepartmentManagement = () => {
    const navigate = useNavigate();

    // DEPARTMENT STATE - Search: DEPARTMENT STATE
    const [departments, setDepartments] = useState([]);
    const [editingId, setEditingId] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);

    // DEPARTMENT FORM STATE - Search: DEPARTMENT FORM STATE
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });

    // DEPARTMENT API HEADERS - Search: DEPARTMENT API HEADERS
    const getHeaders = () => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('pos-token')}`
    });

    // LOAD DEPARTMENTS - Search: LOAD DEPARTMENTS
    const fetchDepartments = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}?refresh=${Date.now()}`, {
                method: 'GET',
                headers: getHeaders(),
                cache: 'no-store'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to load departments');
            }

            setDepartments(data.departments || []);

        } catch (err) {
            setError(err.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    // DEPARTMENT INITIAL LOAD - Search: DEPARTMENT INITIAL LOAD
    useEffect(() => {
        fetchDepartments();
    }, []);

    // HANDLE DEPARTMENT INPUT - Search: HANDLE DEPARTMENT INPUT
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // RESET DEPARTMENT FORM - Search: RESET DEPARTMENT FORM
    const resetForm = () => {
        setFormData({
            name: '',
            description: ''
        });

        setEditingId(null);
    };

    // ADD OR UPDATE DEPARTMENT - Search: ADD OR UPDATE DEPARTMENT
    const handleSaveDepartment = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            alert('Department name is required');
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
                        name: formData.name.trim(),
                        description: formData.description.trim()
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save department');
            }

            alert(isEditing
                ? 'Department updated successfully!'
                : 'Department created successfully!'
            );

            resetForm();
            setShowForm(false);

            await fetchDepartments();

        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    // EDIT DEPARTMENT - Search: EDIT DEPARTMENT
    const handleEditDepartment = (department) => {
        setEditingId(department._id);

        setFormData({
            name: department.name || '',
            description: department.description || ''
        });

        setShowForm(true);

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    // DELETE DEPARTMENT - Search: DELETE DEPARTMENT
    const handleDeleteDepartment = async (id) => {
        const confirmed = window.confirm(
            'Are you sure you want to delete this department?'
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to delete department');
            }

            alert('Department deleted successfully!');

            await fetchDepartments();

        } catch (err) {
            alert(err.message);
        }
    };

    // FILTER DEPARTMENTS - Search: FILTER DEPARTMENTS
    const filteredDepartments = departments.filter(department => {
        const searchText = search.toLowerCase();

        return (
            department.name?.toLowerCase().includes(searchText) ||
            department.description?.toLowerCase().includes(searchText)
        );
    });

    // DEPARTMENT STATISTICS - Search: DEPARTMENT STATISTICS
    const activeDepartments = departments.filter(
        department => department.isActive
    ).length;

    const totalDepartments = departments.length;

    return (
        <div className="min-h-screen bg-[#f5f7fb] p-4 md:p-6 lg:p-8 lg:ml-64">
    <AdminSidebar />

            {/* DEPARTMENT PAGE HEADER - Search: DEPARTMENT PAGE HEADER */}
            <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 p-6 text-white shadow-xl md:p-8">

                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

                    <div>
                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            className="mb-5 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-blue-100 transition hover:bg-white/20"
                        >
                            ← Back to Dashboard
                        </button>

                        <div className="flex items-center gap-3">

                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl backdrop-blur">
                                🏢
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
                                    United Medical College
                                </p>

                                <h1 className="mt-1 text-2xl font-bold md:text-3xl">
                                    Department Management
                                </h1>
                            </div>

                        </div>

                        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
                            Manage departments, organize institutional units and maintain department information from one place.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">

                        <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur">
                            <p className="text-xs text-blue-200">
                                Department Overview
                            </p>

                            <p className="mt-1 text-2xl font-bold">
                                {totalDepartments}
                                <span className="ml-2 text-sm font-medium text-blue-200">
                                    Departments
                                </span>
                            </p>
                        </div>

                        <button
                            onClick={() => {
                                if (showForm) {
                                    setShowForm(false);
                                    resetForm();
                                } else {
                                    resetForm();
                                    setShowForm(true);
                                }
                            }}
                            className="rounded-xl bg-white px-5 py-3 font-bold text-blue-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50"
                        >
                            {showForm ? '✕ Close Form' : '+ Add Department'}
                        </button>

                    </div>

                </div>
            </div>

            {/* DEPARTMENT STATISTICS CARDS - Search: DEPARTMENT STATISTICS CARDS */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">

                <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">

                    <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-blue-500 opacity-[0.07]" />

                    <div className="relative flex items-start justify-between">

                        <div>
                            <p className="text-sm font-medium text-slate-500">
                                Total Departments
                            </p>

                            <h2 className="mt-3 text-3xl font-extrabold text-slate-800">
                                {totalDepartments}
                            </h2>

                            <p className="mt-2 text-xs text-slate-400">
                                Registered departments
                            </p>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl">
                            🏢
                        </div>

                    </div>
                </div>

                <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">

                    <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-emerald-500 opacity-[0.07]" />

                    <div className="relative flex items-start justify-between">

                        <div>
                            <p className="text-sm font-medium text-slate-500">
                                Active Departments
                            </p>

                            <h2 className="mt-3 text-3xl font-extrabold text-slate-800">
                                {activeDepartments}
                            </h2>

                            <p className="mt-2 text-xs text-slate-400">
                                Currently available
                            </p>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl">
                            ✅
                        </div>

                    </div>
                </div>

                <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">

                    <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-violet-500 opacity-[0.07]" />

                    <div className="relative flex items-start justify-between">

                        <div>
                            <p className="text-sm font-medium text-slate-500">
                                Search Results
                            </p>

                            <h2 className="mt-3 text-3xl font-extrabold text-slate-800">
                                {filteredDepartments.length}
                            </h2>

                            <p className="mt-2 text-xs text-slate-400">
                                Matching departments
                            </p>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-xl">
                            🔍
                        </div>

                    </div>
                </div>

            </div>

            {/* ADD DEPARTMENT FORM - Search: ADD DEPARTMENT FORM */}
            {showForm && (
                <div className="mb-8 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-lg">

                    <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 md:px-8">

                        <div className="flex items-center gap-3">

                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-md">
                                {editingId ? '✏️' : '＋'}
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-slate-800">
                                    {editingId ? 'Edit Department' : 'Add New Department'}
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    Enter department information below
                                </p>
                            </div>

                        </div>
                    </div>

                    <form onSubmit={handleSaveDepartment} className="p-6 md:p-8">

                        <div className="mb-6">

                            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                                <span className="h-2 w-2 rounded-full bg-blue-600" />
                                Department Information
                            </h3>

                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Department Name *
                                    </label>

                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        placeholder="e.g. IT Department"
                                        required
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Description
                                    </label>

                                    <input
                                        type="text"
                                        name="description"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        placeholder="Enter department description"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                    />
                                </div>

                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-6">

                            <button
                                type="submit"
                                disabled={saving}
                                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-3 font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {saving
                                    ? 'Saving...'
                                    : editingId
                                        ? '✓ Update Department'
                                        : '+ Save Department'}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setShowForm(false);
                                    resetForm();
                                }}
                                className="rounded-xl border border-slate-200 bg-white px-7 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                                Cancel
                            </button>

                        </div>

                    </form>
                </div>
            )}

            {/* DEPARTMENT TABLE - Search: DEPARTMENT TABLE */}
            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">

                <div className="flex flex-col gap-5 border-b border-slate-100 p-5 md:p-6 lg:flex-row lg:items-center lg:justify-between">

                    <div>
                        <div className="flex items-center gap-3">

                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl">
                                📋
                            </div>

                            <div>
                                <h2 className="text-lg font-bold text-slate-800">
                                    All Departments
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    {filteredDepartments.length} departments found
                                </p>
                            </div>

                        </div>
                    </div>

                    <div className="relative w-full lg:max-w-md">

                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                            🔍
                        </span>

                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search department name..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        />

                    </div>
                </div>

                {loading ? (
                    <div className="p-16 text-center">

                        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />

                        <p className="text-sm font-medium text-slate-500">
                            Loading departments...
                        </p>

                    </div>
                ) : error ? (
                    <div className="p-10 text-center">

                        <div className="mb-3 text-4xl">⚠️</div>

                        <p className="mb-4 font-medium text-red-600">
                            {error}
                        </p>

                        <button
                            onClick={fetchDepartments}
                            className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white transition hover:bg-blue-700"
                        >
                            Try Again
                        </button>

                    </div>
                ) : filteredDepartments.length === 0 ? (
                    <div className="p-16 text-center">

                        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-4xl">
                            🏢
                        </div>

                        <h3 className="text-lg font-bold text-slate-700">
                            No Departments Found
                        </h3>

                        <p className="mt-2 text-sm text-slate-500">
                            {search
                                ? 'Try searching with another department name.'
                                : 'Add a new department to get started.'}
                        </p>

                        {!search && (
                            <button
                                onClick={() => {
                                    resetForm();
                                    setShowForm(true);
                                }}
                                className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white transition hover:bg-blue-700"
                            >
                                + Add Department
                            </button>
                        )}

                    </div>
                ) : (
                    <div className="overflow-x-auto">

                        <table className="w-full min-w-[750px] text-left">

                            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">

                                <tr>
                                    <th className="px-6 py-4 font-bold">#</th>
                                    <th className="px-5 py-4 font-bold">Department</th>
                                    <th className="px-5 py-4 font-bold">Description</th>
                                    <th className="px-5 py-4 text-center font-bold">Status</th>
                                    <th className="px-5 py-4 text-center font-bold">Action</th>
                                </tr>

                            </thead>

                            <tbody className="divide-y divide-slate-100">

                                {filteredDepartments.map((department, index) => (

                                    <tr
                                        key={department._id}
                                        className="group transition duration-200 hover:bg-blue-50/40"
                                    >

                                        <td className="px-6 py-4 text-sm font-semibold text-slate-400">
                                            {index + 1}
                                        </td>

                                        <td className="px-5 py-4">

                                            <div className="flex items-center gap-3">

                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-lg">
                                                    🏢
                                                </div>

                                                <div>
                                                    <p className="font-bold text-slate-800">
                                                        {department.name}
                                                    </p>

                                                    <p className="mt-1 text-xs text-slate-400">
                                                        Department
                                                    </p>
                                                </div>

                                            </div>
                                        </td>

                                        <td className="px-5 py-4 text-sm text-slate-500">
                                            {department.description || 'No description'}
                                        </td>

                                        <td className="px-5 py-4 text-center">

                                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                                                department.isActive
                                                    ? 'bg-emerald-50 text-emerald-600'
                                                    : 'bg-red-50 text-red-600'
                                            }`}>

                                                <span className={`h-1.5 w-1.5 rounded-full ${
                                                    department.isActive
                                                        ? 'bg-emerald-500'
                                                        : 'bg-red-500'
                                                }`} />

                                                {department.isActive ? 'Active' : 'Inactive'}

                                            </span>

                                        </td>

                                        {/* DEPARTMENT ACTION BUTTONS - Search: DEPARTMENT ACTION BUTTONS */}
                                        <td className="px-5 py-4">

                                            <div className="flex items-center justify-center gap-2">

                                                <button
                                                    onClick={() => handleEditDepartment(department)}
                                                    title="Edit Department"
                                                    className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-600 transition hover:border-blue-300 hover:bg-blue-100"
                                                >
                                                    ✏️ Edit
                                                </button>

                                                <button
                                                    onClick={() => handleDeleteDepartment(department._id)}
                                                    title="Delete Department"
                                                    className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:border-red-300 hover:bg-red-100"
                                                >
                                                    🗑️ Delete
                                                </button>

                                            </div>
                                        </td>

                                    </tr>

                                ))}

                            </tbody>

                        </table>
                    </div>
                )}

                {/* DEPARTMENT TABLE FOOTER - Search: DEPARTMENT TABLE FOOTER */}
                {!loading && !error && filteredDepartments.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">

                        <p>
                            Showing{' '}
                            <span className="font-bold text-slate-700">
                                {filteredDepartments.length}
                            </span>{' '}
                            of{' '}
                            <span className="font-bold text-slate-700">
                                {departments.length}
                            </span>{' '}
                            departments
                        </p>

                        <p>
                            United Medical College · IT Inventory Management
                        </p>

                    </div>
                )}

            </div>

        </div>
    );
};

export default DepartmentManagement;
