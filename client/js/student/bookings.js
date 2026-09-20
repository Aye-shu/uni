/* =====================================================
   UNIBUS — My Bookings Page Logic
===================================================== */

let allBookings = [];
let filteredBookings = [];
let currentFilter = 'upcoming';
let cancelTargetId = null;
let user = null;

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

    // ---------- Filter tabs ----------
    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            applyFilter();
        });
    });

    // ---------- Cancel modal ----------
    document.getElementById('cancelModalBtn')?.addEventListener('click', closeCancelModal);
    document.getElementById('confirmCancelBtn')?.addEventListener('click', handleCancel);
    document.getElementById('cancelModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'cancelModal') closeCancelModal();
    });

    // ---------- Details modal ----------
    document.getElementById('closeDetailsBtn')?.addEventListener('click', closeDetailsModal);
    document.getElementById('detailsModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'detailsModal') closeDetailsModal();
    });

    // ---------- ESC ----------
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCancelModal();
            closeDetailsModal();
        }
    });

    // ---------- Load bookings ----------
    await loadBookings();
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
    } catch (err) {
        console.error('Auth check failed:', err);
        window.location.href = '/login.html';
        return null;
    }
}

/* =====================================================
   LOAD BOOKINGS
===================================================== */
async function loadBookings() {
    try {
        const res = await fetch('/api/bookings', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load');

        allBookings = data.data || [];
        updateCounts();
        applyFilter();
    } catch (err) {
        console.error('Load error:', err);
        showToast('error', 'Failed to load bookings', err.message);
        allBookings = [];
        applyFilter();
    }
}

/* =====================================================
   COUNT BOOKINGS PER TAB
===================================================== */
function updateCounts() {
    const upcoming = allBookings.filter(b =>
        b.status === 'confirmed' && isUpcoming(b)
    ).length;

    const past = allBookings.filter(b =>
        b.status === 'completed' || (b.status === 'confirmed' && !isUpcoming(b))
    ).length;

    const cancelled = allBookings.filter(b => b.status === 'cancelled').length;

    document.getElementById('countUpcoming').textContent = upcoming;
    document.getElementById('countPast').textContent = past;
    document.getElementById('countCancelled').textContent = cancelled;
    document.getElementById('countAll').textContent = allBookings.length;
}

/* =====================================================
   FILTER
===================================================== */
function applyFilter() {
    switch (currentFilter) {
        case 'upcoming':
            filteredBookings = allBookings.filter(b =>
                b.status === 'confirmed' && isUpcoming(b)
            ).sort((a, b) => new Date(a.travelDate) - new Date(b.travelDate));
            break;

        case 'past':
            filteredBookings = allBookings.filter(b =>
                b.status === 'completed' || (b.status === 'confirmed' && !isUpcoming(b))
            ).sort((a, b) => new Date(b.travelDate) - new Date(a.travelDate));
            break;

        case 'cancelled':
            filteredBookings = allBookings.filter(b => b.status === 'cancelled')
                .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
            break;

        case 'all':
        default:
            filteredBookings = [...allBookings].sort(
                (a, b) => new Date(b.travelDate || b.createdAt) - new Date(a.travelDate || a.createdAt)
            );
    }

    renderBookings();
}

/* =====================================================
   UPCOMING CHECK  (fixed: now uses date + departure time)
===================================================== */
function isUpcoming(booking) {
    if (!booking.travelDate) return true;

    const travel = new Date(booking.travelDate);

    // Attach departure time if available
    const depTime = booking.trip?.departureTime || booking.departureTime;
    if (depTime && typeof depTime === 'string' && depTime.includes(':')) {
        const [h, m] = depTime.split(':').map(Number);
        if (!Number.isNaN(h) && !Number.isNaN(m)) {
            travel.setHours(h, m, 0, 0);
        }
    } else {
        // No time known — treat as end of that day
        travel.setHours(23, 59, 59, 999);
    }

    return travel >= new Date();
}

/* =====================================================
   RENDER
===================================================== */
function renderBookings() {
    const container = document.getElementById('bookingsContainer');

    if (filteredBookings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-ticket-alt"></i>
                <h3>${emptyTitle()}</h3>
                <p>${emptyMessage()}</p>
                <a href="/student/find-bus.html" class="btn-new">
                    <i class="fas fa-search"></i> Find a Bus
                </a>
            </div>`;
        return;
    }

    container.innerHTML = filteredBookings.map(b => renderBookingCard(b)).join('');
}

function emptyTitle() {
    switch (currentFilter) {
        case 'upcoming':  return 'No upcoming bookings';
        case 'past':      return 'No past bookings';
        case 'cancelled': return 'No cancelled bookings';
        default:          return 'No bookings yet';
    }
}

function emptyMessage() {
    switch (currentFilter) {
        case 'upcoming':  return 'Book a seat for your upcoming class to see it here.';
        case 'past':      return 'Your completed trips will appear here.';
        case 'cancelled': return 'You have no cancelled bookings.';
        default:          return 'Start by booking a seat for your next trip.';
    }
}

/* =====================================================
   RENDER BOOKING CARD
===================================================== */
function renderBookingCard(b) {
    const trip = b.trip || {};
    const bus = b.bus || trip.bus || {};
    const route = b.route || trip.route || {};

    const busNumber = bus.busNumber || 'Bus';
    const routeName = route.name || 'Campus Route';
    const direction = b.direction || trip.direction || 'outbound';
    const seatNumber = b.seatNumber || '—';
    const date = b.travelDate ? formatDate(b.travelDate) : '—';
    const depTime = formatTime(trip.departureTime);
    const arrTime = formatTime(trip.arrivalTime);
    const bookingId = b.bookingId || `#${b._id?.slice(-6) || '—'}`;

    // Determine effective status
    const isLive = trip.status === 'in-progress';
    const isPast = !isUpcoming(b) && b.status === 'confirmed';
    let statusClass = 'confirmed';
    let statusLabel = 'Confirmed';
    let statusIcon = 'fa-check-circle';

    if (b.status === 'cancelled') {
        statusClass = 'cancelled'; statusLabel = 'Cancelled'; statusIcon = 'fa-times-circle';
    } else if (isLive) {
        statusClass = 'live'; statusLabel = 'Live Now'; statusIcon = 'fa-broadcast-tower';
    } else if (b.status === 'completed' || isPast) {
        statusClass = 'completed'; statusLabel = 'Completed'; statusIcon = 'fa-check-circle';
    }

    const directionLabel = direction === 'return' ? 'Return (Campus → Home)' : 'Outbound (Home → Campus)';

    // Action buttons
    let actionsHtml = '';

    if (b.status === 'confirmed' && isUpcoming(b)) {
        if (isLive) {
            actionsHtml += `
                <button class="act-btn track" onclick="trackBus('${b._id}')">
                    <i class="fas fa-map-marker-alt"></i> Track Bus
                </button>`;
        }
        actionsHtml += `
            <button class="act-btn cancel" onclick="openCancelModal('${b._id}')">
                <i class="fas fa-times"></i> Cancel
            </button>`;
    }

    actionsHtml += `
        <button class="act-btn details" onclick="openDetailsModal('${b._id}')">
            <i class="fas fa-info-circle"></i> View Details
        </button>`;

    return `
        <div class="booking-card ${statusClass}">
            <div class="booking-top">
                <span class="booking-id">
                    <i class="fas fa-hashtag"></i>${escapeHtml(bookingId)}
                </span>
                <span class="status-badge ${statusClass}">
                    ${statusClass === 'live' ? '<span class="pulse-dot"></span>' : `<i class="fas ${statusIcon}"></i>`}
                    ${statusLabel}
                </span>
            </div>

            <div class="booking-grid">
                <div class="booking-item">
                    <small><i class="fas fa-bus"></i> Bus</small>
                    <strong class="bus-highlight">${escapeHtml(busNumber)}</strong>
                </div>

                <div class="booking-item">
                    <small><i class="fas fa-route"></i> Route</small>
                    <div class="route-path">
                        ${escapeHtml(routeName)}
                    </div>
                </div>

                <div class="booking-item">
                    <small><i class="fas fa-calendar-day"></i> Date</small>
                    <strong>${date}</strong>
                </div>

                <div class="booking-item">
                    <small><i class="fas fa-clock"></i> Departure</small>
                    <strong>${depTime}</strong>
                </div>

                <div class="booking-item">
                    <small><i class="fas fa-chair"></i> Seat</small>
                    <strong>${escapeHtml(String(seatNumber))}</strong>
                </div>

                <div class="booking-item">
                    <small><i class="fas fa-exchange-alt"></i> Direction</small>
                    <strong style="font-size:0.82rem;">${escapeHtml(directionLabel)}</strong>
                </div>
            </div>

            <div class="booking-actions">
                ${actionsHtml}
            </div>
        </div>
    `;
}

/* =====================================================
   CANCEL MODAL
===================================================== */
window.openCancelModal = function (bookingId) {
    const booking = allBookings.find(b => b._id === bookingId);
    if (!booking) return;

    cancelTargetId = bookingId;
    const busNumber = booking.bus?.busNumber || booking.trip?.bus?.busNumber || 'the bus';
    const date = booking.travelDate ? formatDate(booking.travelDate) : 'this trip';

    document.getElementById('cancelBus').textContent = busNumber;
    document.getElementById('cancelDate').textContent = date;
    document.getElementById('cancelModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closeCancelModal() {
    document.getElementById('cancelModal').classList.remove('active');
    document.body.style.overflow = '';
    cancelTargetId = null;
}

async function handleCancel() {
    if (!cancelTargetId) return;

    const btn = document.getElementById('confirmCancelBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelling...';

    try {
        const res = await fetch(`/api/bookings/${cancelTargetId}/cancel`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ cancellationReason: 'Cancelled by student' }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Cancel failed');

        // Update local list
        const idx = allBookings.findIndex(b => b._id === cancelTargetId);
        if (idx !== -1) {
            allBookings[idx] = data.data;
        }

        closeCancelModal();
        updateCounts();
        applyFilter();
        showToast('success', 'Booking cancelled', 'Your seat has been released.');
    } catch (err) {
        showToast('error', 'Cancellation failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/* =====================================================
   DETAILS MODAL
===================================================== */
window.openDetailsModal = function (bookingId) {
    const b = allBookings.find(x => x._id === bookingId);
    if (!b) return;

    const trip = b.trip || {};
    const bus = b.bus || trip.bus || {};
    const route = b.route || trip.route || {};

    const direction = b.direction || trip.direction || 'outbound';
    const directionLabel = direction === 'return' ? 'Return (Campus → Home)' : 'Outbound (Home → Campus)';

    document.getElementById('detailsBody').innerHTML = `
        <div class="detail-section-title">Booking Information</div>
        <div class="detail-row">
            <span>Booking ID</span>
            <strong>${escapeHtml(b.bookingId || '—')}</strong>
        </div>
        <div class="detail-row">
            <span>Status</span>
            <strong>${escapeHtml(b.status || '—')}</strong>
        </div>
        <div class="detail-row">
            <span>Direction</span>
            <strong>${escapeHtml(directionLabel)}</strong>
        </div>
        <div class="detail-row">
            <span>Seat Number</span>
            <strong>${escapeHtml(String(b.seatNumber || '—'))}</strong>
        </div>

        <div class="detail-section-title">Trip Details</div>
        <div class="detail-row">
            <span>Bus</span>
            <strong>${escapeHtml(bus.busNumber || '—')}</strong>
        </div>
        <div class="detail-row">
            <span>Route</span>
            <strong>${escapeHtml(route.name || '—')}</strong>
        </div>
        <div class="detail-row">
            <span>Date</span>
            <strong>${b.travelDate ? formatDate(b.travelDate) : '—'}</strong>
        </div>
        <div class="detail-row">
            <span>Departure</span>
            <strong>${formatTime(trip.departureTime)}</strong>
        </div>
        <div class="detail-row">
            <span>Arrival</span>
            <strong>${formatTime(trip.arrivalTime)}</strong>
        </div>
    `;

    document.getElementById('detailsModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('active');
    document.body.style.overflow = '';
}

/* =====================================================
   TRACK BUS
===================================================== */
window.trackBus = function (bookingId) {
    const b = allBookings.find(x => x._id === bookingId);
    const tripId = b?.trip?._id || b?.trip || b?.tripId;
    if (tripId) {
        window.location.href = `/student/track-bus.html?tripId=${tripId}`;
    } else {
        window.location.href = '/student/track-bus.html';
    }
};

/* =====================================================
   TOASTS
===================================================== */
function showToast(type, title, message = '') {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
        <div class="toast-content">
            <h5>${escapeHtml(title)}</h5>
            ${message ? `<p>${escapeHtml(message)}</p>` : ''}
        </div>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s ease reverse';
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

function formatDate(date) {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}