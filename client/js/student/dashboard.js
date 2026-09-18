/* =====================================================
   UNIBUS — Student Dashboard JavaScript
===================================================== */

document.addEventListener('DOMContentLoaded', async () => {
    // ---------- Auth Check ----------
    const user = await checkAuth();
    if (!user) return;

    document.getElementById('userName').textContent = user.name || 'Student';
    document.getElementById('userRole').textContent = user.role || 'student';
    document.getElementById('welcomeName').textContent = user.name?.split(' ')[0] || 'Student';
    document.getElementById('userAvatar').textContent = (user.name || 'S').charAt(0).toUpperCase();

    const today = new Date();
    document.getElementById('welcomeDate').textContent = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    // ---------- Load Dashboard Data ----------
    const [classes, bookings, notifications, trips] = await Promise.all([
        fetchAPI('/api/classes'),
        fetchAPI('/api/bookings'),
        fetchAPI('/api/notifications'),
        fetchAPI('/api/trips'),
    ]);

    renderTodayClasses(classes?.data || []);
    renderRecommendation(classes?.data || [], trips?.data || []);
    renderUpcomingBookings(bookings?.data || []);
    renderNotifications(notifications?.data || []);

    // ---------- Update Stats ----------
    const todayName = today.toLocaleDateString('en-US', { weekday: 'long' });
    const todayClasses = (classes?.data || []).filter(c => c.day === todayName);
    const upcomingBookings = (bookings?.data || []).filter(b => b.status === 'confirmed');
    const activeDelays = (trips?.data || []).filter(t => t.status === 'delayed');

    document.getElementById('statClasses').textContent = todayClasses.length;
    document.getElementById('statBookings').textContent = upcomingBookings.length;
    document.getElementById('statBuses').textContent = (trips?.data || []).length;
    document.getElementById('statDelays').textContent = activeDelays.length;

    document.getElementById('welcomeSummary').textContent =
        `You have ${todayClasses.length} class${todayClasses.length !== 1 ? 'es' : ''} today and ${upcomingBookings.length} upcoming trip${upcomingBookings.length !== 1 ? 's' : ''}.`;

    // ---------- Init Mini Map ----------
    initMiniMap();

    // ---------- Sidebar Toggle (mobile) ----------
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    menuToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

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
        try {
            await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' });
        } catch (e) {}
        window.location.href = '/login.html';
    });
});

/* =====================================================
   AUTH
===================================================== */
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/get-session', { credentials: 'include' });
        if (!res.ok) throw new Error('Not authenticated');
        const data = await res.json();
        if (!data.user) throw new Error('No user');
        if (data.user.role !== 'student') {
            if (data.user.role === 'driver') window.location.href = '/driver/dashboard.html';
            else if (data.user.role === 'admin') window.location.href = '/admin/dashboard.html';
            return null;
        }
        return data.user;
    } catch (e) {
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
    } catch (e) {
        console.error(`API error (${endpoint}):`, e);
        return { data: [] };
    }
}

/* =====================================================
   TODAY'S CLASSES
===================================================== */
function renderTodayClasses(classes) {
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayClasses = classes.filter(c => c.day === todayName);
    const container = document.getElementById('todayClasses');

    if (todayClasses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-mug-hot"></i>
                <p>No classes today. Enjoy your day! ☀️</p>
            </div>`;
        return;
    }

    container.innerHTML = todayClasses.map(cls => `
        <div class="class-item">
            <div class="class-time-badge">
                ${formatTime(cls.startTime)}
                <div style="font-size:0.7rem;color:var(--gray);font-weight:500;">${formatTime(cls.endTime)}</div>
            </div>
            <div class="class-details">
                <h4>${escapeHtml(cls.subject)}</h4>
                <p><i class="fas fa-map-marker-alt"></i> ${escapeHtml(cls.location || 'N/A')} ${cls.room ? '· Room ' + escapeHtml(cls.room) : ''}</p>
            </div>
            <span class="status-badge scheduled">${escapeHtml(cls.code || '')}</span>
        </div>
    `).join('');
}

/* =====================================================
   SMART RECOMMENDATION
===================================================== */
function renderRecommendation(classes, trips) {
    const container = document.getElementById('recommendationContent');
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayClasses = classes.filter(c => c.day === todayName);

    if (todayClasses.length === 0 || trips.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-star"></i>
                <p>No recommendations right now.</p>
            </div>`;
        return;
    }

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const upcoming = todayClasses
        .map(c => ({ ...c, startMin: timeToMinutes(c.startTime) }))
        .filter(c => c.startMin > nowMinutes)
        .sort((a, b) => a.startMin - b.startMin);

    const nextClass = upcoming[0] || todayClasses[0];
    const availableTrips = trips.filter(t => t.status === 'scheduled' && t.availableSeats > 0);

    if (availableTrips.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bus"></i>
                <p>No buses available right now.</p>
            </div>`;
        return;
    }

    const bestTrip = availableTrips[0];

    container.innerHTML = `
        <div class="rec-box">
            <div class="rec-bus-icon"><i class="fas fa-bus"></i></div>
            <div class="rec-info">
                <h4>${escapeHtml(bestTrip.bus?.busNumber || 'Bus')} · ${escapeHtml(bestTrip.route?.name || 'Route')}</h4>
                <p>For your next class: <strong>${escapeHtml(nextClass.subject)}</strong> at ${formatTime(nextClass.startTime)}</p>
                <div class="rec-meta">
                    <span><i class="fas fa-clock"></i> ${formatTime(bestTrip.departureTime)}</span>
                    <span><i class="fas fa-chair"></i> ${bestTrip.availableSeats} seats</span>
                    <span><i class="fas fa-route"></i> ${escapeHtml(bestTrip.direction || 'outbound')}</span>
                </div>
            </div>
        </div>
        <a href="/student/find-bus.html" class="rec-btn">
            <i class="fas fa-ticket-alt"></i> Book This Bus
        </a>
    `;
}

/* =====================================================
   UPCOMING BOOKINGS
===================================================== */
function renderUpcomingBookings(bookings) {
    const container = document.getElementById('upcomingBookings');
    const upcoming = bookings
        .filter(b => b.status === 'confirmed')
        .slice(0, 3);

    if (upcoming.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-ticket-alt"></i>
                <p>No upcoming bookings. <a href="/student/find-bus.html" style="color:var(--primary);font-weight:600;">Book a seat →</a></p>
            </div>`;
        return;
    }

    container.innerHTML = upcoming.map(b => `
        <div class="booking-item">
            <div class="booking-badge">
                ${b.travelDate ? new Date(b.travelDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Today'}
            </div>
            <div class="booking-details">
                <h4>${escapeHtml(b.bus?.busNumber || 'Bus')} · Seat ${escapeHtml(b.seatNumber || 'N/A')}</h4>
                <p>${escapeHtml(b.route?.name || 'Route')} · ${escapeHtml(b.direction || 'outbound')}</p>
            </div>
            <span class="status-badge ${b.status}">${escapeHtml(b.status)}</span>
        </div>
    `).join('');
}

/* =====================================================
   NOTIFICATIONS
===================================================== */
function renderNotifications(notifications) {
    const container = document.getElementById('notificationsList');
    const recent = notifications.slice(0, 5);

    if (recent.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>No notifications yet.</p>
            </div>`;
        return;
    }

    const iconMap = {
        booking: { icon: 'fa-ticket-alt', class: 'booking' },
        delay: { icon: 'fa-exclamation-triangle', class: 'delay' },
        trip: { icon: 'fa-bus', class: 'trip' },
        general: { icon: 'fa-info-circle', class: 'general' },
        alert: { icon: 'fa-bell', class: 'delay' },
    };

    container.innerHTML = recent.map(n => {
        const meta = iconMap[n.type] || iconMap.general;
        return `
            <div class="notification-item" style="${n.isRead ? 'opacity:0.6;' : ''}">
                <div class="notif-icon ${meta.class}">
                    <i class="fas ${meta.icon}"></i>
                </div>
                <div class="notif-content">
                    <h5>${escapeHtml(n.title)}</h5>
                    <p>${escapeHtml(n.message)}</p>
                    <span class="notif-time">${timeAgo(n.createdAt)}</span>
                </div>
            </div>
        `;
    }).join('');

    const unread = notifications.filter(n => !n.isRead).length;
    const badge = document.getElementById('notifBadge');
    if (unread > 0) {
        badge.textContent = unread;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

/* =====================================================
   MINI MAP (Leaflet) — CartoDB tiles (no 403)
===================================================== */
function initMiniMap() {
    const mapEl = document.getElementById('miniMap');
    if (!mapEl || typeof L === 'undefined') return;

    const map = L.map('miniMap', {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
    }).setView([23.8103, 90.4125], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '© OpenStreetMap · © CARTO',
    }).addTo(map);

    L.marker([23.8103, 90.4125])
        .addTo(map)
        .bindPopup('Your bus location');
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

function timeAgo(date) {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}