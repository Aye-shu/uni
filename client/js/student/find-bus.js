/* =====================================================
   UNIBUS — Find Bus Page Logic
===================================================== */

let allBuses = [];
let recommendation = null;
let userClasses = [];
let user = null;

document.addEventListener('DOMContentLoaded', async () => {
    // ---------- Auth ----------
    user = await checkAuth();
    if (!user) return;

    document.getElementById('userName').textContent = user.name || 'Student';
    document.getElementById('userRole').textContent = user.role || 'student';
    document.getElementById('userAvatar').textContent = (user.name || 'S').charAt(0).toUpperCase();

    // ---------- Default date = today ----------
    const dateInput = document.getElementById('filterDate');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    //dateInput.min = today;

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

    // ---------- Filter events ----------
    document.getElementById('searchBtn')?.addEventListener('click', searchBuses);
    document.getElementById('resetBtn')?.addEventListener('click', resetFilters);
    document.getElementById('filterDirection')?.addEventListener('change', searchBuses);
    document.getElementById('filterSort')?.addEventListener('change', renderBusList);
    document.getElementById('filterDate')?.addEventListener('change', searchBuses);

    // ---------- Initial load ----------
    await loadClasses();
    await searchBuses();
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
   LOAD CLASSES (for recommendations)
===================================================== */
async function loadClasses() {
    try {
        const res = await fetch('/api/classes', { credentials: 'include' });
        const data = await res.json();
        userClasses = data.data || [];
    } catch (err) {
        console.error('Failed to load classes:', err);
        userClasses = [];
    }
}

/* =====================================================
   SEARCH BUSES
===================================================== */
async function searchBuses() {
    const direction = document.getElementById('filterDirection').value;
    const date = document.getElementById('filterDate').value;

    // Show loading
    showSkeleton();

    try {
        // Fetch all trips and filter by direction
        const tripsRes = await fetch(`/api/trips?direction=${direction}`, { credentials: 'include' });
        const tripsData = await tripsRes.json();
        let trips = tripsData.data || [];

        // Filter trips by day matching the selected date
        const selectedDay = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
        trips = trips.filter(t =>
            (t.status === 'scheduled' || t.status === 'delayed') &&
            (t.day === selectedDay || !t.day)
        );

        allBuses = trips;

        // Compute recommendation
        recommendation = computeRecommendation(trips, date, direction);
        renderRecommendation(recommendation);
        renderBusList();
    } catch (err) {
        console.error('Search error:', err);
        showToast('error', 'Search failed', err.message);
        allBuses = [];
        recommendation = null;
        renderRecommendation(null);
        renderBusList();
    }
}

/* =====================================================
   COMPUTE RECOMMENDATION
   Best bus = departs 60–90 min before the next class
===================================================== */
function computeRecommendation(trips, date, direction) {
    if (trips.length === 0) return null;

    const selectedDay = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    const classesToday = userClasses
        .filter(c => c.day === selectedDay)
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    if (classesToday.length === 0) return null;

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const isToday = date === new Date().toISOString().split('T')[0];

    // Find next upcoming class
    let nextClass = classesToday[0];
    if (isToday) {
        const upcoming = classesToday.find(c => timeToMinutes(c.startTime) > nowMin);
        if (!upcoming) return null;
        nextClass = upcoming;
    }

    const classStart = timeToMinutes(nextClass.startTime);

    // Best bus: departs 60–120 min before class start (outbound only)
    const candidates = trips
        .filter(t => Number(t.availableSeats ?? 0) > 0)
        .map(t => ({ trip: t, dep: timeToMinutes(t.departureTime) }))
        .filter(x => {
            if (direction === 'return') return true;
            return x.dep >= classStart - 120 && x.dep <= classStart - 30;
        })
        .sort((a, b) => Math.abs(a.dep - (classStart - 75)) - Math.abs(b.dep - (classStart - 75)));

    if (candidates.length === 0) return null;

    const best = candidates[0].trip;
    return { trip: best, class: nextClass };
}

/* =====================================================
   RENDER RECOMMENDATION BANNER
===================================================== */
function renderRecommendation(rec) {
    const container = document.getElementById('recommendationBanner');

    if (!rec) {
        container.innerHTML = `
            <div class="rec-banner no-rec">
                <div class="rec-icon"><i class="fas fa-info-circle"></i></div>
                <div class="rec-info">
                    <h3>No recommendation right now</h3>
                    <p>No upcoming class found. Browse all available buses below.</p>
                </div>
            </div>`;
        return;
    }

    const t = rec.trip;
    const cls = rec.class;
    const busNum = t.bus?.busNumber || 'Bus';
    const routeName = t.route?.name || 'Campus Route';

    container.innerHTML = `
        <div class="rec-banner">
            <span class="rec-badge"><i class="fas fa-star"></i> Recommended</span>
            <div class="rec-icon"><i class="fas fa-bus"></i></div>
            <div class="rec-info">
                <h3>${busNum} · ${escapeHtml(routeName)}</h3>
                <p>Best bus for your next class</p>
                <span class="rec-why">Based on your ${escapeHtml(cls.code || cls.subject)} class at ${formatTime(cls.startTime)}</span>
                <div class="rec-meta">
                    <span><i class="fas fa-clock"></i> Departs ${formatTime(t.departureTime)}</span>
                    <span><i class="fas fa-chair"></i> ${t.availableSeats} seats left</span>
                    <span><i class="fas fa-route"></i> ${escapeHtml(t.direction || 'outbound')}</span>
                </div>
            </div>
            <button class="btn-rec-book" onclick="bookBus('${t._id}')">
                <i class="fas fa-ticket-alt"></i> Book This Bus
            </button>
        </div>`;
}

/* =====================================================
   RENDER BUS LIST
===================================================== */
function renderBusList() {
    const container = document.getElementById('busList');
    const countEl = document.getElementById('busCount');
    const sortBy = document.getElementById('filterSort').value;

    let buses = [...allBuses];

    // Sort
    if (sortBy === 'departure') {
        buses.sort((a, b) => timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime));
    } else if (sortBy === 'seats') {
        buses.sort((a, b) => b.availableSeats - a.availableSeats);
    } else {
        // recommended: put recommended first
        if (recommendation) {
            buses.sort((a, b) => {
                if (a._id === recommendation.trip._id) return -1;
                if (b._id === recommendation.trip._id) return 1;
                return timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime);
            });
        } else {
            buses.sort((a, b) => timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime));
        }
    }

    countEl.textContent = `${buses.length} ${buses.length === 1 ? 'bus' : 'buses'}`;

    if (buses.length === 0) {
        container.innerHTML = `
            <div class="empty-buses">
                <i class="fas fa-bus-slash"></i>
                <h3>No buses found</h3>
                <p>No buses available for this date and direction. Try changing the filters.</p>
            </div>`;
        return;
    }

    container.innerHTML = buses.map(b => renderBusCard(b)).join('');
}

function renderBusCard(trip) {
    const isRec = recommendation && recommendation.trip._id === trip._id;
    const isFull = trip.availableSeats <= 0;
    const isDelayed = trip.status === 'delayed';
    const isLive = trip.isLive === true;

    const busNum = trip.bus?.busNumber || 'Bus';
    const routeName = trip.route?.name || 'Campus Route';
    const capacity = Number(trip.bus?.capacity ?? 40);
    const available = Number(trip.availableSeats ?? 0);
    const fillPct = capacity > 0 ? ((capacity - available) / capacity) * 100 : 0;

    let fillClass = '';
    if (fillPct >= 80) fillClass = 'critical';
    else if (fillPct >= 50) fillClass = 'low';

    let statusHtml = '';
    if (isFull) {
        statusHtml = `<span class="bus-status full"><i class="fas fa-ban"></i> Full</span>`;
    } else if (isDelayed) {
        statusHtml = `<span class="bus-status delayed"><span class="dot"></span> Delayed ${trip.delayMinutes || 0} min</span>`;
    } else if (isLive) {
        statusHtml = `<span class="bus-status live"><span class="dot"></span> Live Now</span>`;
    } else {
        statusHtml = `<span class="bus-status ontime"><i class="fas fa-check-circle"></i> On Time</span>`;
    }

    return `
        <div class="bus-card ${isRec ? 'recommended' : ''} ${isFull ? 'full' : ''}">
            <div class="bus-number-badge">
                <i class="fas fa-bus"></i>
                <strong>${escapeHtml(busNum)}</strong>
            </div>

            <div class="bus-details">
                <div class="bus-route">
                    <i class="fas fa-route"></i>
                    ${escapeHtml(routeName)}
                    <span class="arrow">→</span>
                    ${escapeHtml(trip.direction === 'return' ? 'Home' : 'Campus')}
                </div>

                <div class="bus-meta-row">
                    <div class="bus-meta-item">
                        <i class="fas fa-clock"></i>
                        Departs <strong>${formatTime(trip.departureTime)}</strong>
                    </div>
                    ${trip.arrivalTime ? `
                        <div class="bus-meta-item">
                            <i class="fas fa-flag-checkered"></i>
                            Arrives <strong>${formatTime(trip.arrivalTime)}</strong>
                        </div>
                    ` : ''}
                    ${isRec ? `<div class="bus-meta-item" style="color: var(--primary); font-weight: 700;">
                        <i class="fas fa-star"></i> Recommended
                    </div>` : ''}
                </div>

                <div class="seat-availability">
                    <div class="seat-bar">
                        <div class="seat-bar-fill ${fillClass}" style="width: ${100 - fillPct}%"></div>
                    </div>
                    <span class="seat-text"><strong>${available}</strong> / ${capacity} seats</span>
                    ${statusHtml}
                </div>
            </div>

            <div class="bus-actions">
                <button class="btn-book" ${isFull ? 'disabled' : ''} onclick="bookBus('${trip._id}')">
                    <i class="fas fa-ticket-alt"></i>
                    ${isFull ? 'Full' : 'Book Seat'}
                </button>
                ${isLive ? `
                    <button class="btn-track" onclick="trackBus('${trip._id}')">
                        <i class="fas fa-map-marker-alt"></i> Track
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

/* =====================================================
   BOOKING
===================================================== */
window.bookBus = function (tripId) {
    const trip = allBuses.find(t => t._id === tripId);
    if (!trip) return;

    // Save selected trip for seat-selection page
    localStorage.setItem('unibus_selected_trip', JSON.stringify({
        tripId,
        busNumber: trip.bus?.busNumber,
        routeName: trip.route?.name,
        departureTime: trip.departureTime,
        direction: trip.direction,
        date: document.getElementById('filterDate').value,
    }));

const date = document.getElementById('filterDate').value;
window.location.href = `/student/seat-selection.html?tripId=${tripId}&date=${date}`;
};

window.trackBus = function (tripId) {
    window.location.href = `/student/track-bus.html?tripId=${tripId}`;
};

/* =====================================================
   RESET FILTERS
===================================================== */
function resetFilters() {
    document.getElementById('filterDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('filterDirection').value = 'outbound';
    document.getElementById('filterSort').value = 'recommended';
    searchBuses();
}

/* =====================================================
   SKELETON
===================================================== */
function showSkeleton() {
    document.getElementById('busList').innerHTML = `
        <div class="bus-card skeleton-card">
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
        </div>
        <div class="bus-card skeleton-card">
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
        </div>`;
}

/* =====================================================
   TOASTS
===================================================== */
function showToast(type, title, message = '') {
    const container = document.getElementById('toastContainer');
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
    };
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

function timeToMinutes(time) {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}