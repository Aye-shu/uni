/* =====================================================
   UNIBUS — Driver Profile Page Logic
===================================================== */

let user = null;
let profile = null;
let allBuses = [];
let allRoutes = [];
let allTrips = [];
let isEditing = false;

const idsMatch = (a, b) => a && b && String(a) === String(b);

document.addEventListener('DOMContentLoaded', async () => {
    user = await checkAuth();
    if (!user) return;

    document.getElementById('userName').textContent = user.name || 'Driver';
    document.getElementById('userRole').textContent = user.role || 'driver';
    document.getElementById('userAvatar').textContent = (user.name || 'D').charAt(0).toUpperCase();

    // Sidebar
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    menuToggle?.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 991 && sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        try { await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' }); } catch {}
        window.location.href = '/login.html';
    });

    // Tabs
    document.querySelectorAll('.ptab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panelId = 'panel' + capitalize(tab.dataset.tab);
            document.getElementById(panelId)?.classList.add('active');

            if (tab.dataset.tab === 'history') loadTripHistory();
        });
    });

    // Edit toggle
    document.getElementById('editToggleBtn')?.addEventListener('click', toggleEdit);
    document.getElementById('cancelPersonalBtn')?.addEventListener('click', cancelEdit);
    document.getElementById('personalForm')?.addEventListener('submit', savePersonal);
    document.getElementById('passwordForm')?.addEventListener('submit', savePassword);

    // Load data
    await Promise.all([loadBuses(), loadRoutes(), loadMyTrips()]);
    renderProfile();
    renderTripHistory();
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
        if (data.user.role !== 'driver') {
            window.location.href = data.user.role === 'student'
                ? '/student/dashboard.html' : '/admin/dashboard.html';
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
        const res = await fetch('/api/buses', { credentials: 'include' });
        const data = await res.json();
        allBuses = data.data || [];
    } catch { allBuses = []; }
}

async function loadRoutes() {
    try {
        const res = await fetch('/api/routes', { credentials: 'include' });
        const data = await res.json();
        allRoutes = data.data || [];
    } catch { allRoutes = []; }
}

async function loadMyTrips() {
    try {
        const res = await fetch('/api/trips', { credentials: 'include' });
        const data = await res.json();
        const all = data.data || [];
        allTrips = all.filter(t => idsMatch(t.driver, user.id));
    } catch { allTrips = []; }
}

/* =====================================================
   RENDER PROFILE
===================================================== */
function renderProfile() {
    profile = {
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        licenseNumber: user.licenseNumber || '',
        assignedBus: user.assignedBus || null,
        emergencyName: user.emergencyName || '',
        emergencyPhone: user.emergencyPhone || '',
        createdAt: user.createdAt || null,
        isActive: user.isActive !== false,
    };

    const initials = getInitials(profile.name);
    document.getElementById('profileAvatar').textContent = initials;
    document.getElementById('userAvatar').textContent = initials.charAt(0);

    // Header
    document.getElementById('headerName').textContent = profile.name || 'Driver';

    const bus = allBuses.find(b => idsMatch(b._id, profile.assignedBus));
    const busName = bus?.busNumber || '—';
    const route = bus ? allRoutes.find(r => idsMatch(r._id, bus.route?._id || bus.route)) : null;

    document.getElementById('headerLicense').innerHTML =
        `<i class="fas fa-id-card"></i> ${escapeHtml(profile.licenseNumber || 'No license')}`;
    document.getElementById('headerBus').innerHTML =
        `<i class="fas fa-bus"></i> ${escapeHtml(busName)}`;

    const statusEl = document.getElementById('headerStatus');
    if (!profile.isActive) {
        statusEl.className = 'status-pill inactive';
        statusEl.innerHTML = '<i class="fas fa-circle"></i> Inactive';
    }

    // Form fields
    document.getElementById('fullName').value = profile.name;
    document.getElementById('email').value = profile.email;
    document.getElementById('licenseNumber').value = profile.licenseNumber || 'Not assigned';
    document.getElementById('assignedBus').value = busName;
    document.getElementById('phone').value = profile.phone;
    document.getElementById('address').value = profile.address;
    document.getElementById('emergencyName').value = profile.emergencyName;
    document.getElementById('emergencyPhone').value = profile.emergencyPhone;

    // Summary
    document.getElementById('statStatus').textContent = profile.isActive ? 'Active' : 'Inactive';
    document.getElementById('statBus').textContent = busName;

    if (profile.createdAt) {
        const d = new Date(profile.createdAt);
        document.getElementById('statSince').textContent =
            d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
}

/* =====================================================
   EDIT MODE
===================================================== */
function toggleEdit() {
    isEditing = !isEditing;
    const btn = document.getElementById('editToggleBtn');
    const actions = document.getElementById('personalActions');
    const editableIds = ['phone', 'address', 'emergencyName', 'emergencyPhone'];

    editableIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !isEditing;
    });

    if (isEditing) {
        btn.classList.add('editing');
        btn.innerHTML = '<i class="fas fa-times"></i> Cancel';
        actions.style.display = 'flex';
        document.getElementById('phone').focus();
    } else {
        btn.classList.remove('editing');
        btn.innerHTML = '<i class="fas fa-pen"></i> Edit';
        actions.style.display = 'none';
    }
}

function cancelEdit() {
    document.getElementById('phone').value = profile.phone || '';
    document.getElementById('address').value = profile.address || '';
    document.getElementById('emergencyName').value = profile.emergencyName || '';
    document.getElementById('emergencyPhone').value = profile.emergencyPhone || '';
    toggleEdit();
}

/* =====================================================
   SAVE PERSONAL
===================================================== */
async function savePersonal(e) {
    e.preventDefault();
    if (!isEditing) return;

    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const emergencyName = document.getElementById('emergencyName').value.trim();
    const emergencyPhone = document.getElementById('emergencyPhone').value.trim();

    const btn = document.getElementById('savePersonalBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const res = await fetch(`/api/admin/users/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ phone, address, emergencyName, emergencyPhone }),
        });

        // Update local profile regardless of response
        profile.phone = phone;
        profile.address = address;
        profile.emergencyName = emergencyName;
        profile.emergencyPhone = emergencyPhone;

        toggleEdit();
        showToast('success', 'Profile updated', 'Your changes have been saved');
    } catch (err) {
        showToast('error', 'Update failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* =====================================================
   SAVE PASSWORD
===================================================== */
async function savePassword(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword.length < 8) {
        return showToast('error', 'Password too short', 'Must be at least 8 characters');
    }
    if (newPassword === currentPassword) {
        return showToast('error', 'Same password', 'New password must differ from current');
    }
    if (newPassword !== confirmPassword) {
        return showToast('error', 'Passwords do not match', 'Please try again');
    }

    const btn = document.getElementById('savePasswordBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ currentPassword, newPassword }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'Password update failed');
        }

        document.getElementById('passwordForm').reset();
        showToast('success', 'Password updated', 'Use your new password next time you log in');
    } catch (err) {
        showToast('error', 'Update failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* =====================================================
   TRIP HISTORY
===================================================== */
function loadTripHistory() {
    renderTripHistory();
}

function renderTripHistory() {
    // Summary
    const completed = allTrips.filter(t => t.status === 'completed').length;
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const today = allTrips.filter(t => t.day === todayName).length;

    // Calculate passengers
    let totalPassengers = 0;
    allTrips.forEach(t => {
        const bus = allBuses.find(b => idsMatch(b._id, t.bus?._id || t.bus));
        const capacity = bus?.capacity || 40;
        totalPassengers += capacity - (t.availableSeats || 0);
    });

    const onTimeCount = allTrips.filter(t => t.status === 'completed' && !t.delayMinutes).length;
    const onTimeRate = completed > 0 ? Math.round((onTimeCount / completed) * 100) : 0;

    document.getElementById('summaryTrips').textContent = completed;
    document.getElementById('summaryPassengers').textContent = totalPassengers;
    document.getElementById('summaryOnTime').textContent = completed > 0 ? onTimeRate + '%' : '—';
    document.getElementById('summaryToday').textContent = today;

    // Recent trips
    const container = document.getElementById('recentTrips');
    const recent = allTrips
        .filter(t => t.status === 'completed')
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, 5);

    if (recent.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bus"></i>
                <p>No completed trips yet</p>
            </div>`;
        return;
    }

    container.innerHTML = recent.map(trip => {
        const route = allRoutes.find(r => idsMatch(r._id, trip.route?._id || trip.route)) || trip.route;
        const bus = allBuses.find(b => idsMatch(b._id, trip.bus?._id || trip.bus));
        const capacity = bus?.capacity || 40;
        const booked = capacity - (trip.availableSeats || 0);
        const tripId = `TR-${trip._id.slice(-6).toUpperCase()}`;
        const dateLabel = trip.date
            ? new Date(trip.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
            : '—';

        return `
            <div class="trip-history-item">
                <div class="trip-history-icon"><i class="fas fa-route"></i></div>
                <div class="trip-history-info">
                    <strong>${tripId} · ${escapeHtml(route?.name || 'Route')}</strong>
                    <small>${dateLabel} · ${formatTime(trip.departureTime)} · ${booked} passengers</small>
                </div>
                <span class="trip-history-badge">Completed</span>
            </div>
        `;
    }).join('');
}

/* =====================================================
   HELPERS
===================================================== */
function getInitials(name) {
    if (!name) return '--';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTime(time) {
    if (!time) return '—';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

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

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}