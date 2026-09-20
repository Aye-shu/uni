/* =====================================================
   UNIBUS — Student Profile Page Logic
===================================================== */

let user = null;
let profile = null;
let isEditing = false;

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

    // ---------- Tabs ----------
    document.querySelectorAll('.ptab').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.getElementById('panel' + capitalize(tab.dataset.tab));
            if (panel) panel.classList.add('active');
        });
    });

    // ---------- Edit toggle ----------
    document.getElementById('editToggleBtn')?.addEventListener('click', toggleEdit);
    document.getElementById('cancelPersonalBtn')?.addEventListener('click', cancelEdit);

    // ---------- Forms ----------
    document.getElementById('personalForm')?.addEventListener('submit', savePersonal);
    document.getElementById('passwordForm')?.addEventListener('submit', savePassword);
    document.getElementById('preferencesForm')?.addEventListener('submit', savePreferences);

    // ---------- Load profile ----------
    await loadProfile();
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
    } catch {
        window.location.href = '/login.html';
        return null;
    }
}

/* =====================================================
   LOAD PROFILE — reads fresh from DB, falls back to session
===================================================== */
async function loadProfile() {
    try {
        let u = null;

        // Try fresh DB data first
        try {
            const res = await fetch('/api/student/profile', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                u = data.data || null;
            }
        } catch { /* fall through */ }

        // Fall back to session data
        if (!u) {
            const res = await fetch('/api/auth/get-session', { credentials: 'include' });
            const data = await res.json();
            u = data.user || {};
        }

        profile = {
            name:       u.name       || '',
            email:      u.email      || '',
            studentId:  u.studentId  || '—',
            department: u.department || '—',
            year:       u.year       || '',
            phone:      u.phone      || '',
            address:    u.address    || '',
            role:       u.role       || 'student',
            createdAt:  u.createdAt  || null,
        };

        renderProfile();

        // Load stats + preferences in parallel
        loadStats();
        loadPreferences();
    } catch (err) {
        console.error('Load profile error:', err);
        showToast('error', 'Failed to load profile', err.message);
    }
}

/* =====================================================
   RENDER PROFILE
===================================================== */
function renderProfile() {
    const p = profile;

    const initials = getInitials(p.name);
    document.getElementById('profileAvatar').textContent = initials;
    document.getElementById('userAvatar').textContent = initials.charAt(0);

    document.getElementById('headerName').textContent = p.name || 'Student';
    document.getElementById('headerStudentId').innerHTML =
        `<i class="fas fa-id-card"></i> ${escapeHtml(p.studentId || '—')}`;
    document.getElementById('headerEmail').innerHTML =
        `<i class="fas fa-envelope"></i> ${escapeHtml(p.email || '—')}`;
    document.getElementById('headerRole').textContent = capitalize(p.role);

    document.getElementById('fullName').value    = p.name       || '';
    document.getElementById('email').value       = p.email      || '';
    document.getElementById('studentId').value   = p.studentId  || '';
    document.getElementById('department').value  = p.department || '';
    document.getElementById('year').value        = p.year       || '';
    document.getElementById('phone').value       = p.phone      || '';
    document.getElementById('address').value     = p.address    || '';

    if (p.createdAt) {
        const d = new Date(p.createdAt);
        document.getElementById('statSince').textContent =
            d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else {
        document.getElementById('statSince').textContent = '—';
    }
}

function getInitials(name) {
    if (!name) return '--';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* =====================================================
   LOAD STATS
===================================================== */
async function loadStats() {
    try {
        const res = await fetch('/api/bookings', { credentials: 'include' });
        const data = await res.json();
        const bookings = data.data || [];

        const completed = bookings.filter(b => b.status === 'completed').length;
        const upcoming = bookings.filter(b => {
            if (b.status !== 'confirmed') return false;
            if (!b.travelDate) return true;
            const t = new Date(b.travelDate);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            return t >= today;
        }).length;

        document.getElementById('statTrips').textContent = completed;
        document.getElementById('statBookings').textContent = upcoming;
    } catch (err) {
        console.error('Stats error:', err);
    }
}

/* =====================================================
   LOAD PREFERENCES
===================================================== */
async function loadPreferences() {
    try {
        const res = await fetch('/api/student/preferences', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const p = data.data || {};
        document.getElementById('prefEmail').checked = !!p.email;
        document.getElementById('prefSms').checked = !!p.sms;
        document.getElementById('prefPush').checked = !!p.push;
    } catch { /* endpoint may not exist yet */ }
}

/* =====================================================
   EDIT MODE
===================================================== */
function toggleEdit() {
    isEditing = !isEditing;

    const btn = document.getElementById('editToggleBtn');
    const actions = document.getElementById('personalActions');
    const editableIds = ['year', 'phone', 'address'];

    editableIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !isEditing;
    });

    if (isEditing) {
        btn.classList.add('editing');
        btn.innerHTML = '<i class="fas fa-times"></i> Cancel';
        actions.style.display = 'flex';
        document.getElementById('year').focus();
    } else {
        btn.classList.remove('editing');
        btn.innerHTML = '<i class="fas fa-pen"></i> Edit';
        actions.style.display = 'none';
    }
}

function cancelEdit() {
    document.getElementById('year').value = profile.year || '';
    document.getElementById('phone').value = profile.phone || '';
    document.getElementById('address').value = profile.address || '';
    toggleEdit();
}

/* =====================================================
   SAVE PERSONAL
===================================================== */
async function savePersonal(e) {
    e.preventDefault();
    if (!isEditing) return;

    const year = document.getElementById('year').value;
    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();

    const btn = document.getElementById('savePersonalBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const res = await fetch('/api/student/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ year, phone, address }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'Update failed');
        }

        // Update local state
        profile.year = year;
        profile.phone = phone;
        profile.address = address;

        // Update session cache so other pages reflect it too
        if (user) {
            user.year = year;
            user.phone = phone;
            user.address = address;
        }

        toggleEdit();
        showToast('success', 'Profile updated', 'Your changes have been saved.');
    } catch (err) {
        showToast('error', 'Update failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/* =====================================================
   SAVE PASSWORD
===================================================== */
async function savePassword(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    clearPwErrors();

    let hasErr = false;
    if (!currentPassword) { setPwError('currentPassword', 'Current password is required'); hasErr = true; }
    if (!newPassword) { setPwError('newPassword', 'New password is required'); hasErr = true; }
    if (newPassword && newPassword.length < 8) { setPwError('newPassword', 'Must be at least 8 characters'); hasErr = true; }
    if (newPassword && currentPassword && newPassword === currentPassword) {
        setPwError('newPassword', 'New password must differ from current'); hasErr = true;
    }
    if (newPassword !== confirmPassword) { setPwError('confirmPassword', 'Passwords do not match'); hasErr = true; }

    if (hasErr) return;

    const btn = document.getElementById('savePasswordBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ currentPassword, newPassword }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'Password update failed');
        }

        document.getElementById('passwordForm').reset();
        showToast('success', 'Password updated', 'Use your new password next time you log in.');
    } catch (err) {
        showToast('error', 'Update failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function setPwError(fieldId, message) {
    const err = document.getElementById('err' + capitalize(fieldId));
    const input = document.getElementById(fieldId);
    if (input) input.classList.add('error');
    if (err) {
        err.textContent = message;
        err.classList.add('show');
    }
}

function clearPwErrors() {
    ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.classList.remove('error');
        const err = document.getElementById('err' + capitalize(id));
        if (err) { err.classList.remove('show'); err.textContent = ''; }
    });
}

window.togglePw = function (fieldId, btn) {
    const input = document.getElementById(fieldId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        input.type = 'password';
        btn.innerHTML = '<i class="fas fa-eye"></i>';
    }
};

/* =====================================================
   SAVE PREFERENCES
===================================================== */
async function savePreferences(e) {
    e.preventDefault();

    const email = document.getElementById('prefEmail').checked;
    const sms = document.getElementById('prefSms').checked;
    const push = document.getElementById('prefPush').checked;

    const btn = document.getElementById('savePreferencesBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const res = await fetch('/api/student/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ preferences: { email, sms, push } }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'Could not save preferences');
        }

        showToast('success', 'Preferences saved', 'Your notification settings have been updated.');
    } catch (err) {
        showToast('error', 'Save failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
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