let user = null;

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

    await loadRoutes();
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

async function loadRoutes() {
    const container = document.getElementById('routesList');
    try {
        const res = await fetch('/api/routes', { credentials: 'include' });
        const data = await res.json();
        const routes = data.data || [];

        if (routes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-route"></i>
                    <h3>No routes available</h3>
                    <p>Routes will appear here once added by the admin.</p>
                </div>`;
            return;
        }

        container.innerHTML = routes.map(r => renderRoute(r)).join('');
    } catch (err) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Failed to load routes</h3>
                <p>${escapeHtml(err.message || 'Try again later.')}</p>
            </div>`;
    }
}

function renderRoute(r) {
    const stops = (r.stops || []).filter(Boolean);
    const stopsHtml = stops.map((s, idx) => {
        const cls = idx === 0 ? 'first' : (idx === stops.length - 1 ? 'last' : '');
        return `
            <div class="stop-item ${cls}">
                <div class="stop-dot"></div>
                <div class="stop-info">
                    <strong>${escapeHtml(s.name || 'Stop')}</strong>
                    <small>${s.isCampusStop ? 'Campus stop' : 'En route'}</small>
                </div>
            </div>`;
    }).join('');

    return `
        <div class="route-card">
            <div class="route-card-header">
                <div class="route-title">
                    <h3>${escapeHtml(r.name || 'Route')}</h3>
                    <small>${escapeHtml(r.description || '')}</small>
                </div>
                <span class="route-code">${escapeHtml(r.code || '')}</span>
            </div>

            <div class="route-meta">
                <div class="route-meta-item">
                    <i class="fas fa-road"></i>
                    <span>Distance <strong>${r.distance || 0} km</strong></span>
                </div>
                <div class="route-meta-item">
                    <i class="fas fa-clock"></i>
                    <span>Duration <strong>${r.estimatedDuration || 0} min</strong></span>
                </div>
                <div class="route-meta-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span><strong>${stops.length}</strong> stops</span>
                </div>
            </div>

            <div class="stops-list">${stopsHtml}</div>
        </div>
    `;
}

function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}