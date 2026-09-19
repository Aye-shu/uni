/* =====================================================
   UNIBUS — Seat Selection Page Logic
===================================================== */

let currentTrip = null;
let currentSeats = { available: [], taken: [], total: 0, capacity: 0 };
let selectedSeat = null;
let user = null;
let selectedTravelDate = null;   // user-picked date

const FARE = 50; // Fare per seat

document.addEventListener('DOMContentLoaded', async () => {
    // ---------- Auth ----------
    user = await checkAuth();
    if (!user) return;

    document.getElementById('userName').textContent = user.name || 'Student';
    document.getElementById('userRole').textContent = user.role || 'student';
    document.getElementById('userAvatar').textContent = (user.name || 'S').charAt(0).toUpperCase();

    // ---------- Get tripId from URL ----------
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get('tripId');

    // ---------- Read user-picked date (from URL or localStorage) ----------
    selectedTravelDate = params.get('date') || null;
    if (!selectedTravelDate) {
        try {
            const stored = localStorage.getItem('unibus_selected_trip');
            if (stored) {
                const parsed = JSON.parse(stored);
                selectedTravelDate = parsed.date || null;
            }
        } catch (err) {
            console.warn('Could not read stored trip date:', err);
        }
    }

    if (!tripId) {
        // Maybe from localStorage
        const stored = localStorage.getItem('unibus_selected_trip');
        if (stored) {
            const parsed = JSON.parse(stored);
            window.location.href = `/student/seat-selection.html?tripId=${parsed.tripId}${parsed.date ? `&date=${parsed.date}` : ''}`;
            return;
        }
        showToast('error', 'No trip selected', 'Please choose a bus first.');
        setTimeout(() => window.location.href = '/student/find-bus.html', 1500);
        return;
    }

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

    // ---------- Load data ----------
    await loadTrip(tripId);
    await loadSeats(tripId);

    // ---------- Buttons ----------
    document.getElementById('confirmBtn')?.addEventListener('click', openConfirmModal);
    document.getElementById('cancelBtn')?.addEventListener('click', () => {
        window.location.href = '/student/find-bus.html';
    });
    document.getElementById('modalCancelBtn')?.addEventListener('click', closeConfirmModal);
    document.getElementById('modalConfirmBtn')?.addEventListener('click', createBooking);
    document.getElementById('confirmModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'confirmModal') closeConfirmModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeConfirmModal();
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
   LOAD TRIP DETAILS
===================================================== */
async function loadTrip(tripId) {
    try {
        const res = await fetch(`/api/trips/${tripId}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Trip not found');

        currentTrip = data.data;
        renderTripSummary();
        renderPanel();
    } catch (err) {
        showToast('error', 'Failed to load trip', err.message);
        setTimeout(() => window.location.href = '/student/find-bus.html', 1500);
    }
}

/* =====================================================
   LOAD SEATS
===================================================== */
async function loadSeats(tripId) {
    try {
        const res = await fetch(`/api/trips/${tripId}/seats`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load seats');

        currentSeats = data.data;
        renderSeatGrid();
    } catch (err) {
        console.error('Seat load error:', err);
        showToast('error', 'Failed to load seats', err.message);
        document.getElementById('seatGrid').innerHTML = `
            <div class="seat-loading" style="color:#dc2626;">
                <i class="fas fa-exclamation-circle"></i> Could not load seats
            </div>`;
    }
}

/* =====================================================
   DATE HELPERS
===================================================== */
function getTravelDate() {
    if (selectedTravelDate) return selectedTravelDate;
    if (currentTrip?.date) {
        const d = new Date(currentTrip.date);
        if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
}

function formatTravelDate() {
    const iso = getTravelDate();
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* =====================================================
   STOP ID HELPER
   Route stops may be full objects, subdocs, or IDs.
   Always return a plain 24-char hex string (or null).
===================================================== */
function extractStopId(stop) {
    if (!stop) return null;
    if (typeof stop === 'string') return stop;
    if (typeof stop === 'object') {
        if (stop._id) return String(stop._id);
        if (stop.id) return String(stop.id);
    }
    return null;
}

function getPickupStopId() {
    const stops = currentTrip?.route?.stops || [];
    return extractStopId(stops[0]);
}

function getDropoffStopId() {
    const stops = currentTrip?.route?.stops || [];
    return extractStopId(stops[stops.length - 1]);
}

/* =====================================================
   RENDER TRIP SUMMARY
===================================================== */
function renderTripSummary() {
    const t = currentTrip;
    const busNum = t.bus?.busNumber || 'Bus';
    const route = t.route?.name || 'Campus Route';
    const date = formatTravelDate();

    document.getElementById('tripSummary').innerHTML = `
        <div class="trip-summary-grid">
            <div class="trip-summary-item">
                <span>Bus</span>
                <strong class="bus-badge">${escapeHtml(busNum)}</strong>
            </div>
            <div class="trip-summary-item">
                <span>Route</span>
                <strong>${escapeHtml(route)}</strong>
            </div>
            <div class="trip-summary-item">
                <span>Date</span>
                <strong>${date}</strong>
            </div>
            <div class="trip-summary-item">
                <span>Departure</span>
                <strong>${formatTime(t.departureTime)}</strong>
            </div>
            <div class="trip-summary-item">
                <span>Direction</span>
                <strong>${escapeHtml(t.direction || 'outbound')}</strong>
            </div>
        </div>
    `;
}

/* =====================================================
   RENDER SEAT GRID
===================================================== */
function renderSeatGrid() {
    const grid = document.getElementById('seatGrid');
    const { capacity, taken } = currentSeats;

    if (!capacity) {
        grid.innerHTML = `<div class="seat-loading">No seats found for this trip.</div>`;
        return;
    }

    const takenSet = new Set(taken.map(String));
    let html = '';

    const rows = Math.ceil(capacity / 4);

    for (let r = 0; r < rows; r++) {
        const left1 = r * 4 + 1;
        const left2 = r * 4 + 2;
        const right1 = r * 4 + 3;
        const right2 = r * 4 + 4;

        html += seatCell(left1, takenSet, capacity);
        html += seatCell(left2, takenSet, capacity);

        html += `<div class="seat-aisle"></div>`;

        html += seatCell(right1, takenSet, capacity);
        html += seatCell(right2, takenSet, capacity);
    }

    grid.innerHTML = html;

    grid.querySelectorAll('.seat:not(.taken)').forEach((seatEl) => {
        seatEl.addEventListener('click', () => selectSeat(seatEl));
    });
}

function seatCell(num, takenSet, capacity) {
    if (num > capacity) return '<div class="seat-aisle"></div>';

    const numStr = String(num);
    const isTaken = takenSet.has(numStr);
    return `
        <div class="seat ${isTaken ? 'taken' : ''}"
             data-seat="${numStr}"
             role="button"
             tabindex="${isTaken ? -1 : 0}"
             aria-label="Seat ${numStr} ${isTaken ? 'taken' : 'available'}">
            ${num}
        </div>
    `;
}

/* =====================================================
   SELECT SEAT
===================================================== */
function selectSeat(el) {
    const seatNum = el.dataset.seat;

    if (selectedSeat === seatNum) {
        el.classList.remove('selected');
        selectedSeat = null;
        updateConfirmBtn();
        renderPanel();
        return;
    }

    document.querySelectorAll('.seat.selected').forEach((s) => s.classList.remove('selected'));

    el.classList.add('selected');
    selectedSeat = seatNum;
    updateConfirmBtn();
    renderPanel();
}

function updateConfirmBtn() {
    const btn = document.getElementById('confirmBtn');
    btn.disabled = !selectedSeat;
}

/* =====================================================
   RENDER BOOKING PANEL
===================================================== */
function renderPanel() {
    const t = currentTrip;
    if (!t) return;

    document.getElementById('panelBus').textContent = t.bus?.busNumber || '—';
    document.getElementById('panelRoute').textContent = t.route?.name || '—';
    document.getElementById('panelDate').textContent = formatTravelDate();
    document.getElementById('panelDeparture').textContent = formatTime(t.departureTime);
    document.getElementById('panelDirection').textContent = (t.direction || 'outbound');
    document.getElementById('panelSeat').textContent = selectedSeat ? `Seat ${selectedSeat}` : 'None';
    document.getElementById('panelFare').textContent = selectedSeat ? `৳ ${FARE}` : '৳ 0';
}

/* =====================================================
   CONFIRM MODAL
===================================================== */
function openConfirmModal() {
    if (!selectedSeat) return;

    document.getElementById('confirmSeat').textContent = `Seat ${selectedSeat}`;
    document.getElementById('confirmBus').textContent = currentTrip?.bus?.busNumber || 'the bus';
    document.getElementById('confirmDate').textContent = formatTravelDate();

    document.getElementById('confirmModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
    document.body.style.overflow = '';
}

/* =====================================================
   CREATE BOOKING
===================================================== */
async function createBooking() {
    if (!selectedSeat) return;

    const btn = document.getElementById('modalConfirmBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking...';

    try {
        const tripId = currentTrip._id;
        const travelDate = getTravelDate();

        // Extract only the stop IDs — never send whole stop objects
        const pickupStopId  = getPickupStopId();
        const dropoffStopId = getDropoffStopId();

        const res = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                tripId,
                seatNumber: selectedSeat,
                travelDate,
                pickupStop: pickupStopId,
                dropoffStop: dropoffStopId,
            }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Booking failed');

        closeConfirmModal();

        // Clear stored selection after successful booking
        localStorage.removeItem('unibus_selected_trip');

        showSuccess(data.data);
    } catch (err) {
        if (err.message.toLowerCase().includes('seat') && err.message.toLowerCase().includes('book')) {
            showToast('error', 'Seat just taken', 'Please choose another seat.');
            await loadSeats(currentTrip._id);
            selectedSeat = null;
            updateConfirmBtn();
            renderPanel();
        } else {
            showToast('error', 'Booking failed', err.message);
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/* =====================================================
   SUCCESS MODAL
===================================================== */
function showSuccess(booking) {
    const t = currentTrip;
    document.getElementById('successDetails').innerHTML = `
        <div class="row"><span>Booking ID</span><strong>${escapeHtml(booking.bookingId || '—')}</strong></div>
        <div class="row"><span>Bus</span><strong>${escapeHtml(t.bus?.busNumber || '')}</strong></div>
        <div class="row"><span>Seat</span><strong>${escapeHtml(booking.seatNumber)}</strong></div>
        <div class="row"><span>Date</span><strong>${escapeHtml(booking.travelDate ? new Date(booking.travelDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : formatTravelDate())}</strong></div>
        <div class="row"><span>Departure</span><strong>${formatTime(t.departureTime)}</strong></div>
    `;
    document.getElementById('successModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

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

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}