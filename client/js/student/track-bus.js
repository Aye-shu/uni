/* =====================================================
   UNIBUS — Track Bus Page Logic
   Leaflet map + Socket.io live updates + Driver reports
===================================================== */

let map = null;
let busMarker = null;
let routePolyline = null;
let stopMarkers = [];
let userStopMarkers = [];
let socket = null;
let currentTrip = null;
let currentBooking = null;
let user = null;
let busCoords = null;

document.addEventListener('DOMContentLoaded', async () => {
    // ---------- Auth ----------
    user = await checkAuth();
    if (!user) return;

    document.getElementById('userName').textContent = user.name || 'Student';
    document.getElementById('userRole').textContent = user.role || 'student';
    document.getElementById('userAvatar').textContent = (user.name || 'S').charAt(0).toUpperCase();

    // ---------- Sidebar toggle ----------
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

    // ---------- Logout ----------
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        try { await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' }); } catch {}
        window.location.href = '/login.html';
    });

    // ---------- Buttons ----------
    document.getElementById('recenterBtn')?.addEventListener('click', recenterMap);
    document.getElementById('refreshBtn')?.addEventListener('click', refreshLocation);
    document.getElementById('reportBtn')?.addEventListener('click', () => {
        showToast('info', 'Coming soon', 'Report Problem page will be available soon.');
    });
    document.getElementById('fullscreenBtn')?.addEventListener('click', toggleFullscreen);

    // ---------- Load data ----------
    await loadTripContext();
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
        if (data.user.role !== 'student') {
            window.location.href = data.user.role === 'driver'
                ? '/driver/dashboard.html'
                : '/admin/dashboard.html';
            return null;
        }
        return data.user;
    } catch {
        window.location.href = '/login.html';
        return null;
    }
}

/* =====================================================
   LOAD TRIP CONTEXT
===================================================== */
async function loadTripContext() {
    const params = new URLSearchParams(window.location.search);
    let tripId = params.get('tripId');

    try {
        if (!tripId) {
            const res = await fetch('/api/bookings', { credentials: 'include' });
            const data = await res.json();
            const bookings = data.data || [];
            const active = bookings.find(b => b.status === 'confirmed' && b.trip?.status === 'in-progress');
            const upcoming = bookings.find(b => b.status === 'confirmed');
            currentBooking = active || upcoming;
            if (currentBooking) {
                tripId = currentBooking.trip?._id || currentBooking.trip;
            }
        } else {
            const res = await fetch('/api/bookings', { credentials: 'include' });
            const data = await res.json();
            currentBooking = (data.data || []).find(b => {
                const tId = b.trip?._id || b.trip;
                return String(tId) === String(tripId);
            });
        }

        if (!tripId) {
            showEmptyState();
            return;
        }

        const tripRes = await fetch(`/api/trips/${tripId}`, { credentials: 'include' });
        const tripData = await tripRes.json();
        if (!tripRes.ok) throw new Error(tripData.message || 'Trip not found');

        currentTrip = tripData.data;
        console.log('✅ Trip loaded:', currentTrip);

        renderTripInfo();
        initMap();
        drawRoute();
        drawStops();
        await refreshLocation();
        initSocket(tripId);

        document.getElementById('mapLoading').style.display = 'none';
    } catch (err) {
        console.error('❌ Load context error:', err);
        showToast('error', 'Unable to load trip', err.message);
        showEmptyState();
    }
}

function showEmptyState() {
    document.getElementById('mapLoading').style.display = 'none';
    document.getElementById('mapEmpty').style.display = 'flex';
}

/* =====================================================
   RENDER INFO PANEL
===================================================== */
function renderTripInfo() {
    if (!currentTrip) return;
    const t = currentTrip;
    const bus = t.bus || {};
    const route = t.route || {};

    document.getElementById('infoBus').textContent = bus.busNumber || '—';
    document.getElementById('infoRoute').textContent = route.name || '—';
    document.getElementById('infoDirection').textContent = t.direction || '—';
    document.getElementById('infoDeparture').textContent = formatTime(t.departureTime);
    document.getElementById('infoSeat').textContent =
        currentBooking?.seatNumber ? `Seat ${currentBooking.seatNumber}` : '—';

    const badge = document.getElementById('statusBadge');
    const status = t.status || 'scheduled';
    badge.className = 'status-badge';
    if (status === 'in-progress') { badge.classList.add('in-progress'); badge.textContent = 'Live'; }
    else if (status === 'delayed') { badge.classList.add('delayed'); badge.textContent = `Delayed ${t.delayMinutes || 0}m`; }
    else if (status === 'completed') { badge.classList.add('completed'); badge.textContent = 'Completed'; }
    else { badge.classList.add('ontime'); badge.textContent = 'On Time'; }

    if (t.status === 'delayed' && t.delayMinutes > 0) {
        document.getElementById('alertBanner').style.display = 'flex';
        document.getElementById('alertText').textContent =
            `${t.delayReason || 'Delay'}: ${t.delayMinutes} min delay reported.`;
    }

    document.getElementById('infoEta').textContent = 'Calculating...';
}

/* =====================================================
   MAP
===================================================== */
function initMap() {
    const stops = currentTrip.route?.stops || [];
    let center = [23.8103, 90.4125];

    if (currentTrip.currentLocation?.latitude && currentTrip.currentLocation.latitude !== 0) {
        center = [currentTrip.currentLocation.latitude, currentTrip.currentLocation.longitude];
    } else {
        const first = stops.find(s => s && s.location && s.location.latitude);
        if (first) center = [first.location.latitude, first.location.longitude];
    }

    map = L.map('map').setView(center, 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '© OpenStreetMap · © CARTO',
    }).addTo(map);
}

/* =====================================================
   ROUTE + STOPS
===================================================== */
function drawRoute() {
    const stops = (currentTrip.route?.stops || [])
        .filter(s => s && s.location && s.location.latitude && s.location.longitude);
    if (stops.length < 2) return;

    const coords = stops.map(s => [s.location.latitude, s.location.longitude]);
    routePolyline = L.polyline(coords, {
        color: '#f97316', weight: 5, opacity: 0.7,
    }).addTo(map);
    map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
}

function drawStops() {
    const stops = currentTrip.route?.stops || [];
    stopMarkers.forEach(m => map.removeLayer(m));
    userStopMarkers.forEach(m => map.removeLayer(m));
    stopMarkers = []; userStopMarkers = [];

    const userStopId = currentBooking?.pickupStop?._id || currentBooking?.pickupStop;
    const timelineEl = document.getElementById('progressTimeline');
    let timelineHtml = '';

    if (!stops.length) {
        timelineEl.innerHTML = '<div class="timeline-loading">No stops available.</div>';
        return;
    }

    stops.forEach((stop, idx) => {
        if (!stop) return;
        const isUser = userStopId && String(stop._id) === String(userStopId);
        const cls = isUser ? 'stop-marker user-stop' : 'stop-marker';

        if (stop.location?.latitude) {
            const marker = L.marker([stop.location.latitude, stop.location.longitude], {
                icon: L.divIcon({ className: '', html: `<div class="${cls}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] }),
            }).addTo(map);
            marker.bindPopup(`<strong>${escapeHtml(stop.name)}</strong>`);
            if (isUser) userStopMarkers.push(marker); else stopMarkers.push(marker);
        }

        timelineHtml += `
            <div class="timeline-item ${idx === 0 ? 'completed' : ''} ${isUser ? 'user-stop' : ''}">
                <div class="timeline-dot"><i class="fas fa-${idx === 0 ? 'check' : 'map-marker-alt'}"></i></div>
                <div class="timeline-content">
                    <strong>${escapeHtml(stop.name || 'Stop ' + (idx + 1))}${isUser ? ' (Your stop)' : ''}</strong>
                    <small>Stop ${idx + 1}</small>
                </div>
            </div>`;
    });
    timelineEl.innerHTML = timelineHtml;
}

/* =====================================================
   BUS MARKER
===================================================== */
function updateBusMarker(lat, lng) {
    if (!lat || !lng || !map) return;
    const ll = [lat, lng];

    if (!busMarker) {
        busMarker = L.marker(ll, {
            icon: L.divIcon({
                className: '', html: `<div class="bus-marker-icon">🚌</div>`,
                iconSize: [44, 44], iconAnchor: [22, 22],
            }),
            zIndexOffset: 1000,
        }).addTo(map);
    } else {
        busMarker.setLatLng(ll);
    }
    busCoords = { lat, lng };
    updateEta();
}

/* =====================================================
   REFRESH
===================================================== */
async function refreshLocation() {
    try {
        const tripId = currentTrip?._id;
        if (!tripId) return { live: false };

        const res = await fetch(`/api/tracking/trip/${tripId}`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            const loc = data.data?.location || data.data?.currentLocation;
            if (loc && loc.latitude && loc.longitude && (loc.latitude !== 0 || loc.longitude !== 0)) {
                updateBusMarker(loc.latitude, loc.longitude);
                return { live: true };
            }
        }

        const stops = currentTrip?.route?.stops || [];
        const first = stops.find(s => s && s.location && s.location.latitude);
        if (first) {
            updateBusMarker(first.location.latitude, first.location.longitude);
        }
        return { live: false };
    } catch (err) {
        console.error('Refresh error:', err);
        const stops = currentTrip?.route?.stops || [];
        const first = stops.find(s => s && s.location && s.location.latitude);
        if (first) updateBusMarker(first.location.latitude, first.location.longitude);
        return { live: false };
    }
}

/* =====================================================
   ETA
===================================================== */
function updateEta() {
    if (!busCoords || !currentTrip) return;
    const userStopId = currentBooking?.pickupStop?._id || currentBooking?.pickupStop;
    const stops = currentTrip.route?.stops || [];
    let target = stops.find(s => s && String(s._id) === String(userStopId)) || stops[stops.length - 1];
    if (!target?.location?.latitude) {
        document.getElementById('infoEta').textContent = '—';
        return;
    }
    const km = haversine(busCoords.lat, busCoords.lng, target.location.latitude, target.location.longitude);
    const mins = Math.max(1, Math.round((km / 25) * 60));
    const eta = new Date(Date.now() + mins * 60000);
    document.getElementById('infoEta').textContent =
        `${eta.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · ${mins} min${mins !== 1 ? 's' : ''} away`;
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, toRad = d => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/* =====================================================
   SOCKET — with driver report handling
===================================================== */
function initSocket(tripId) {
    if (typeof io === 'undefined') {
        updateConnectionStatus('disconnected', 'Offline');
        return;
    }
    try {
        socket = io({ withCredentials: true });

        socket.on('connect', () => {
            updateConnectionStatus('connected', 'Live');
            console.log('🔌 Socket connected');
            socket.emit('join-trip', tripId);
        });

        socket.on('disconnect', () => {
            updateConnectionStatus('disconnected', 'Disconnected');
        });

        // ---------- Location updates ----------
        socket.on('location-updated', (d) => {
            if (String(d.tripId) === String(tripId) && d.latitude && d.longitude)
                updateBusMarker(d.latitude, d.longitude);
        });

        // ---------- Trip status change ----------
        socket.on('trip-status-changed', (data) => {
            if (String(data.tripId) !== String(tripId)) return;

            console.log('📡 Trip status changed:', data);

            if (data.status === 'completed') {
                showToast('info', 'Trip completed', 'The bus has finished its trip.');
                hideAlertBanner();
            } else if (data.status === 'delayed') {
                showAlertBanner(
                    `${data.delayReason || 'Driver reported a delay'} — checking details...`,
                    'warning'
                );
            }

            if (currentTrip) {
                currentTrip.status = data.status;
                renderTripInfo();
            }
        });

        // ---------- NEW: Rich driver report ----------
        socket.on('driver-report-received', (data) => {
            if (String(data.tripId) !== String(tripId)) return;

            console.log('📢 Driver report received:', data);

            const typeLabel = {
                traffic:   'Traffic jam',
                breakdown: 'Vehicle breakdown',
                accident:  'Accident',
                passenger: 'Passenger issue',
                weather:   'Bad weather',
                other:     'Issue',
            }[data.issueType] || 'Delay';

            const delayText = data.delayMinutes > 0
                ? ` — approx. ${data.delayMinutes} min delay`
                : '';

            const severityClass = data.severity === 'high' ? 'danger'
                : data.severity === 'medium' ? 'warning'
                : 'info';

            showAlertBanner(
                `${typeLabel}${delayText}${data.description ? ': ' + data.description : ''}`,
                severityClass
            );

            showToast(
                data.severity === 'high' ? 'error' : 'info',
                `Driver reported: ${typeLabel}`,
                data.description || `${data.delayMinutes} min delay expected`
            );

            addNotificationToList({
                title: `Driver: ${typeLabel}`,
                message: data.description || `Expected delay: ${data.delayMinutes} minutes`,
                timestamp: new Date(),
            });
        });

    } catch (err) {
        console.warn('Socket init failed:', err);
        updateConnectionStatus('disconnected', 'Offline');
    }
}

function updateConnectionStatus(state, text) {
    const el = document.getElementById('connectionStatus');
    if (!el) return;
    el.className = 'connection-status ' + state;
    const t = el.querySelector('.text');
    if (t) t.textContent = text;
}

/* =====================================================
   ALERT BANNER HELPERS
===================================================== */
function showAlertBanner(message, severity = 'warning') {
    const banner = document.getElementById('alertBanner');
    const textEl = document.getElementById('alertText');
    if (!banner || !textEl) return;

    textEl.textContent = message;

    banner.className = 'alert-banner';
    if (severity === 'danger') {
        banner.classList.add('danger');
    } else if (severity === 'info') {
        banner.classList.add('info');
    }

    banner.style.display = 'flex';

    if (severity !== 'danger') {
        if (window._alertTimeout) clearTimeout(window._alertTimeout);
        window._alertTimeout = setTimeout(() => {
            banner.style.display = 'none';
        }, 20000);
    }
}

function hideAlertBanner() {
    const banner = document.getElementById('alertBanner');
    if (banner) banner.style.display = 'none';
    if (window._alertTimeout) {
        clearTimeout(window._alertTimeout);
        window._alertTimeout = null;
    }
}

function addNotificationToList(notif) {
    const list = document.getElementById('notificationsList') ||
                 document.getElementById('notifList');
    if (!list) return;

    const item = document.createElement('div');
    item.className = 'notification-item';
    item.innerHTML = `
        <div class="notif-icon alert">
            <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div class="notif-content">
            <h5>${escapeHtml(notif.title)}</h5>
            <p>${escapeHtml(notif.message)}</p>
            <span class="notif-time">just now</span>
        </div>`;
    list.prepend(item);
}

/* =====================================================
   MAP HELPERS
===================================================== */
function recenterMap() {
    if (!map) {
        showToast('error', 'Map not ready', 'Please wait for the map to load.');
        return;
    }
    if (busCoords) {
        map.setView([busCoords.lat, busCoords.lng], 15, { animate: true });
        showToast('success', 'Recentered', 'Map centered on the bus.');
    } else if (routePolyline) {
        map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
        showToast('success', 'Recentered', 'Map fitted to the route.');
    } else {
        showToast('info', 'Nothing to recenter', 'No bus location available.');
    }
}

function toggleFullscreen() {
    const wrapper = document.querySelector('.map-wrapper');
    if (!wrapper) return;
    if (!document.fullscreenElement) {
        wrapper.requestFullscreen?.().catch(() => {
            showToast('error', 'Fullscreen blocked', 'Your browser blocked fullscreen.');
        });
    } else {
        document.exitFullscreen?.();
    }
}

/* =====================================================
   TOASTS
===================================================== */
function showToast(type, title, message = '') {
    const container = document.getElementById('toastContainer');
    if (!container) { console.log('[toast]', type, title, message); return; }
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
function formatTime(time) {
    if (!time) return '--:--';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.addEventListener('beforeunload', () => {
    if (socket) { try { socket.emit('leave-trip', currentTrip?._id); socket.disconnect(); } catch {} }
});