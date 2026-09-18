/* =====================================================
   UNIBUS — My Trips Page Logic
===================================================== */

let user = null;
let socket = null;
let allTrips = [];
let filteredTrips = [];
let allBuses = [];
let allRoutes = [];
let currentFilter = 'today';
let searchQuery = '';
let routeFilter = 'all';
let statusFilter = 'all';
let sortBy = 'departure';
let activeTripId = null;

// GPS state
let gpsWatchId = null;

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
        stopGpsBroadcast();
        try { await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' }); } catch {}
        window.location.href = '/login.html';
    });

    // Filter tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            applyFilters();
        });
    });

    // Filters
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        applyFilters();
    });
    document.getElementById('routeFilter')?.addEventListener('change', (e) => {
        routeFilter = e.target.value;
        applyFilters();
    });
    document.getElementById('statusFilter')?.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        applyFilters();
    });
    document.getElementById('sortFilter')?.addEventListener('change', (e) => {
        sortBy = e.target.value;
        applyFilters();
    });
    document.getElementById('resetFiltersBtn')?.addEventListener('click', resetFilters);

    // Today button
    document.getElementById('todayBtn')?.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.tab-btn[data-filter="today"]')?.classList.add('active');
        currentFilter = 'today';
        applyFilters();
    });

    // Details modal
    document.getElementById('closeDetailsBtn')?.addEventListener('click', closeDetailsModal);
    document.getElementById('closeDetailsBtn2')?.addEventListener('click', closeDetailsModal);
    document.getElementById('detailsModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'detailsModal') closeDetailsModal();
    });

    // Start modal
    document.getElementById('cancelStartBtn')?.addEventListener('click', closeStartModal);
    document.getElementById('confirmStartBtn')?.addEventListener('click', startTrip);
    document.getElementById('startModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'startModal') closeStartModal();
    });

    // End modal
    document.getElementById('cancelEndBtn')?.addEventListener('click', closeEndModal);
    document.getElementById('confirmEndBtn')?.addEventListener('click', endTrip);
    document.getElementById('endModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'endModal') closeEndModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDetailsModal(); closeStartModal(); closeEndModal();
        }
    });

    // Load
    await Promise.all([loadBuses(), loadRoutes(), loadTrips()]);
    initSocket();
    restoreGpsState();
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
   LOAD
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
        populateRouteFilter();
    } catch { allRoutes = []; }
}

async function loadTrips() {
    try {
        const res = await fetch('/api/trips', { credentials: 'include' });
        const data = await res.json();
        const all = data.data || [];

        // Keep only trips assigned to this driver
        allTrips = all.filter(t => idsMatch(t.driver, user.id));

        console.log('✅ Loaded', allTrips.length, 'trips for this driver');

        updateCounts();
        applyFilters();
    } catch (err) {
        console.error('loadTrips:', err);
        allTrips = [];
        applyFilters();
    }
}

function populateRouteFilter() {
    const select = document.getElementById('routeFilter');
    if (!select) return;
    select.innerHTML = '<option value="all">All Routes</option>';
    allRoutes.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r._id;
        opt.textContent = r.name || r.code;
        select.appendChild(opt);
    });
}

/* =====================================================
   COUNTS
===================================================== */
function updateCounts() {
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    const today = allTrips.filter(t => t.day === todayName).length;
    const active = allTrips.filter(t => t.status === 'in-progress').length;
    const completed = allTrips.filter(t => t.status === 'completed').length;
    const cancelled = allTrips.filter(t => t.status === 'cancelled').length;
    const upcoming = allTrips.filter(t => {
        if (t.status !== 'scheduled') return false;
        if (t.day === todayName) return false;
        return true;
    }).length;

    document.getElementById('cntToday').textContent = today;
    document.getElementById('cntUpcoming').textContent = upcoming;
    document.getElementById('cntActive').textContent = active;
    document.getElementById('cntCompleted').textContent = completed;
    document.getElementById('cntCancelled').textContent = cancelled;
    document.getElementById('cntAll').textContent = allTrips.length;
}

/* =====================================================
   FILTERS
===================================================== */
function applyFilters() {
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    filteredTrips = allTrips.filter(t => {
        // Tab filter
        if (currentFilter === 'today' && t.day !== todayName) return false;
        if (currentFilter === 'active' && t.status !== 'in-progress') return false;
        if (currentFilter === 'completed' && t.status !== 'completed') return false;
        if (currentFilter === 'cancelled' && t.status !== 'cancelled') return false;
        if (currentFilter === 'upcoming') {
            if (t.status !== 'scheduled') return false;
            if (t.day === todayName) return false;
        }

        // Route filter
        if (routeFilter !== 'all') {
            const tripRouteId = t.route?._id || t.route;
            if (!idsMatch(tripRouteId, routeFilter)) return false;
        }

        // Status filter
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;

        // Search
        if (searchQuery) {
            const route = allRoutes.find(r => idsMatch(r._id, t.route?._id || t.route));
            const tripId = `TR-${t._id.slice(-6).toUpperCase()}`;
            const haystack = `${tripId} ${route?.name || ''} ${t.day || ''}`.toLowerCase();
            if (!haystack.includes(searchQuery)) return false;
        }

        return true;
    });

    // Sort
    filteredTrips.sort((a, b) => {
        switch (sortBy) {
            case 'date':
                return new Date(b.date || 0) - new Date(a.date || 0);
            case 'status':
                return (a.status || '').localeCompare(b.status || '');
            case 'departure':
            default:
                return (a.departureTime || '').localeCompare(b.departureTime || '');
        }
    });

    renderTrips();
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('routeFilter').value = 'all';
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('sortFilter').value = 'departure';
    searchQuery = '';
    routeFilter = 'all';
    statusFilter = 'all';
    sortBy = 'departure';
    applyFilters();
}

/* =====================================================
   RENDER
===================================================== */
function renderTrips() {
    const container = document.getElementById('tripsContainer');
    const countEl = document.getElementById('tripCount');

    countEl.textContent = `${filteredTrips.length} trip${filteredTrips.length === 1 ? '' : 's'}`;

    if (filteredTrips.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bus-slash"></i>
                <h3>No trips found</h3>
                <p>Try changing the date range or status filter.</p>
            </div>`;
        return;
    }

    container.innerHTML = filteredTrips.map(t => renderTripCard(t)).join('');
}

function renderTripCard(trip) {
    const bus = allBuses.find(b => idsMatch(b._id, trip.bus?._id || trip.bus)) || trip.bus;
    const route = allRoutes.find(r => idsMatch(r._id, trip.route?._id || trip.route)) || trip.route;

    const busName = bus?.busNumber || '—';
    const routeName = route?.name || '—';
    const capacity = bus?.capacity || 40;
    const booked = capacity - (trip.availableSeats || 0);
    const tripId = `TR-${trip._id.slice(-6).toUpperCase()}`;
    const status = trip.status || 'scheduled';
    const isActive = status === 'in-progress';
    const isCompleted = status === 'completed';
    const isCancelled = status === 'cancelled';

    const statusMeta = {
        scheduled:     { label: 'Scheduled', cls: 'scheduled',   icon: 'fa-circle' },
        'in-progress': { label: 'Active',    cls: 'in-progress', icon: 'fa-circle' },
        completed:     { label: 'Completed', cls: 'completed',   icon: 'fa-check-circle' },
        cancelled:     { label: 'Cancelled', cls: 'cancelled',   icon: 'fa-times-circle' },
        delayed:       { label: 'Delayed',   cls: 'delayed',     icon: 'fa-clock' },
    }[status] || { label: status, cls: 'scheduled', icon: 'fa-circle' };

    // Action buttons
    let actions = '';
    if (isActive) {
        actions = `
            <button class="trip-btn end" onclick="openEndModal('${trip._id}')">
                <i class="fas fa-stop"></i> End Trip
            </button>
            <button class="trip-btn view" onclick="viewPassengers('${trip._id}')">
                <i class="fas fa-users"></i> ${booked}
            </button>
            <button class="trip-btn view" onclick="viewDetails('${trip._id}')">
                <i class="fas fa-info-circle"></i> Details
            </button>
        `;
    } else if (isCompleted || isCancelled) {
        actions = `
            <button class="trip-btn view" onclick="viewPassengers('${trip._id}')">
                <i class="fas fa-users"></i> ${booked}
            </button>
            <button class="trip-btn view" onclick="viewDetails('${trip._id}')">
                <i class="fas fa-info-circle"></i> Details
            </button>
        `;
    } else {
        // Scheduled
        actions = `
            <button class="trip-btn start" onclick="openStartModal('${trip._id}')">
                <i class="fas fa-play"></i> Start Trip
            </button>
            <button class="trip-btn view" onclick="viewPassengers('${trip._id}')">
                <i class="fas fa-users"></i> ${booked}
            </button>
            <button class="trip-btn view" onclick="viewDetails('${trip._id}')">
                <i class="fas fa-info-circle"></i> Details
            </button>
        `;
    }

    const dateLabel = trip.date
        ? new Date(trip.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        : (trip.day || '—');

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
                    <div class="trip-info-icon"><i class="fas fa-calendar-day"></i></div>
                    <div class="trip-info-text">
                        <small>Date</small>
                        <strong>${escapeHtml(dateLabel)}</strong>
                    </div>
                </div>
                <div class="trip-info-item">
                    <div class="trip-info-icon"><i class="fas fa-clock"></i></div>
                    <div class="trip-info-text">
                        <small>Departure</small>
                        <strong>${formatTime(trip.departureTime)}</strong>
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
                ${actions}
            </div>
        </div>
    `;
}

/* =====================================================
   DETAILS MODAL
===================================================== */
window.viewDetails = function (tripId) {
    const trip = allTrips.find(t => t._id === tripId);
    if (!trip) return;

    const bus = allBuses.find(b => idsMatch(b._id, trip.bus?._id || trip.bus)) || trip.bus;
    const route = allRoutes.find(r => idsMatch(r._id, trip.route?._id || trip.route)) || trip.route;
    const capacity = bus?.capacity || 40;
    const booked = capacity - (trip.availableSeats || 0);
    const tripIdStr = `TR-${trip._id.slice(-6).toUpperCase()}`;
    const dateLabel = trip.date
        ? new Date(trip.date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
        : (trip.day || '—');

    const stops = route?.stops || [];
    const stopsHtml = stops.length > 0
        ? stops.map((s, i) => `
            <span class="stop-name">${escapeHtml(s.name || 'Stop ' + (i + 1))}</span>
            ${i < stops.length - 1 ? '<span class="arrow">→</span>' : ''}
        `).join('')
        : '<span style="color:var(--gray);">No stops defined</span>';

    const statusMeta = {
        scheduled:     { label: 'Scheduled', cls: 'scheduled' },
        'in-progress': { label: 'Active',    cls: 'in-progress' },
        completed:     { label: 'Completed', cls: 'completed' },
        cancelled:     { label: 'Cancelled', cls: 'cancelled' },
        delayed:       { label: 'Delayed',   cls: 'delayed' },
    }[trip.status] || { label: trip.status, cls: 'scheduled' };

    document.getElementById('detailsTitle').textContent = tripIdStr;
    document.getElementById('detailsBody').innerHTML = `
        <div class="detail-section-title">Trip Information</div>
        <div class="detail-row"><span>Date</span><strong>${escapeHtml(dateLabel)}</strong></div>
        <div class="detail-row"><span>Route</span><strong>${escapeHtml(route?.name || '—')}</strong></div>
        <div class="detail-row"><span>Direction</span><strong>${escapeHtml(trip.direction || 'outbound')}</strong></div>
        <div class="detail-row"><span>Departure</span><strong>${formatTime(trip.departureTime)}</strong></div>
        <div class="detail-row"><span>Arrival</span><strong>${formatTime(trip.arrivalTime)}</strong></div>

        <div class="detail-section-title">Bus & Passengers</div>
        <div class="detail-row"><span>Bus</span><strong>${escapeHtml(bus?.busNumber || '—')} (${capacity} seats)</strong></div>
        <div class="detail-row"><span>Booked</span><strong>${booked} / ${capacity}</strong></div>
        <div class="detail-row"><span>Status</span><strong>${statusMeta.label}</strong></div>

        <div class="detail-section-title">Stops</div>
        <div class="stops-chain">${stopsHtml}</div>

        ${trip.notes ? `
            <div class="detail-section-title">Notes</div>
            <p style="font-size:0.88rem;color:var(--gray);margin:0;">${escapeHtml(trip.notes)}</p>
        ` : ''}
    `;

    document.getElementById('detailsModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('active');
    document.body.style.overflow = '';
}

/* =====================================================
   START TRIP
===================================================== */
window.openStartModal = function (tripId) {
    const trip = allTrips.find(t => t._id === tripId);
    if (!trip) return;
    activeTripId = tripId;

    const bus = allBuses.find(b => idsMatch(b._id, trip.bus?._id || trip.bus)) || trip.bus;
    const route = allRoutes.find(r => idsMatch(r._id, trip.route?._id || trip.route)) || trip.route;
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
        const position = await requestGpsPermission();

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

        startGpsBroadcast(tripId);

        const idx = allTrips.findIndex(t => t._id === tripId);
        if (idx !== -1) allTrips[idx].status = 'in-progress';

        closeStartModal();
        updateCounts();
        applyFilters();
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

    const bus = allBuses.find(b => idsMatch(b._id, trip.bus?._id || trip.bus)) || trip.bus;
    const route = allRoutes.find(r => idsMatch(r._id, trip.route?._id || trip.route)) || trip.route;

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
        updateCounts();
        applyFilters();
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
   GPS
===================================================== */
function requestGpsPermission() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('GPS is not supported on this device'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            resolve,
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

    gpsWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            if (socket && socket.connected) {
                socket.emit('update-location', { tripId, latitude, longitude });
            }
            fetch(`/api/tracking/trip/${tripId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ latitude, longitude }),
            }).catch(() => {});
        },
        () => updateGpsStatus('error', 'GPS Error'),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
}

function stopGpsBroadcast() {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
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
    } catch (err) { console.warn('Socket init failed:', err); }
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

window.addEventListener('beforeunload', () => {
    stopGpsBroadcast();
    if (socket) { try { socket.disconnect(); } catch {} }
});