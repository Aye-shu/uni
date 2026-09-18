/* =====================================================
   UNIBUS — Manage Buses Page Logic
===================================================== */

let allBuses = [];
let filteredBuses = [];
let drivers = [];
let routes = [];
let editingId = null;
let deleteTargetId = null;
let user = null;

const STATUS_LABELS = {
    active: { label: 'Active', cls: 'active', icon: 'fa-circle' },
    maintenance: { label: 'Maintenance', cls: 'maintenance', icon: 'fa-circle' },
    inactive: { label: 'Idle', cls: 'inactive', icon: 'fa-circle' },
};

document.addEventListener('DOMContentLoaded', async () => {
    user = await checkAuth();
    if (!user) return;

    document.getElementById('userName').textContent = user.name || 'Admin';
    document.getElementById('userRole').textContent = user.role || 'admin';
    document.getElementById('userAvatar').textContent = (user.name || 'A').charAt(0).toUpperCase();

    // Sidebar toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    menuToggle?.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 991 &&
            sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !menuToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        try { await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' }); } catch {}
        window.location.href = '/login.html';
    });

    // Buttons
    document.getElementById('addBusBtn')?.addEventListener('click', () => openModal());
    document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('cancelBtn')?.addEventListener('click', closeModal);
    document.getElementById('busModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'busModal') closeModal();
    });

    document.getElementById('busForm')?.addEventListener('submit', saveBus);

    // Delete modal
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', deleteBus);
    document.getElementById('deleteModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'deleteModal') closeDeleteModal();
    });

    // Filters
    document.getElementById('searchInput')?.addEventListener('input', applyFilters);
    document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
    document.getElementById('driverFilter')?.addEventListener('change', applyFilters);
    document.getElementById('sortFilter')?.addEventListener('change', applyFilters);
    document.getElementById('resetFiltersBtn')?.addEventListener('click', resetFilters);

    // ESC closes modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeDeleteModal();
        }
    });

    // Load data
    await Promise.all([loadBuses(), loadDrivers(), loadRoutes()]);
});

/* =====================================================
   AUTH
===================================================== */
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/get-session', { credentials: 'include' });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!data.user) throw new Error();
        if (data.user.role !== 'admin') {
            window.location.href = data.user.role === 'student'
                ? '/student/dashboard.html'
                : '/driver/dashboard.html';
            return null;
        }
        return data.user;
    } catch {
        window.location.href = '/login.html';
        return null;
    }
}

/* =====================================================
   LOAD DATA
===================================================== */
async function loadBuses() {
    try {
        const res = await fetch('/api/admin/buses', { credentials: 'include' });
        const data = await res.json();
        allBuses = data.data || [];
        applyFilters();
    } catch (err) {
        console.error('Load buses error:', err);
        allBuses = [];
        applyFilters();
    }
}

async function loadDrivers() {
    try {
        const res = await fetch('/api/admin/users', { credentials: 'include' });
        const data = await res.json();
        const allUsers = data.data || [];
        drivers = allUsers.filter(u => u.role === 'driver');
        populateDriverDropdown();
    } catch {
        drivers = [];
    }
}

async function loadRoutes() {
    try {
        const res = await fetch('/api/routes', { credentials: 'include' });
        const data = await res.json();
        routes = data.data || [];
    } catch {
        routes = [];
    }
}

function populateDriverDropdown() {
    const select = document.getElementById('driverSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Unassigned</option>';

    if (drivers.length === 0) {
        select.innerHTML += '<option value="" disabled>No drivers available</option>';
        return;
    }

    drivers.forEach(driver => {
        const opt = document.createElement('option');
        opt.value = driver._id || driver.id;
        opt.textContent = `${driver.name || 'Driver'} (${driver.email || ''})`;
        select.appendChild(opt);
    });
}

/* =====================================================
   FILTERS
===================================================== */
function applyFilters() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const status = document.getElementById('statusFilter')?.value || 'all';
    const driverFilter = document.getElementById('driverFilter')?.value || 'all';
    const sortBy = document.getElementById('sortFilter')?.value || 'number';

    filteredBuses = allBuses.filter(bus => {
        // Search
        if (search) {
            const haystack = `${bus.busNumber || ''} ${bus.plateNumber || ''}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }

        // Status
        if (status !== 'all' && bus.status !== status) return false;

        // Driver
        if (driverFilter === 'assigned' && !bus.currentDriver) return false;
        if (driverFilter === 'unassigned' && bus.currentDriver) return false;

        return true;
    });

    // Sort
    filteredBuses.sort((a, b) => {
        switch (sortBy) {
            case 'capacity':
                return (b.capacity || 0) - (a.capacity || 0);
            case 'status':
                return (a.status || '').localeCompare(b.status || '');
            case 'number':
            default:
                return (a.busNumber || '').localeCompare(b.busNumber || '');
        }
    });

    renderTable();
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('driverFilter').value = 'all';
    document.getElementById('sortFilter').value = 'number';
    applyFilters();
}

/* =====================================================
   RENDER TABLE
===================================================== */
function renderTable() {
    const container = document.getElementById('busTableContainer');
    const countEl = document.getElementById('busCount');

    countEl.textContent = `${filteredBuses.length} ${filteredBuses.length === 1 ? 'bus' : 'buses'}`;

    if (filteredBuses.length === 0) {
        const isEmpty = allBuses.length === 0;
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bus"></i>
                <h3>${isEmpty ? 'No buses in your fleet' : 'No matching buses'}</h3>
                <p>${isEmpty
                    ? 'Start by adding your first bus to the fleet.'
                    : 'Try adjusting your search or filters.'}</p>
                ${isEmpty ? `
                    <button type="button" class="btn-add" onclick="document.getElementById('addBusBtn').click()">
                        <i class="fas fa-plus"></i> Add Your First Bus
                    </button>` : ''}
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="bus-table">
            <div class="bus-table-header">
                <span>Bus</span>
                <span>Plate</span>
                <span>Capacity</span>
                <span>Assigned Driver</span>
                <span>Status</span>
                <span style="text-align: right;">Actions</span>
            </div>
            ${filteredBuses.map(bus => renderRow(bus)).join('')}
        </div>
    `;
}

function renderRow(bus) {
    const status = STATUS_LABELS[bus.status] || STATUS_LABELS.inactive;
    const driver = findDriverName(bus.currentDriver);
    const capacity = bus.capacity || 0;

    return `
        <div class="bus-table-row" data-label-bus="${escapeHtml(bus.busNumber || '')}">
            <span class="bus-number">${escapeHtml(bus.busNumber || '—')}</span>
            <span class="plate">${escapeHtml(bus.plateNumber || '—')}</span>
            <span class="capacity">${capacity}</span>
            <span class="driver ${driver === 'Unassigned' ? 'unassigned' : ''}">${escapeHtml(driver)}</span>
            <span><span class="status-pill ${status.cls}">
                <i class="fas ${status.icon}"></i> ${status.label}
            </span></span>
            <div class="row-actions">
                <button class="act-btn edit" title="Edit" onclick="editBus('${bus._id}')">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="act-btn delete" title="Delete" onclick="confirmDelete('${bus._id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

function findDriverName(driverId) {
    if (!driverId) return 'Unassigned';
    const driver = drivers.find(d => (d._id || d.id) === driverId);
    return driver ? driver.name : 'Unassigned';
}

/* =====================================================
   MODAL — OPEN / CLOSE
===================================================== */
function openModal(bus = null) {
    editingId = bus?._id || null;
    const title = document.getElementById('modalTitle');
    title.innerHTML = bus
        ? '<i class="fas fa-pen"></i> Edit Bus'
        : '<i class="fas fa-bus"></i> Add New Bus';

    document.getElementById('busForm').reset();
    clearErrors();

    // Clear features checkboxes
    document.querySelectorAll('.check-item input[type="checkbox"]').forEach(cb => cb.checked = false);

    if (bus) {
        document.getElementById('busNumber').value = bus.busNumber || '';
        document.getElementById('plateNumber').value = bus.plateNumber || '';
        document.getElementById('capacity').value = bus.capacity || '';
        document.getElementById('busType').value = bus.busType || 'standard';
        document.getElementById('driverSelect').value = bus.currentDriver || '';
        document.getElementById('busStatus').value = bus.status || 'active';
        document.getElementById('notes').value = bus.notes || '';

        // Features
        const features = bus.features || [];
        document.querySelectorAll('.check-item input[type="checkbox"]').forEach(cb => {
            cb.checked = features.includes(cb.value);
        });
    }

    document.getElementById('busModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('busNumber').focus(), 100);
}

function closeModal() {
    document.getElementById('busModal').classList.remove('active');
    document.body.style.overflow = '';
    editingId = null;
}

/* =====================================================
   EDIT / DELETE HANDLERS
===================================================== */
window.editBus = function (id) {
    const bus = allBuses.find(b => b._id === id);
    if (bus) openModal(bus);
};

window.confirmDelete = function (id) {
    const bus = allBuses.find(b => b._id === id);
    if (!bus) return;
    deleteTargetId = id;
    document.getElementById('deleteBusName').textContent =
        `${bus.busNumber || 'this bus'} (${bus.plateNumber || ''})`;
    document.getElementById('deleteModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    document.body.style.overflow = '';
    deleteTargetId = null;
}

/* =====================================================
   SAVE (Create / Update)
===================================================== */
async function saveBus(e) {
    e.preventDefault();
    clearErrors();

    const busNumber = document.getElementById('busNumber').value.trim();
    const plateNumber = document.getElementById('plateNumber').value.trim();
    const capacity = parseInt(document.getElementById('capacity').value, 10);
    const busType = document.getElementById('busType').value;
    const currentDriver = document.getElementById('driverSelect').value || null;
    const status = document.getElementById('busStatus').value;
    const notes = document.getElementById('notes').value.trim();

    const features = [];
    document.querySelectorAll('.check-item input[type="checkbox"]:checked').forEach(cb => {
        features.push(cb.value);
    });

    // Validation
    let hasError = false;
    if (!busNumber) { setError('busNumber', 'Bus number is required'); hasError = true; }
    if (!plateNumber) { setError('plateNumber', 'License plate is required'); hasError = true; }
    if (!capacity || capacity < 1 || capacity > 100) {
        setError('capacity', 'Capacity must be between 1 and 100');
        hasError = true;
    }

    // Check for duplicate bus number / plate (excluding self)
    if (!hasError) {
        const dup = allBuses.find(b =>
            b._id !== editingId &&
            (b.busNumber === busNumber || b.plateNumber === plateNumber)
        );
        if (dup) {
            if (dup.busNumber === busNumber) setError('busNumber', 'Bus number already exists');
            if (dup.plateNumber === plateNumber) setError('plateNumber', 'Plate number already exists');
            hasError = true;
        }
    }

    if (hasError) return;

    const btn = document.getElementById('saveBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const url = editingId ? `/api/admin/buses/${editingId}` : '/api/admin/buses';
        const method = editingId ? 'PUT' : 'POST';

        const body = {
            busNumber,
            plateNumber,
            capacity,
            availableSeats: capacity, // default full capacity
            busType,
            currentDriver,
            status,
            features,
            notes,
            isLive: false,
            currentLocation: { latitude: 0, longitude: 0 },
        };

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Save failed');

        if (editingId) {
            const idx = allBuses.findIndex(b => b._id === editingId);
            if (idx !== -1) allBuses[idx] = data.data;
            showToast('success', 'Bus updated', `${busNumber} has been updated`);
        } else {
            allBuses.push(data.data);
            showToast('success', 'Bus added', `${busNumber} has been added to the fleet`);
        }

        closeModal();
        applyFilters();
    } catch (err) {
        showToast('error', 'Save failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/* =====================================================
   DELETE
===================================================== */
async function deleteBus() {
    if (!deleteTargetId) return;
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    const bus = allBuses.find(b => b._id === deleteTargetId);
    const name = bus?.busNumber || 'Bus';

    try {
        const res = await fetch(`/api/admin/buses/${deleteTargetId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Delete failed');

        allBuses = allBuses.filter(b => b._id !== deleteTargetId);
        closeDeleteModal();
        applyFilters();
        showToast('success', 'Bus deleted', `${name} has been removed from the fleet`);
    } catch (err) {
        showToast('error', 'Delete failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* =====================================================
   ERRORS
===================================================== */
function setError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const err = document.getElementById('err' + capitalize(fieldId));
    if (input) input.classList.add('error');
    if (err) {
        err.textContent = message;
        err.classList.add('show');
    }
}

function clearErrors() {
    document.querySelectorAll('.form-field input, .form-field select').forEach(el => {
        el.classList.remove('error');
    });
    document.querySelectorAll('.field-error').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
    });
}

/* =====================================================
   TOASTS
===================================================== */
function showToast(type, title, message = '') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <div class="toast-content">
            <h5>${escapeHtml(title)}</h5>
            ${message ? `<p>${escapeHtml(message)}</p>` : ''}
        </div>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        toast.style.transition = '0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/* =====================================================
   UTILITIES
===================================================== */
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}