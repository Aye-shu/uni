/* =====================================================
   UNIBUS — Notifications Page Logic
===================================================== */

let allNotifs = [];
let currentFilter = 'all';
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

    document.getElementById('markAllBtn')?.addEventListener('click', markAllRead);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            render();
        });
    });

    await loadNotifications();
});

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
    } catch {
        window.location.href = '/login.html';
        return null;
    }
}

async function loadNotifications() {
    try {
        const res = await fetch('/api/notifications', { credentials: 'include' });
        const data = await res.json();
        allNotifs = data.data || [];
    } catch {
        allNotifs = [];
    }
    updateCounts();
    render();
}

function updateCounts() {
    document.getElementById('cntAll').textContent = allNotifs.length;
    document.getElementById('cntUnread').textContent = allNotifs.filter(n => !n.isRead).length;
}

function render() {
    const container = document.getElementById('notificationsList');
    let list = [...allNotifs];

    if (currentFilter === 'unread') {
        list = list.filter(n => !n.isRead);
    } else if (currentFilter === 'booking') {
        list = list.filter(n => n.type === 'booking');
    } else if (currentFilter === 'delay') {
        list = list.filter(n => n.type === 'delay');
    }

    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (list.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <h3>No notifications</h3>
                <p>You're all caught up.</p>
            </div>`;
        return;
    }

    const iconMap = {
        booking: { icon: 'fa-ticket-alt', cls: 'booking' },
        delay:   { icon: 'fa-clock', cls: 'delay' },
        trip:    { icon: 'fa-bus', cls: 'trip' },
        alert:   { icon: 'fa-exclamation-triangle', cls: 'alert' },
        general: { icon: 'fa-info-circle', cls: 'general' },
    };

    container.innerHTML = list.map(n => {
        const type = n.type || 'general';
        const meta = iconMap[type] || iconMap.general;
        return `
            <div class="notif-card type-${type} ${n.isRead ? '' : 'unread'}"
                 onclick="markRead('${n._id}')">
                <div class="notif-icon ${meta.cls}"><i class="fas ${meta.icon}"></i></div>
                <div class="notif-body">
                    <h4>${escapeHtml(n.title || 'Notification')}</h4>
                    <p>${escapeHtml(n.message || '')}</p>
                    <span class="notif-time">${timeAgo(n.createdAt)}</span>
                </div>
                <div class="notif-actions">
                    <button class="notif-btn delete"
                            onclick="event.stopPropagation(); deleteNotif('${n._id}')"
                            title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>`;
    }).join('');
}

window.markRead = async function (id) {
    const n = allNotifs.find(x => x._id === id);
    if (!n || n.isRead) return;
    try {
        await fetch(`/api/notifications/${id}/read`, {
            method: 'PUT',
            credentials: 'include',
        });
        n.isRead = true;
        updateCounts();
        render();
    } catch {}
};

window.deleteNotif = async function (id) {
    try {
        await fetch(`/api/notifications/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        allNotifs = allNotifs.filter(n => n._id !== id);
        updateCounts();
        render();
        showToast('success', 'Deleted', 'Notification removed.');
    } catch {
        showToast('error', 'Failed', 'Could not delete.');
    }
};

async function markAllRead() {
    try {
        await fetch('/api/notifications/read-all', {
            method: 'PUT',
            credentials: 'include',
        });
        allNotifs.forEach(n => n.isRead = true);
        updateCounts();
        render();
        showToast('success', 'All marked read', '');
    } catch {
        showToast('error', 'Failed', 'Try again.');
    }
}

function timeAgo(date) {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
}

function showToast(type, title, message = '') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <div class="toast-content">
            <h5>${escapeHtml(title)}</h5>
            ${message ? `<p>${escapeHtml(message)}</p>` : ''}
        </div>`;
    c.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

function escapeHtml(s) {
    if (!s) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
