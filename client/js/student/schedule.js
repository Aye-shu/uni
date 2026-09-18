let user = null;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

document.addEventListener('DOMContentLoaded', async () => {
    user = await checkAuth();
    if (!user) return;

    document.getElementById('userName').textContent = user.name || 'Student';
    document.getElementById('userRole').textContent = user.role || 'student';
    document.getElementById('userAvatar').textContent = (user.name || 'S').charAt(0).toUpperCase();

    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    menuToggle?.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 991 && sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) && !menuToggle.contains(e.target)) sidebar.classList.remove('open');
    });

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        try { await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' }); } catch {}
        window.location.href = '/login.html';
    });

    // Populate day dropdown
    const daySelect = document.getElementById('dayFilter');
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    DAYS.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        if (d === today) opt.selected = true;
        daySelect.appendChild(opt);
    });

    daySelect.addEventListener('change', loadSchedule);
    document.getElementById('directionFilter').addEventListener('change', loadSchedule);

    await loadSchedule();
});

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/get-session', { credentials: 'include' });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!data.user) throw new Error();
        if (data.user.role !== 'student') {
            window.location.href = data.user.role === 'driver' ? '/driver/dashboard.html' : '/admin/dashboard.html';
            return null;
        }
        return data.user;
    } catch { window.location.href = '/login.html'; return null; }
}

async function loadSchedule() {
    const day = document.getElementById('dayFilter').value;
    const direction = document.getElementById('directionFilter').value;
    const container = document.getElementById('scheduleTable');

    container.innerHTML = '<div class="loading-skeleton"><div class="skeleton-card"></div></div>';

    try {
        const res = await fetch(`/api/trips?direction=${direction}`, { credentials: 'include' });
        const data = await res.json();
        let trips = (data.data || []).filter(t => t.day === day);
        trips.sort((a, b) => a.departureTime.localeCompare(b.departureTime));

        if (trips.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No trips on ${day}</h3>
                    <p>Try a different day or direction.</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="schedule-grid">
                <div class="grid-header">
                    <span>Bus</span>
                    <span>Departs</span>
                    <span>Route</span>
                    <span>Arrives</span>
                    <span>Seats</span>
                    <span>Action</span>
                </div>
                ${trips.map(t => renderRow(t)).join('')}
            </div>`;
    } catch (err) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Failed to load</h3>
                <p>${escapeHtml(err.message || 'Try again later.')}</p>
            </div>`;
    }
}

function renderRow(t) {
    const bus = t.bus || {};
    const route = t.route || {};
    const available = t.availableSeats || 0;
    const capacity = bus.capacity || 40;
    const isFull = available <= 0;

    let status = 'ontime', statusLabel = 'On Time';
    if (t.status === 'delayed') { status = 'delayed'; statusLabel = 'Delayed'; }
    if (isFull) { status = 'full'; statusLabel = 'Full'; }

    return `
        <div class="grid-row">
            <span class="cell-bus">${escapeHtml(bus.busNumber || '—')}</span>
            <span class="cell-time">${formatTime(t.departureTime)}</span>
            <span class="cell-route">${escapeHtml(route.name || '—')}</span>
            <span class="cell-time">${formatTime(t.arrivalTime)}</span>
            <span class="cell-seats">${available}/${capacity}</span>
            <div class="cell-action">
                ${isFull
                    ? '<span class="disabled">Full</span>'
                    : `<a href="/student/seat-selection.html?tripId=${t._id}">Book →</a>`}
            </div>
        </div>
    `;
}

function formatTime(time) {
    if (!time) return '--:--';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}