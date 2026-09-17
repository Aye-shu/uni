/* =====================================================
   UNIBUS — Report Problem Page Logic
===================================================== */

let user = null;
let socket = null;
let activeTrip = null;
let myReports = [];
let selectedIssueType = null;

let pendingReport = null; // used for confirmation step

const ISSUE_META = {
    traffic:   { label: 'Traffic',         icon: 'fa-traffic-light', cls: 'traffic' },
    breakdown: { label: 'Breakdown',       icon: 'fa-tools',         cls: 'breakdown' },
    accident:  { label: 'Accident',        icon: 'fa-car-crash',     cls: 'accident' },
    passenger: { label: 'Passenger Issue', icon: 'fa-users',         cls: 'passenger' },
    weather:   { label: 'Weather',         icon: 'fa-cloud-rain',    cls: 'weather' },
    other:     { label: 'Other',           icon: 'fa-ellipsis-h',    cls: 'other' },
};

const SEVERITY_META = {
    low:    { label: 'Low',    color: '#10b981' },
    medium: { label: 'Medium', color: '#eab308' },
    high:   { label: 'High',   color: '#dc2626' },
};

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

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        try { await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' }); } catch {}
        window.location.href = '/login.html';
    });

    // Issue buttons
    document.querySelectorAll('.issue-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.issue-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedIssueType = btn.dataset.value;
            document.getElementById('issueType').value = selectedIssueType;
            document.getElementById('errIssueType').classList.remove('show');
        });
    });

    // Quick reports
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.quick;
            document.querySelectorAll('.issue-btn').forEach(b => b.classList.remove('active'));
            const target = document.querySelector(`.issue-btn[data-value="${type}"]`);
            if (target) {
                target.classList.add('active');
                selectedIssueType = type;
                document.getElementById('issueType').value = type;
            }
            if (type === 'accident' || type === 'breakdown') {
                document.querySelector('input[name="severity"][value="high"]').checked = true;
            } else if (type === 'traffic') {
                document.querySelector('input[name="severity"][value="medium"]').checked = true;
                document.getElementById('estimatedDelay').value = '10';
            }
            document.getElementById('reportForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => openConfirmModal(), 400);
        });
    });

    document.getElementById('cancelBtn')?.addEventListener('click', resetForm);
    document.getElementById('reportForm')?.addEventListener('submit', handleSubmit);

    document.getElementById('cancelConfirmBtn')?.addEventListener('click', closeConfirmModal);
    document.getElementById('confirmSubmitBtn')?.addEventListener('click', confirmSubmit);
    document.getElementById('confirmModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'confirmModal') closeConfirmModal();
    });

    document.getElementById('successCloseBtn')?.addEventListener('click', () => {
        document.getElementById('successModal').classList.remove('active');
        document.body.style.overflow = '';
        resetForm();
    });

    document.getElementById('historyFilter')?.addEventListener('change', renderHistory);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeConfirmModal();
            document.getElementById('successModal').classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    await Promise.all([loadActiveTrip(), loadMyReports()]);
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
   LOAD ACTIVE TRIP
===================================================== */
async function loadActiveTrip() {
    const banner = document.getElementById('activeTripBanner');

    try {
        const [tripsRes, busesRes, routesRes] = await Promise.all([
            fetch('/api/trips', { credentials: 'include' }).then(r => r.json()),
            fetch('/api/buses', { credentials: 'include' }).then(r => r.json()),
            fetch('/api/routes', { credentials: 'include' }).then(r => r.json()),
        ]);

        const trips = tripsRes.data || [];
        const buses = busesRes.data || [];
        const routes = routesRes.data || [];

        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

        const active = trips.find(t => idsMatch(t.driver, user.id) && t.status === 'in-progress');
        const todayTrip = trips.find(t => idsMatch(t.driver, user.id) && t.day === today);
        const chosen = active || todayTrip;

        if (!chosen) {
            banner.innerHTML = `
                <div class="trip-info-active">
                    <div class="icon-pill" style="background: var(--gray);">
                        <i class="fas fa-bus-slash"></i>
                    </div>
                    <div class="trip-text">
                        <small>No Active Trip</small>
                        <strong>General Report</strong>
                        <span class="route-line">You can still submit a report below</span>
                    </div>
                </div>
                <span class="status-idle">
                    <i class="fas fa-circle" style="font-size:0.5rem;"></i> Idle
                </span>
            `;
            return;
        }

        activeTrip = chosen;
        const bus = buses.find(b => idsMatch(b._id, chosen.bus?._id || chosen.bus)) || chosen.bus;
        const route = routes.find(r => idsMatch(r._id, chosen.route?._id || chosen.route)) || chosen.route;
        const tripId = `TR-${chosen._id.slice(-6).toUpperCase()}`;
        const isLive = chosen.status === 'in-progress';

        banner.innerHTML = `
            <div class="trip-info-active">
                <div class="icon-pill">
                    <i class="fas fa-bus"></i>
                </div>
                <div class="trip-text">
                    <small>Reporting for</small>
                    <strong>${tripId} · ${escapeHtml(bus?.busNumber || 'Bus')}</strong>
                    <span class="route-line">
                        <i class="fas fa-route"></i>
                        ${escapeHtml(route?.name || 'Route')}
                    </span>
                </div>
            </div>
            ${isLive ? `
                <span class="status-live">
                    <span class="dot"></span> Live
                </span>
            ` : `
                <span class="status-idle">
                    <i class="fas fa-circle" style="font-size:0.5rem;"></i>
                    ${chosen.status === 'scheduled' ? 'Scheduled' : chosen.status}
                </span>
            `}
        `;
    } catch (err) {
        console.error('loadActiveTrip:', err);
        banner.innerHTML = `<div class="trip-loading">Could not load trip info</div>`;
    }
}

/* =====================================================
   LOAD MY REPORTS
===================================================== */
async function loadMyReports() {
    try {
        const res = await fetch('/api/reports', { credentials: 'include' });
        if (!res.ok) {
            myReports = [];
        } else {
            const data = await res.json();
            const all = data.data || [];
            myReports = all.filter(r => idsMatch(r.driver, user.id));
        }
    } catch {
        myReports = [];
    }

    renderHistory();
}

/* =====================================================
   RENDER HISTORY
===================================================== */
function renderHistory() {
    const container = document.getElementById('historyList');
    const filter = document.getElementById('historyFilter')?.value || 'all';

    let list = [...myReports];

    if (filter === 'pending') list = list.filter(r => r.status !== 'resolved');
    else if (filter === 'resolved') list = list.filter(r => r.status === 'resolved');

    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (list.length === 0) {
        container.innerHTML = `
            <div class="empty-history">
                <i class="fas fa-clipboard-check"></i>
                <h3>No reports yet</h3>
                <p>Any issues you report will appear here.</p>
            </div>`;
        return;
    }

    container.innerHTML = `<div class="history-list">${list.map(r => renderReportItem(r)).join('')}</div>`;
}

function renderReportItem(r) {
    const rawType = r.reason || r.issueType || r.type || 'other';
    const typeKey = String(rawType).toLowerCase();
    const meta = ISSUE_META[typeKey] || ISSUE_META.other;

    const severity = String(r.severity || 'medium').toLowerCase();
    const isResolved = r.status === 'resolved';

    const dateLabel = r.createdAt
        ? new Date(r.createdAt).toLocaleString('en-US', {
            day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
        })
        : '—';

    return `
        <div class="report-item">
            <div class="report-top">
                <div class="report-type">
                    <div class="report-type-icon ${meta.cls}">
                        <i class="fas ${meta.icon}"></i>
                    </div>
                    ${escapeHtml(meta.label)}
                </div>
                <span class="report-status ${isResolved ? 'resolved' : 'pending'}">
                    <i class="fas ${isResolved ? 'fa-check-circle' : 'fa-hourglass-half'}"></i>
                    ${isResolved ? 'Resolved' : 'Pending'}
                </span>
            </div>
            <div class="report-meta">
                <span><i class="fas fa-calendar"></i> ${dateLabel}</span>
                <span><i class="fas fa-circle" style="color: ${SEVERITY_META[severity]?.color || '#eab308'};"></i> ${SEVERITY_META[severity]?.label || 'Medium'}</span>
                ${r.delayMinutes ? `<span><i class="fas fa-clock"></i> ${r.delayMinutes} min delay</span>` : ''}
            </div>
            ${r.description ? `<p class="report-description">${escapeHtml(r.description)}</p>` : ''}
        </div>
    `;
}

/* =====================================================
   FORM SUBMIT
===================================================== */
function handleSubmit(e) {
    e.preventDefault();

    document.getElementById('errIssueType').classList.remove('show');

    const issueType = selectedIssueType || document.getElementById('issueType').value;
    if (!issueType) {
        document.getElementById('errIssueType').textContent = 'Please select an issue type';
        document.getElementById('errIssueType').classList.add('show');
        return;
    }

    const severity = document.querySelector('input[name="severity"]:checked')?.value || 'low';
    const description = document.getElementById('description').value.trim();
    const delayMinutes = parseInt(document.getElementById('estimatedDelay').value, 10) || 0;
    const notifyStudents = document.getElementById('notifyStudents').checked;

    pendingReport = {
        tripId: activeTrip?._id || null,
        issueType,
        severity,
        description,
        delayMinutes,
        notifyStudents,
    };

    openConfirmModal();
}

/* =====================================================
   CONFIRM MODAL
===================================================== */
function openConfirmModal() {
    if (!pendingReport) return;

    const meta = ISSUE_META[pendingReport.issueType] || ISSUE_META.other;
    const sevMeta = SEVERITY_META[pendingReport.severity] || SEVERITY_META.medium;

    document.getElementById('confirmSummary').innerHTML = `
        <div class="confirm-row">
            <span>Trip</span>
            <strong>${activeTrip ? 'TR-' + activeTrip._id.slice(-6).toUpperCase() : 'General'}</strong>
        </div>
        <div class="confirm-row">
            <span>Issue</span>
            <strong>${escapeHtml(meta.label)}</strong>
        </div>
        <div class="confirm-row">
            <span>Severity</span>
            <strong style="color: ${sevMeta.color};">${sevMeta.label}</strong>
        </div>
        ${pendingReport.delayMinutes > 0 ? `
        <div class="confirm-row">
            <span>Est. Delay</span>
            <strong>${pendingReport.delayMinutes} minutes</strong>
        </div>` : ''}
        <div class="confirm-row">
            <span>Notify Students</span>
            <strong>${pendingReport.notifyStudents ? 'Yes' : 'No'}</strong>
        </div>
    `;

    const hint = document.getElementById('confirmHint');
    if (pendingReport.severity === 'high') {
        hint.innerHTML = '⚠️ <strong>High severity</strong> — the admin will be alerted immediately.';
    } else if (pendingReport.notifyStudents) {
        hint.innerHTML = 'This report will be sent to the admin and students tracking this bus.';
    } else {
        hint.innerHTML = 'This report will be sent to the admin.';
    }

    document.getElementById('confirmModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
    document.body.style.overflow = '';
}

/* =====================================================
   SUBMIT
===================================================== */
async function confirmSubmit() {
    if (!pendingReport) return;

    const btn = document.getElementById('confirmSubmitBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        const payload = {
            tripId: pendingReport.tripId,
            delayMinutes: pendingReport.delayMinutes,
            reason: pendingReport.issueType,
            description: `[${pendingReport.severity.toUpperCase()}] ${pendingReport.description || 'No details'}`,
            notifyStudents: pendingReport.notifyStudents,
        };

        const res = await fetch('/api/reports/delay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
        });

        if (res.ok) {
            const data = await res.json();
            if (data.data) {
                myReports.unshift({
                    ...data.data,
                    createdAt: new Date().toISOString(),
                    status: 'pending',
                });
            }
        } else {
            myReports.unshift({
                _id: 'local-' + Date.now(),
                reason: pendingReport.issueType,
                severity: pendingReport.severity,
                description: pendingReport.description,
                delayMinutes: pendingReport.delayMinutes,
                status: 'pending',
                createdAt: new Date().toISOString(),
            });
        }

        // ============= REAL-TIME BROADCAST TO STUDENTS =============
        if (socket && socket.connected && pendingReport.tripId) {
            // Event 1: Trip status update
            socket.emit('trip-status-update', {
                tripId: pendingReport.tripId,
                status: 'delayed',
            });

            // Event 2: Rich report details for students + admins
            socket.emit('driver-report', {
                tripId: pendingReport.tripId,
                issueType: pendingReport.issueType,
                severity: pendingReport.severity,
                description: pendingReport.description || '',
                delayMinutes: pendingReport.delayMinutes,
                notifyStudents: pendingReport.notifyStudents,
            });

            console.log('📤 Sent report to students tracking trip', pendingReport.tripId);
        } else {
            console.warn('⚠️ Socket not connected or no tripId — students will not be notified live');
        }
        // ===========================================================

        closeConfirmModal();
        showSuccessModal();
        renderHistory();
    } catch (err) {
        console.error('confirmSubmit:', err);
        showToast('error', 'Failed to submit', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* =====================================================
   SUCCESS MODAL
===================================================== */
function showSuccessModal() {
    const msg = document.getElementById('successMessage');
    if (pendingReport?.notifyStudents) {
        msg.textContent = 'Your report has been sent to the admin. Students tracking this bus have been notified.';
    } else if (pendingReport?.severity === 'high') {
        msg.textContent = 'Urgent report sent. The admin has been alerted.';
    } else {
        msg.textContent = 'Your report has been sent to the admin.';
    }

    document.getElementById('successModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

/* =====================================================
   RESET FORM
===================================================== */
function resetForm() {
    document.getElementById('reportForm').reset();
    document.querySelectorAll('.issue-btn').forEach(b => b.classList.remove('active'));
    selectedIssueType = null;
    pendingReport = null;
    document.getElementById('issueType').value = '';
    document.getElementById('errIssueType').classList.remove('show');
    document.querySelector('input[name="severity"][value="low"]').checked = true;
    document.getElementById('estimatedDelay').value = '10';
    document.getElementById('notifyStudents').checked = true;
}

/* =====================================================
   SOCKET
===================================================== */
function initSocket() {
    if (typeof io === 'undefined') return;
    try {
        socket = io({ withCredentials: true });
        socket.on('connect', () => console.log('🔌 Driver socket connected'));
    } catch (err) {
        console.warn('Socket init failed:', err);
    }
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
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.addEventListener('beforeunload', () => {
    if (socket) { try { socket.disconnect(); } catch {} }
});