/* =====================================================
   UNIBUS — Driver Dashboard Logic
===================================================== */

let user = null;
let socket = null;
let allTrips = [];
let allBuses = [];
let allRoutes = [];
let driverProfile = null;
let activeTripId = null;

// GPS broadcasting state
let gpsWatchId = null;
let gpsIntervalId = null;

const idsMatch = (a, b) => a && b && String(a) === String(b);

document.addEventListener('DOMContentLoaded', async () => {
    user = await checkAuth();
    if (!user) return;

    document.getElementById('userName').textContent = user.name || 'Driver';
    document.getElementById('userRole').textContent = user.role || 'driver';
    document.getElementById('userAvatar').textContent = (user.name || 'D').charAt(0).toUpperCase();
    document.getElementById('welcomeName').textContent = user.name?.split(' ')[0] || 'Driver';

    const today = new Date();
    document.getElementById('welcomeDate').textContent = today.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

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

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        stopGpsBroadcast();
        try { await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' }); } catch {}
        window.location.href = '/login.html';
    });

    // Modal buttons
    document.getElementById('cancelStartBtn')?.addEventListener('click', closeStartModal);
    document.getElementById('cancelEndBtn')?.addEventListener('click', closeEndModal);
    document.getElementById('confirmStartBtn')?.addEventListener('click', startTrip);
    document.getElementById('confirmEndBtn')?.addEventListener('click', endTrip);
    document.getElementById('startModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'startModal') closeStartModal();
    });
    document.getElementById('endModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'endModal') closeEndModal();
    });

    // ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeStartModal(); closeEndModal(); }
    });

    // Load data
    await Promise.all([loadBuses(), loadRoutes(), loadMyTrips()]);
    renderNotifications();
    initSocket();
    restoreGpsState();

    // Update greeting
    const driver = driverProfile || user;
    const busName = driver?.assignedBus
        ? (allBuses.find(b => idsMatch(b._id, driver.assignedBus))?.busNumber || '—')
        : '—';
    document.getElementById('chipBus').innerHTML = `<i class="fas fa-bus"></i> ${escapeHtml(busName)}`;
    document.getElementById('chipRoute').innerHTML = `<i class="fas fa-route"></i> View Route`;
    document.getElementById('welcomeSubtitle').textContent =
        `You have ${allTrips.length} trip${allTrips.length !== 1 ? 's' : ''} scheduled today.`;
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
        driverProfile = data.user;
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

        // Filter: today's trips where driver matches
        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const myTrips = all.filter(t =>
            idsMatch(t.driver, user.id) &&
            (t.day === todayName || !t.day)
        );

        // If driver has no trips assigned, show a friendly message
        allTrips = myTrips;
        console.log('✅ My trips today:', allTrips.length);

        renderTrips();
        updateStats();
    } catch (err) {
        console.error('loadMyTrips:', err);
        allTrips = [];
        renderTrips();
        updateStats();
    }
}

/* =====================================================
   RENDER
===================================================== */
function renderTrips() {
    const container = document.getElementById('tripsList');
    const countEl = document.getElementById('tripCount');

    countEl.textContent = `${allTrips.length} trip${allTrips.length !== 1 ? 's' : ''}`;

    if (allTrips.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bus-slash"></i>
                <h3>No trips assigned for today</h3>
                <p>Check back later or contact the administrator.</p>
            </div>`;
        return;
    }

    // Sort by departure time
    allTrips.sort((a, b) => (a.departureTime || '').localeCompare(b.departureTime || ''));

    container.innerHTML = allTrips.map(trip => renderTripCard(trip)).join('');
}

function renderTripCard(trip) {
    const bus = allBuses.find(b => idsMatch(b._id, trip.bus?._id || trip.bus));
    const route = allRoutes.find(r => idsMatch(r._id, trip.route?._id || trip.route));
    const busName = bus?.busNumber || trip.bus?.busNumber || '—';
    const routeName = route?.name || trip.route?.name || '—';
    const capacity = bus?.capacity || 40;
    const booked = capacity - (trip.availableSeats || 0);
    const tripId = `TR-${trip._id.slice(-6).toUpperCase()}`;
    const status = trip.status || 'scheduled';
    const isActive = status === 'in-progress';
    const isCompleted = status === 'completed';
    const isCancelled = status === 'cancelled';

    const statusMeta = {
        scheduled:   { label: 'Scheduled',   cls: 'scheduled', icon: 'fa-circle' },
        'in-progress': { label: 'Active',    cls: 'in-progress', icon: 'fa-circle' },
        completed:   { label: 'Completed',   cls: 'completed', icon: 'fa-check-circle' },
        cancelled:   { label: 'Cancelled',   cls: 'cancelled', icon: 'fa-times-circle' },
        delayed:     { label: 'Delayed',     cls: 'delayed',   icon: 'fa-clock' },
    }[status] || { label: status, cls: 'scheduled', icon: 'fa-circle' };

    let actionsHtml = '';

    if (isActive) {
        actionsHtml = `
            <button class="trip-btn end" onclick="openEndModal('${trip._id}')">
                <i class="fas fa-stop"></i> End Trip
            </button>
            <button class="trip-btn view" onclick="viewPassengers('${trip._id}')">
                <i class="fas fa-users"></i> Passengers (${booked})
            </button>
        `;
    } else if (isCompleted || isCancelled) {
        actionsHtml = `
            <button class="trip-btn view" onclick="viewPassengers('${trip._id}')">
                <i class="fas fa-users"></i> Passengers (${booked})
            </button>
        `;
    } else {
        // Scheduled
        actionsHtml = `
            <button class="trip-btn start" onclick="openStartModal('${trip._id}')">
                <i class="fas fa-play"></i> Start Trip
            </button>
            <button class="trip-btn view" onclick="viewPassengers('${trip._id}')">
                <i class="fas fa-users"></i> Passengers (${booked})
            </button>
        `;
    }

    return `
        <div class="trip-card ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}">
            <div class="trip-header">
                <span class="trip-id"><i class="fas fa-hashtag"></i>${tripId}</span>
                <span class="trip-status-badge ${statusMeta.cls}">
                    ${isActive ? '<span class="dot"></span>' : `<i class="fas ${statusMeta.icon}"></i>`}
                    ${statusMeta.label}
                </span>
            </div>

            ${isActive ? `
                <div class="live-badge">
                    <span class="live-dot"></span>
                    Broadcasting GPS
                </div>
            ` : ''}

            <div class="trip-info">
                <div class="trip-info-item">
                    <div class="trip-info-icon"><i class="fas fa-clock"></i></div>
                    <div class="trip-info-text">
                        <small>Departure</small>
                        <strong>${formatTime(trip.departureTime)}</strong>
                    </div>
                </div>
                <div class="trip-info-item">
                    <div class="trip-info-icon"><i class="fas fa-flag-checkered"></i></div>
                    <div class="trip-info-text">
                        <small>Arrival</small>
                        <strong>${formatTime(trip.arrivalTime)}</strong>
                    </div>
                </div>
                <div class="trip-info-item">
                    <div class="trip-info-icon"><i class="fas fa-bus"></i></div>
                    <div class="trip-info-text">
                        <small>Bus</small>
                        <strong>${escapeHtml(busName)}</strong>
                    </div>
                </div>
                <div class="trip-info-item">
                    <div class="trip-info-icon"><i class="fas fa-route"></i></div>
                    <div class="trip-info-text">
                        <small>Route</small>
                        <strong>${escapeHtml(routeName)}</strong>
                    </div>
                </div>
            </div>

            <div class="trip-actions">
                ${actionsHtml}
            </div>
        </div>
    `;
}

function updateStats() {
    const assigned = allTrips.length;
    const completed = allTrips.filter(t => t.status === 'completed').length;
    const remaining = allTrips.filter(t => t.status === 'scheduled').length;
    const passengers = allTrips.reduce((sum, t) => {
        const bus = allBuses.find(b => idsMatch(b._id, t.bus?._id || t.bus));
        const capacity = bus?.capacity || 40;
        return sum + (capacity - (t.availableSeats || 0));
    }, 0);

    document.getElementById('statAssigned').textContent = assigned;
    document.getElementById('statCompleted').textContent = completed;
    document.getElementById('statRemaining').textContent = remaining;
    document.getElementById('statPassengers').textContent = passengers;
}

/* =====================================================
   START TRIP
===================================================== */
window.openStartModal = function (tripId) {
    const trip = allTrips.find(t => t._id === tripId);
    if (!trip) return;

    activeTripId = tripId;
    const bus = allBuses.find(b => idsMatch(b._id, trip.bus?._id || trip.bus));
    const route = allRoutes.find(r => idsMatch(r._id, trip.route?._id || trip.route));
    const capacity = bus?.capacity || 40;
    const booked = capacity - (trip.availableSeats || 0);

    document.getElementById('startTripId').textContent = `TR-${tripId.slice(-6).toUpperCase()}`;
    document.getElementById('startTripInfo').innerHTML = `
        <div><span>Route</span><strong>${escapeHtml(route?.name || '—')}</strong></div>
        <div><span>Bus</span><strong>${escapeHtml(bus?.busNumber || '—')}</strong></div>
        <div><span>Passengers</span><strong>${booked} / ${capacity}</strong></div>
        <div><span>Departure</span><strong>${formatTime(trip.departureTime)}</strong></div>
    `;

    document.getElementById('startModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closeStartModal() {
    document.getElementById('startModal').classList.remove('active');
    document.body.style.overflow = '';
    activeTripId = null;
}

async function startTrip() {
    if (!activeTripId) return;
    const tripId = activeTripId;
    const btn = document.getElementById('confirmStartBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';

    try {
        // Step 1 — Request GPS permission
        const position = await requestGpsPermission();

        // Step 2 — Call backend
        const res = await fetch(`/api/driver/trips/${tripId}/start`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to start trip');

        // Step 3 — Start GPS broadcasting
        startGpsBroadcast(tripId);

        // Step 4 — Update local state
        const idx = allTrips.findIndex(t => t._id === tripId);
        if (idx !== -1) allTrips[idx].status = 'in-progress';

        closeStartModal();
        renderTrips();
        updateStats();
        showToast('success', 'Trip started', 'GPS broadcasting is now live');
    } catch (err) {
        console.error('startTrip:', err);
        showToast('error', 'Failed to start', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* =====================================================
   END TRIP
===================================================== */
window.openEndModal = function (tripId) {
    const trip = allTrips.find(t => t._id === tripId);
    if (!trip) return;

    activeTripId = tripId;
    const bus = allBuses.find(b => idsMatch(b._id, trip.bus?._id || trip.bus));
    const route = allRoutes.find(r => idsMatch(r._id, trip.route?._id || trip.route));

    document.getElementById('endTripId').textContent = `TR-${tripId.slice(-6).toUpperCase()}`;
    document.getElementById('endTripInfo').innerHTML = `
        <div><span>Route</span><strong>${escapeHtml(route?.name || '—')}</strong></div>
        <div><span>Bus</span><strong>${escapeHtml(bus?.busNumber || '—')}</strong></div>
    `;

    document.getElementById('endModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closeEndModal() {
    document.getElementById('endModal').classList.remove('active');
    document.body.style.overflow = '';
    activeTripId = null;
}

async function endTrip() {
    if (!activeTripId) return;
    const tripId = activeTripId;
    const btn = document.getElementById('confirmEndBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ending...';

    try {
        // Stop GPS first
        stopGpsBroadcast();

        const res = await fetch(`/api/driver/trips/${tripId}/end`, {
            method: 'PUT',
            credentials: 'include',
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to end trip');

        const idx = allTrips.findIndex(t => t._id === tripId);
        if (idx !== -1) allTrips[idx].status = 'completed';

        closeEndModal();
        renderTrips();
        updateStats();
        showToast('success', 'Trip ended', 'GPS broadcasting stopped');
    } catch (err) {
        console.error('endTrip:', err);
        showToast('error', 'Failed to end', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* =====================================================
   VIEW PASSENGERS
===================================================== */
window.viewPassengers = function (tripId) {
    window.location.href = `/driver/passenger-list.html?tripId=${tripId}`;
};

/* =====================================================
   GPS HANDLING
===================================================== */
function requestGpsPermission() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('GPS is not supported on this device'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => resolve(position),
            (err) => {
                let msg = 'GPS permission denied';
                if (err.code === 1) msg = 'Please enable location access to start the trip';
                else if (err.code === 2) msg = 'GPS position unavailable';
                else if (err.code === 3) msg = 'GPS request timed out';
                reject(new Error(msg));
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

function startGpsBroadcast(tripId) {
    if (gpsWatchId !== null) stopGpsBroadcast();

    updateGpsStatus('active', 'Broadcasting');

    // Watch position continuously
    gpsWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            const speed = position.coords.speed || 0;

            // Emit via Socket.io
            if (socket && socket.connected) {
                socket.emit('update-location', {
                    tripId,
                    latitude,
                    longitude,
                    speed,
                });
            }

            // Also update via REST (fallback)
            fetch(`/api/tracking/trip/${tripId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ latitude, longitude }),
            }).catch(() => {});

        },
        (err) => {
            console.warn('GPS watch error:', err.message);
            updateGpsStatus('error', 'GPS Error');
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
}

function stopGpsBroadcast() {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }
    if (gpsIntervalId) {
        clearInterval(gpsIntervalId);
        gpsIntervalId = null;
    }
    updateGpsStatus('', 'GPS Off');
}

function updateGpsStatus(state, text) {
    const el = document.getElementById('gpsStatus');
    if (!el) return;
    el.className = 'gps-status' + (state ? ' ' + state : '');
    const t = el.querySelector('.text');
    if (t) t.textContent = text;
}

function restoreGpsState() {
    // If any trip is already in-progress when page loads, resume broadcasting
    const active = allTrips.find(t => t.status === 'in-progress');
    if (active) {
        console.log('Resuming GPS for active trip:', active._id);
        startGpsBroadcast(active._id);
    }
}

/* =====================================================
   SOCKET
===================================================== */
function initSocket() {
    if (typeof io === 'undefined') return;
    try {
        socket = io({ withCredentials: true });
        socket.on('connect', () => console.log('🔌 Driver socket connected'));
        socket.on('disconnect', () => console.log('🔌 Driver socket disconnected'));
    } catch (err) {
        console.warn('Socket init failed:', err);
    }
}

/* =====================================================
   NOTIFICATIONS (Placeholder)
===================================================== */
function renderNotifications() {
    const container = document.getElementById('notificationsList');
    const items = [];

    // Build from active bookings today
    allTrips.forEach(trip => {
        const bus = allBuses.find(b => idsMatch(b._id, trip.bus?._id || trip.bus));
        const capacity = bus?.capacity || 40;
        const booked = capacity - (trip.availableSeats || 0);
        if (booked > 0) {
            items.push({
                icon: 'fa-ticket-alt',
                cls: 'booking',
                title: `${booked} passenger${booked !== 1 ? 's' : ''} on TR-${trip._id.slice(-6).toUpperCase()}`,
                message: `Departure ${formatTime(trip.departureTime)}`,
                time: trip.updatedAt || trip.createdAt,
            });
        }
    });

    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding:30px 20px;">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications yet</p>
            </div>`;
        return;
    }

    container.innerHTML = items.slice(0, 5).map(n => `
        <div class="notification-item">
            <div class="notif-icon ${n.cls}"><i class="fas ${n.icon}"></i></div>
            <div class="notif-content">
                <h5>${escapeHtml(n.title)}</h5>
                <p>${escapeHtml(n.message)}</p>
                <span class="notif-time">${timeAgo(n.time)}</span>
            </div>
        </div>
    `).join('');
}

/* =====================================================
   UTILITIES
===================================================== */
function formatTime(time) {
    if (!time) return '—';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function timeAgo(date) {
    if (!date) return 'just now';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
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

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

window.addEventListener('beforeunload', () => {
    stopGpsBroadcast();
    if (socket) { try { socket.disconnect(); } catch {} }
});