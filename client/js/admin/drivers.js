/* =====================================================
   UNIBUS — Manage Drivers Page Logic
===================================================== */

let allDrivers = [];
let filteredDrivers = [];
let allBuses = [];
let editingId = null;
let deleteTargetId = null;
let pwTargetId = null;
let user = null;

const STATUS_LABELS = {
    active: { label: 'Active', cls: 'active', icon: 'fa-circle' },
    inactive: { label: 'Inactive', cls: 'inactive', icon: 'fa-circle' },
};

document.addEventListener('DOMContentLoaded', async () => {
    user = await checkAuth();
    if (!user) return;

    document.getElementById('userName').textContent = user.name || 'Admin';
    document.getElementById('userRole').textContent = user.role || 'admin';
    document.getElementById('userAvatar').textContent = (user.name || 'A').charAt(0).toUpperCase();

    // Sidebar
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

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        try { await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' }); } catch {}
        window.location.href = '/login.html';
    });

    // Buttons
    document.getElementById('addDriverBtn')?.addEventListener('click', () => openModal());
    document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('cancelBtn')?.addEventListener('click', closeModal);
    document.getElementById('driverModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'driverModal') closeModal();
    });
    document.getElementById('driverForm')?.addEventListener('submit', saveDriver);

    // Password modal
    document.getElementById('closePwBtn')?.addEventListener('click', closePwModal);
    document.getElementById('cancelPwBtn')?.addEventListener('click', closePwModal);
    document.getElementById('pwModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'pwModal') closePwModal();
    });
    document.getElementById('pwForm')?.addEventListener('submit', resetPassword);

    // Delete modal
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', deleteDriver);
    document.getElementById('deleteModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'deleteModal') closeDeleteModal();
    });

    // Filters
    document.getElementById('searchInput')?.addEventListener('input', applyFilters);
    document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
    document.getElementById('busFilter')?.addEventListener('change', applyFilters);
    document.getElementById('sortFilter')?.addEventListener('change', applyFilters);
    document.getElementById('resetFiltersBtn')?.addEventListener('click', resetFilters);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closePwModal();
            closeDeleteModal();
        }
    });

    // Load
    await Promise.all([loadDrivers(), loadBuses()]);
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
   LOAD
===================================================== */
async function loadDrivers() {
    try {
        const res = await fetch('/api/admin/users', { credentials: 'include' });
        const data = await res.json();
        const allUsers = data.data || [];
        allDrivers = allUsers.filter(u => u.role === 'driver');
        applyFilters();
    } catch (err) {
        console.error('Load drivers error:', err);
        allDrivers = [];
        applyFilters();
    }
}

async function loadBuses() {
    try {
        const res = await fetch('/api/admin/buses', { credentials: 'include' });
        const data = await res.json();
        allBuses = data.data || [];
        populateBusDropdown();
    } catch {
        allBuses = [];
    }
}

function populateBusDropdown() {
    const select = document.getElementById('driverBus');
    if (!select) return;
    select.innerHTML = '<option value="">Unassigned</option>';

    allBuses.forEach(bus => {
        const opt = document.createElement('option');
        opt.value = bus._id;
        opt.textContent = `${bus.busNumber || 'Bus'} (${bus.plateNumber || ''})`;
        select.appendChild(opt);
    });
}

/* =====================================================
   FILTERS
===================================================== */
function applyFilters() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const status = document.getElementById('statusFilter')?.value || 'all';
    const busFilter = document.getElementById('busFilter')?.value || 'all';
    const sortBy = document.getElementById('sortFilter')?.value || 'name';

    filteredDrivers = allDrivers.filter(driver => {
        if (search) {
            const haystack = `${driver.name || ''} ${driver.email || ''} ${driver.phone || ''}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }

        if (status !== 'all') {
            const driverStatus = driver.isActive === false ? 'inactive' : 'active';
            if (driverStatus !== status) return false;
        }

        if (busFilter === 'assigned' && !driver.assignedBus) return false;
        if (busFilter === 'unassigned' && driver.assignedBus) return false;

        return true;
    });

    filteredDrivers.sort((a, b) => {
        switch (sortBy) {
            case 'created':
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            case 'name':
            default:
                return (a.name || '').localeCompare(b.name || '');
        }
    });

    renderTable();
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('busFilter').value = 'all';
    document.getElementById('sortFilter').value = 'name';
    applyFilters();
}

/* =====================================================
   RENDER
===================================================== */
function renderTable() {
    const container = document.getElementById('driverTableContainer');
    const countEl = document.getElementById('driverCount');

    countEl.textContent = `${filteredDrivers.length} ${filteredDrivers.length === 1 ? 'driver' : 'drivers'}`;

    if (filteredDrivers.length === 0) {
        const isEmpty = allDrivers.length === 0;
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-id-card"></i>
                <h3>${isEmpty ? 'No drivers in your fleet' : 'No matching drivers'}</h3>
                <p>${isEmpty
                    ? 'Start by creating your first driver account.'
                    : 'Try adjusting your search or filters.'}</p>
                ${isEmpty ? `
                    <button type="button" class="btn-add" onclick="document.getElementById('addDriverBtn').click()">
                        <i class="fas fa-user-plus"></i> Create Driver Account
                    </button>` : ''}
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="driver-table">
            <div class="driver-table-header">
                <span></span>
                <span>Name</span>
                <span>Email</span>
                <span>Phone</span>
                <span>Bus</span>
                <span>Status</span>
                <span style="text-align: right;">Actions</span>
            </div>
            ${filteredDrivers.map(d => renderRow(d)).join('')}
        </div>
    `;
}

function renderRow(driver) {
    const status = driver.isActive === false ? STATUS_LABELS.inactive : STATUS_LABELS.active;
    const initials = getInitials(driver.name);
    const busName = findBusName(driver.assignedBus);
    const isUnassigned = !driver.assignedBus;

    return `
        <div class="driver-table-row">
            <div class="driver-avatar">${escapeHtml(initials)}</div>
            <span class="driver-name">${escapeHtml(driver.name || '—')}</span>
            <span class="driver-email">${escapeHtml(driver.email || '—')}</span>
            <span class="driver-phone">${escapeHtml(driver.phone || '—')}</span>
            <span class="driver-bus ${isUnassigned ? 'unassigned' : ''}">${escapeHtml(busName)}</span>
            <span><span class="status-pill ${status.cls}">
                <i class="fas ${status.icon}"></i> ${status.label}
            </span></span>
            <div class="row-actions">
                <button class="act-btn edit" title="Edit" onclick="editDriver('${driver._id || driver.id}')">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="act-btn pw" title="Reset Password" onclick="openPwModal('${driver._id || driver.id}')">
                    <i class="fas fa-key"></i>
                </button>
                <button class="act-btn delete" title="Delete" onclick="confirmDelete('${driver._id || driver.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

function getInitials(name) {
    if (!name) return '--';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function findBusName(busId) {
    if (!busId) return 'Unassigned';
    const bus = allBuses.find(b => b._id === busId);
    return bus ? bus.busNumber : 'Unassigned';
}

/* =====================================================
   MODAL — OPEN / CLOSE
===================================================== */
function openModal(driver = null) {
    editingId = driver?._id || driver?.id || null;
    const title = document.getElementById('modalTitle');
    const pwSection = document.getElementById('passwordSection');

    if (driver) {
        title.innerHTML = '<i class="fas fa-pen"></i> Edit Driver';
        pwSection.style.display = 'none';
        document.getElementById('driverEmail').disabled = true;
    } else {
        title.innerHTML = '<i class="fas fa-user-plus"></i> Create Driver Account';
        pwSection.style.display = 'block';
        document.getElementById('driverEmail').disabled = false;
    }

    document.getElementById('driverForm').reset();
    clearErrors();

    if (driver) {
        document.getElementById('driverName').value = driver.name || '';
        document.getElementById('driverEmail').value = driver.email || '';
        document.getElementById('driverPhone').value = driver.phone || '';
        document.getElementById('driverLicense').value = driver.licenseNumber || '';
        document.getElementById('driverBus').value = driver.assignedBus || '';
        document.getElementById('driverStatus').value = driver.isActive === false ? 'inactive' : 'active';
    }

    document.getElementById('driverModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('driverName').focus(), 100);
}

function closeModal() {
    document.getElementById('driverModal').classList.remove('active');
    document.body.style.overflow = '';
    editingId = null;
}

/* =====================================================
   PW MODAL
===================================================== */
window.openPwModal = function (id) {
    const driver = allDrivers.find(d => (d._id || d.id) === id);
    if (!driver) return;
    pwTargetId = id;
    document.getElementById('pwDriverName').textContent = driver.name || 'this driver';
    document.getElementById('pwForm').reset();
    clearPwErrors();
    document.getElementById('pwModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closePwModal() {
    document.getElementById('pwModal').classList.remove('active');
    document.body.style.overflow = '';
    pwTargetId = null;
}

/* =====================================================
   EDIT / DELETE HANDLERS
===================================================== */
window.editDriver = function (id) {
    const driver = allDrivers.find(d => (d._id || d.id) === id);
    if (driver) openModal(driver);
};

window.confirmDelete = function (id) {
    const driver = allDrivers.find(d => (d._id || d.id) === id);
    if (!driver) return;
    deleteTargetId = id;
    document.getElementById('deleteDriverName').textContent =
        `${driver.name || 'this driver'} (${driver.email || ''})`;
    document.getElementById('deleteModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    document.body.style.overflow = '';
    deleteTargetId = null;
}

/* =====================================================
   SAVE DRIVER
===================================================== */
async function saveDriver(e) {
    e.preventDefault();
    clearErrors();

    const name = document.getElementById('driverName').value.trim();
    const email = document.getElementById('driverEmail').value.trim();
    const phone = document.getElementById('driverPhone').value.trim();
    const licenseNumber = document.getElementById('driverLicense').value.trim();
    const assignedBus = document.getElementById('driverBus').value || null;
    const status = document.getElementById('driverStatus').value;
    const isActive = status === 'active';

    let hasError = false;
    if (!name) { setError('driverName', 'Name is required'); hasError = true; }
    if (!email) { setError('driverEmail', 'Email is required'); hasError = true; }
    if (!phone) { setError('driverPhone', 'Phone is required'); hasError = true; }
    if (!licenseNumber) { setError('driverLicense', 'License is required'); hasError = true; }

    let password = null;
    if (!editingId) {
        password = document.getElementById('driverPassword').value;
        const confirm = document.getElementById('driverConfirm').value;
        if (!password) { setError('driverPassword', 'Password is required'); hasError = true; }
        if (password && password.length < 8) { setError('driverPassword', 'Min 8 characters'); hasError = true; }
        if (password !== confirm) { setError('driverConfirm', 'Passwords do not match'); hasError = true; }
    }

    if (hasError) return;

    const btn = document.getElementById('saveBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        if (editingId) {
            // Update
            const res = await fetch(`/api/admin/drivers/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, phone, licenseNumber, assignedBus, isActive }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Update failed');

            const idx = allDrivers.findIndex(d => (d._id || d.id) === editingId);
            if (idx !== -1) allDrivers[idx] = data.data;
            showToast('success', 'Driver updated', `${name} has been updated`);
        } else {
            // Create
            const res = await fetch('/api/admin/drivers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name, email, phone, licenseNumber,
                    assignedBus, isActive, password,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Create failed');

            allDrivers.push(data.data);
            showToast('success', 'Driver created', `${name} can now log in with the temp password`);
        }

        closeModal();
        applyFilters();
    } catch (err) {
        showToast('error', 'Save failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* =====================================================
   RESET PASSWORD
===================================================== */
async function resetPassword(e) {
    e.preventDefault();
    clearPwErrors();

    const newPw = document.getElementById('newPw').value;
    const confirmPw = document.getElementById('confirmPw').value;

    let hasError = false;
    if (!newPw || newPw.length < 8) { setPwError('newPw', 'Min 8 characters'); hasError = true; }
    if (newPw !== confirmPw) { setPwError('confirmPw', 'Passwords do not match'); hasError = true; }
    if (hasError) return;

    const btn = document.getElementById('resetPwBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';

    try {
        const res = await fetch(`/api/admin/drivers/${pwTargetId}/reset-password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password: newPw }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Reset failed');

        closePwModal();
        showToast('success', 'Password reset', 'Driver must use the new password next login');
    } catch (err) {
        showToast('error', 'Reset failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* =====================================================
   DELETE
===================================================== */
async function deleteDriver() {
    if (!deleteTargetId) return;
    const btn = document.getElementById('confirmDeleteBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    const driver = allDrivers.find(d => (d._id || d.id) === deleteTargetId);
    const name = driver?.name || 'Driver';

    try {
        const res = await fetch(`/api/admin/drivers/${deleteTargetId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Delete failed');

        allDrivers = allDrivers.filter(d => (d._id || d.id) !== deleteTargetId);
        closeDeleteModal();
        applyFilters();
        showToast('success', 'Driver deleted', `${name} has been removed`);
    } catch (err) {
        showToast('error', 'Delete failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* =====================================================
   HELPERS
===================================================== */
window.togglePw = function (fieldId, btn) {
    const input = document.getElementById(fieldId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        input.type = 'password';
        btn.innerHTML = '<i class="fas fa-eye"></i>';
    }
};

function setError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const err = document.getElementById('err' + capitalize(fieldId));
    if (input) input.classList.add('error');
    if (err) { err.textContent = message; err.classList.add('show'); }
}

function clearErrors() {
    document.querySelectorAll('#driverModal .form-field input, #driverModal .form-field select').forEach(el => {
        el.classList.remove('error');
    });
    document.querySelectorAll('#driverModal .field-error').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
    });
}

function setPwError(fieldId, message) {
    const err = document.getElementById('err' + capitalize(fieldId));
    if (err) { err.textContent = message; err.classList.add('show'); }
}

function clearPwErrors() {
    document.querySelectorAll('#pwModal .field-error').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
    });
}

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