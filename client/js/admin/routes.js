/* =====================================================
   UNIBUS — Manage Routes Page Logic
===================================================== */

let allRoutes = [];
let filteredRoutes = [];
let editingId = null;
let deleteTargetId = null;
let user = null;
let stopCounter = 0;

document.addEventListener('DOMContentLoaded', async () => {
    user = await checkAuth();
    if (!user) return;

    document.getElementById('userName').textContent = user.name || 'Admin';
    document.getElementById('userRole').textContent = user.role || 'admin';
    document.getElementById('userAvatar').textContent = (user.name || 'A').charAt(0).toUpperCase();

    // Sidebar toggle
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

    // Buttons
    document.getElementById('addRouteBtn')?.addEventListener('click', () => openModal());
    document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('cancelBtn')?.addEventListener('click', closeModal);
    document.getElementById('routeModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'routeModal') closeModal();
    });
    document.getElementById('addStopBtn')?.addEventListener('click', () => addStopRow());

    // Save
    document.getElementById('routeForm')?.addEventListener('submit', saveRoute);

    // Stops modal
    document.getElementById('closeStopsBtn')?.addEventListener('click', () => {
        document.getElementById('stopsModal').classList.remove('active');
        document.body.style.overflow = '';
    });
    document.getElementById('stopsModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'stopsModal') {
            document.getElementById('stopsModal').classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // Delete modal
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', deleteRoute);
    document.getElementById('deleteModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'deleteModal') closeDeleteModal();
    });

    // Filters
    document.getElementById('searchInput')?.addEventListener('input', applyFilters);
    document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
    document.getElementById('directionFilter')?.addEventListener('change', applyFilters);
    document.getElementById('sortFilter')?.addEventListener('change', applyFilters);
    document.getElementById('resetFiltersBtn')?.addEventListener('click', resetFilters);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeDeleteModal();
            document.getElementById('stopsModal').classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    await loadRoutes();
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
   LOAD
===================================================== */
async function loadRoutes() {
    try {
        const res = await fetch('/api/routes', { credentials: 'include' });
        const data = await res.json();
        allRoutes = data.data || [];
        applyFilters();
    } catch (err) {
        console.error('Load routes error:', err);
        allRoutes = [];
        applyFilters();
    }
}

/* =====================================================
   FILTERS
===================================================== */
function applyFilters() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const status = document.getElementById('statusFilter')?.value || 'all';
    const direction = document.getElementById('directionFilter')?.value || 'all';
    const sortBy = document.getElementById('sortFilter')?.value || 'name';

    filteredRoutes = allRoutes.filter(route => {
        if (search) {
            const haystack = `${route.name || ''} ${route.code || ''} ${route.startPoint || ''} ${route.endPoint || ''}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        if (status !== 'all' && route.status !== status) return false;
        if (direction !== 'all' && route.direction !== direction) return false;
        return true;
    });

    filteredRoutes.sort((a, b) => {
        switch (sortBy) {
            case 'stops':
                return (b.stops?.length || 0) - (a.stops?.length || 0);
            case 'duration':
                return (b.estimatedDuration || 0) - (a.estimatedDuration || 0);
            case 'name':
            default:
                return (a.name || '').localeCompare(b.name || '');
        }
    });

    renderRoutes();
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('directionFilter').value = 'all';
    document.getElementById('sortFilter').value = 'name';
    applyFilters();
}

/* =====================================================
   RENDER
===================================================== */
function renderRoutes() {
    const container = document.getElementById('routesContainer');
    const countEl = document.getElementById('routeCount');

    countEl.textContent = `${filteredRoutes.length} ${filteredRoutes.length === 1 ? 'route' : 'routes'}`;

    if (filteredRoutes.length === 0) {
        const isEmpty = allRoutes.length === 0;
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-route"></i>
                <h3>${isEmpty ? 'No routes yet' : 'No matching routes'}</h3>
                <p>${isEmpty
                    ? 'Start by adding your first bus route.'
                    : 'Try adjusting your search or filters.'}</p>
                ${isEmpty ? `
                    <button type="button" class="btn-add" onclick="document.getElementById('addRouteBtn').click()">
                        <i class="fas fa-plus"></i> Add Your First Route
                    </button>` : ''}
            </div>`;
        return;
    }

    container.innerHTML = filteredRoutes.map(r => renderRouteCard(r)).join('');
}

function renderRouteCard(route) {
    const stops = (route.stops || []).filter(Boolean);
    const direction = route.direction || 'outbound';
    const status = route.status || 'active';

    // Stops preview (first 3 + "more")
    const previewStops = stops.slice(0, 3).map(s =>
        `<span class="stop-name">${escapeHtml(s.name || 'Stop')}</span>`
    ).join('<span class="arrow">→</span>');
    const moreCount = stops.length > 3
        ? `<span class="more">+${stops.length - 3} more</span>`
        : '';

    return `
        <div class="route-card">
            <div class="route-card-header">
                <div class="route-title">
                    <h3>${escapeHtml(route.name || 'Route')}</h3>
                    <small>${escapeHtml(route.description || direction)}</small>
                </div>
                <span class="route-code">${escapeHtml(route.code || '')}</span>
            </div>

            <div class="route-meta">
                <div class="route-meta-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>Start: <strong>${escapeHtml(route.startPoint || '—')}</strong></span>
                </div>
                <div class="route-meta-item">
                    <i class="fas fa-flag-checkered"></i>
                    <span>End: <strong>${escapeHtml(route.endPoint || '—')}</strong></span>
                </div>
                <div class="route-meta-item">
                    <i class="fas fa-clock"></i>
                    <span><strong>${route.estimatedDuration || 0}</strong> min</span>
                </div>
                <div class="route-meta-item">
                    <i class="fas fa-road"></i>
                    <span><strong>${route.distance || 0}</strong> km</span>
                </div>
            </div>

            <div class="route-stops-preview">
                <i class="fas fa-map-signs" style="color: var(--primary);"></i>
                ${previewStops || '<span class="stop-name">No stops</span>'}
                ${moreCount}
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                <span class="status-pill ${status}">
                    <i class="fas fa-circle"></i> ${status === 'active' ? 'Active' : 'Inactive'}
                </span>
                <span style="font-size: 0.78rem; color: var(--gray); font-family: 'DM Sans', sans-serif;">
                    ${stops.length} stop${stops.length !== 1 ? 's' : ''}
                </span>
            </div>

            <div class="route-actions">
                <button class="act-btn stops" onclick="viewStops('${route._id}')">
                    <i class="fas fa-map-signs"></i> Stops
                </button>
                <button class="act-btn edit" onclick="editRoute('${route._id}')">
                    <i class="fas fa-pen"></i> Edit
                </button>
                <button class="act-btn delete" onclick="confirmDelete('${route._id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

/* =====================================================
   VIEW STOPS
===================================================== */
window.viewStops = function (id) {
    const route = allRoutes.find(r => r._id === id);
    if (!route) return;

    document.getElementById('stopsRouteName').textContent = route.name || 'Route Stops';

    const stops = (route.stops || []).filter(Boolean);
    const container = document.getElementById('stopsView');

    if (stops.length === 0) {
        container.innerHTML = `
            <div class="stops-empty">
                <i class="fas fa-map-pin"></i>
                No stops added for this route yet.
            </div>`;
    } else {
        container.innerHTML = stops.map((stop, idx) => `
            <div class="stop-view-item">
                <div class="stop-view-num">${idx + 1}</div>
                <div class="stop-view-info">
                    <strong>${escapeHtml(stop.name || 'Stop ' + (idx + 1))}</strong>
                    <small>${stop.isCampusStop ? 'Campus stop' : 'En route'}${stop.address ? ' · ' + escapeHtml(stop.address) : ''}</small>
                </div>
            </div>
        `).join('');
    }

    document.getElementById('stopsModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

/* =====================================================
   MODAL — OPEN / CLOSE
===================================================== */
function openModal(route = null) {
    editingId = route?._id || null;
    const title = document.getElementById('modalTitle');
    title.innerHTML = route
        ? '<i class="fas fa-pen"></i> Edit Route'
        : '<i class="fas fa-route"></i> Add New Route';

    document.getElementById('routeForm').reset();
    clearErrors();
    document.getElementById('stopsList').innerHTML = '';
    stopCounter = 0;

    if (route) {
        document.getElementById('routeName').value = route.name || '';
        document.getElementById('routeCode').value = route.code || '';
        document.getElementById('startPoint').value = route.startPoint || '';
        document.getElementById('endPoint').value = route.endPoint || '';
        document.getElementById('direction').value = route.direction || 'outbound';
        document.getElementById('duration').value = route.estimatedDuration || 30;
        document.getElementById('distance').value = route.distance || '';
        document.getElementById('routeStatus').value = route.status || 'active';
        document.getElementById('description').value = route.description || '';

        // Load stops
        (route.stops || []).forEach(stop => {
            addStopRow(stop.name, stop.isCampusStop, stop.address);
        });
    }

    if (document.getElementById('stopsList').children.length === 0) {
        addStopRow();
    }

    document.getElementById('routeModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('routeName').focus(), 100);
}

function closeModal() {
    document.getElementById('routeModal').classList.remove('active');
    document.body.style.overflow = '';
    editingId = null;
}

/* =====================================================
   STOPS
===================================================== */
function addStopRow(name = '', isCampus = false, address = '') {
    const container = document.getElementById('stopsList');
    const id = `stop-${stopCounter++}`;

    const row = document.createElement('div');
    row.className = 'stop-row';
    row.dataset.stopId = id;
    row.innerHTML = `
        <span class="stop-order"></span>
        <input type="text" placeholder="Stop name" class="stop-name-input" value="${escapeHtml(name)}" />
        <input type="text" placeholder="Address (optional)" class="stop-address-input" value="${escapeHtml(address)}" />
        <button type="button" class="stop-remove" title="Remove">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(row);

    row.querySelector('.stop-remove').addEventListener('click', () => {
        row.remove();
        renumberStops();
    });

    renumberStops();
}

function renumberStops() {
    document.querySelectorAll('#stopsList .stop-row').forEach((row, idx) => {
        row.querySelector('.stop-order').textContent = idx + 1;
    });
}

function collectStops() {
    const rows = document.querySelectorAll('#stopsList .stop-row');
    const stops = [];
    rows.forEach(row => {
        const name = row.querySelector('.stop-name-input').value.trim();
        const address = row.querySelector('.stop-address-input').value.trim();
        if (name) {
            stops.push({
                name,
                address: address || undefined,
                isCampusStop: false,
            });
        }
    });
    return stops;
}

/* =====================================================
   EDIT / DELETE HANDLERS
===================================================== */
window.editRoute = function (id) {
    const route = allRoutes.find(r => r._id === id);
    if (route) openModal(route);
};

window.confirmDelete = function (id) {
    const route = allRoutes.find(r => r._id === id);
    if (!route) return;
    deleteTargetId = id;
    document.getElementById('deleteRouteName').textContent =
        `${route.name || 'this route'} (${route.code || ''})`;
    document.getElementById('deleteModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    document.body.style.overflow = '';
    deleteTargetId = null;
}

/* =====================================================
   SAVE
===================================================== */
async function saveRoute(e) {
    e.preventDefault();
    clearErrors();

    const name = document.getElementById('routeName').value.trim();
    const code = document.getElementById('routeCode').value.trim();
    const startPoint = document.getElementById('startPoint').value.trim();
    const endPoint = document.getElementById('endPoint').value.trim();
    const direction = document.getElementById('direction').value;
    const estimatedDuration = parseInt(document.getElementById('duration').value, 10);
    const distance = parseFloat(document.getElementById('distance').value) || 0;
    const status = document.getElementById('routeStatus').value;
    const description = document.getElementById('description').value.trim();

    const stops = collectStops();

    // Validation
    let hasError = false;
    if (!name) { setError('routeName', 'Route name is required'); hasError = true; }
    if (!code) { setError('routeCode', 'Route code is required'); hasError = true; }
    if (!startPoint) { setError('startPoint', 'Start point is required'); hasError = true; }
    if (!endPoint) { setError('endPoint', 'End point is required'); hasError = true; }
    if (!estimatedDuration || estimatedDuration < 1) {
        setError('duration', 'Duration must be at least 1 minute');
        hasError = true;
    }
    if (stops.length < 2) {
        showToast('error', 'At least 2 stops required', 'A route needs a starting and ending stop.');
        hasError = true;
    }

    if (hasError) return;

    const btn = document.getElementById('saveBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const url = editingId ? `/api/routes/${editingId}` : '/api/routes';
        const method = editingId ? 'PUT' : 'POST';

        const body = {
            name,
            code,
            startPoint,
            endPoint,
            direction,
            estimatedDuration,
            distance,
            status,
            description,
            stops,
        };

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Save failed');

        if (editingId) {
            const idx = allRoutes.findIndex(r => r._id === editingId);
            if (idx !== -1) allRoutes[idx] = data.data;
            showToast('success', 'Route updated', `${name} has been updated`);
        } else {
            allRoutes.push(data.data);
            showToast('success', 'Route added', `${name} has been added`);
        }

        closeModal();
        applyFilters();
    } catch (err) {
        showToast('error', 'Save failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/* =====================================================
   DELETE
===================================================== */
async function deleteRoute() {
    if (!deleteTargetId) return;
    const btn = document.getElementById('confirmDeleteBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    const route = allRoutes.find(r => r._id === deleteTargetId);
    const name = route?.name || 'Route';

    try {
        const res = await fetch(`/api/routes/${deleteTargetId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Delete failed');

        allRoutes = allRoutes.filter(r => r._id !== deleteTargetId);
        closeDeleteModal();
        applyFilters();
        showToast('success', 'Route deleted', `${name} has been removed`);
    } catch (err) {
        showToast('error', 'Delete failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* =====================================================
   ERRORS
===================================================== */
function setError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const err = document.getElementById('err' + capitalize(fieldId));
    if (input) input.classList.add('error');
    if (err) {
        err.textContent = message;
        err.classList.add('show');
    }
}

function clearErrors() {
    document.querySelectorAll('.form-field input, .form-field select').forEach(el => {
        el.classList.remove('error');
    });
    document.querySelectorAll('.field-error').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
    });
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
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}