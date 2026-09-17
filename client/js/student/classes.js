/* =====================================================
   UNIBUS — My Classes Page Logic
===================================================== */

let allClasses = [];
let editingId = null;
let deleteId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // ---------- Auth Check ----------
    const user = await checkAuth();
    if (!user) return;

    document.getElementById('userName').textContent = user.name || 'Student';
    document.getElementById('userRole').textContent = user.role || 'student';
    document.getElementById('userAvatar').textContent = (user.name || 'S').charAt(0).toUpperCase();

    // ---------- Load Classes ----------
    await loadClasses();

    // ---------- Sidebar Toggle (mobile) ----------
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
        try {
            await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' });
        } catch (e) {}
        window.location.href = '/login.html';
    });

    // ---------- Add Class Button ----------
    document.getElementById('addClassBtn')?.addEventListener('click', () => openModal());

    // ---------- Close Modal ----------
    document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('cancelBtn')?.addEventListener('click', closeModal);
    document.getElementById('classModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'classModal') closeModal();
    });

    // ---------- Form Submit ----------
    document.getElementById('classForm')?.addEventListener('submit', handleSave);

    // ---------- Delete Confirmation ----------
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', handleDelete);
    document.getElementById('deleteModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'deleteModal') closeDeleteModal();
    });

    // ---------- Filter ----------
    document.getElementById('dayFilter')?.addEventListener('change', renderClasses);

    // ---------- ESC closes modals ----------
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeDeleteModal();
        }
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
   LOAD CLASSES
===================================================== */
async function loadClasses() {
    try {
        const res = await fetch('/api/classes', { credentials: 'include' });

        // 🔍 Show status in console
        console.log('GET /api/classes →', res.status);

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error('Load failed:', res.status, errData);
            showToast('error', `Load failed (${res.status})`, errData.message || 'Check console');
            allClasses = [];
            renderClasses();
            return;
        }

        const data = await res.json();
        console.log('Classes loaded:', data);
        allClasses = data.data || [];
        renderClasses();
    } catch (err) {
        console.error('Network error:', err);
        showToast('error', 'Network error', err.message);
        allClasses = [];
        renderClasses();
    }
}

/* =====================================================
   RENDER CLASSES
===================================================== */
function renderClasses() {
    const container = document.getElementById('classesContainer');
    const dayOrder = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const filter = document.getElementById('dayFilter')?.value || 'all';

    let classes = [...allClasses];

    // Filter
    if (filter !== 'all') {
        classes = classes.filter(c => c.day === filter);
    }

    // Update count
    document.getElementById('classCount').textContent =
        `${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`;

    // Empty state
    if (classes.length === 0) {
        container.innerHTML = `
            <div class="empty-state-large">
                <i class="fas fa-calendar-plus empty-icon"></i>
                <h3>${filter === 'all' ? "You haven't added any classes yet" : `No classes on ${filter}`}</h3>
                <p>Add your weekly class schedule to get smart bus recommendations for every class.</p>
                <button class="btn-add" onclick="openModal()">
                    <i class="fas fa-plus"></i> ${filter === 'all' ? 'Add Your First Class' : 'Add Class on ' + filter}
                </button>
            </div>`;
        return;
    }

    // Group by day
    const grouped = {};
    classes.forEach(c => {
        if (!grouped[c.day]) grouped[c.day] = [];
        grouped[c.day].push(c);
    });

    // Render
    container.innerHTML = dayOrder
        .filter(day => grouped[day])
        .map(day => {
            const dayClasses = grouped[day].sort((a, b) =>
                timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
            );
            return `
                <div class="day-group">
                    <div class="day-header">
                        <h2>${day}</h2>
                        <span class="day-count">${dayClasses.length} class${dayClasses.length !== 1 ? 'es' : ''}</span>
                    </div>
                    <div class="class-table">
                        ${dayClasses.map(c => renderClassRow(c)).join('')}
                    </div>
                </div>
            `;
        }).join('');
}

function renderClassRow(cls) {
    const location = [cls.location, cls.room ? `Room ${cls.room}` : '']
        .filter(Boolean)
        .join(' · ') || 'No location';

    return `
        <div class="class-row">
            <span class="course-code">${escapeHtml(cls.code || '')}</span>
            <div class="course-name">${escapeHtml(cls.subject || '')}</div>
            <div class="time-slot">
                <strong>${formatTime(cls.startTime)}</strong>
                <small>to ${formatTime(cls.endTime)}</small>
            </div>
            <div class="location-info">
                <strong><i class="fas fa-map-marker-alt"></i>${escapeHtml(cls.location || 'N/A')}</strong>
                ${cls.room ? `<small>Room ${escapeHtml(cls.room)}</small>` : ''}
            </div>
            <div class="class-actions">
                <button class="action-btn edit" title="Edit" onclick="editClass('${cls._id}')">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="action-btn delete" title="Delete" onclick="confirmDelete('${cls._id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

/* =====================================================
   MODAL — OPEN / CLOSE
===================================================== */
function openModal(cls = null) {
    editingId = cls?._id || null;
    document.getElementById('modalTitle').textContent = cls ? 'Edit Class' : 'Add New Class';
    document.getElementById('saveBtn').innerHTML = cls
        ? '<i class="fas fa-save"></i> Update Class'
        : '<i class="fas fa-save"></i> Save Class';

    // Reset form
    document.getElementById('classForm').reset();
    document.getElementById('classId').value = editingId || '';
    clearErrors();

    // Prefill if editing
    if (cls) {
        document.getElementById('courseName').value = cls.subject || '';
        document.getElementById('courseCode').value = cls.code || '';
        document.getElementById('day').value = cls.day || '';
        document.getElementById('startTime').value = cls.startTime || '';
        document.getElementById('endTime').value = cls.endTime || '';
        document.getElementById('location').value = cls.location || '';
        document.getElementById('room').value = cls.room || '';
    }

    document.getElementById('classModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus first field
    setTimeout(() => document.getElementById('courseName').focus(), 100);
}

function closeModal() {
    document.getElementById('classModal').classList.remove('active');
    document.body.style.overflow = '';
    editingId = null;
}

/* =====================================================
   EDIT / DELETE HANDLERS
===================================================== */
window.editClass = function (id) {
    const cls = allClasses.find(c => c._id === id);
    if (cls) openModal(cls);
};

window.confirmDelete = function (id) {
    const cls = allClasses.find(c => c._id === id);
    if (!cls) return;
    deleteId = id;
    document.getElementById('deleteClassName').textContent =
        `${cls.subject} (${cls.code})`;
    document.getElementById('deleteModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    document.body.style.overflow = '';
    deleteId = null;
}

/* =====================================================
   SAVE (Add / Update)
===================================================== */
async function handleSave(e) {
    e.preventDefault();
    clearErrors();

    const subject = document.getElementById('courseName').value.trim();
    const code = document.getElementById('courseCode').value.trim();
    const day = document.getElementById('day').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const location = document.getElementById('location').value.trim();
    const room = document.getElementById('room').value.trim();

    // ---------- Validation ----------
    let hasError = false;

    if (!subject) { setError('courseName', 'Course name is required'); hasError = true; }
    if (!code) { setError('courseCode', 'Course code is required'); hasError = true; }
    if (!day) { setError('day', 'Please select a day'); hasError = true; }
    if (!startTime) { setError('startTime', 'Start time is required'); hasError = true; }
    if (!endTime) { setError('endTime', 'End time is required'); hasError = true; }

    if (startTime && endTime && timeToMinutes(endTime) <= timeToMinutes(startTime)) {
        setError('endTime', 'End time must be after start time');
        hasError = true;
    }

    // Check for duplicate (same day + overlapping time + different id)
    if (!hasError) {
        const duplicate = allClasses.find(c =>
            c._id !== editingId &&
            c.day === day &&
            timesOverlap(startTime, endTime, c.startTime, c.endTime)
        );
        if (duplicate) {
            setError('startTime', 'This time overlaps with another class on ' + day);
            hasError = true;
        }
    }

    if (hasError) return;

    // ---------- Submit ----------
    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const url = editingId ? `/api/classes/${editingId}` : '/api/classes';
        const method = editingId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ subject, code, day, startTime, endTime, location, room }),
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Save failed');

        // Update local list
        if (editingId) {
            const idx = allClasses.findIndex(c => c._id === editingId);
            if (idx !== -1) allClasses[idx] = data.data;
            showToast('success', 'Class updated', `${subject} has been updated`);
        } else {
            allClasses.push(data.data);
            showToast('success', 'Class added', `${subject} has been added to your schedule`);
        }

        closeModal();
        renderClasses();
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
async function handleDelete() {
    if (!deleteId) return;
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    const cls = allClasses.find(c => c._id === deleteId);
    const name = cls?.subject || 'Class';

    try {
        const res = await fetch(`/api/classes/${deleteId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Delete failed');

        allClasses = allClasses.filter(c => c._id !== deleteId);
        closeDeleteModal();
        renderClasses();
        showToast('success', 'Class deleted', `${name} has been removed`);
    } catch (err) {
        showToast('error', 'Delete failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-trash"></i> Delete';
    }
}

/* =====================================================
   FIELD ERRORS
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
        </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
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

function timesOverlap(startA, endA, startB, endB) {
    const sA = timeToMinutes(startA);
    const eA = timeToMinutes(endA);
    const sB = timeToMinutes(startB);
    const eB = timeToMinutes(endB);
    return sA < eB && sB < eA;
}

function capitalize(str) {
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