
import { useState, useEffect, useMemo } from 'react';
import AdminSidebar from '../../components/AdminSidebar.jsx';

// API URLS
const ROOM_API_URL = 'http://localhost:3001/api/rooms';
const DEPARTMENT_API_URL = 'http://localhost:3001/api/departments';
const ROOM_INVENTORY_API_URL = 'http://localhost:3001/api/assignments/room';
const ASSIGNMENT_API_URL = 'http://localhost:3001/api/assignments';

// ROOM & DEPARTMENT INVENTORY PAGE
const RoomInventory = () => {
    const [rooms, setRooms] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [roomCards, setRoomCards] = useState([]);
    const [assignments, setAssignments] = useState([]);

    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [selectedFloor, setSelectedFloor] = useState('');
    const [selectedRoom, setSelectedRoom] = useState('');

    const [roomSearch, setRoomSearch] = useState('');
    const [personSearch, setPersonSearch] = useState('');

    const [selectedDetails, setSelectedDetails] = useState(null);

    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState('');

    // AUTH HEADER
    const getHeaders = () => ({
        Authorization: `Bearer ${localStorage.getItem('pos-token')}`,
        'Content-Type': 'application/json'
    });

    // LOAD DEPARTMENTS, ROOMS AND ASSIGNMENTS
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                setInitialLoading(true);
                setError('');

                const [departmentResponse, roomResponse, assignmentResponse] =
                    await Promise.all([
                        fetch(DEPARTMENT_API_URL, { headers: getHeaders() }),
                        fetch(ROOM_API_URL, { headers: getHeaders() }),
                        fetch(ASSIGNMENT_API_URL, { headers: getHeaders() })
                    ]);

                const departmentData = await departmentResponse.json();
                const roomData = await roomResponse.json();
                const assignmentData = await assignmentResponse.json();

                if (!departmentResponse.ok) {
                    throw new Error(
                        departmentData.message || 'Failed to load departments'
                    );
                }

                if (!roomResponse.ok) {
                    throw new Error(
                        roomData.message || 'Failed to load rooms'
                    );
                }

                if (!assignmentResponse.ok) {
                    throw new Error(
                        assignmentData.message || 'Failed to load assignments'
                    );
                }

                const activeRooms = (roomData.rooms || []).filter(
                    room => room.isActive !== false
                );

                setDepartments(departmentData.departments || []);
                setRooms(activeRooms);
                setAssignments(assignmentData.assignments || []);

                // LOAD INVENTORY FOR ALL ROOMS
                setLoading(true);

                const inventoryResults = await Promise.all(
                    activeRooms.map(async room => {
                        try {
                            const response = await fetch(
                                `${ROOM_INVENTORY_API_URL}/${room._id}`,
                                { headers: getHeaders() }
                            );

                            const data = await response.json();

                            if (!response.ok) {
                                return {
                                    ...room,
                                    assets: [],
                                    inventoryError: data.message || 'Failed to load inventory'
                                };
                            }

                            return {
                                ...room,
                                assets: data.assets || [],
                                roomDetails: data.room || room
                            };
                        } catch (err) {
                            console.error(
                                `ROOM INVENTORY ERROR (${room.roomNumber || room.name}):`,
                                err
                            );

                            return {
                                ...room,
                                assets: [],
                                inventoryError: 'Unable to load room inventory'
                            };
                        }
                    })
                );

                setRoomCards(inventoryResults);

            } catch (err) {
                console.error('ROOM INVENTORY INITIAL LOAD ERROR:', err);
                setError(err.message || 'Failed to load room information');
            } finally {
                setLoading(false);
                setInitialLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    // GET UNIQUE FLOOR LEVELS
    const floorLevels = useMemo(() => {
        const filteredRooms = rooms.filter(room => {
            if (!selectedDepartment) return true;

            const departmentId =
                room.department?._id || room.department;

            return String(departmentId) === String(selectedDepartment);
        });

        return [
            ...new Set(
                filteredRooms
                    .map(room => room.floorLevel)
                    .filter(level => level !== undefined && level !== null && level !== '')
            )
        ].sort((a, b) =>
            String(a).localeCompare(String(b), undefined, { numeric: true })
        );
    }, [rooms, selectedDepartment]);

    // FIND ROOM IDS BY PERSON / RECEIVER NAME
    const personRoomIds = useMemo(() => {
        const search = personSearch.trim().toLowerCase();

        if (!search) return [];

        return assignments
            .filter(assignment => {
                const receiver = assignment.receiver || {};

                const receiverName = receiver.name || '';
                const employeeId = receiver.employeeId || '';
                const designation = receiver.designation || '';

                return (
                    receiverName.toLowerCase().includes(search) ||
                    String(employeeId).toLowerCase().includes(search) ||
                    designation.toLowerCase().includes(search)
                );
            })
            .map(assignment =>
                assignment.room?._id || assignment.room
            )
            .filter(Boolean)
            .map(id => String(id));
    }, [assignments, personSearch]);

    // FILTER ROOM CARDS
    const filteredRoomCards = useMemo(() => {
        const roomSearchValue = roomSearch.trim().toLowerCase();
        const personSearchValue = personSearch.trim();

        return roomCards.filter(room => {
            const departmentId =
                room.department?._id || room.department;

            const matchesDepartment =
                !selectedDepartment ||
                String(departmentId) === String(selectedDepartment);

            const matchesFloor =
                !selectedFloor ||
                String(room.floorLevel) === String(selectedFloor);

            const matchesRoom =
                !selectedRoom ||
                String(room._id) === String(selectedRoom);

            const matchesRoomSearch =
                !roomSearchValue ||
                String(room.roomNumber || '').toLowerCase().includes(roomSearchValue) ||
                String(room.name || '').toLowerCase().includes(roomSearchValue);

            const matchesPerson =
                !personSearchValue ||
                personRoomIds.includes(String(room._id));

            return (
                matchesDepartment &&
                matchesFloor &&
                matchesRoom &&
                matchesRoomSearch &&
                matchesPerson
            );
        });
    }, [
        roomCards,
        selectedDepartment,
        selectedFloor,
        selectedRoom,
        roomSearch,
        personSearch,
        personRoomIds
    ]);

    // DEPARTMENT CHANGE
    const handleDepartmentChange = value => {
        setSelectedDepartment(value);
        setSelectedFloor('');
        setSelectedRoom('');
    };

    // FLOOR CHANGE
    const handleFloorChange = value => {
        setSelectedFloor(value);
        setSelectedRoom('');
    };

    // ROOM SEARCH
    const handleRoomSearch = value => {
        setRoomSearch(value);
        setSelectedRoom('');
        setPersonSearch('');
    };

    // PERSON SEARCH
    const handlePersonSearch = value => {
        setPersonSearch(value);
        setRoomSearch('');
        setSelectedRoom('');
    };

    // RESET FILTERS
    const handleResetFilters = () => {
        setSelectedDepartment('');
        setSelectedFloor('');
        setSelectedRoom('');
        setRoomSearch('');
        setPersonSearch('');
        setSelectedDetails(null);
        setError('');
    };

    // STATUS COLORS
    const getStatusStyle = status => {
        switch (status) {
            case 'Assigned':
                return 'bg-emerald-100 text-emerald-700';

            case 'Damaged':
                return 'bg-red-100 text-red-700';

            case 'Under Repair':
                return 'bg-orange-100 text-orange-700';

            default:
                return 'bg-slate-100 text-slate-700';
        }
    };

    // GET ROOM STATUS COUNTS
    const getRoomCounts = assets => ({
        assigned: assets.filter(item => item.status === 'Assigned').length,
        damaged: assets.filter(item => item.status === 'Damaged').length,
        repair: assets.filter(item => item.status === 'Under Repair').length
    });

    // GET PRODUCT-WISE ROOM INVENTORY SUMMARY
    const getProductSummary = assets => {
        const productMap = new Map();

        assets.forEach(asset => {
            const stockItem = asset.stockItem || {};

            const name =
                asset.name ||
                stockItem.name ||
                'Unknown Product';

            const brand =
                asset.brand ||
                stockItem.brand ||
                '';

            const model =
                asset.model ||
                stockItem.model ||
                '';

            const category = stockItem.category || '';

            const productKey = [
                name.trim().toLowerCase(),
                brand.trim().toLowerCase(),
                model.trim().toLowerCase()
            ].join('|');

            if (!productMap.has(productKey)) {
                productMap.set(productKey, {
                    name,
                    brand,
                    model,
                    category,
                    total: 0,
                    assigned: 0,
                    damaged: 0,
                    repair: 0
                });
            }

            const product = productMap.get(productKey);

            product.total += 1;

            if (asset.status === 'Assigned') {
                product.assigned += 1;
            } else if (asset.status === 'Damaged') {
                product.damaged += 1;
            } else if (asset.status === 'Under Repair') {
                product.repair += 1;
            }
        });

        return Array.from(productMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
        );
    };

    // GET MATCHING RECEIVERS FOR A ROOM
    const getRoomReceivers = roomId => {
        const search = personSearch.trim().toLowerCase();

        const roomAssignments = assignments.filter(assignment => {
            const assignmentRoomId =
                assignment.room?._id || assignment.room;

            return String(assignmentRoomId) === String(roomId);
        });

        const receivers = roomAssignments
            .filter(assignment => {
                if (!search) return true;

                const receiver = assignment.receiver || {};

                const receiverName = receiver.name || '';
                const employeeId = receiver.employeeId || '';
                const designation = receiver.designation || '';

                return (
                    receiverName.toLowerCase().includes(search) ||
                    String(employeeId).toLowerCase().includes(search) ||
                    designation.toLowerCase().includes(search)
                );
            })
            .map(assignment => assignment.receiver)
            .filter(Boolean);

        return [
            ...new Map(
                receivers.map(receiver => [
                    `${receiver.name || ''}-${receiver.employeeId || ''}`,
                    receiver
                ])
            ).values()
        ];
    };

    // PRINT ROOM DETAILS
    const handlePrintDetails = room => {
        const details = room.roomDetails || room;
        const assets = room.assets || [];
        const counts = getRoomCounts(assets);
        const productSummary = getProductSummary(assets);
        const receivers = getRoomReceivers(room._id);

        const escapeHtml = value =>
            String(value ?? 'N/A')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

        const productRows = productSummary.map((product, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(product.name)}</td>
                <td>${escapeHtml(product.brand || 'N/A')}</td>
                <td>${escapeHtml(product.model || 'N/A')}</td>
                <td>${escapeHtml(product.total)}</td>
                <td>${escapeHtml(product.assigned)}</td>
                <td>${escapeHtml(product.damaged)}</td>
                <td>${escapeHtml(product.repair)}</td>
            </tr>
        `).join('');

        const assetRows = assets.map((asset, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(asset.name || asset.stockItem?.name)}</td>
                <td>${escapeHtml(asset.brand || asset.stockItem?.brand)}</td>
                <td>${escapeHtml(asset.model || asset.stockItem?.model)}</td>
                <td>${escapeHtml(asset.assetId)}</td>
                <td>${escapeHtml(asset.serialNumber)}</td>
                <td>${escapeHtml(asset.status)}</td>
            </tr>
        `).join('');

        const receiverRows = receivers.length
            ? receivers.map(receiver => `
                <tr>
                    <td>${escapeHtml(receiver.name)}</td>
                    <td>${escapeHtml(receiver.employeeId)}</td>
                    <td>${escapeHtml(receiver.designation)}</td>
                    <td>${escapeHtml(receiver.phone)}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="4">No receiver information available</td></tr>';

        const printWindow = window.open('', '_blank', 'width=1100,height=800');

        if (!printWindow) {
            alert('Please allow pop-ups to print room details.');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Room Inventory Details</title>
                <style>
                    * { box-sizing: border-box; }
                    body {
                        font-family: Arial, sans-serif;
                        color: #1e293b;
                        padding: 30px;
                        margin: 0;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 3px solid #2563eb;
                        padding-bottom: 18px;
                        margin-bottom: 25px;
                    }
                    .header h1 {
                        color: #1e3a8a;
                        margin: 0 0 7px;
                        font-size: 23px;
                    }
                    .header p {
                        margin: 4px 0;
                        color: #64748b;
                        font-size: 12px;
                    }
                    .section {
                        margin-top: 25px;
                    }
                    .section h2 {
                        font-size: 16px;
                        color: #1d4ed8;
                        border-left: 4px solid #f97316;
                        padding-left: 10px;
                        margin-bottom: 12px;
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px;
                    }
                    .info-item {
                        border: 1px solid #e2e8f0;
                        padding: 11px;
                        border-radius: 5px;
                    }
                    .info-item span {
                        display: block;
                        color: #64748b;
                        font-size: 11px;
                        margin-bottom: 5px;
                    }
                    .info-item strong {
                        font-size: 13px;
                        color: #1e3a8a;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 11px;
                    }
                    th {
                        background: #eff6ff;
                        color: #1e3a8a;
                        text-align: left;
                    }
                    th, td {
                        border: 1px solid #cbd5e1;
                        padding: 9px 7px;
                    }
                    .status-summary {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 10px;
                    }
                    .status-box {
                        border: 1px solid #cbd5e1;
                        padding: 12px;
                        text-align: center;
                        border-radius: 5px;
                    }
                    .status-box strong {
                        display: block;
                        font-size: 18px;
                        margin-top: 5px;
                    }
                    .footer {
                        margin-top: 35px;
                        padding-top: 12px;
                        border-top: 1px solid #cbd5e1;
                        text-align: center;
                        color: #64748b;
                        font-size: 10px;
                    }
                    @media print {
                        body { padding: 10px; }
                        tr { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>UNITED MEDICAL COLLEGE</h1>
                    <p>IT INVENTORY & ASSET MANAGEMENT SYSTEM</p>
                    <p>ROOM & DEPARTMENT INVENTORY REPORT</p>
                </div>

                <div class="section">
                    <h2>Room Information</h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <span>Room Number</span>
                            <strong>${escapeHtml(details.roomNumber || details.name)}</strong>
                        </div>
                        <div class="info-item">
                            <span>Room Name</span>
                            <strong>${escapeHtml(details.name)}</strong>
                        </div>
                        <div class="info-item">
                            <span>Department</span>
                            <strong>${escapeHtml(details.department?.name || 'N/A')}</strong>
                        </div>
                        <div class="info-item">
                            <span>Floor Level</span>
                            <strong>${escapeHtml(details.floorLevel)}</strong>
                        </div>
                        <div class="info-item">
                            <span>Room In-Charge</span>
                            <strong>${escapeHtml(details.inCharge)}</strong>
                        </div>
                        <div class="info-item">
                            <span>Total Devices</span>
                            <strong>${assets.length}</strong>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h2>Device Status Summary</h2>
                    <div class="status-summary">
                        <div class="status-box">
                            Assigned
                            <strong>${counts.assigned}</strong>
                        </div>
                        <div class="status-box">
                            Damaged
                            <strong>${counts.damaged}</strong>
                        </div>
                        <div class="status-box">
                            Under Repair
                            <strong>${counts.repair}</strong>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h2>Product-wise Summary (${productSummary.length} Products)</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Product Name</th>
                                <th>Brand</th>
                                <th>Model</th>
                                <th>Total</th>
                                <th>Assigned</th>
                                <th>Damaged</th>
                                <th>Under Repair</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${productRows || '<tr><td colspan="8">No products found</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <div class="section">
                    <h2>Complete Device Information (${assets.length})</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Product Name</th>
                                <th>Brand</th>
                                <th>Model</th>
                                <th>Asset ID</th>
                                <th>Serial Number</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${assetRows || '<tr><td colspan="7">No devices found</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <div class="section">
                    <h2>Receiver Information</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Receiver Name</th>
                                <th>Employee ID</th>
                                <th>Designation</th>
                                <th>Phone</th>
                            </tr>
                        </thead>
                        <tbody>${receiverRows}</tbody>
                    </table>
                </div>

                <div class="footer">
                    United Medical College - IT Inventory & Asset Management
                    <br />
                    Printed on: ${new Date().toLocaleString()}
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);

        printWindow.document.close();
    };

    return (
        <div className="min-h-screen bg-slate-100">
            <AdminSidebar />

            <main className="lg:ml-64 min-h-screen p-4 sm:p-6 lg:p-8">

                {/* PAGE HEADER */}
                <div className="mb-7">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xl shadow-sm">
                            🏢
                        </div>

                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">
                                Room & Department Inventory
                            </h1>

                            <p className="text-sm text-slate-500 mt-1">
                                View IT devices by room, department and receiver
                            </p>
                        </div>
                    </div>
                </div>

                {/* FILTER SECTION */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">

                    <div className="flex items-center justify-between mb-5 gap-3">
                        <div>
                            <h2 className="text-base font-bold text-slate-800">
                                Search Inventory
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">
                                Search by department, room number or receiver name
                            </p>
                        </div>

                        <button
                            onClick={handleResetFilters}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap"
                        >
                            Reset Filters
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

                        {/* DEPARTMENT */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-2">
                                Department
                            </label>

                            <select
                                value={selectedDepartment}
                                onChange={e => handleDepartmentChange(e.target.value)}
                                className="w-full h-11 px-3 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">All Departments</option>

                                {departments.map(department => (
                                    <option key={department._id} value={department._id}>
                                        {department.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* FLOOR */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-2">
                                Floor Level
                            </label>

                            <select
                                value={selectedFloor}
                                onChange={e => handleFloorChange(e.target.value)}
                                className="w-full h-11 px-3 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">All Floors</option>

                                {floorLevels.map((floor, index) => (
                                    <option key={index} value={floor}>
                                        {floor}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* ROOM SELECT */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-2">
                                Select Room
                            </label>

                            <select
                                value={selectedRoom}
                                onChange={e => setSelectedRoom(e.target.value)}
                                className="w-full h-11 px-3 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">All Rooms</option>

                                {rooms
                                    .filter(room => {
                                        const departmentId =
                                            room.department?._id || room.department;

                                        return (
                                            (!selectedDepartment ||
                                                String(departmentId) === String(selectedDepartment)) &&
                                            (!selectedFloor ||
                                                String(room.floorLevel) === String(selectedFloor))
                                        );
                                    })
                                    .map(room => (
                                        <option key={room._id} value={room._id}>
                                            {room.roomNumber || room.name}
                                            {room.name && room.roomNumber
                                                ? ` - ${room.name}`
                                                : ''}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {/* ROOM NUMBER SEARCH */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-2">
                                Search Room Number
                            </label>

                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    🔍
                                </span>

                                <input
                                    type="text"
                                    value={roomSearch}
                                    onChange={e => handleRoomSearch(e.target.value)}
                                    placeholder="Enter room number..."
                                    className="w-full h-11 pl-10 pr-3 border border-slate-300 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        </div>

                        {/* PERSON SEARCH */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-2">
                                Person / Receiver Name
                            </label>

                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    👤
                                </span>

                                <input
                                    type="text"
                                    value={personSearch}
                                    onChange={e => handlePersonSearch(e.target.value)}
                                    placeholder="Enter receiver name or ID..."
                                    className="w-full h-11 pl-10 pr-3 border border-slate-300 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        </div>

                    </div>

                    <p className="text-xs text-slate-400 mt-4">
                        {filteredRoomCards.length} room(s) found
                    </p>
                </div>

                {/* INITIAL LOADING */}
                {initialLoading && (
                    <div className="bg-white rounded-xl p-10 text-center border border-slate-200">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                        <p className="text-sm text-slate-500">
                            Loading room and department inventory...
                        </p>
                    </div>
                )}

                {/* ERROR */}
                {!initialLoading && error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                        <p className="text-sm font-medium text-red-700">
                            ⚠️ {error}
                        </p>
                    </div>
                )}

                {/* INVENTORY ROOM CARDS */}
                {!initialLoading && !error && (
                    <>
                        {loading ? (
                            <div className="bg-white rounded-xl p-10 text-center border border-slate-200">
                                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                                <p className="text-sm text-slate-500">
                                    Loading room devices...
                                </p>
                            </div>
                        ) : filteredRoomCards.length === 0 ? (
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-12 text-center">
                                <div className="text-5xl mb-4">📦</div>

                                <h2 className="text-lg font-bold text-slate-700">
                                    No Room Found
                                </h2>

                                <p className="text-sm text-slate-500 mt-2">
                                    No room or inventory information matches your search.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

                                {filteredRoomCards.map(room => {
                                    const details = room.roomDetails || room;
                                    const assets = room.assets || [];
                                    const counts = getRoomCounts(assets);
                                    const productSummary = getProductSummary(assets);
                                    const receivers = getRoomReceivers(room._id);

                                    return (
                                        <div
                                            key={room._id}
                                            className="bg-white rounded-2xl border border-orange-200 border-l-4 border-l-orange-500 shadow-sm overflow-hidden"
                                        >
                                            {/* CARD HEADER */}
                                            <div className="p-5 border-b border-slate-100">
                                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-bold uppercase tracking-wider text-orange-600 mb-2">
                                                            Room Inventory
                                                        </p>

                                                        <h2 className="text-xl font-bold text-blue-800">
                                                            {details.roomNumber || details.name || 'Room'}
                                                        </h2>

                                                        <p className="text-sm text-slate-500 mt-1">
                                                            {details.name && details.roomNumber
                                                                ? details.name
                                                                : 'Room details'}
                                                        </p>
                                                    </div>

                                                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-center min-w-24">
                                                        <p className="text-xs font-semibold text-blue-600">
                                                            Total Devices
                                                        </p>
                                                        <p className="text-2xl font-bold text-blue-800 mt-1">
                                                            {assets.length}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ROOM INFORMATION */}
                                            <div className="p-5 grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-slate-400 font-medium">
                                                        Department
                                                    </p>
                                                    <p className="text-sm font-bold text-blue-800 mt-1">
                                                        {details.department?.name ||
                                                            departments.find(department =>
                                                                department._id === (room.department?._id || room.department)
                                                            )?.name ||
                                                            'N/A'}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-slate-400 font-medium">
                                                        Floor Level
                                                    </p>
                                                    <p className="text-sm font-bold text-blue-800 mt-1">
                                                        {details.floorLevel ?? 'N/A'}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-slate-400 font-medium">
                                                        Room In-Charge
                                                    </p>
                                                    <p className="text-sm font-bold text-blue-800 mt-1">
                                                        {details.inCharge || 'N/A'}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-slate-400 font-medium">
                                                        Room Number
                                                    </p>
                                                    <p className="text-sm font-bold text-blue-800 mt-1">
                                                        {details.roomNumber || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* STATUS SUMMARY */}
                                            <div className="px-5 pb-5">
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="bg-emerald-50 rounded-lg p-3 text-center">
                                                        <p className="text-xs text-emerald-700 font-medium">
                                                            Assigned
                                                        </p>
                                                        <p className="text-lg font-bold text-emerald-700 mt-1">
                                                            {counts.assigned}
                                                        </p>
                                                    </div>

                                                    <div className="bg-red-50 rounded-lg p-3 text-center">
                                                        <p className="text-xs text-red-700 font-medium">
                                                            Damaged
                                                        </p>
                                                        <p className="text-lg font-bold text-red-700 mt-1">
                                                            {counts.damaged}
                                                        </p>
                                                    </div>

                                                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                                                        <p className="text-xs text-orange-700 font-medium">
                                                            Under Repair
                                                        </p>
                                                        <p className="text-lg font-bold text-orange-700 mt-1">
                                                            {counts.repair}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* PRODUCT-WISE SUMMARY */}
                                            <div className="px-5 pb-5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-sm font-bold text-blue-800">
                                                        Product-wise Inventory
                                                    </h3>

                                                    <span className="text-xs text-slate-400">
                                                        {productSummary.length} product type(s)
                                                    </span>
                                                </div>

                                                {productSummary.length === 0 ? (
                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 text-center">
                                                        <p className="text-sm text-slate-500">
                                                            No product information available.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                                        <table className="w-full text-sm text-left">
                                                            <thead className="bg-blue-50 text-blue-900">
                                                                <tr>
                                                                    <th className="px-3 py-2.5">Product</th>
                                                                    <th className="px-3 py-2.5 text-center">Total</th>
                                                                    <th className="px-3 py-2.5 text-center">Assigned</th>
                                                                    <th className="px-3 py-2.5 text-center">Damaged</th>
                                                                    <th className="px-3 py-2.5 text-center">Repair</th>
                                                                </tr>
                                                            </thead>

                                                            <tbody className="divide-y divide-slate-100">
                                                                {productSummary.map((product, index) => (
                                                                    <tr key={`${product.name}-${product.brand}-${product.model}-${index}`}>
                                                                        <td className="px-3 py-3">
                                                                            <p className="font-semibold text-slate-800">
                                                                                {product.name}
                                                                            </p>

                                                                            {(product.brand || product.model) && (
                                                                                <p className="text-xs text-slate-400 mt-1">
                                                                                    {[product.brand, product.model].filter(Boolean).join(' / ')}
                                                                                </p>
                                                                            )}
                                                                        </td>

                                                                        <td className="px-3 py-3 text-center font-bold text-blue-800">
                                                                            {product.total}
                                                                        </td>

                                                                        <td className="px-3 py-3 text-center text-emerald-700 font-semibold">
                                                                            {product.assigned}
                                                                        </td>

                                                                        <td className="px-3 py-3 text-center text-red-700 font-semibold">
                                                                            {product.damaged}
                                                                        </td>

                                                                        <td className="px-3 py-3 text-center text-orange-700 font-semibold">
                                                                            {product.repair}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>

                                            {/* DEVICE PREVIEW */}
                                            <div className="px-5 pb-5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-sm font-bold text-blue-800">
                                                        Room Devices
                                                    </h3>

                                                    <span className="text-xs text-slate-400">
                                                        {assets.length} device(s)
                                                    </span>
                                                </div>

                                                {assets.length === 0 ? (
                                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 text-center">
                                                        <p className="text-sm text-slate-500">
                                                            No assigned devices in this room.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {assets.slice(0, 3).map(asset => (
                                                            <div
                                                                key={asset._id}
                                                                className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-100 rounded-lg p-3"
                                                            >
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-semibold text-slate-800 truncate">
                                                                        {asset.name ||
                                                                            asset.stockItem?.name ||
                                                                            'N/A'}
                                                                    </p>

                                                                    <p className="text-xs text-blue-700 mt-1">
                                                                        {asset.assetId || 'No Asset ID'}
                                                                    </p>
                                                                </div>

                                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${getStatusStyle(asset.status)}`}>
                                                                    {asset.status}
                                                                </span>
                                                            </div>
                                                        ))}

                                                        {assets.length > 3 && (
                                                            <p className="text-xs text-center text-slate-400 pt-1">
                                                                + {assets.length - 3} more device(s)
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* RECEIVER INFORMATION */}
                                            <div className="px-5 pb-5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-sm font-bold text-blue-800">
                                                        Room Receivers
                                                    </h3>

                                                    <span className="text-xs text-slate-400">
                                                        {receivers.length} receiver(s)
                                                    </span>
                                                </div>

                                                {receivers.length === 0 ? (
                                                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                                        <p className="text-xs text-slate-500">
                                                            No receiver information available.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {receivers.slice(0, 2).map((receiver, index) => (
                                                            <div
                                                                key={`${receiver.employeeId || receiver.name}-${index}`}
                                                                className="bg-blue-50 border border-blue-100 rounded-lg p-3"
                                                            >
                                                                <p className="text-sm font-bold text-blue-800">
                                                                    {receiver.name || 'N/A'}
                                                                </p>

                                                                <p className="text-xs text-slate-500 mt-1">
                                                                    Employee ID: {receiver.employeeId || 'N/A'}
                                                                </p>

                                                                <p className="text-xs text-slate-500 mt-1">
                                                                    Designation: {receiver.designation || 'N/A'}
                                                                </p>
                                                            </div>
                                                        ))}

                                                        {receivers.length > 2 && (
                                                            <p className="text-xs text-center text-slate-400">
                                                                + {receivers.length - 2} more receiver(s)
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* CARD ACTIONS */}
                                            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3">
                                                <button
                                                    onClick={() => setSelectedDetails(room)}
                                                    className="flex-1 min-w-28 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors"
                                                >
                                                    View Details
                                                </button>

                                                <button
                                                    onClick={() => handlePrintDetails(room)}
                                                    className="flex-1 min-w-28 bg-white border border-orange-300 hover:bg-orange-50 text-orange-700 text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors"
                                                >
                                                    🖨 Print Details
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                            </div>
                        )}
                    </>
                )}

            </main>

            {/* ROOM DETAILS MODAL */}
            {selectedDetails && (
                <div
                    className="fixed inset-0 z-[100] bg-slate-950/60 flex items-center justify-center p-3 sm:p-6"
                    onClick={() => setSelectedDetails(null)}
                >
                    <div
                        className="bg-white w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {(() => {
                            const room = selectedDetails;
                            const details = room.roomDetails || room;
                            const assets = room.assets || [];
                            const counts = getRoomCounts(assets);
                            const productSummary = getProductSummary(assets);
                            const receivers = getRoomReceivers(room._id);

                            return (
                                <>
                                    <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-5 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-orange-600">
                                                Room Inventory Details
                                            </p>
                                            <h2 className="text-xl font-bold text-blue-800 mt-1">
                                                {details.roomNumber || details.name}
                                            </h2>
                                        </div>

                                        <button
                                            onClick={() => setSelectedDetails(null)}
                                            className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xl"
                                            aria-label="Close details"
                                        >
                                            ×
                                        </button>
                                    </div>

                                    <div className="p-5 sm:p-6">
                                        {/* ROOM INFORMATION AND COUNTS */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                            {[
                                                ['Department', details.department?.name || departments.find(department =>
                                                    department._id === (room.department?._id || room.department)
                                                )?.name || 'N/A'],
                                                ['Room Number', details.roomNumber || 'N/A'],
                                                ['Room Name', details.name || 'N/A'],
                                                ['Floor Level', details.floorLevel ?? 'N/A'],
                                                ['Room In-Charge', details.inCharge || 'N/A'],
                                                ['Total Devices', assets.length],
                                                ['Assigned', counts.assigned],
                                                ['Damaged', counts.damaged],
                                                ['Under Repair', counts.repair],
                                                ['Product Types', productSummary.length]
                                            ].map(([label, value]) => (
                                                <div
                                                    key={label}
                                                    className="bg-white border border-orange-200 border-l-4 border-l-orange-400 rounded-lg p-4"
                                                >
                                                    <p className="text-xs font-medium text-slate-400">
                                                        {label}
                                                    </p>
                                                    <p className="text-sm font-bold text-blue-800 mt-2 break-words">
                                                        {value}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* PRODUCT-WISE SUMMARY */}
                                        <div className="mb-6">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-base font-bold text-blue-800">
                                                    Product-wise Inventory Summary
                                                </h3>

                                                <span className="text-xs text-slate-400">
                                                    {productSummary.length} product type(s)
                                                </span>
                                            </div>

                                            {productSummary.length === 0 ? (
                                                <div className="bg-slate-50 rounded-xl p-8 text-center text-sm text-slate-500">
                                                    No product information available in this room.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-blue-50 text-blue-900">
                                                            <tr>
                                                                <th className="px-4 py-3">#</th>
                                                                <th className="px-4 py-3">Product Name</th>
                                                                <th className="px-4 py-3">Brand</th>
                                                                <th className="px-4 py-3">Model</th>
                                                                <th className="px-4 py-3 text-center">Total</th>
                                                                <th className="px-4 py-3 text-center">Assigned</th>
                                                                <th className="px-4 py-3 text-center">Damaged</th>
                                                                <th className="px-4 py-3 text-center">Under Repair</th>
                                                            </tr>
                                                        </thead>

                                                        <tbody className="divide-y divide-slate-100">
                                                            {productSummary.map((product, index) => (
                                                                <tr key={`${product.name}-${product.brand}-${product.model}-${index}`}>
                                                                    <td className="px-4 py-3">{index + 1}</td>

                                                                    <td className="px-4 py-3 font-semibold text-slate-800">
                                                                        {product.name}
                                                                    </td>

                                                                    <td className="px-4 py-3">
                                                                        {product.brand || 'N/A'}
                                                                    </td>

                                                                    <td className="px-4 py-3">
                                                                        {product.model || 'N/A'}
                                                                    </td>

                                                                    <td className="px-4 py-3 text-center font-bold text-blue-800">
                                                                        {product.total}
                                                                    </td>

                                                                    <td className="px-4 py-3 text-center font-semibold text-emerald-700">
                                                                        {product.assigned}
                                                                    </td>

                                                                    <td className="px-4 py-3 text-center font-semibold text-red-700">
                                                                        {product.damaged}
                                                                    </td>

                                                                    <td className="px-4 py-3 text-center font-semibold text-orange-700">
                                                                        {product.repair}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>

                                        {/* COMPLETE DEVICE INFORMATION */}
                                        <div className="mb-6">
                                            <h3 className="text-base font-bold text-blue-800 mb-3">
                                                Complete Device Information
                                            </h3>

                                            {assets.length === 0 ? (
                                                <div className="bg-slate-50 rounded-xl p-8 text-center text-sm text-slate-500">
                                                    No devices found in this room.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-blue-50 text-blue-900">
                                                            <tr>
                                                                <th className="px-4 py-3">#</th>
                                                                <th className="px-4 py-3">Product Name</th>
                                                                <th className="px-4 py-3">Brand</th>
                                                                <th className="px-4 py-3">Model</th>
                                                                <th className="px-4 py-3">Asset ID</th>
                                                                <th className="px-4 py-3">Serial Number</th>
                                                                <th className="px-4 py-3">Status</th>
                                                            </tr>
                                                        </thead>

                                                        <tbody className="divide-y divide-slate-100">
                                                            {assets.map((asset, index) => (
                                                                <tr key={asset._id}>
                                                                    <td className="px-4 py-3">{index + 1}</td>

                                                                    <td className="px-4 py-3 font-semibold text-slate-800">
                                                                        {asset.name || asset.stockItem?.name || 'N/A'}
                                                                    </td>

                                                                    <td className="px-4 py-3">
                                                                        {asset.brand || asset.stockItem?.brand || 'N/A'}
                                                                    </td>

                                                                    <td className="px-4 py-3">
                                                                        {asset.model || asset.stockItem?.model || 'N/A'}
                                                                    </td>

                                                                    <td className="px-4 py-3 font-semibold text-blue-700 whitespace-nowrap">
                                                                        {asset.assetId || 'N/A'}
                                                                    </td>

                                                                    <td className="px-4 py-3">
                                                                        {asset.serialNumber || 'N/A'}
                                                                    </td>

                                                                    <td className="px-4 py-3">
                                                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${getStatusStyle(asset.status)}`}>
                                                                            {asset.status}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>

                                        {/* RECEIVER INFORMATION */}
                                        <div className="mb-6">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-base font-bold text-blue-800">
                                                    Room Receiver Information
                                                </h3>

                                                <span className="text-xs text-slate-400">
                                                    {receivers.length} receiver(s)
                                                </span>
                                            </div>

                                            {receivers.length === 0 ? (
                                                <div className="bg-slate-50 rounded-xl p-6 text-center text-sm text-slate-500">
                                                    No receiver information available for this room.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-blue-50 text-blue-900">
                                                            <tr>
                                                                <th className="px-4 py-3">#</th>
                                                                <th className="px-4 py-3">Receiver Name</th>
                                                                <th className="px-4 py-3">Employee ID</th>
                                                                <th className="px-4 py-3">Designation</th>
                                                                <th className="px-4 py-3">Phone</th>
                                                            </tr>
                                                        </thead>

                                                        <tbody className="divide-y divide-slate-100">
                                                            {receivers.map((receiver, index) => (
                                                                <tr key={`${receiver.employeeId || receiver.name}-${index}`}>
                                                                    <td className="px-4 py-3">{index + 1}</td>

                                                                    <td className="px-4 py-3 font-semibold text-slate-800">
                                                                        {receiver.name || 'N/A'}
                                                                    </td>

                                                                    <td className="px-4 py-3">
                                                                        {receiver.employeeId || 'N/A'}
                                                                    </td>

                                                                    <td className="px-4 py-3">
                                                                        {receiver.designation || 'N/A'}
                                                                    </td>

                                                                    <td className="px-4 py-3">
                                                                        {receiver.phone || 'N/A'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap justify-end gap-3">
                                            <button
                                                onClick={() => handlePrintDetails(room)}
                                                className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg"
                                            >
                                                🖨 Print Details
                                            </button>

                                            <button
                                                onClick={() => setSelectedDetails(null)}
                                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-lg"
                                            >
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoomInventory;
