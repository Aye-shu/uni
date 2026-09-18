/* =====================================================
   UNIBUS — Manage Users Page Logic
===================================================== */

let allUsers = [];
let filteredUsers = [];
let currentRole = 'all';
let searchQuery = '';
let statusFilter = 'all';
let sortBy = 'name';
let user = null;

let viewTargetId = null;
let editTargetId = null;
let pwTargetId = null;
let deleteTargetId = null;

const ROLE_LABELS = {
    student: { label: 'Student', icon: 'fa-user-graduate' },
    driver:  { label: 'Driver',  icon: 'fa-id-card' },
    admin:   { label: 'Admin',   icon: 'fa-user-tie' },
};

document.addEventListener('DOMContentLoaded', async () => {
    user = await checkAuth();
    if (!user) return;

    document.getElementById('userName').textContent = user.name || 'Admin';
    document.getElementById('userRole').textContent = user.role || 'admin';
    document.getElementById('userAvatar').textContent = (user.name || 'A').charAt(0).toUpperCase();

    // Sidebar
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

    // Role tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRole = btn.dataset.role;
            applyFilters();
        });
    });

    // Filters
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        applyFilters();
    });
    document.getElementById('statusFilter')?.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        applyFilters();
    });
    document.getElementById('sortFilter')?.addEventListener('change', (e) => {
        sortBy = e.target.value;
        applyFilters();
    });
    document.getElementById('resetFiltersBtn')?.addEventListener('click', resetFilters);

    // View modal
    document.getElementById('closeViewBtn')?.addEventListener('click', closeViewModal);
    document.getElementById('closeViewBtn2')?.addEventListener('click', closeViewModal);
    document.getElementById('viewModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'viewModal') closeViewModal();
    });
    document.getElementById('viewEditBtn')?.addEventListener('click', () => {
        const id = viewTargetId;
        closeViewModal();
        if (id) openEditModal(id);
    });

    // Edit modal
    document.getElementById('closeEditBtn')?.addEventListener('click', closeEditModal);
    document.getElementById('cancelEditBtn')?.addEventListener('click', closeEditModal);
    document.getElementById('editModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'editModal') closeEditModal();
    });
    document.getElementById('editForm')?.addEventListener('submit', saveEdit);

    // PW modal
    document.getElementById('closePwBtn')?.addEventListener('click', closePwModal);
    document.getElementById('cancelPwBtn')?.addEventListener('click', closePwModal);
    document.getElementById('pwModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'pwModal') closePwModal();
    });
    document.getElementById('pwForm')?.addEventListener('submit', resetPassword);

    // Delete modal
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', deleteUser);
    document.getElementById('deactivateBtn')?.addEventListener('click', deactivateUser);
    document.getElementById('deleteModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'deleteModal') closeDeleteModal();
    });

    // Export
    document.getElementById('exportBtn')?.addEventListener('click', exportCSV);

    // ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeViewModal(); closeEditModal(); closePwModal(); closeDeleteModal();
        }
    });

    await loadUsers();
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
   LOAD USERS
===================================================== */
async function loadUsers() {
    try {
        const res = await fetch('/api/admin/users', { credentials: 'include' });
        const data = await res.json();
        allUsers = data.data || [];
        console.log('✅ Loaded', allUsers.length, 'users');

        updateRoleCounts();
        applyFilters();
    } catch (err) {
        console.error('loadUsers error:', err);
        allUsers = [];
        applyFilters();
    }
}

function updateRoleCounts() {
    const students = allUsers.filter(u => u.role === 'student').length;
    const drivers = allUsers.filter(u => u.role === 'driver').length;
    const admins = allUsers.filter(u => u.role === 'admin').length;

    document.getElementById('countAll').textContent = allUsers.length;
    document.getElementById('countStudents').textContent = students;
    document.getElementById('countDrivers').textContent = drivers;
    document.getElementById('countAdmins').textContent = admins;
}

/* =====================================================
   FILTERS
===================================================== */
function applyFilters() {
    filteredUsers = allUsers.filter(u => {
        if (currentRole !== 'all' && u.role !== currentRole) return false;

        if (statusFilter !== 'all') {
            const s = u.isActive === false ? 'inactive' : 'active';
            if (s !== statusFilter) return false;
        }

        if (searchQuery) {
            const text = `${u.name || ''} ${u.email || ''} ${u.studentId || ''} ${u.phone || ''}`.toLowerCase();
            if (!text.includes(searchQuery)) return false;
        }

        return true;
    });

    filteredUsers.sort((a, b) => {
        switch (sortBy) {
            case 'created':
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            case 'email':
                return (a.email || '').localeCompare(b.email || '');
            case 'name':
            default:
                return (a.name || '').localeCompare(b.name || '');
        }
    });

    renderTable();
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('sortFilter').value = 'name';
    searchQuery = '';
    statusFilter = 'all';
    sortBy = 'name';
    applyFilters();
}

/* =====================================================
   RENDER
===================================================== */
function renderTable() {
    const container = document.getElementById('usersTableContainer');
    const countEl = document.getElementById('userCount');
    countEl.textContent = `${filteredUsers.length} user${filteredUsers.length === 1 ? '' : 's'}`;

    if (filteredUsers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users-slash"></i>
                <h3>No users found</h3>
                <p>Try adjusting your filters or search term.</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="user-table">
            <div class="user-table-header">
                <span></span>
                <span>Name</span>
                <span>Email</span>
                <span>ID</span>
                <span>Role</span>
                <span>Status</span>
                <span>Actions</span>
            </div>
            ${filteredUsers.map(u => renderRow(u)).join('')}
        </div>
    `;
}

function renderRow(u) {
    const role = ROLE_LABELS[u.role] || ROLE_LABELS.student;
    const isActive = u.isActive !== false;
    const statusCls = isActive ? 'active' : 'inactive';
    const statusLabel = isActive ? 'Active' : 'Inactive';
    const initials = getInitials(u.name);
    const isSelf = String(u._id || u.id) === String(user.id);

    const idValue = u.studentId || u.licenseNumber || u.employeeId || '—';

    return `
        <div class="user-table-row">
            <div class="user-avatar-cell ${u.role || 'student'}">${escapeHtml(initials)}</div>
            <span class="user-name">${escapeHtml(u.name || '—')}${isSelf ? ' <em style="color:var(--gray);font-size:0.72rem;font-style:normal;">(You)</em>' : ''}</span>
            <span class="user-email">${escapeHtml(u.email || '—')}</span>
            <span class="user-id">${escapeHtml(idValue)}</span>
            <span><span class="role-badge ${u.role}">
                <i class="fas ${role.icon}"></i> ${role.label}
            </span></span>
            <span><span class="status-pill ${statusCls}">
                <i class="fas fa-circle"></i> ${statusLabel}
            </span></span>
            <div class="row-actions">
                <button class="act-btn view" title="View" onclick="openViewModal('${u._id || u.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="act-btn edit" title="Edit" onclick="openEditModal('${u._id || u.id}')">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="act-btn pw" title="Reset Password" onclick="openPwModal('${u._id || u.id}')">
                    <i class="fas fa-key"></i>
                </button>
                ${isSelf ? '' : `
                    <button class="act-btn delete" title="Delete" onclick="confirmDelete('${u._id || u.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                `}
            </div>
        </div>
    `;
}

function getInitials(name) {
    if (!name) return '--';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* =====================================================
   VIEW MODAL
===================================================== */
window.openViewModal = function (id) {
    const u = allUsers.find(x => String(x._id || x.id) === String(id));
    if (!u) return;

    viewTargetId = id;
    const role = ROLE_LABELS[u.role] || ROLE_LABELS.student;
    const isActive = u.isActive !== false;
    const memberSince = u.createdAt
        ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : '—';

    let extraRows = '';

    if (u.role === 'student') {
        extraRows = `
            <div class="detail-row"><span>Student ID</span><strong>${escapeHtml(u.studentId || '—')}</strong></div>
            <div class="detail-row"><span>Department</span><strong>${escapeHtml(u.department || '—')}</strong></div>
            <div class="detail-row"><span>Year / Semester</span><strong>${escapeHtml(u.year || '—')}</strong></div>
        `;
    } else if (u.role === 'driver') {
        extraRows = `
            <div class="detail-row"><span>License</span><strong>${escapeHtml(u.licenseNumber || '—')}</strong></div>
        `;
    }

    document.getElementById('viewBody').innerHTML = `
        <div class="detail-section-title">Basic Information</div>
        <div class="detail-row"><span>Full Name</span><strong>${escapeHtml(u.name || '—')}</strong></div>
        <div class="detail-row"><span>Email</span><strong>${escapeHtml(u.email || '—')}</strong></div>
        <div class="detail-row"><span>Phone</span><strong>${escapeHtml(u.phone || '—')}</strong></div>
        <div class="detail-row"><span>Role</span><strong>${role.label}</strong></div>
        <div class="detail-row"><span>Status</span><strong style="color:${isActive ? '#059669' : '#64748b'};">${isActive ? 'Active' : 'Inactive'}</strong></div>
        <div class="detail-row"><span>Member Since</span><strong>${memberSince}</strong></div>
        ${extraRows ? `<div class="detail-section-title">Role Details</div>${extraRows}` : ''}
    `;

    document.getElementById('viewModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closeViewModal() {
    document.getElementById('viewModal').classList.remove('active');
    document.body.style.overflow = '';
    viewTargetId = null;
}

/* =====================================================
   EDIT MODAL
===================================================== */
window.openEditModal = function (id) {
    const u = allUsers.find(x => String(x._id || x.id) === String(id));
    if (!u) return;

    editTargetId = id;
    clearEditErrors();

    document.getElementById('editName').value = u.name || '';
    document.getElementById('editEmail').value = u.email || '';
    document.getElementById('editPhone').value = u.phone || '';
    document.getElementById('editRole').value = u.role || 'student';
    document.getElementById('editDepartment').value = u.department || '';
    document.getElementById('editYear').value = u.year || '';
    document.getElementById('editStatus').value = u.isActive === false ? 'inactive' : 'active';

    document.getElementById('editModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    document.body.style.overflow = '';
    editTargetId = null;
}

async function saveEdit(e) {
    e.preventDefault();
    clearEditErrors();

    const name = document.getElementById('editName').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    const role = document.getElementById('editRole').value;
    const department = document.getElementById('editDepartment').value;
    const year = document.getElementById('editYear').value;
    const status = document.getElementById('editStatus').value;

    if (!name) {
        setEditError('editName', 'Name is required');
        return;
    }

    const u = allUsers.find(x => String(x._id || x.id) === String(editTargetId));
    const originalRole = u?.role;

    // Warn on role change
    if (originalRole && originalRole !== role) {
        if (!confirm(`Change ${name}'s role from ${originalRole} to ${role}? This is a powerful action.`)) {
            return;
        }
    }

    const btn = document.getElementById('saveEditBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const body = {
            name,
            phone,
            role,
            department,
            year,
            isActive: status === 'active',
        };

        const res = await fetch(`/api/admin/users/${editTargetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Update failed');

        const idx = allUsers.findIndex(x => String(x._id || x.id) === String(editTargetId));
        if (idx !== -1) allUsers[idx] = { ...allUsers[idx], ...body };

        closeEditModal();
        updateRoleCounts();
        applyFilters();
        showToast('success', 'User updated', 'Changes saved successfully');
    } catch (err) {
        showToast('error', 'Update failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* =====================================================
   RESET PASSWORD
===================================================== */
window.openPwModal = function (id) {
    const u = allUsers.find(x => String(x._id || x.id) === String(id));
    if (!u) return;

    pwTargetId = id;
    document.getElementById('pwUserName').textContent = u.name || 'this user';
    document.getElementById('pwForm').reset();
    clearPwErrors();
    document.getElementById('pwModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closePwModal() {
    document.getElementById('pwModal').classList.remove('active');
    document.body.style.overflow = '';
    pwTargetId = null;
}

async function resetPassword(e) {
    e.preventDefault();
    clearPwErrors();

    const newPw = document.getElementById('newPw').value;
    const confirmPw = document.getElementById('confirmPw').value;

    let hasErr = false;
    if (!newPw || newPw.length < 8) { setPwError('newPw', 'Min 8 characters'); hasErr = true; }
    if (newPw !== confirmPw) { setPwError('confirmPw', 'Passwords do not match'); hasErr = true; }
    if (hasErr) return;

    const btn = document.getElementById('resetPwBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';

    try {
        // Reuse the driver reset-password route (works for any user)
        const res = await fetch(`/api/admin/drivers/${pwTargetId}/reset-password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password: newPw }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Reset failed');

        closePwModal();
        showToast('success', 'Password reset', 'Share the new password securely');
    } catch (err) {
        showToast('error', 'Reset failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
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
   DELETE / DEACTIVATE
===================================================== */
window.confirmDelete = function (id) {
    const u = allUsers.find(x => String(x._id || x.id) === String(id));
    if (!u) return;

    if (String(id) === String(user.id)) {
        showToast('error', 'Cannot delete yourself', 'You cannot delete your own admin account');
        return;
    }

    deleteTargetId = id;
    document.getElementById('deleteUserName').textContent = u.name || 'this user';
    document.getElementById('deleteModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    document.body.style.overflow = '';
    deleteTargetId = null;
}

async function deleteUser() {
    if (!deleteTargetId) return;
    const btn = document.getElementById('confirmDeleteBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
        const res = await fetch(`/api/admin/users/${deleteTargetId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Delete failed');

        allUsers = allUsers.filter(x => String(x._id || x.id) !== String(deleteTargetId));
        closeDeleteModal();
        updateRoleCounts();
        applyFilters();
        showToast('success', 'User deleted', 'Account has been removed');
    } catch (err) {
        showToast('error', 'Delete failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

async function deactivateUser() {
    if (!deleteTargetId) return;
    const btn = document.getElementById('deactivateBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deactivating...';

    try {
        const res = await fetch(`/api/admin/users/${deleteTargetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ isActive: false }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed');

        const idx = allUsers.findIndex(x => String(x._id || x.id) === String(deleteTargetId));
        if (idx !== -1) allUsers[idx].isActive = false;

        closeDeleteModal();
        applyFilters();
        showToast('success', 'User deactivated', 'Account is now inactive');
    } catch (err) {
        showToast('error', 'Deactivation failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

/* =====================================================
   EXPORT CSV
===================================================== */
function exportCSV() {
    if (filteredUsers.length === 0) {
        showToast('error', 'Nothing to export', 'No users match the filters');
        return;
    }

    const headers = ['Name', 'Email', 'Role', 'Phone', 'Department', 'Year', 'Status', 'Created'];
    const rows = filteredUsers.map(u => [
        u.name || '',
        u.email || '',
        u.role || '',
        u.phone || '',
        u.department || '',
        u.year || '',
        u.isActive === false ? 'Inactive' : 'Active',
        u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '',
    ]);

    const csv = [headers, ...rows]
        .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unibus-users-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('success', 'Exported', 'Users CSV downloaded');
}

/* =====================================================
   ERRORS
===================================================== */
function setEditError(fieldId, msg) {
    const input = document.getElementById(fieldId);
    const err = document.getElementById('err' + capitalize(fieldId));
    if (input) input.classList.add('error');
    if (err) { err.textContent = msg; err.classList.add('show'); }
}

function clearEditErrors() {
    document.querySelectorAll('#editModal .form-field input').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('#editModal .field-error').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
    });
}

function setPwError(fieldId, msg) {
    const err = document.getElementById('err' + capitalize(fieldId));
    if (err) { err.textContent = msg; err.classList.add('show'); }
}

function clearPwErrors() {
    document.querySelectorAll('#pwModal .field-error').forEach(el => {
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
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}