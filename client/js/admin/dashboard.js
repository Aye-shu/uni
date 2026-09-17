/* =====================================================
   UNIBUS — Admin Dashboard JavaScript
===================================================== */

let fleetMap = null;
let fleetMarkers = [];
let user = null;

document.addEventListener('DOMContentLoaded', async () => {
    user = await checkAuth();
    if (!user) return;

    // Populate user info
    document.getElementById('userName').textContent = user.name || 'Admin';
    document.getElementById('userRole').textContent = user.role || 'admin';
    document.getElementById('userAvatar').textContent = (user.name || 'A').charAt(0).toUpperCase();
    document.getElementById('welcomeName').textContent = user.name?.split(' ')[0] || 'Admin';

    const today = new Date();
    document.getElementById('welcomeDate').textContent = today.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    // ---------- Load all data in parallel ----------
    const [stats, buses, routes, users, trips] = await Promise.all([
        fetchAPI('/api/admin/stats'),
        fetchAPI('/api/buses'),
        fetchAPI('/api/routes'),
        fetchAPI('/api/admin/users'),
        fetchAPI('/api/trips'),
    ]);

    // ---------- Update stat cards ----------
    const busList = buses?.data || [];
    const routeList = routes?.data || [];
    const userList = users?.data || [];
    const tripList = trips?.data || [];

    const studentCount = userList.filter(u => u.role === 'student').length;
    const driverCount = userList.filter(u => u.role === 'driver').length;
    const liveTrips = tripList.filter(t => t.status === 'in-progress').length;
    const delayedTrips = tripList.filter(t => t.status === 'delayed').length;

    document.getElementById('statBuses').textContent = stats?.data?.totalBuses ?? busList.length;
    document.getElementById('statDrivers').textContent = stats?.data?.totalDrivers ?? driverCount;
    document.getElementById('statStudents').textContent = studentCount;
    document.getElementById('statLive').textContent = liveTrips;
    document.getElementById('statBookings').textContent = stats?.data?.totalBookings ?? 0;
    document.getElementById('statReports').textContent = stats?.data?.pendingReports ?? 0;
    document.getElementById('statRoutes').textContent = stats?.data?.totalRoutes ?? routeList.length;

    document.getElementById('welcomeSummary').textContent =
        `${liveTrips} active trip${liveTrips !== 1 ? 's' : ''}, ${delayedTrips} delay${delayedTrips !== 1 ? 's' : ''} reported.`;

    // ---------- Fleet map ----------
    initFleetMap(busList);

    // ---------- Fleet table ----------
    renderFleetTable(busList);

    // ---------- Alerts ----------
    renderAlerts(tripList, delayedTrips);

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
   API HELPER
===================================================== */
async function fetchAPI(endpoint) {
    try {
        const res = await fetch(endpoint, { credentials: 'include' });
        if (!res.ok) return { data: [] };
        return await res.json();
    } catch {
        return { data: [] };
    }
}

/* =====================================================
   FLEET MAP
===================================================== */
function initFleetMap(buses) {
    const mapEl = document.getElementById('fleetMap');
    if (!mapEl || typeof L === 'undefined') return;

    fleetMap = L.map('fleetMap', {
        zoomControl: true,
        attributionControl: false,
    }).setView([23.8103, 90.4125], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '© OpenStreetMap · © CARTO',
    }).addTo(fleetMap);

    // Plot live buses
    const liveBuses = buses.filter(b => b.isLive && b.currentLocation?.latitude);

    if (liveBuses.length === 0) {
        document.getElementById('mapStatusDot').classList.remove('live');
        document.getElementById('mapStatusText').textContent = 'No buses currently live';
    } else {
        document.getElementById('mapStatusDot').classList.add('live');
        document.getElementById('mapStatusText').textContent =
            `${liveBuses.length} bus${liveBuses.length !== 1 ? 'es' : ''} live`;

        liveBuses.forEach(bus => {
            const marker = L.marker([bus.currentLocation.latitude, bus.currentLocation.longitude], {
                icon: L.divIcon({
                    className: '',
                    html: `<div class="bus-marker-icon">🚌</div>`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20],
                }),
            }).addTo(fleetMap);

            marker.bindPopup(`
                <strong>${escapeHtml(bus.busNumber || 'Bus')}</strong><br/>
                <small>${escapeHtml(bus.plateNumber || '')}</small><br/>
                <small>Capacity: ${bus.capacity || 0}</small>
            `);

            fleetMarkers.push(marker);
        });

        // Fit map bounds
        if (fleetMarkers.length > 0) {
            const group = L.featureGroup(fleetMarkers);
            fleetMap.fitBounds(group.getBounds().pad(0.15));
        }
    }

    // If no live buses, still plot a placeholder in Dhaka center
    if (liveBuses.length === 0 && buses.length > 0) {
        const firstBus = buses[0];
        if (firstBus.currentLocation?.latitude) {
            L.marker([firstBus.currentLocation.latitude, firstBus.currentLocation.longitude])
                .addTo(fleetMap)
                .bindPopup(`<strong>${escapeHtml(firstBus.busNumber || 'Bus')}</strong><br/><small>Idle</small>`);
        }
    }
}

/* =====================================================
   FLEET TABLE
===================================================== */
function renderFleetTable(buses) {
    const container = document.getElementById('fleetTable');

    if (buses.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px;">
                <i class="fas fa-bus"></i>
                <p>No buses in your fleet yet.</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <table class="fleet-table">
            <thead>
                <tr>
                    <th>Bus</th>
                    <th>Driver</th>
                    <th>Route</th>
                    <th>Status</th>
                    <th>Seats</th>
                </tr>
            </thead>
            <tbody>
                ${buses.slice(0, 6).map(bus => {
                    const status = determineStatus(bus);
                    const driverName = bus.currentDriver?.name || 'Unassigned';
                    const routeName = bus.route?.name || '—';
                    const booked = (bus.capacity || 0) - (bus.availableSeats || 0);

                    return `
                        <tr>
                            <td class="bus-cell">${escapeHtml(bus.busNumber || '—')}</td>
                            <td class="driver-cell">${escapeHtml(driverName)}</td>
                            <td class="route-cell">${escapeHtml(routeName)}</td>
                            <td><span class="status-pill ${status.cls}">
                                <i class="fas ${status.icon}"></i> ${status.label}
                            </span></td>
                            <td class="seats-cell">${booked} / ${bus.capacity || 0}</td>
                        </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

function determineStatus(bus) {
    if (bus.status === 'maintenance') {
        return { cls: 'issue', icon: 'fa-tools', label: 'Maintenance' };
    }
    if (bus.isLive) {
        return { cls: 'on-trip', icon: 'fa-circle', label: 'On Trip' };
    }
    if (bus.status === 'active') {
        return { cls: 'idle', icon: 'fa-circle', label: 'Idle' };
    }
    return { cls: 'idle', icon: 'fa-circle', label: 'Idle' };
}

/* =====================================================
   ALERTS
===================================================== */
function renderAlerts(trips, delayedCount) {
    const container = document.getElementById('alertsList');

    const alerts = [];

    // Delayed trips
    trips.filter(t => t.status === 'delayed').slice(0, 3).forEach(trip => {
        alerts.push({
            icon: 'fa-exclamation-triangle',
            cls: 'delay',
            title: `Delay: ${trip.bus?.busNumber || 'Bus'}`,
            message: `${trip.delayReason || 'Delay reported'} • ${trip.delayMinutes || 0} min`,
            time: trip.updatedAt || trip.createdAt,
        });
    });

    // Live trips
    trips.filter(t => t.status === 'in-progress').slice(0, 2).forEach(trip => {
        alerts.push({
            icon: 'fa-bus',
            cls: 'trip',
            title: `Trip started: ${trip.bus?.busNumber || 'Bus'}`,
            message: `${trip.route?.name || 'Route'} · ${trip.direction || 'outbound'}`,
            time: trip.updatedAt || trip.createdAt,
        });
    });

    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px;">
                <i class="fas fa-check-circle"></i>
                <p>All systems running smoothly.</p>
            </div>`;
        return;
    }

    container.innerHTML = alerts.slice(0, 5).map(a => `
        <div class="alert-item">
            <div class="alert-icon ${a.cls}">
                <i class="fas ${a.icon}"></i>
            </div>
            <div class="alert-content">
                <h5>${escapeHtml(a.title)}</h5>
                <p>${escapeHtml(a.message)}</p>
                <span class="alert-time">${timeAgo(a.time)}</span>
            </div>
        </div>
    `).join('');
}

/* =====================================================
   UTILITIES
===================================================== */
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

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}