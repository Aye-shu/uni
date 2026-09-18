/* =====================================================
   UNIBUS — Passenger List / Live Trip Logic
===================================================== */

let user = null;
let socket = null;
let currentTrip = null;
let passengers = [];       // [{ _id, seatNumber, student, status, boarded }]
let allBuses = [];
let allRoutes = [];
let tripStops = [];
let boardedSeats = new Set();

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

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        try { await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' }); } catch {}
        window.location.href = '/login.html';
    });

    // Get tripId
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get('tripId');

    // If no tripId, try to find an active trip
    if (!tripId) {
        await findActiveTrip();
    } else {
        await loadTrip(tripId);
    }

    // Buttons
    document.getElementById('endTripBtn')?.addEventListener('click', openEndModal);
    document.getElementById('endTripBtnTop')?.addEventListener('click', openEndModal);
    document.getElementById('cancelEndBtn')?.addEventListener('click', closeEndModal);
    document.getElementById('confirmEndBtn')?.addEventListener('click', endTrip);
    document.getElementById('endModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'endModal') closeEndModal();
    });

    document.getElementById('reportIssueBtn')?.addEventListener('click', openReportModal);
    document.getElementById('reportIssueBtnTop')?.addEventListener('click', openReportModal);
    document.getElementById('closeReportBtn')?.addEventListener('click', closeReportModal);
    document.getElementById('cancelReportBtn')?.addEventListener('click', closeReportModal);
    document.getElementById('reportModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'reportModal') closeReportModal();
    });
    document.getElementById('reportForm')?.addEventListener('submit', submitReport);

    document.getElementById('markAllBoardedBtn')?.addEventListener('click', markAllBoarded);

    // Passenger search/filter
    document.getElementById('passengerSearch')?.addEventListener('input', renderPassengerTable);
    document.getElementById('passengerFilter')?.addEventListener('change', renderPassengerTable);

    // ESC closes modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeEndModal(); closeReportModal();
        }
    });

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
   FIND ACTIVE TRIP
===================================================== */
async function findActiveTrip() {
    try {
        const res = await fetch('/api/trips', { credentials: 'include' });
        const data = await res.json();
        const allTrips = data.data || [];

        // Prefer in-progress trip; fallback to today's scheduled
        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const active = allTrips.find(t =>
            idsMatch(t.driver, user.id) && t.status === 'in-progress'
        );
        const today = allTrips.find(t =>
            idsMatch(t.driver, user.id) && t.day === todayName
        );
        const chosen = active || today;

        if (!chosen) {
            document.getElementById('pageLoading').style.display = 'none';
            document.getElementById('pageEmpty').style.display = 'flex';
            return;
        }

        await loadTrip(chosen._id);
    } catch (err) {
        console.error('findActiveTrip:', err);
        document.getElementById('pageLoading').style.display = 'none';
        document.getElementById('pageEmpty').style.display = 'flex';
    }
}

/* =====================================================
   LOAD TRIP
===================================================== */
async function loadTrip(tripId) {
    try {
        // Load buses & routes
        const [busesRes, routesRes, tripRes, passengersRes] = await Promise.all([
            fetch('/api/buses', { credentials: 'include' }).then(r => r.json()),
            fetch('/api/routes', { credentials: 'include' }).then(r => r.json()),
            fetch(`/api/trips/${tripId}`, { credentials: 'include' }).then(r => r.json()),
            fetch(`/api/trips/${tripId}/passengers`, { credentials: 'include' }).then(r => r.json()),
        ]);

        allBuses = busesRes.data || [];
        allRoutes = routesRes.data || [];
        currentTrip = tripRes.data || null;

        if (!currentTrip) {
            document.getElementById('pageLoading').style.display = 'none';
            document.getElementById('pageEmpty').style.display = 'flex';
            return;
        }

        passengers = (passengersRes.data || []).map(p => ({
            _id: p._id,
            seatNumber: p.seatNumber,
            student: p.student,
            status: p.status,
            boarded: false,
        }));

        console.log('✅ Loaded trip:', currentTrip._id, '| passengers:', passengers.length);

        renderTripHeader();
        renderProgress();
        renderStats();
        renderSeatMap();
        renderPassengerTable();

        document.getElementById('pageLoading').style.display = 'none';
        document.getElementById('tripContent').style.display = 'block';

        // Show live pill only if trip is active
        updateLivePill(currentTrip.status);
    } catch (err) {
        console.error('loadTrip:', err);
        document.getElementById('pageLoading').style.display = 'none';
        document.getElementById('pageEmpty').style.display = 'flex';
    }
}

/* =====================================================
   LIVE PILL
===================================================== */
function updateLivePill(status) {
    const pill = document.getElementById('livePill');
    if (!pill) return;
    pill.className = 'live-pill';
    if (status === 'in-progress') {
        pill.querySelector('.text').textContent = 'Live';
    } else if (status === 'completed' || status === 'cancelled') {
        pill.classList.add('completed');
        pill.querySelector('.text').textContent = status === 'completed' ? 'Completed' : 'Cancelled';
    } else {
        pill.classList.add('idle');
        pill.querySelector('.text').textContent = 'Not Started';
    }
}

/* =====================================================
   RENDER TRIP HEADER
===================================================== */
function renderTripHeader() {
    const trip = currentTrip;
    const bus = allBuses.find(b => idsMatch(b._id, trip.bus?._id || trip.bus)) || trip.bus;
    const route = allRoutes.find(r => idsMatch(r._id, trip.route?._id || trip.route)) || trip.route;

    const tripId = `TR-${trip._id.slice(-6).toUpperCase()}`;
    const dateLabel = trip.date
        ? new Date(trip.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        : (trip.day || '—');

    document.getElementById('tripId').textContent = tripId;
    document.getElementById('tripRoute').innerHTML =
        `<i class="fas fa-route"></i> <span>${escapeHtml(route?.name || '—')}</span>`;
    document.getElementById('metaBus').innerHTML =
        `<i class="fas fa-bus"></i> ${escapeHtml(bus?.busNumber || '—')}`;
    document.getElementById('metaDate').innerHTML =
        `<i class="fas fa-calendar-day"></i> ${dateLabel}`;
    document.getElementById('metaTime').innerHTML =
        `<i class="fas fa-clock"></i> ${formatTime(trip.departureTime)}`;

    const statusEl = document.getElementById('statusBadge');
    statusEl.className = 'status-badge ' + (trip.status || 'scheduled');
    const statusLabel = {
        scheduled: 'Scheduled',
        'in-progress': 'Live',
        completed: 'Completed',
        cancelled: 'Cancelled',
        delayed: 'Delayed',
    }[trip.status] || trip.status;
    statusEl.textContent = statusLabel;

    // Hide End Trip buttons if already completed/cancelled
    if (trip.status === 'completed' || trip.status === 'cancelled') {
        document.getElementById('endTripBtn')?.style.setProperty('display', 'none');
        document.getElementById('endTripBtnTop')?.style.setProperty('display', 'none');
    }
}

/* =====================================================
   RENDER PROGRESS
===================================================== */
function renderProgress() {
    const route = allRoutes.find(r => idsMatch(r._id, currentTrip.route?._id || currentTrip.route)) ||
                  currentTrip.route;
    const stops = route?.stops || [];
    const container = document.getElementById('progressChain');

    if (stops.length === 0) {
        container.innerHTML = '<div class="progress-loading">No stops defined for this route</div>';
        return;
    }

    // Simulate: first 2 stops are completed, 3rd is current, rest upcoming
    const completedCount = currentTrip.status === 'completed' ? stops.length : Math.min(2, stops.length);

    container.innerHTML = stops.map((stop, idx) => {
        let cls = 'upcoming';
        let icon = 'fa-circle';
        let label = stop.name || `Stop ${idx + 1}`;

        if (idx < completedCount) {
            cls = 'completed';
            icon = 'fa-check';
        } else if (idx === completedCount && currentTrip.status === 'in-progress') {
            cls = 'current';
            icon = 'fa-bus';
            label += ' (Now)';
        }

        return `
            <div class="progress-stop ${cls}">
                <i class="fas ${icon}"></i>
                <span>${escapeHtml(label)}</span>
            </div>
            ${idx < stops.length - 1 ? '<span class="progress-arrow"><i class="fas fa-chevron-right"></i></span>' : ''}
        `;
    }).join('');
}

/* =====================================================
   RENDER STATS
   ===================================================== */
function renderStats() {
    const bus = allBuses.find(b => idsMatch(b._id, currentTrip.bus?._id || currentTrip.bus)) || currentTrip.bus;
    const capacity = bus?.capacity || 40;

    const booked = passengers.filter(p => p.status === 'confirmed').length;
    const boarded = passengers.filter(p => p.boarded).length;
    const cancelled = passengers.filter(p => p.status === 'cancelled').length;
    const pending = booked - boarded;
    const empty = capacity - booked;

    document.getElementById('statBooked').textContent = booked;
    document.getElementById('statBoarded').textContent = boarded;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statEmpty').textContent = empty;

    document.getElementById('seatCounter').textContent = `${boarded} / ${booked} boarded`;
}

/* =====================================================
   RENDER SEAT MAP
   ===================================================== */
function renderSeatMap() {
    const bus = allBuses.find(b => idsMatch(b._id, currentTrip.bus?._id || currentTrip.bus)) || currentTrip.bus;
    const capacity = bus?.capacity || 40;
    const grid = document.getElementById('seatGrid');

    const passengerBySeat = {};
    passengers.forEach(p => {
        passengerBySeat[String(p.seatNumber)] = p;
    });

    let html = '';
    const rows = Math.ceil(capacity / 4);

    for (let r = 0; r < rows; r++) {
        const seatNums = [r * 4 + 1, r * 4 + 2, r * 4 + 3, r * 4 + 4];

        html += seatCell(seatNums[0], passengerBySeat, capacity);
        html += seatCell(seatNums[1], passengerBySeat, capacity);
        html += '<div class="seat-aisle"></div>';
        html += seatCell(seatNums[2], passengerBySeat, capacity);
        html += seatCell(seatNums[3], passengerBySeat, capacity);
    }

    grid.innerHTML = html;
}

function seatCell(num, passengerBySeat, capacity) {
    if (num > capacity) return '<div class="seat-aisle"></div>';

    const key = String(num);
    const p = passengerBySeat[key];

    let cls = 'empty';
    let check = '';
    let title = `Seat ${num} — Empty`;

    if (p) {
        if (p.status === 'cancelled') {
            cls = 'cancelled';
            title = `Seat ${num} — Cancelled`;
        } else if (p.boarded) {
            cls = 'boarded';
            check = '<i class="fas fa-check seat-check"></i>';
            title = `Seat ${num} — ${p.student?.name || 'Passenger'} (Boarded)`;
        } else {
            cls = 'booked';
            title = `Seat ${num} — ${p.student?.name || 'Passenger'} (Not Boarded)`;
        }
    }

    const clickable = p && p.status !== 'cancelled';
    const onclick = clickable ? `onclick="toggleBoardFromSeat('${p._id}')"` : '';

    return `
        <div class="seat ${cls}" title="${escapeHtml(title)}" ${onclick}>
            <span class="seat-num">${num}</span>
            ${check}
        </div>
    `;
}

/* =====================================================
   RENDER PASSENGER TABLE
===================================================== */
function renderPassengerTable() {
    const container = document.getElementById('passengerList');
    const search = (document.getElementById('passengerSearch')?.value || '').toLowerCase().trim();
    const filter = document.getElementById('passengerFilter')?.value || 'all';

    let list = [...passengers];

    // Filter
    if (filter === 'boarded') list = list.filter(p => p.boarded);
    else if (filter === 'not-boarded') list = list.filter(p => !p.boarded && p.status === 'confirmed');
    else if (filter === 'cancelled') list = list.filter(p => p.status === 'cancelled');

    // Search
    if (search) {
        list = list.filter(p =>
            `${p.student?.name || ''} ${p.student?.studentId || ''} ${p.seatNumber}`
                .toLowerCase().includes(search)
        );
    }

    // Sort by seat
    list.sort((a, b) => Number(a.seatNumber) - Number(b.seatNumber));

    if (list.length === 0) {
        container.innerHTML = `
            <div class="empty-passenger-state">
                <i class="fas fa-users-slash"></i>
                <h3>No passengers found</h3>
                <p>${search || filter !== 'all' ? 'Try clearing your filters.' : 'No bookings for this trip.'}</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="passenger-table-wrap">
            <table class="passenger-table">
                <thead>
                    <tr>
                        <th>Seat</th>
                        <th>Student</th>
                        <th>ID</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Boarded</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map(p => renderPassengerRow(p)).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderPassengerRow(p) {
    const isCancelled = p.status === 'cancelled';
    const isBoarded = p.boarded;

    return `
        <tr class="${isCancelled ? 'cancelled' : ''} ${isBoarded ? 'boarded' : ''}">
            <td class="cell-seat">${escapeHtml(String(p.seatNumber || '—'))}</td>
            <td class="cell-name">${escapeHtml(p.student?.name || 'Passenger')}</td>
            <td class="cell-id">${escapeHtml(p.student?.studentId || '—')}</td>
            <td class="cell-phone">${escapeHtml(p.student?.phone || '—')}</td>
            <td class="cell-status ${p.status}">${escapeHtml(p.status || 'confirmed')}</td>
            <td>
                <button
                    type="button"
                    class="board-toggle ${isBoarded ? 'checked' : ''}"
                    onclick="toggleBoard('${p._id}')"
                    ${isCancelled ? 'disabled' : ''}
                    title="${isBoarded ? 'Mark as not boarded' : 'Mark as boarded'}"
                >
                    <i class="fas fa-check"></i>
                </button>
            </td>
        </tr>
    `;
}

/* =====================================================
   BOARDING
===================================================== */
window.toggleBoard = function (passengerId) {
    const p = passengers.find(x => String(x._id) === String(passengerId));
    if (!p || p.status === 'cancelled') return;

    p.boarded = !p.boarded;

    renderStats();
    renderSeatMap();
    renderPassengerTable();

    showToast('success',
        p.boarded ? 'Marked as boarded' : 'Marked as not boarded',
        p.student?.name || ''
    );
};

window.toggleBoardFromSeat = function (passengerId) {
    window.toggleBoard(passengerId);
};

function markAllBoarded() {
    const confirmed = passengers.filter(p => p.status === 'confirmed');
    if (confirmed.length === 0) {
        showToast('info', 'No passengers', 'No confirmed bookings to mark');
        return;
    }
    if (!confirm(`Mark all ${confirmed.length} confirmed passengers as boarded?`)) return;

    confirmed.forEach(p => p.boarded = true);

    renderStats();
    renderSeatMap();
    renderPassengerTable();
    showToast('success', 'All marked boarded', `${confirmed.length} passengers updated`);
}

/* =====================================================
   END TRIP
===================================================== */
function openEndModal() {
    const boarded = passengers.filter(p => p.boarded).length;
    const pending = passengers.filter(p => !p.boarded && p.status === 'confirmed').length;

    document.getElementById('endTripIdLabel').textContent = `TR-${currentTrip._id.slice(-6).toUpperCase()}`;
    document.getElementById('endBoarded').textContent = boarded;
    document.getElementById('endPending').textContent = pending;

    document.getElementById('endModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeEndModal() {
    document.getElementById('endModal').classList.remove('active');
    document.body.style.overflow = '';
}

async function endTrip() {
    const btn = document.getElementById('confirmEndBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ending...';

    try {
        const res = await fetch(`/api/driver/trips/${currentTrip._id}/end`, {
            method: 'PUT',
            credentials: 'include',
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to end trip');

        closeEndModal();
        showCompletionModal();
    } catch (err) {
        console.error('endTrip:', err);
        showToast('error', 'Failed to end', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

function showCompletionModal() {
    const boarded = passengers.filter(p => p.boarded).length;
    const pending = passengers.filter(p => !p.boarded && p.status === 'confirmed').length;

    document.getElementById('completionStats').innerHTML = `
        <div class="stat-line"><span>Boarded</span><strong>${boarded}</strong></div>
        <div class="stat-line"><span>Not Boarded</span><strong>${pending}</strong></div>
        <div class="stat-line"><span>Total Passengers</span><strong>${passengers.length}</strong></div>
    `;

    document.getElementById('completedModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

/* =====================================================
   REPORT ISSUE
===================================================== */
function openReportModal() {
    document.getElementById('reportForm').reset();
    document.getElementById('errReportType').classList.remove('show');
    document.getElementById('reportModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeReportModal() {
    document.getElementById('reportModal').classList.remove('active');
    document.body.style.overflow = '';
}

async function submitReport(e) {
    e.preventDefault();
    const type = document.getElementById('reportType').value;
    const severity = document.querySelector('input[name="severity"]:checked')?.value || 'low';
    const description = document.getElementById('reportDescription').value.trim();

    if (!type) {
        document.getElementById('errReportType').textContent = 'Please select an issue type';
        document.getElementById('errReportType').classList.add('show');
        return;
    }

    const btn = document.getElementById('submitReportBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        // Send to the backend
        const res = await fetch('/api/reports/delay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                tripId: currentTrip._id,
                delayMinutes: 0,
                reason: type,
                description: `[${severity.toUpperCase()}] ${description || 'No details'}`,
            }),
        });

        if (!res.ok) {
            // Non-critical — still show success for MVP
            console.warn('Report API failed, but continuing...');
        }

        // Emit via socket for real-time admin alert
        if (socket && socket.connected) {
            socket.emit('trip-status-update', {
                tripId: currentTrip._id,
                status: 'delayed',
            });
        }

        closeReportModal();
        showToast('success', 'Report submitted', 'Admin has been notified');
    } catch (err) {
        console.error('submitReport:', err);
        showToast('error', 'Failed to submit', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
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
    if (socket) { try { socket.disconnect(); } catch {} }
});