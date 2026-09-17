/* =====================================================
   UNIBUS — Live Bus Monitoring Logic
===================================================== */

let map = null;
let busMarkers = {};   // { tripId: { marker, data } }
let routePolylines = [];
let stopMarkers = [];
let socket = null;
let allTrips = [];
let allBuses = [];
let allDrivers = [];
let allRoutes = [];
let activeTrips = [];
let user = null;
let currentFilter = 'all';
let searchQuery = '';
let selectedTripId = null;
let showRoutes = true;
let showStops = true;
let followMode = false;

const idsMatch = (a, b) => a && b && String(a) === String(b);

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

    // Map controls
    document.getElementById('recenterBtn')?.addEventListener('click', recenterMap);
    document.getElementById('toggleRoutesBtn')?.addEventListener('click', toggleRoutes);
    document.getElementById('toggleStopsBtn')?.addEventListener('click', toggleStops);
    document.getElementById('fullscreenBtn')?.addEventListener('click', toggleFullscreen);
    document.getElementById('closeDetailsBtn')?.addEventListener('click', closeDetails);

    // Search & filter
    document.getElementById('busSearch')?.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderBusList();
    });

    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            renderBusList();
            updateMarkersVisibility();
        });
    });

    // Load data
    await Promise.all([loadRoutes(), loadBuses(), loadDrivers()]);
    await loadActiveTrips();

    // Init map (after data loads)
    initMap();

    // Connect socket
    initSocket();
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
                ? '/student/dashboard.html' : '/driver/dashboard.html';
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
async function loadRoutes() {
    try {
        const res = await fetch('/api/routes', { credentials: 'include' });
        const data = await res.json();
        allRoutes = data.data || [];
    } catch { allRoutes = []; }
}

async function loadBuses() {
    try {
        const res = await fetch('/api/admin/buses', { credentials: 'include' });
        const data = await res.json();
        allBuses = data.data || [];
    } catch { allBuses = []; }
}

async function loadDrivers() {
    try {
        const res = await fetch('/api/admin/drivers', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            allDrivers = data.data || [];
            if (allDrivers.length > 0) return;
        }
        const res2 = await fetch('/api/admin/users', { credentials: 'include' });
        const data2 = await res2.json();
        allDrivers = (data2.data || []).filter(u => u.role === 'driver');
    } catch { allDrivers = []; }
}

async function loadActiveTrips() {
    try {
        const res = await fetch('/api/trips', { credentials: 'include' });
        const data = await res.json();
        allTrips = data.data || [];

        // Filter for active trips (in-progress OR delayed OR scheduled-today with available seats)
        activeTrips = allTrips.filter(t =>
            t.status === 'in-progress' ||
            t.status === 'delayed' ||
            t.isLive === true
        );

        // If no active trips, show scheduled ones for demo purposes
        if (activeTrips.length === 0) {
            const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            activeTrips = allTrips.filter(t => t.day === today).slice(0, 8);
        }

        console.log('✅ Active trips loaded:', activeTrips.length);

        updateStats();
        renderBusList();
        renderAlerts();
        plotBusesOnMap();

        document.getElementById('mapLoading').style.display = 'none';

        if (activeTrips.length === 0) {
            document.getElementById('mapEmpty').style.display = 'flex';
        }
    } catch (err) {
        console.error('Load active trips error:', err);
        document.getElementById('mapLoading').style.display = 'none';
        document.getElementById('mapEmpty').style.display = 'flex';
    }
}

/* =====================================================
   MAP INIT
===================================================== */
function initMap() {
    const mapEl = document.getElementById('fleetMap');
    if (!mapEl || typeof L === 'undefined') return;

    map = L.map('fleetMap', {
        zoomControl: true,
        attributionControl: false,
    }).setView([23.8103, 90.4125], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '© OpenStreetMap · © CARTO',
    }).addTo(map);
}

/* =====================================================
   GET HELPERS
===================================================== */
function getBus(trip) {
    if (trip.bus && typeof trip.bus === 'object') return trip.bus;
    return allBuses.find(b => idsMatch(b._id, trip.bus)) || null;
}

function getRoute(trip) {
    if (trip.route && typeof trip.route === 'object') return trip.route;
    return allRoutes.find(r => idsMatch(r._id, trip.route)) || null;
}

function getDriver(trip) {
    return allDrivers.find(d => idsMatch(d._id || d.id, trip.driver)) || null;
}

function getStatus(trip) {
    if (trip.status === 'delayed') return { label: 'Delayed', cls: 'delayed', icon: 'fa-clock', color: '#eab308' };
    if (trip.status === 'in-progress') return { label: 'On Time', cls: 'ontime', icon: 'fa-circle', color: '#10b981' };
    if (trip.status === 'scheduled') return { label: 'Scheduled', cls: 'idle', icon: 'fa-circle', color: '#94a3b8' };
    if (trip.status === 'completed') return { label: 'Completed', cls: 'idle', icon: 'fa-check-circle', color: '#64748b' };
    return { label: 'Idle', cls: 'idle', icon: 'fa-circle', color: '#94a3b8' };
}

function getBookedCount(trip) {
    const bus = getBus(trip);
    const capacity = bus?.capacity || 40;
    return capacity - (trip.availableSeats || 0);
}

/* =====================================================
   PLOT BUSES ON MAP
===================================================== */
function plotBusesOnMap() {
    if (!map) return;

    // Clear existing markers
    Object.values(busMarkers).forEach(m => {
        if (m.marker) map.removeLayer(m.marker);
    });
    busMarkers = {};

    // Clear routes & stops
    routePolylines.forEach(p => map.removeLayer(p));
    stopMarkers.forEach(m => map.removeLayer(m));
    routePolylines = [];
    stopMarkers = [];

    const bounds = [];

    activeTrips.forEach(trip => {
        const bus = getBus(trip);
        const route = getRoute(trip);
        const status = getStatus(trip);

        // Get coordinates — use trip.currentLocation or fall back to route's first stop
        let lat = 0, lng = 0;
        if (trip.currentLocation?.latitude && trip.currentLocation.latitude !== 0) {
            lat = trip.currentLocation.latitude;
            lng = trip.currentLocation.longitude;
        } else if (bus?.currentLocation?.latitude && bus.currentLocation.latitude !== 0) {
            lat = bus.currentLocation.latitude;
            lng = bus.currentLocation.longitude;
        } else if (route?.stops?.[0]?.location?.latitude) {
            lat = route.stops[0].location.latitude;
            lng = route.stops[0].location.longitude;
        } else {
            // Dhaka center + small random offset
            lat = 23.8103 + (Math.random() - 0.5) * 0.05;
            lng = 90.4125 + (Math.random() - 0.5) * 0.05;
        }

        // Create bus marker
        const marker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'bus-marker-wrap',
                html: `
                    <div class="bus-marker-dot ${status.cls}" data-trip="${trip._id}">
                        🚌
                    </div>
                    <span class="bus-marker-label">${escapeHtml(bus?.busNumber || 'Bus')}</span>
                `,
                iconSize: [48, 60],
                iconAnchor: [24, 24],
            }),
            zIndexOffset: 1000,
        }).addTo(map);

        marker.on('click', () => openDetails(trip._id));

        busMarkers[trip._id] = {
            marker,
            data: trip,
            lat, lng,
        };

        bounds.push([lat, lng]);

        // Draw route polyline
        if (route?.stops?.length >= 2) {
            const routeCoords = route.stops
                .filter(s => s.location?.latitude)
                .map(s => [s.location.latitude, s.location.longitude]);

            if (routeCoords.length >= 2) {
                const polyline = L.polyline(routeCoords, {
                    color: status.color,
                    weight: 3,
                    opacity: 0.5,
                    dashArray: '8, 6',
                }).addTo(map);

                if (!showRoutes) polyline.setStyle({ opacity: 0 });

                routePolylines.push(polyline);

                // Stops
                route.stops.forEach(stop => {
                    if (!stop.location?.latitude) return;
                    const stopMarker = L.marker(
                        [stop.location.latitude, stop.location.longitude],
                        {
                            icon: L.divIcon({
                                className: '',
                                html: '<div class="stop-marker-dot"></div>',
                                iconSize: [14, 14],
                                iconAnchor: [7, 7],
                            }),
                        }
                    ).addTo(map);

                    if (!showStops) stopMarker.setOpacity(0);
                    stopMarkers.push(stopMarker);
                });
            }
        }
    });

    // Fit bounds
    if (bounds.length > 1) {
        try {
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
        } catch (e) {}
    } else if (bounds.length === 1) {
        map.setView(bounds[0], 13);
    }
}

/* =====================================================
   STATS
===================================================== */
function updateStats() {
    const active = activeTrips.filter(t => t.status === 'in-progress').length;
    const delayed = activeTrips.filter(t => t.status === 'delayed').length;
    const scheduled = activeTrips.filter(t => t.status === 'scheduled').length;
    const issues = 0; // No issue status in schema currently
    const students = activeTrips.reduce((sum, t) => sum + getBookedCount(t), 0);
    const routesUsed = new Set(activeTrips.map(t => t.route?._id || t.route).filter(Boolean)).size;

    document.getElementById('statActive').textContent = active + scheduled;
    document.getElementById('statDelayed').textContent = delayed;
    document.getElementById('statIssues').textContent = issues;
    document.getElementById('statStudents').textContent = students;
    document.getElementById('statRoutes').textContent = routesUsed;
}

/* =====================================================
   BUS LIST
===================================================== */
function renderBusList() {
    const list = document.getElementById('busList');
    const count = document.getElementById('activeCount');

    if (!list) return;

    // Apply filter + search
    let trips = [...activeTrips];

    if (searchQuery) {
        trips = trips.filter(t => {
            const bus = getBus(t);
            const driver = getDriver(t);
            const text = `${bus?.busNumber || ''} ${driver?.name || ''}`.toLowerCase();
            return text.includes(searchQuery);
        });
    }

    if (currentFilter !== 'all') {
        trips = trips.filter(t => t.status === currentFilter);
    }

    count.textContent = trips.length;

    if (trips.length === 0) {
        list.innerHTML = `
            <div class="list-loading">
                <i class="fas fa-bus-slash" style="font-size:1.5rem;opacity:0.4;display:block;margin-bottom:8px;"></i>
                No buses match your filter
            </div>`;
        return;
    }

    list.innerHTML = trips.map(trip => {
        const bus = getBus(trip);
        const driver = getDriver(trip);
        const route = getRoute(trip);
        const status = getStatus(trip);
        const booked = getBookedCount(trip);
        const capacity = bus?.capacity || 40;
        const isSelected = trip._id === selectedTripId;

        return `
            <div class="bus-item ${isSelected ? 'active' : ''}" onclick="focusBus('${trip._id}')">
                <div class="bus-item-top">
                    <span class="bus-item-num">${escapeHtml(bus?.busNumber || 'Bus')}</span>
                    <span class="bus-item-status ${status.cls}">
                        <i class="fas ${status.icon}"></i> ${status.label}
                    </span>
                </div>
                <div class="bus-item-details">
                    <span><i class="fas fa-user"></i> ${escapeHtml(driver?.name?.split(' ')[0] || 'N/A')}</span>
                    <span><i class="fas fa-route"></i> ${escapeHtml((route?.name || '—').slice(0, 20))}</span>
                    <span><i class="fas fa-users"></i> ${booked}/${capacity}</span>
                </div>
            </div>
        `;
    }).join('');
}

/* =====================================================
   ALERTS
===================================================== */
function renderAlerts() {
    const container = document.getElementById('alertsList');
    const alerts = [];

    // Delayed trips
    activeTrips.filter(t => t.status === 'delayed').forEach(trip => {
        const bus = getBus(trip);
        alerts.push({
            type: 'delayed',
            icon: 'fa-clock',
            text: `${bus?.busNumber || 'Bus'} delayed ${trip.delayMinutes || 0} min${trip.delayReason ? ' — ' + trip.delayReason : ''}`,
            time: trip.updatedAt || trip.createdAt,
        });
    });

    // In-progress trips
    activeTrips.filter(t => t.status === 'in-progress').slice(0, 5).forEach(trip => {
        const bus = getBus(trip);
        const route = getRoute(trip);
        alerts.push({
            type: 'ontime',
            icon: 'fa-bus',
            text: `${bus?.busNumber || 'Bus'} started trip on ${route?.name || 'route'}`,
            time: trip.updatedAt || trip.createdAt,
        });
    });

    if (alerts.length === 0) {
        container.innerHTML = `<div class="list-loading">No alerts</div>`;
        return;
    }

    alerts.sort((a, b) => new Date(b.time) - new Date(a.time));

    container.innerHTML = alerts.slice(0, 6).map(a => `
        <div class="alert-item ${a.type}">
            <div class="alert-icon"><i class="fas ${a.icon}"></i></div>
            <div class="alert-content">
                <p>${escapeHtml(a.text)}</p>
                <small>${timeAgo(a.time)}</small>
            </div>
        </div>
    `).join('');
}

/* =====================================================
   FOCUS / DETAILS
===================================================== */
window.focusBus = function (tripId) {
    const entry = busMarkers[tripId];
    if (!entry) return;

    selectedTripId = tripId;

    // Center map
    if (map) {
        map.setView([entry.lat, entry.lng], Math.max(map.getZoom(), 14), { animate: true });
    }

    // Open details
    openDetails(tripId);
    renderBusList();
};

function openDetails(tripId) {
    const trip = activeTrips.find(t => t._id === tripId);
    if (!trip) return;

    selectedTripId = tripId;

    const bus = getBus(trip);
    const driver = getDriver(trip);
    const route = getRoute(trip);
    const status = getStatus(trip);
    const booked = getBookedCount(trip);
    const capacity = bus?.capacity || 40;
    const progress = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;

    const stops = route?.stops || [];
    const completedStops = Math.min(2, stops.length);
    const stopProgress = stops.length > 0 ? Math.round((completedStops / stops.length) * 100) : 0;

    document.getElementById('detailsTitle').textContent = bus?.busNumber || 'Bus Details';

    document.getElementById('detailsBody').innerHTML = `
        <div class="detail-row">
            <span>Driver</span>
            <strong>${escapeHtml(driver?.name || 'Unassigned')}</strong>
        </div>
        ${driver?.phone ? `
        <div class="detail-row">
            <span>Driver Phone</span>
            <strong>${escapeHtml(driver.phone)}</strong>
        </div>` : ''}
        <div class="detail-row">
            <span>Route</span>
            <strong>${escapeHtml(route?.name || '—')}</strong>
        </div>
        <div class="detail-row">
            <span>Trip ID</span>
            <strong>TR-${escapeHtml(trip._id.slice(-6).toUpperCase())}</strong>
        </div>
        <div class="detail-row">
            <span>Departure</span>
            <strong>${formatTime(trip.departureTime)}</strong>
        </div>
        <div class="detail-row">
            <span>Direction</span>
            <strong>${escapeHtml(trip.direction || '—')}</strong>
        </div>
        <div class="detail-row">
            <span>Students</span>
            <strong>${booked} / ${capacity}</strong>
        </div>
        <div class="detail-row">
            <span>Status</span>
            <strong style="color:${status.color};">${status.label}</strong>
        </div>

        <div class="detail-progress">
            <div class="detail-progress-label">
                <span>Seat Occupancy</span>
                <span>${progress}%</span>
            </div>
            <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width:${progress}%"></div>
            </div>
        </div>

        <div class="detail-progress">
            <div class="detail-progress-label">
                <span>Route Progress</span>
                <span>${completedStops} of ${stops.length} stops</span>
            </div>
            <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width:${stopProgress}%"></div>
            </div>
        </div>

        <div class="detail-actions">
            ${driver?.phone ? `
                <a href="tel:${escapeHtml(driver.phone)}" class="detail-btn primary">
                    <i class="fas fa-phone"></i> Call Driver
                </a>
            ` : `
                <button class="detail-btn" disabled>
                    <i class="fas fa-phone-slash"></i> No Phone
                </button>
            `}
            <button class="detail-btn" onclick="followBus('${trip._id}')">
                <i class="fas fa-crosshairs"></i> ${followMode && selectedTripId === trip._id ? 'Following' : 'Follow'}
            </button>
            <button class="detail-btn" onclick="viewPassengers('${trip._id}')">
                <i class="fas fa-users"></i> Passengers
            </button>
            <button class="detail-btn" onclick="recenterMap()">
                <i class="fas fa-map-pin"></i> Recenter
            </button>
            <button class="detail-btn danger" onclick="forceEndTrip('${trip._id}')">
                <i class="fas fa-stop-circle"></i> Force End Trip
            </button>
        </div>
    `;

    document.getElementById('busDetails').classList.add('active');
}

function closeDetails() {
    document.getElementById('busDetails').classList.remove('active');
    selectedTripId = null;
    followMode = false;
    renderBusList();
}

/* =====================================================
   ACTIONS
===================================================== */
window.followBus = function (tripId) {
    followMode = !followMode || selectedTripId !== tripId;
    selectedTripId = tripId;
    if (followMode) {
        showToast('success', 'Following bus', 'Map will auto-center as it moves');
    }
    openDetails(tripId);
};

window.recenterMap = function () {
    if (!map) return;
    if (followMode && selectedTripId && busMarkers[selectedTripId]) {
        const entry = busMarkers[selectedTripId];
        map.setView([entry.lat, entry.lng], 15, { animate: true });
        showToast('success', 'Recentered', 'Following selected bus');
    } else if (Object.keys(busMarkers).length > 0) {
        const bounds = Object.values(busMarkers).map(m => [m.lat, m.lng]);
        try {
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
            showToast('success', 'Recentered', 'All buses in view');
        } catch (e) {}
    } else {
        map.setView([23.8103, 90.4125], 12);
        showToast('info', 'No buses', 'Showing default view');
    }
};

window.viewPassengers = async function (tripId) {
    const trip = activeTrips.find(t => t._id === tripId);
    if (!trip) return;

    try {
        const res = await fetch(`/api/trips/${tripId}/passengers`, { credentials: 'include' });
        const data = await res.json();
        const bookings = data.data || [];

        if (bookings.length === 0) {
            showToast('info', 'No passengers', 'No students have booked this trip');
            return;
        }

        const names = bookings.map(b => `${b.seatNumber}: ${b.student?.name || 'Student'}`).join('\n');
        alert(`Passengers (${bookings.length}):\n\n${names}`);
    } catch (err) {
        showToast('error', 'Failed to load', err.message);
    }
};

window.forceEndTrip = async function (tripId) {
    if (!confirm('Are you sure you want to force-end this trip? The driver will be notified.')) return;

    try {
        const res = await fetch(`/api/trips/${tripId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: 'completed' }),
        });

        if (!res.ok) throw new Error('Failed to end trip');

        showToast('success', 'Trip ended', 'Bus removed from active trips');
        await loadActiveTrips();
        closeDetails();
    } catch (err) {
        showToast('error', 'Failed', err.message);
    }
};

window.toggleRoutes = function () {
    showRoutes = !showRoutes;
    routePolylines.forEach(p => p.setStyle({ opacity: showRoutes ? 0.5 : 0 }));
    document.getElementById('toggleRoutesBtn').classList.toggle('toggled', !showRoutes);
    showToast('info', showRoutes ? 'Routes shown' : 'Routes hidden', '');
};

window.toggleStops = function () {
    showStops = !showStops;
    stopMarkers.forEach(m => m.setOpacity(showStops ? 1 : 0));
    document.getElementById('toggleStopsBtn').classList.toggle('toggled', !showStops);
    showToast('info', showStops ? 'Stops shown' : 'Stops hidden', '');
};

function toggleFullscreen() {
    const wrapper = document.querySelector('.map-wrapper');
    if (!wrapper) return;
    if (!document.fullscreenElement) {
        wrapper.requestFullscreen?.().catch(() => {});
    } else {
        document.exitFullscreen?.();
    }
}

function updateMarkersVisibility() {
    // When filter changes, dim non-matching markers
    Object.values(busMarkers).forEach(({ marker, data }) => {
        const status = getStatus(data);
        const matches = currentFilter === 'all' || data.status === currentFilter;
        const el = marker.getElement();
        if (el) el.style.opacity = matches ? '1' : '0.25';
    });
}

/* =====================================================
   SOCKET.IO
===================================================== */
function initSocket() {
    if (typeof io === 'undefined') {
        updateConnectionStatus('disconnected', 'Offline');
        return;
    }

    try {
        socket = io({ withCredentials: true });

        socket.on('connect', () => {
            updateConnectionStatus('connected', 'Live');
            console.log('🔌 Socket connected');
            // Join admin room for fleet updates
            socket.emit('join-admin-room');
        });

        socket.on('disconnect', () => {
            updateConnectionStatus('disconnected', 'Disconnected');
        });

        socket.on('connect_error', () => {
            updateConnectionStatus('disconnected', 'Reconnecting...');
        });

        // Bus location update
        socket.on('location-updated', (data) => {
            if (!data.tripId) return;
            const entry = busMarkers[data.tripId];
            if (entry && data.latitude && data.longitude) {
                entry.lat = data.latitude;
                entry.lng = data.longitude;
                smoothMove(entry.marker, entry.marker.getLatLng(), L.latLng(data.latitude, data.longitude), 800);
                if (followMode && selectedTripId === data.tripId && map) {
                    map.panTo([data.latitude, data.longitude]);
                }
            }
        });

        // Trip status changed
        socket.on('trip-status-changed', (data) => {
            if (!data.tripId) return;
            const trip = activeTrips.find(t => t._id === data.tripId);
            if (trip) {
                trip.status = data.status;
                renderBusList();
                updateStats();
            }
        });

    } catch (err) {
        console.warn('Socket init failed:', err);
        updateConnectionStatus('disconnected', 'Offline');
    }
}

function smoothMove(marker, from, to, duration) {
    const start = performance.now();
    function step(now) {
        const t = Math.min((now - start) / duration, 1);
        const lat = from.lat + (to.lat - from.lat) * t;
        const lng = from.lng + (to.lng - from.lng) * t;
        marker.setLatLng([lat, lng]);
        if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function updateConnectionStatus(state, text) {
    const el = document.getElementById('connectionStatus');
    if (!el) return;
    el.className = 'connection-status ' + state;
    const t = el.querySelector('.text');
    if (t) t.textContent = text;
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
function formatTime(time) {
    if (!time) return '—';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function timeAgo(date) {
    if (!date) return 'just now';
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Cleanup
window.addEventListener('beforeunload', () => {
    if (socket) { try { socket.disconnect(); } catch {} }
});