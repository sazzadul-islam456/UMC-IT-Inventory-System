
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';

import AdminSidebar from '../../components/AdminSidebar.jsx';

// ROOM MANAGEMENT PAGE - Search: ROOM MANAGEMENT PAGE

const API_URL = 'http://127.0.0.1:3001/api/rooms';
const DEPARTMENT_API_URL = 'http://127.0.0.1:3001/api/departments';

const RoomManagement = () => {
    const navigate = useNavigate();

    // ROOM STATE - Search: ROOM STATE
    const [rooms, setRooms] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [editingId, setEditingId] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [departmentLoading, setDepartmentLoading] = useState(false);

    const [error, setError] = useState('');
    const [departmentError, setDepartmentError] = useState('');

    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);

    // ROOM FORM STATE - Search: ROOM FORM STATE
    const [formData, setFormData] = useState({
        name: '',
        roomNumber: '',
        department: '',
        inCharge: '',
        description: '',
        isActive: true
    });

    // ROOM API HEADERS - Search: ROOM API HEADERS
    const getHeaders = () => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('pos-token')}`
    });

    // SAFE API RESPONSE - Search: SAFE API RESPONSE
    const readResponse = async (response) => {
        const text = await response.text();

        try {
            return text ? JSON.parse(text) : {};
        } catch {
            throw new Error(
                `Invalid server response (${response.status}). Check backend API.`
            );
        }
    };

    // LOAD ROOMS AND DEPARTMENTS - Search: LOAD ROOMS AND DEPARTMENTS
    const fetchRoomData = useCallback(async () => {
        setLoading(true);
        setError('');
        setDepartmentLoading(true);
        setDepartmentError('');

        try {
            const [roomResponse, departmentResponse] = await Promise.all([
                fetch(`${API_URL}?refresh=${Date.now()}`, {
                    method: 'GET',
                    headers: getHeaders(),
                    cache: 'no-store'
                }),
                fetch(`${DEPARTMENT_API_URL}?refresh=${Date.now()}`, {
                    method: 'GET',
                    headers: getHeaders(),
                    cache: 'no-store'
                })
            ]);

            const roomData = await readResponse(roomResponse);
            const departmentData = await readResponse(departmentResponse);

            if (!roomResponse.ok) {
                throw new Error(
                    roomData.message || 'Failed to load rooms'
                );
            }

            if (!departmentResponse.ok) {
                throw new Error(
                    departmentData.message || 'Failed to load departments'
                );
            }

            setRooms(roomData.rooms || []);

            setDepartments(
                (departmentData.departments || []).filter(
                    department => department.isActive
                )
            );

        } catch (err) {
            setError(err.message || 'Something went wrong');
            setDepartmentError(err.message || 'Failed to load departments');

        } finally {
            setLoading(false);
            setDepartmentLoading(false);
        }
    }, []);

    // ROOM INITIAL LOAD - Search: ROOM INITIAL LOAD
    useEffect(() => {
        fetchRoomData();
    }, [fetchRoomData]);

    // HANDLE ROOM INPUT - Search: HANDLE ROOM INPUT
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // RESET ROOM FORM - Search: RESET ROOM FORM
    const resetForm = () => {
        setFormData({
            name: '',
            roomNumber: '',
            department: '',
            inCharge: '',
            description: '',
            isActive: true
        });

        setEditingId(null);
    };

    // ADD OR UPDATE ROOM - Search: ADD OR UPDATE ROOM
    const handleSaveRoom = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            alert('Room name is required');
            return;
        }

        if (!formData.department) {
            alert('Please select a department');
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
                        roomNumber: formData.roomNumber.trim(),
                        department: formData.department,
                        inCharge: formData.inCharge.trim(),
                        description: formData.description.trim(),
                        isActive: formData.isActive
                    })
                }
            );

            const data = await readResponse(response);

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save room');
            }

            alert(
                isEditing
                    ? 'Room updated successfully!'
                    : 'Room created successfully!'
            );

            resetForm();
            setShowForm(false);

            await fetchRoomData();

        } catch (err) {
            alert(err.message || 'Failed to save room');

        } finally {
            setSaving(false);
        }
    };

    // EDIT ROOM - Search: EDIT ROOM
    const handleEditRoom = (room) => {
        setEditingId(room._id);

        setFormData({
            name: room.name || '',
            roomNumber: room.roomNumber || '',
            department: room.department?._id || '',
            inCharge: room.inCharge || '',
            description: room.description || '',
            isActive: room.isActive ?? true
        });

        setShowForm(true);

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    // DELETE ROOM - Search: DELETE ROOM
    const handleDeleteRoom = async (id) => {
        const confirmed = window.confirm(
            'Are you sure you want to delete this room?'
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            const data = await readResponse(response);

            if (!response.ok) {
                throw new Error(data.message || 'Failed to delete room');
            }

            alert('Room deleted successfully!');

            await fetchRoomData();

        } catch (err) {
            alert(err.message || 'Failed to delete room');
        }
    };

    // FILTER ROOMS - Search: FILTER ROOMS
    const filteredRooms = rooms.filter(room => {
        const searchText = search.toLowerCase();

        return (
            room.name?.toLowerCase().includes(searchText) ||
            room.roomNumber?.toLowerCase().includes(searchText) ||
            room.inCharge?.toLowerCase().includes(searchText) ||
            room.department?.name?.toLowerCase().includes(searchText)
        );
    });

    // ROOM STATISTICS - Search: ROOM STATISTICS
    const activeRooms = rooms.filter(room => room.isActive).length;
    const totalRooms = rooms.length;
    const inactiveRooms = totalRooms - activeRooms;

    return (
        <div className="min-h-screen bg-[#f5f7fb] p-4 md:p-6 lg:p-8 lg:ml-64">
            <AdminSidebar />

            {/* ROOM PAGE HEADER - Search: ROOM PAGE HEADER */}
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
                                🚪
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
                                    United Medical College
                                </p>

                                <h1 className="mt-1 text-2xl font-bold md:text-3xl">
                                    Room Management
                                </h1>
                            </div>

                        </div>

                        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
                            Manage rooms, assign departments and maintain room information from one place.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">

                        <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur">
                            <p className="text-xs text-blue-200">
                                Room Overview
                            </p>

                            <p className="mt-1 text-2xl font-bold">
                                {totalRooms}
                                <span className="ml-2 text-sm font-medium text-blue-200">
                                    Rooms
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
                            {showForm ? '✕ Close Form' : '+ Add Room'}
                        </button>

                    </div>

                </div>
            </div>

            {/* ROOM STATISTICS CARDS - Search: ROOM STATISTICS CARDS */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">

                <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">

                    <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-blue-500 opacity-[0.07]" />

                    <div className="relative flex items-start justify-between">

                        <div>
                            <p className="text-sm font-medium text-slate-500">
                                Total Rooms
                            </p>

                            <h2 className="mt-3 text-3xl font-extrabold text-slate-800">
                                {totalRooms}
                            </h2>

                            <p className="mt-2 text-xs text-slate-400">
                                Registered rooms
                            </p>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl">
                            🚪
                        </div>

                    </div>
                </div>

                <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">

                    <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-emerald-500 opacity-[0.07]" />

                    <div className="relative flex items-start justify-between">

                        <div>
                            <p className="text-sm font-medium text-slate-500">
                                Active Rooms
                            </p>

                            <h2 className="mt-3 text-3xl font-extrabold text-slate-800">
                                {activeRooms}
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
                                {filteredRooms.length}
                            </h2>

                            <p className="mt-2 text-xs text-slate-400">
                                Matching rooms
                            </p>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-xl">
                            🔍
                        </div>

                    </div>
                </div>

            </div>

            {/* ADD ROOM FORM - Search: ADD ROOM FORM */}
            {showForm && (
                <div className="mb-8 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-lg">

                    <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 md:px-8">

                        <div className="flex items-center gap-3">

                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-md">
                                {editingId ? '✏️' : '＋'}
                            </div>

                            <div>
                                <h2 className="text-xl font-bold text-slate-800">
                                    {editingId ? 'Edit Room' : 'Add New Room'}
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    Enter room information below
                                </p>
                            </div>

                        </div>
                    </div>

                    <form onSubmit={handleSaveRoom} className="p-6 md:p-8">

                        <div className="mb-6">

                            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                                <span className="h-2 w-2 rounded-full bg-blue-600" />
                                Room Information
                            </h3>

                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Room Name *
                                    </label>

                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        placeholder="e.g. IT Room"
                                        required
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Room Number
                                    </label>

                                    <input
                                        type="text"
                                        name="roomNumber"
                                        value={formData.roomNumber}
                                        onChange={handleInputChange}
                                        placeholder="e.g. 101"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                    />
                                </div>

                                {/* DEPARTMENT DROPDOWN - Search: DEPARTMENT DROPDOWN */}
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Department *
                                    </label>

                                    <select
                                        name="department"
                                        value={formData.department}
                                        onChange={handleInputChange}
                                        required
                                        disabled={departmentLoading || departments.length === 0}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <option value="">
                                            {departmentLoading
                                                ? 'Loading departments...'
                                                : departments.length === 0
                                                    ? 'No department available'
                                                    : 'Select Department'}
                                        </option>

                                        {departments.map(department => (
                                            <option
                                                key={department._id}
                                                value={department._id}
                                            >
                                                {department.name}
                                            </option>
                                        ))}
                                    </select>

                                    {departmentError ? (
                                        <p className="mt-2 text-xs font-medium text-red-600">
                                            {departmentError}
                                        </p>
                                    ) : departments.length === 0 && !departmentLoading ? (
                                        <p className="mt-2 text-xs text-amber-600">
                                            No active departments found. Please add a department first.
                                        </p>
                                    ) : (
                                        <p className="mt-2 text-xs text-slate-400">
                                            Select a department from your saved department list.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Room In-Charge
                                    </label>

                                    <input
                                        type="text"
                                        name="inCharge"
                                        value={formData.inCharge}
                                        onChange={handleInputChange}
                                        placeholder="Enter responsible person's name"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Description
                                    </label>

                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        placeholder="Enter room description"
                                        rows="3"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                    />
                                </div>

                                {editingId && (
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                                            Room Status
                                        </label>

                                        <select
                                            name="isActive"
                                            value={String(formData.isActive)}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                isActive: e.target.value === 'true'
                                            }))}
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                        >
                                            <option value="true">Active</option>
                                            <option value="false">Inactive</option>
                                        </select>
                                    </div>
                                )}

                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-6">

                            <button
                                type="submit"
                                disabled={saving || departmentLoading || departments.length === 0}
                                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-3 font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {saving
                                    ? 'Saving...'
                                    : editingId
                                        ? '✓ Update Room'
                                        : '+ Save Room'}
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

            {/* ROOM TABLE - Search: ROOM TABLE */}
            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">

                <div className="flex flex-col gap-5 border-b border-slate-100 p-5 md:p-6 lg:flex-row lg:items-center lg:justify-between">

                    <div>
                        <div className="flex items-center gap-3">

                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl">
                                📋
                            </div>

                            <div>
                                <h2 className="text-lg font-bold text-slate-800">
                                    All Rooms
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    {filteredRooms.length} rooms found
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
                            placeholder="Search room, number or department..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        />

                    </div>
                </div>

                {loading ? (
                    <div className="p-16 text-center">

                        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />

                        <p className="text-sm font-medium text-slate-500">
                            Loading rooms...
                        </p>

                    </div>
                ) : error ? (
                    <div className="p-10 text-center">

                        <div className="mb-3 text-4xl">⚠️</div>

                        <p className="mb-4 font-medium text-red-600">
                            {error}
                        </p>

                        <button
                            onClick={fetchRoomData}
                            className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white transition hover:bg-blue-700"
                        >
                            Try Again
                        </button>

                    </div>
                ) : filteredRooms.length === 0 ? (
                    <div className="p-16 text-center">

                        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-4xl">
                            🚪
                        </div>

                        <h3 className="text-lg font-bold text-slate-700">
                            No Rooms Found
                        </h3>

                        <p className="mt-2 text-sm text-slate-500">
                            {search
                                ? 'Try searching with another room name.'
                                : 'Add a new room to get started.'}
                        </p>

                        {!search && (
                            <button
                                onClick={() => {
                                    resetForm();
                                    setShowForm(true);
                                }}
                                className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white transition hover:bg-blue-700"
                            >
                                + Add Room
                            </button>
                        )}

                    </div>
                ) : (
                    <div className="overflow-x-auto">

                        <table className="w-full min-w-[950px] text-left">

                            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">

                                <tr>
                                    <th className="px-6 py-4 font-bold">#</th>
                                    <th className="px-5 py-4 font-bold">Room</th>
                                    <th className="px-5 py-4 font-bold">Room Number</th>
                                    <th className="px-5 py-4 font-bold">Department</th>
                                    <th className="px-5 py-4 font-bold">In-Charge</th>
                                    <th className="px-5 py-4 text-center font-bold">Status</th>
                                    <th className="px-5 py-4 text-center font-bold">Action</th>
                                </tr>

                            </thead>

                            <tbody className="divide-y divide-slate-100">

                                {filteredRooms.map((room, index) => (

                                    <tr
                                        key={room._id}
                                        className="group transition duration-200 hover:bg-blue-50/40"
                                    >

                                        <td className="px-6 py-4 text-sm font-semibold text-slate-400">
                                            {index + 1}
                                        </td>

                                        <td className="px-5 py-4">

                                            <div className="flex items-center gap-3">

                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-lg">
                                                    🚪
                                                </div>

                                                <div>
                                                    <p className="font-bold text-slate-800">
                                                        {room.name}
                                                    </p>

                                                    <p className="mt-1 text-xs text-slate-400">
                                                        Room
                                                    </p>
                                                </div>

                                            </div>
                                        </td>

                                        <td className="px-5 py-4 text-sm font-medium text-slate-600">
                                            {room.roomNumber || 'Not assigned'}
                                        </td>

                                        <td className="px-5 py-4 text-sm text-slate-600">
                                            {room.department?.name || 'No department'}
                                        </td>

                                        <td className="px-5 py-4 text-sm text-slate-500">
                                            {room.inCharge || 'Not assigned'}
                                        </td>

                                        <td className="px-5 py-4 text-center">

                                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                                                room.isActive
                                                    ? 'bg-emerald-50 text-emerald-600'
                                                    : 'bg-red-50 text-red-600'
                                            }`}>

                                                <span className={`h-1.5 w-1.5 rounded-full ${
                                                    room.isActive
                                                        ? 'bg-emerald-500'
                                                        : 'bg-red-500'
                                                }`} />

                                                {room.isActive ? 'Active' : 'Inactive'}

                                            </span>

                                        </td>

                                        {/* ROOM ACTION BUTTONS - Search: ROOM ACTION BUTTONS */}
                                        <td className="px-5 py-4">

                                            <div className="flex items-center justify-center gap-2">

                                                <button
                                                    onClick={() => handleEditRoom(room)}
                                                    title="Edit Room"
                                                    className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-600 transition hover:border-blue-300 hover:bg-blue-100"
                                                >
                                                    ✏️ Edit
                                                </button>

                                                <button
                                                    onClick={() => handleDeleteRoom(room._id)}
                                                    title="Delete Room"
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

                {/* ROOM TABLE FOOTER - Search: ROOM TABLE FOOTER */}
                {!loading && !error && filteredRooms.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">

                        <p>
                            Showing{' '}
                            <span className="font-bold text-slate-700">
                                {filteredRooms.length}
                            </span>{' '}
                            of{' '}
                            <span className="font-bold text-slate-700">
                                {rooms.length}
                            </span>{' '}
                            rooms
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

export default RoomManagement;
