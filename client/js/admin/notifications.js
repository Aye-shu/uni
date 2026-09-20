/* =====================================================
   UNIBUS — Admin Notifications Page
===================================================== */

let user = null;
let socket = null;
let allNotifs = [];
let currentFilter = 'all';

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

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        try { await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' }); } catch {}
        window.location.href = '/login.html';
    });

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderList();
        });
    });

    // Mark all
    document.getElementById('markAllBtn')?.addEventListener('click', markAllRead);

    // Init socket
    initSocket();

    // Load
    await loadNotifications();

    // Live updates
    socket?.on('new-notification', (data) => {
        console.log('🔔 Live notification:', data);
        allNotifs.unshift({
            _id: 'live-' + Date.now(),
            title: data.title,
            message: data.message,
            type: data.type || 'general',
            isRead: false,
            createdAt: new Date(),
        });
        updateCounts();
        renderList();
        showToast('info', data.title || 'New notification', data.message || '');
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
        if (data.user.role !== 'admin') {
            window.location.href = data.user.role === 'student'
                ? '/student/dashboard.html' : '/driver/dashboard.html';
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
async function loadNotifications() {
    try {
        const res = await fetch('/api/notifications', { credentials: 'include' });
        const data = await res.json();
        allNotifs = data.data || [];
        updateCounts();
        renderList();
    } catch (err) {
        console.error('Load error:', err);
        allNotifs = [];
        renderList();
    }
}

function updateCounts() {
    const unread = allNotifs.filter(n => !n.isRead).length;
    const alerts = allNotifs.filter(n => n.type === 'alert').length;
    const bookings = allNotifs.filter(n => n.type === 'booking').length;
    const trips = allNotifs.filter(n => n.type === 'trip').length;
    const delays = allNotifs.filter(n => n.type === 'delay').length;

    document.getElementById('countAll').textContent = allNotifs.length;
    document.getElementById('countUnread').textContent = unread;
    document.getElementById('countAlerts').textContent = alerts;
    document.getElementById('countBookings').textContent = bookings;
    document.getElementById('countTrips').textContent = trips;
    document.getElementById('countDelays').textContent = delays;
}

/* =====================================================
   RENDER
===================================================== */
function renderList() {
    const container = document.getElementById('notificationsList');
    let list = [...allNotifs];

    if (currentFilter === 'unread') {
        list = list.filter(n => !n.isRead);
    } else if (currentFilter !== 'all') {
        list = list.filter(n => n.type === currentFilter);
    }

    if (list.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <h3>No notifications</h3>
                <p>You're all caught up.</p>
            </div>`;
        return;
    }

    container.innerHTML = list.map(n => {
        const icon = iconFor(n.type);
        const cls = clsFor(n.type);
        const unreadCls = !n.isRead ? 'unread' : '';
        return `
            <div class="notif-item ${unreadCls}" data-id="${n._id}">
                <div class="notif-icon ${cls}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="notif-body">
                    <div class="notif-top">
                        <h4>${escapeHtml(n.title || 'Notification')}</h4>
                        <span class="notif-time">${timeAgo(n.createdAt)}</span>
                    </div>
                    <p>${escapeHtml(n.message || '')}</p>
                    <div class="notif-actions">
                        ${!n.isRead ? `<button type="button" class="btn-read" onclick="markRead('${n._id}')"><i class="fas fa-check"></i> Mark read</button>` : ''}
                        <button type="button" class="btn-del" onclick="deleteNotif('${n._id}')"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function iconFor(type) {
    return {
        alert: 'fa-exclamation-triangle',
        booking: 'fa-ticket-alt',
        trip: 'fa-bus',
        delay: 'fa-clock',
        general: 'fa-bell',
    }[type] || 'fa-bell';
}

function clsFor(type) {
    return {
        alert: 'alert',
        booking: 'booking',
        trip: 'trip',
        delay: 'delay',
        general: 'general',
    }[type] || 'general';
}

/* =====================================================
   ACTIONS
===================================================== */
window.markRead = async function (id) {
    const n = allNotifs.find(x => x._id === id);
    if (!n || n.isRead) return;
    n.isRead = true;
    updateCounts();
    renderList();

    if (id.startsWith('live-')) return;

    try {
        await fetch(`/api/notifications/${id}/read`, {
            method: 'PUT',
            credentials: 'include',
        });
    } catch {}
};

window.deleteNotif = async function (id) {
    allNotifs = allNotifs.filter(x => x._id !== id);
    updateCounts();
    renderList();

    if (id.startsWith('live-')) return;

    try {
        await fetch(`/api/notifications/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
    } catch {}
};

async function markAllRead() {
    allNotifs.forEach(n => { n.isRead = true; });
    updateCounts();
    renderList();

    try {
        await fetch('/api/notifications/read-all', {
            method: 'PUT',
            credentials: 'include',
        });
        showToast('success', 'All marked as read', '');
    } catch {
        showToast('error', 'Failed to update', '');
    }
}

/* =====================================================
   SOCKET
===================================================== */
function initSocket() {
    if (typeof io === 'undefined') return;
    try {
        socket = io({ withCredentials: true });
        socket.on('connect', () => {
            console.log('🔌 Admin notifications socket connected');
            socket.emit('join-admin-room');
            if (user?.id) socket.emit('join-user', user.id);
            updateConnectionStatus('connected', 'Live');
        });
        socket.on('disconnect', () => updateConnectionStatus('disconnected', 'Offline'));
    } catch (err) {
        console.warn('Socket init failed:', err);
    }
}

function updateConnectionStatus(state, text) {
    const el = document.getElementById('connectionStatus');
    if (!el) return;
    el.className = 'connection-status ' + state;
    const t = el.querySelector('.text');
    if (t) t.textContent = text;
}

/* =====================================================
   UTILITIES
===================================================== */
function timeAgo(date) {
    if (!date) return 'just now';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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

window.addEventListener('beforeunload', () => {
    if (socket) { try { socket.disconnect(); } catch {} }
});