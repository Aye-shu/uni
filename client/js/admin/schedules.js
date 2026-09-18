/* =====================================================
   UNIBUS — Manage Schedules (Final Working Version)
===================================================== */

let allTrips = [];
let filteredTrips = [];
let allRoutes = [];
let allBuses = [];
let allDrivers = [];
let editingId = null;
let deleteTargetId = null;
let user = null;

const STATUS_LABELS = {
    scheduled:     { label: 'Scheduled', cls: 'scheduled',   icon: 'fa-circle' },
    'in-progress': { label: 'Active',    cls: 'in-progress', icon: 'fa-circle' },
    completed:     { label: 'Completed', cls: 'completed',   icon: 'fa-check-circle' },
    cancelled:     { label: 'Cancelled', cls: 'cancelled',   icon: 'fa-times-circle' },
    delayed:       { label: 'Delayed',   cls: 'delayed',     icon: 'fa-clock' },
};

const idsMatch = (a, b) => a && b && String(a) === String(b);

document.addEventListener('DOMContentLoaded', async () => {
    user = await checkAuth();
    if (!user) return;

    document.getElementById('userName').textContent = user.name || 'Admin';
    document.getElementById('userRole').textContent = user.role || 'admin';
    document.getElementById('userAvatar').textContent = (user.name || 'A').charAt(0).toUpperCase();

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

    // ⚡ DEFAULT: Show ALL trips (leave date empty)
    document.getElementById('dateFilter').value = '';

    document.getElementById('addScheduleBtn')?.addEventListener('click', () => openModal());
    document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('cancelBtn')?.addEventListener('click', closeModal);
    document.getElementById('scheduleModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'scheduleModal') closeModal();
    });
    document.getElementById('scheduleForm')?.addEventListener('submit', saveSchedule);

    document.getElementById('repeatToggle')?.addEventListener('change', (e) => {
        document.getElementById('repeatOptions').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('scheduleRoute')?.addEventListener('change', autoFillArrival);
    document.getElementById('scheduleDeparture')?.addEventListener('change', autoFillArrival);

    document.getElementById('closeBookingsBtn')?.addEventListener('click', () => {
        document.getElementById('bookingsModal').classList.remove('active');
        document.body.style.overflow = '';
    });
    document.getElementById('bookingsModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'bookingsModal') {
            document.getElementById('bookingsModal').classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', cancelTrip);
    document.getElementById('deleteModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'deleteModal') closeDeleteModal();
    });

    document.getElementById('dateFilter')?.addEventListener('change', applyFilters);
    document.getElementById('routeFilter')?.addEventListener('change', applyFilters);
    document.getElementById('busFilter')?.addEventListener('change', applyFilters);
    document.getElementById('driverFilter')?.addEventListener('change', applyFilters);
    document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
    document.getElementById('resetFiltersBtn')?.addEventListener('click', resetFilters);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeDeleteModal();
            document.getElementById('bookingsModal').classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    await loadRoutes();
    await loadBuses();
    await loadDrivers();
    await loadTrips();
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
   LOAD DATA
===================================================== */
async function loadRoutes() {
    try {
        const res = await fetch('/api/routes', { credentials: 'include' });
        const data = await res.json();
        allRoutes = data.data || [];
        populateRouteDropdowns();
    } catch (err) { allRoutes = []; console.error('Routes:', err); }
}

async function loadBuses() {
    try {
        const res = await fetch('/api/admin/buses', { credentials: 'include' });
        const data = await res.json();
        allBuses = data.data || [];
        populateBusDropdowns();
    } catch (err) { allBuses = []; console.error('Buses:', err); }
}

async function loadDrivers() {
    try {
        const res = await fetch('/api/admin/drivers', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            allDrivers = data.data || [];
            if (allDrivers.length > 0) {
                populateDriverDropdowns();
                return;
            }
        }
    } catch (err) { console.warn('/api/admin/drivers failed:', err.message); }

    try {
        const res = await fetch('/api/admin/users', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            allDrivers = (data.data || []).filter(u => u.role === 'driver');
        }
    } catch (err) { allDrivers = []; }
    populateDriverDropdowns();
}

async function loadTrips() {
    try {
        const res = await fetch('/api/trips', { credentials: 'include' });
        const data = await res.json();
        allTrips = data.data || [];
        console.log('✅ Loaded', allTrips.length, 'trips');
        applyFilters();
    } catch (err) {
        console.error('Trips:', err);
        allTrips = [];
        applyFilters();
    }
}

/* =====================================================
   POPULATE DROPDOWNS
===================================================== */
function populateRouteDropdowns() {
    const filter = document.getElementById('routeFilter');
    const modal = document.getElementById('scheduleRoute');
    filter.innerHTML = '<option value="all">All Routes</option>';
    modal.innerHTML = '<option value="">Select route</option>';
    allRoutes.forEach(r => {
        filter.innerHTML += `<option value="${r._id}">${escapeHtml(r.name || r.code)}</option>`;
        modal.innerHTML += `<option value="${r._id}" data-duration="${r.estimatedDuration || 0}">${escapeHtml(r.name || r.code)}</option>`;
    });
}

function populateBusDropdowns() {
    const filter = document.getElementById('busFilter');
    const modal = document.getElementById('scheduleBus');
    filter.innerHTML = '<option value="all">All Buses</option>';
    modal.innerHTML = '<option value="">Select bus</option>';
    allBuses.forEach(b => {
        filter.innerHTML += `<option value="${b._id}">${escapeHtml(b.busNumber)}</option>`;
        modal.innerHTML += `<option value="${b._id}" data-capacity="${b.capacity || 0}">${escapeHtml(b.busNumber)} (${b.capacity} seats)</option>`;
    });
}

function populateDriverDropdowns() {
    const filter = document.getElementById('driverFilter');
    const modal = document.getElementById('scheduleDriver');
    filter.innerHTML = '<option value="all">All Drivers</option>';
    modal.innerHTML = '<option value="">Select driver</option>';

    if (allDrivers.length === 0) {
        modal.innerHTML = '<option value="" disabled>No drivers — create one in Manage Drivers</option>';
        return;
    }

    allDrivers.forEach(d => {
        const id = String(d._id || d.id || '');
        const name = d.name || d.email || 'Driver';
        const o1 = document.createElement('option');
        o1.value = id; o1.textContent = name;
        filter.appendChild(o1);
        const o2 = document.createElement('option');
        o2.value = id; o2.textContent = name;
        modal.appendChild(o2);
    });
}

function autoFillArrival() {
    const routeSelect = document.getElementById('scheduleRoute');
    const depInput = document.getElementById('scheduleDeparture');
    const arrInput = document.getElementById('scheduleArrival');
    const sel = routeSelect.options[routeSelect.selectedIndex];
    const dur = parseInt(sel?.dataset?.duration || '0', 10);
    if (dur > 0 && depInput.value) {
        const [h, m] = depInput.value.split(':').map(Number);
        const total = h * 60 + m + dur;
        arrInput.value = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }
}

/* =====================================================
   FILTERS — Date is now OPTIONAL
===================================================== */
function applyFilters() {
    const date = document.getElementById('dateFilter')?.value || '';
    const routeId = document.getElementById('routeFilter')?.value || 'all';
    const busId = document.getElementById('busFilter')?.value || 'all';
    const driverId = document.getElementById('driverFilter')?.value || 'all';
    const status = document.getElementById('statusFilter')?.value || 'all';

    filteredTrips = allTrips.filter(trip => {
        // If date is set, filter by day. Otherwise show all.
        if (date) {
            const selectedDay = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
            if (trip.day !== selectedDay) return false;
        }

        if (routeId !== 'all' && !idsMatch(trip.route?._id || trip.route, routeId)) return false;
        if (busId !== 'all' && !idsMatch(trip.bus?._id || trip.bus, busId)) return false;
        if (driverId !== 'all' && !idsMatch(trip.driver, driverId)) return false;
        if (status !== 'all' && trip.status !== status) return false;
        return true;
    });

    filteredTrips.sort((a, b) => (a.departureTime || '').localeCompare(b.departureTime || ''));
    renderTable();
}

function resetFilters() {
    document.getElementById('dateFilter').value = '';
    document.getElementById('routeFilter').value = 'all';
    document.getElementById('busFilter').value = 'all';
    document.getElementById('driverFilter').value = 'all';
    document.getElementById('statusFilter').value = 'all';
    applyFilters();
}

/* =====================================================
   RENDER
===================================================== */
function getDriverName(trip) {
    if (!trip || !trip.driver) return 'Unassigned';
    if (typeof trip.driver === 'object' && trip.driver.name) return trip.driver.name;
    const id = String(trip.driver);
    const found = allDrivers.find(d => String(d._id || d.id || '') === id);
    if (found) return found.name || found.email || 'Driver';
    return 'Driver #' + id.slice(-6);
}

function renderTable() {
    const container = document.getElementById('scheduleTableContainer');
    const countEl = document.getElementById('scheduleCount');
    countEl.textContent = `${filteredTrips.length} of ${allTrips.length} trips`;

    if (filteredTrips.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <h3>No trips found</h3>
                <p>Try clearing the date filter or adjusting your filters.</p>
                <button type="button" class="btn-add" onclick="document.getElementById('resetFiltersBtn').click()">
                    <i class="fas fa-redo"></i> Show All Trips
                </button>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="schedule-table">
            <div class="schedule-table-header">
                <span>Trip ID</span>
                <span>Route</span>
                <span>Bus</span>
                <span>Driver</span>
                <span>Departs</span>
                <span>Arrives</span>
                <span>Seats</span>
                <span>Status</span>
                <span style="text-align:right;">Actions</span>
            </div>
            ${filteredTrips.map(t => renderRow(t)).join('')}
        </div>
    `;
}

function renderRow(trip) {
    const route = trip.route || {};
    const bus = trip.bus || {};
    const driverName = getDriverName(trip);
    const status = STATUS_LABELS[trip.status] || STATUS_LABELS.scheduled;
    const tripId = `TR-${trip._id?.slice(-6).toUpperCase() || 'XXX'}`;
    const busName = bus.busNumber || '—';
    const capacity = bus.capacity || 0;
    const booked = capacity - (trip.availableSeats || 0);

    return `
        <div class="schedule-table-row" data-trip="${tripId}">
            <span class="trip-id">${tripId}</span>
            <span class="trip-route">${escapeHtml(route.name || '—')}</span>
            <span class="trip-bus">${escapeHtml(busName)}</span>
            <span class="trip-driver">${escapeHtml(driverName)}</span>
            <span class="trip-time">${formatTime(trip.departureTime)}</span>
            <span class="trip-time">${formatTime(trip.arrivalTime)}</span>
            <span class="trip-seats">${booked} / ${capacity}</span>
            <span><span class="status-pill ${status.cls}">
                <i class="fas ${status.icon}"></i> ${status.label}
            </span></span>
            <div class="row-actions">
                <button class="act-btn view" title="View Bookings" onclick="viewBookings('${trip._id}')">
                    <i class="fas fa-users"></i>
                </button>
                <button class="act-btn edit" title="Edit" onclick="editTrip('${trip._id}')">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="act-btn delete" title="Cancel Trip" onclick="confirmCancel('${trip._id}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
}

/* =====================================================
   VIEW BOOKINGS
===================================================== */
window.viewBookings = async function (tripId) {
    const container = document.getElementById('bookingsView');
    container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--gray);"><i class="fas fa-spinner fa-spin"></i> Loading...</p>';
    document.getElementById('bookingsModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
        const res = await fetch(`/api/trips/${tripId}/passengers`, { credentials: 'include' });
        const data = await res.json();
        const bookings = data.data || [];
        if (bookings.length === 0) {
            container.innerHTML = `<div class="empty-state" style="border:none;padding:40px 20px;">
                <i class="fas fa-users-slash"></i><h3>No passengers</h3></div>`;
            return;
        }
        container.innerHTML = bookings.map(b => `
            <div class="booking-item">
                <span class="booking-seat">Seat ${escapeHtml(String(b.seatNumber || '—'))}</span>
                <div>
                    <div class="booking-name">${escapeHtml(b.student?.name || 'Student')}</div>
                    <div class="booking-id">${escapeHtml(b.student?.email || '')}</div>
                </div>
                <span class="booking-id">${escapeHtml(b.bookingId || '')}</span>
                <span class="booking-status">${escapeHtml(b.status || 'confirmed')}</span>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<p style="color:var(--red);text-align:center;padding:20px;">Failed to load</p>`;
    }
};

/* =====================================================
   MODAL
===================================================== */
function openModal(trip = null) {
    editingId = trip?._id || null;
    const title = document.getElementById('modalTitle');
    const recurring = document.getElementById('recurringSection');

    if (trip) {
        title.innerHTML = '<i class="fas fa-pen"></i> Edit Schedule';
        recurring.style.display = 'none';
    } else {
        title.innerHTML = '<i class="fas fa-calendar-plus"></i> Create Schedule';
        recurring.style.display = 'block';
        document.getElementById('repeatToggle').checked = false;
        document.getElementById('repeatOptions').style.display = 'none';
    }

    document.getElementById('scheduleForm').reset();
    clearErrors();

    if (allDrivers.length > 0) populateDriverDropdowns();

    if (trip) {
        const routeId = String(trip.route?._id || trip.route || '');
        const busId = String(trip.bus?._id || trip.bus || '');
        const driverId = String(trip.driver || '');

        document.getElementById('scheduleRoute').value = routeId;
        document.getElementById('scheduleBus').value = busId;
        document.getElementById('scheduleDriver').value = driverId;
        document.getElementById('scheduleDirection').value = trip.direction || 'outbound';
        document.getElementById('scheduleDeparture').value = trip.departureTime || '';
        document.getElementById('scheduleArrival').value = trip.arrivalTime || '';
        document.getElementById('scheduleStatus').value = trip.status === 'cancelled' ? 'cancelled' : 'scheduled';

        if (trip.date) {
            document.getElementById('scheduleDate').value = new Date(trip.date).toISOString().split('T')[0];
        }

        const driverSelect = document.getElementById('scheduleDriver');
        if (driverId && driverSelect.value !== driverId) {
            const tempOpt = document.createElement('option');
            tempOpt.value = driverId;
            tempOpt.textContent = getDriverName(trip);
            driverSelect.appendChild(tempOpt);
            driverSelect.value = driverId;
        }
    } else {
        document.getElementById('scheduleDate').value = new Date().toISOString().split('T')[0];
    }

    document.getElementById('scheduleModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('scheduleModal').classList.remove('active');
    document.body.style.overflow = '';
    editingId = null;
}

window.editTrip = function (id) {
    const trip = allTrips.find(t => t._id === id);
    if (trip) openModal(trip);
};

window.confirmCancel = function (id) {
    const trip = allTrips.find(t => t._id === id);
    if (!trip) return;
    deleteTargetId = id;
    document.getElementById('deleteTripName').textContent = `TR-${id.slice(-6).toUpperCase()}`;
    document.getElementById('deleteModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    document.body.style.overflow = '';
    deleteTargetId = null;
}

/* =====================================================
   SAVE — Refetches after save, keeps edit context
===================================================== */
async function saveSchedule(e) {
    e.preventDefault();
    clearErrors();

    const routeId = document.getElementById('scheduleRoute').value;
    const busId = document.getElementById('scheduleBus').value;
    const driverId = document.getElementById('scheduleDriver').value;
    const direction = document.getElementById('scheduleDirection').value;
    const dateVal = document.getElementById('scheduleDate').value;
    const departure = document.getElementById('scheduleDeparture').value;
    const arrival = document.getElementById('scheduleArrival').value;
    const status = document.getElementById('scheduleStatus').value;
    const notes = document.getElementById('scheduleNotes').value.trim();

    let hasError = false;
    if (!routeId) { setError('scheduleRoute', 'Select a route'); hasError = true; }
    if (!busId) { setError('scheduleBus', 'Select a bus'); hasError = true; }
    if (!driverId) { setError('scheduleDriver', 'Select a driver'); hasError = true; }
    if (!dateVal) { setError('scheduleDate', 'Date required'); hasError = true; }
    if (!departure) { setError('scheduleDeparture', 'Departure required'); hasError = true; }
    if (!arrival) { setError('scheduleArrival', 'Arrival required'); hasError = true; }
    if (departure && arrival && arrival <= departure) {
        setError('scheduleArrival', 'Arrival must be after departure');
        hasError = true;
    }
    if (hasError) return;

    const selectedDate = new Date(dateVal);
    const day = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
    const selectedBus = allBuses.find(b => idsMatch(b._id, busId));
    const capacity = selectedBus?.capacity || 40;

    const dates = [];
    const repeat = !editingId && document.getElementById('repeatToggle').checked;

    if (repeat) {
        const pattern = document.getElementById('repeatPattern').value;
        const untilVal = document.getElementById('repeatUntil').value;
        if (!untilVal) { showToast('error', 'Repeat end date required', ''); return; }
        const until = new Date(untilVal);
        const cur = new Date(dateVal);
        while (cur <= until) {
            const dayName = cur.toLocaleDateString('en-US', { weekday: 'long' });
            let include = false;
            if (pattern === 'daily') include = true;
            else if (pattern === 'weekdays') include = !['Saturday', 'Sunday'].includes(dayName);
            else if (pattern === 'weekly') include = dayName === day;
            if (include) dates.push({ date: new Date(cur), day: dayName });
            cur.setDate(cur.getDate() + 1);
        }
    } else {
        dates.push({ date: selectedDate, day });
    }

    const btn = document.getElementById('saveBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        if (editingId) {
            // ============ EDIT ============
            const res = await fetch(`/api/trips/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    route: routeId, bus: busId, driver: driverId, date: selectedDate, day,
                    direction, departureTime: departure, arrivalTime: arrival, status, notes,
                    availableSeats: capacity,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Update failed');

            // ⚡ IMMEDIATE LOCAL UPDATE — no refetch needed
            const idx = allTrips.findIndex(t => t._id === editingId);
            if (idx !== -1 && data.data) {
                allTrips[idx] = data.data;

                // Ensure bus/route objects are attached (in case API returns IDs)
                if (!allTrips[idx].bus || typeof allTrips[idx].bus !== 'object') {
                    allTrips[idx].bus = allBuses.find(b => idsMatch(b._id, busId));
                }
                if (!allTrips[idx].route || typeof allTrips[idx].route !== 'object') {
                    allTrips[idx].route = allRoutes.find(r => idsMatch(r._id, routeId));
                }
            }

            // Clear date filter so nothing is hidden
            document.getElementById('dateFilter').value = '';

            // Re-render immediately (shows the change right away)
            applyFilters();

            showToast('success', 'Trip updated', 'Schedule saved successfully');

        } else {
            // ============ CREATE ============
            let created = 0;
            const createdTrips = [];

            for (const d of dates) {
                const res = await fetch('/api/trips', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        route: routeId, bus: busId, driver: driverId, date: d.date, day: d.day,
                        direction, departureTime: departure, arrivalTime: arrival, status, notes,
                        availableSeats: capacity, bookings: [],
                        currentLocation: { latitude: 0, longitude: 0 },
                    }),
                });
                const data = await res.json();
                if (res.ok && data.data) {
                    // Attach bus/route for immediate display
                    if (!data.data.bus || typeof data.data.bus !== 'object') {
                        data.data.bus = allBuses.find(b => idsMatch(b._id, busId));
                    }
                    if (!data.data.route || typeof data.data.route !== 'object') {
                        data.data.route = allRoutes.find(r => idsMatch(r._id, routeId));
                    }
                    createdTrips.push(data.data);
                    created++;
                }
            }

            // Add to local array immediately
            createdTrips.forEach(t => allTrips.push(t));

            // Clear date filter
            document.getElementById('dateFilter').value = '';

            // Re-render
            applyFilters();

            showToast('success', `${created} trip${created !== 1 ? 's' : ''} created`, '');
        }

        closeModal();

        // Optional: silent background refresh to fully sync with server
        setTimeout(() => loadTrips(), 300);

    } catch (err) {
        console.error('Save error:', err);
        showToast('error', 'Save failed', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
/* =====================================================
   CANCEL TRIP
===================================================== */
async function cancelTrip() {
    if (!deleteTargetId) return;
    const btn = document.getElementById('confirmDeleteBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelling...';

    try {
        const res = await fetch(`/api/trips/${deleteTargetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: 'cancelled' }),
        });
        const data = await res.json();

        if (!res.ok || !data.data) {
            const delRes = await fetch(`/api/trips/${deleteTargetId}`, { method: 'DELETE', credentials: 'include' });
            if (!delRes.ok) throw new Error(data.message || 'Cancel failed');
        }

        closeDeleteModal();
        await loadTrips();
        showToast('success', 'Trip cancelled', '');
    } catch (err) {
        showToast('error', 'Cancel failed', err.message);
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
    if (err) { err.textContent = message; err.classList.add('show'); }
}

function clearErrors() {
    document.querySelectorAll('#scheduleModal .form-field input, #scheduleModal .form-field select').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('#scheduleModal .field-error').forEach(el => { el.classList.remove('show'); el.textContent = ''; });
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
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><div class="toast-content"><h5>${escapeHtml(title)}</h5>${message ? `<p>${escapeHtml(message)}</p>` : ''}</div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(40px)'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

/* =====================================================
   UTILITIES
===================================================== */
function formatTime(time) {
    if (!time) return '—';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}