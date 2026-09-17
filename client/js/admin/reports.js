/* =====================================================
   UNIBUS — Reports Page Logic
===================================================== */

let user = null;
let allBookings = [];
let allTrips = [];
let allBuses = [];
let allRoutes = [];
let allDrivers = [];

let filteredBookings = [];
let filteredTrips = [];

let trendChart, routeChart, busChart, hoursChart;

// Table state
let tableData = [];
let currentPage = 1;
let pageSize = 25;
let sortField = 'date';
let sortDir = 'desc';
let searchQuery = '';

const idsMatch = (a, b) => a && b && String(a) === String(b);

const CHART_COLORS = {
    primary: '#f97316',
    primaryLight: 'rgba(249,115,22,0.15)',
    green: '#10b981',
    blue: '#3b82f6',
    red: '#ef4444',
    purple: '#8b5cf6',
    yellow: '#eab308',
    gray: '#94a3b8',
};

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

    // Preset chips
    document.querySelectorAll('.preset-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            applyPreset(parseInt(chip.dataset.range, 10) || 'all');
        });
    });

    // Apply date range
    document.getElementById('applyDateBtn')?.addEventListener('click', () => {
        document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
        applyDateRange();
    });

    // Table controls
    document.getElementById('tableSearch')?.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        currentPage = 1;
        renderTable();
    });
    document.getElementById('tablePageSize')?.addEventListener('change', (e) => {
        pageSize = parseInt(e.target.value, 10);
        currentPage = 1;
        renderTable();
    });

    // Sortable headers
    document.querySelectorAll('.report-table thead th').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (!field) return;
            if (sortField === field) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            else { sortField = field; sortDir = 'desc'; }
            renderTable();
        });
    });

    // Export
    document.getElementById('exportBtn')?.addEventListener('click', exportCSV);

    // Load data
    await loadData();

    // Default: last 7 days
    applyPreset(7);
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
   LOAD ALL DATA
===================================================== */
async function loadData() {
    const [bookings, trips, buses, routes, drivers] = await Promise.all([
        fetchJSON('/api/bookings'),
        fetchJSON('/api/trips'),
        fetchJSON('/api/admin/buses'),
        fetchJSON('/api/routes'),
        fetchJSON('/api/admin/drivers'),
    ]);

    allBookings = bookings;
    allTrips = trips;
    allBuses = buses;
    allRoutes = routes;
    allDrivers = drivers;

    console.log('Loaded:', { bookings: allBookings.length, trips: allTrips.length });
}

async function fetchJSON(url) {
    try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) return [];
        const data = await res.json();
        return data.data || [];
    } catch { return []; }
}

/* =====================================================
   DATE RANGE
===================================================== */
function applyPreset(days) {
    const toDate = new Date();
    const fromDate = new Date();

    if (days === 'all' || isNaN(days)) {
        // No filtering
        document.getElementById('fromDate').value = '';
        document.getElementById('toDate').value = '';
    } else {
        fromDate.setDate(fromDate.getDate() - days + 1);
        document.getElementById('fromDate').value = toISO(fromDate);
        document.getElementById('toDate').value = toISO(toDate);
    }

    applyDateRange();
}

function applyDateRange() {
    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;

    const fromTs = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
    const toTs = to ? new Date(to).setHours(23, 59, 59, 999) : Infinity;

    // Filter bookings by createdAt
    filteredBookings = allBookings.filter(b => {
        const ts = new Date(b.createdAt || b.travelDate).getTime();
        return ts >= fromTs && ts <= toTs;
    });

    // Filter trips by date
    filteredTrips = allTrips.filter(t => {
        if (!t.date) return false;
        const ts = new Date(t.date).getTime();
        return ts >= fromTs && ts <= toTs;
    });

    console.log('Filtered:', { bookings: filteredBookings.length, trips: filteredTrips.length });

    updateSummary();
    renderCharts();
    renderPerformers();
    buildTableData();
    renderTable();
}

function toISO(date) {
    return date.toISOString().split('T')[0];
}

/* =====================================================
   SUMMARY
===================================================== */
function updateSummary() {
    const totalBookings = filteredBookings.length;
    const confirmed = filteredBookings.filter(b => b.status === 'confirmed').length;
    const cancelled = filteredBookings.filter(b => b.status === 'cancelled').length;

    const uniqueStudents = new Set(
        filteredBookings.map(b => b.student?._id || b.student || b.studentId).filter(Boolean)
    ).size;

    // Occupancy: sum(booked) / sum(capacity) across trips
    let totalCapacity = 0;
    let totalBooked = 0;
    filteredTrips.forEach(t => {
        const bus = allBuses.find(b => idsMatch(b._id, t.bus?._id || t.bus));
        const cap = bus?.capacity || t.bus?.capacity || 0;
        const booked = cap - (t.availableSeats || 0);
        totalCapacity += cap;
        totalBooked += booked;
    });

    const occupancy = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;

    document.getElementById('statTotalBookings').textContent = totalBookings;
    document.getElementById('statConfirmed').textContent = confirmed;
    document.getElementById('statCancelled').textContent = cancelled;
    document.getElementById('statTrips').textContent = filteredTrips.length;
    document.getElementById('statStudents').textContent = uniqueStudents;
    document.getElementById('statOccupancy').textContent = occupancy + '%';
}

/* =====================================================
   CHARTS
===================================================== */
function renderCharts() {
    renderTrendChart();
    renderRouteChart();
    renderBusChart();
    renderHoursChart();
}

function renderTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    // Group bookings by date
    const counts = {};
    filteredBookings.forEach(b => {
        const date = new Date(b.createdAt || b.travelDate);
        const key = toISO(date);
        counts[key] = (counts[key] || 0) + 1;
    });

    const sortedDates = Object.keys(counts).sort();
    const labels = sortedDates;
    const data = sortedDates.map(d => counts[d]);

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ['No data'],
            datasets: [{
                label: 'Bookings',
                data: data.length ? data : [0],
                borderColor: CHART_COLORS.primary,
                backgroundColor: CHART_COLORS.primaryLight,
                fill: true,
                tension: 0.4,
                borderWidth: 2.5,
                pointRadius: 4,
                pointBackgroundColor: CHART_COLORS.primary,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
            }],
        },
        options: chartOptions('Bookings'),
    });
}

function renderRouteChart() {
    const ctx = document.getElementById('routeChart');
    if (!ctx) return;

    // Group bookings by route
    const counts = {};
    filteredBookings.forEach(b => {
        const route = b.route || b.trip?.route;
        const name = route?.name || 'Unknown';
        counts[name] = (counts[name] || 0) + 1;
    });

    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

    const labels = sorted.map(x => x[0]);
    const data = sorted.map(x => x[1]);

    if (routeChart) routeChart.destroy();

    routeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['No data'],
            datasets: [{
                label: 'Bookings',
                data: data.length ? data : [0],
                backgroundColor: CHART_COLORS.primary,
                borderRadius: 6,
            }],
        },
        options: {
            ...chartOptions('Bookings'),
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: { ...chartOptions().plugins.tooltip },
            },
        },
    });
}

function renderBusChart() {
    const ctx = document.getElementById('busChart');
    if (!ctx) return;

    const counts = {};
    filteredBookings.forEach(b => {
        const bus = b.bus || b.trip?.bus;
        const name = bus?.busNumber || 'Unknown';
        counts[name] = (counts[name] || 0) + 1;
    });

    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

    const labels = sorted.map(x => x[0]);
    const data = sorted.map(x => x[1]);

    if (busChart) busChart.destroy();

    const palette = [
        CHART_COLORS.primary,
        CHART_COLORS.blue,
        CHART_COLORS.green,
        CHART_COLORS.purple,
        CHART_COLORS.yellow,
        CHART_COLORS.red,
    ];

    busChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length ? labels : ['No data'],
            datasets: [{
                data: data.length ? data : [1],
                backgroundColor: palette.slice(0, Math.max(1, labels.length)),
                borderWidth: 3,
                borderColor: '#fff',
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: 'DM Sans', size: 12 },
                        padding: 12,
                        usePointStyle: true,
                    },
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    padding: 10,
                    titleFont: { family: 'DM Sans', size: 13 },
                    bodyFont: { family: 'DM Sans', size: 12 },
                },
            },
        },
    });
}

function renderHoursChart() {
    const ctx = document.getElementById('hoursChart');
    if (!ctx) return;

    // Group by departure hour (6 AM to 10 PM)
    const counts = {};
    for (let h = 6; h <= 22; h++) counts[h] = 0;

    filteredBookings.forEach(b => {
        const trip = b.trip;
        if (!trip?.departureTime) return;
        const h = parseInt(trip.departureTime.split(':')[0], 10);
        if (h in counts) counts[h]++;
    });

    const labels = Object.keys(counts).map(h => formatHour(parseInt(h, 10)));
    const data = Object.values(counts);

    if (hoursChart) hoursChart.destroy();

    hoursChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Bookings',
                data,
                backgroundColor: CHART_COLORS.blue,
                borderRadius: 6,
            }],
        },
        options: chartOptions('Bookings'),
    });
}

function chartOptions(yLabel = '') {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    font: { family: 'DM Sans', size: 12 },
                    usePointStyle: true,
                    padding: 16,
                },
            },
            tooltip: {
                backgroundColor: '#0f172a',
                padding: 10,
                titleFont: { family: 'DM Sans', size: 13 },
                bodyFont: { family: 'DM Sans', size: 12 },
                cornerRadius: 8,
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: {
                    font: { family: 'DM Sans', size: 11 },
                    color: '#64748b',
                },
            },
            y: {
                beginAtZero: true,
                grid: { color: '#f1f5f9' },
                ticks: {
                    font: { family: 'DM Sans', size: 11 },
                    color: '#64748b',
                    precision: 0,
                },
                title: {
                    display: !!yLabel,
                    text: yLabel,
                    font: { family: 'DM Sans', size: 11 },
                    color: '#94a3b8',
                },
            },
        },
    };
}

/* =====================================================
   PERFORMERS
===================================================== */
function renderPerformers() {
    // Top Route
    const routeCounts = {};
    filteredBookings.forEach(b => {
        const route = b.route || b.trip?.route;
        const name = route?.name || 'Unknown';
        routeCounts[name] = (routeCounts[name] || 0) + 1;
    });
    const topRoute = Object.entries(routeCounts).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('topRoute').textContent = topRoute?.[0] || '—';
    document.getElementById('topRouteCount').textContent =
        topRoute ? `${topRoute[1]} bookings` : '0 bookings';

    // Top Bus
    const busCounts = {};
    filteredBookings.forEach(b => {
        const bus = b.bus || b.trip?.bus;
        const name = bus?.busNumber || 'Unknown';
        busCounts[name] = (busCounts[name] || 0) + 1;
    });
    const topBus = Object.entries(busCounts).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('topBus').textContent = topBus?.[0] || '—';
    document.getElementById('topBusCount').textContent =
        topBus ? `${topBus[1]} bookings` : '0 bookings';

    // Top Driver
    const driverCounts = {};
    filteredTrips.forEach(t => {
        const driver = allDrivers.find(d => idsMatch(d._id || d.id, t.driver));
        const name = driver?.name || 'Unknown';
        driverCounts[name] = (driverCounts[name] || 0) + 1;
    });
    const topDriver = Object.entries(driverCounts).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('topDriver').textContent = topDriver?.[0] || '—';
    document.getElementById('topDriverCount').textContent =
        topDriver ? `${topDriver[1]} trips` : '0 trips';

    // Peak Hour
    const hourCounts = {};
    filteredBookings.forEach(b => {
        const trip = b.trip;
        if (!trip?.departureTime) return;
        const h = trip.departureTime;
        hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const topHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('topHour').textContent = topHour ? formatTime(topHour[0]) : '—';
    document.getElementById('topHourCount').textContent =
        topHour ? `${topHour[1]} bookings` : '0 bookings';
}

/* =====================================================
   TABLE
===================================================== */
function buildTableData() {
    tableData = filteredTrips.map(trip => {
        const route = trip.route || allRoutes.find(r => idsMatch(r._id, trip.route));
        const bus = trip.bus || allBuses.find(b => idsMatch(b._id, trip.bus));
        const driver = allDrivers.find(d => idsMatch(d._id || d.id, trip.driver));
        const capacity = bus?.capacity || 40;
        const booked = capacity - (trip.availableSeats || 0);
        const cancelled = filteredBookings.filter(b =>
            idsMatch(b.trip?._id || b.trip, trip._id) && b.status === 'cancelled'
        ).length;
        const occupancy = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;

        return {
            _id: trip._id,
            date: trip.date,
            tripId: `TR-${trip._id.slice(-6).toUpperCase()}`,
            route: route?.name || '—',
            bus: bus?.busNumber || '—',
            driver: driver?.name || 'Unassigned',
            booked,
            cancelled,
            capacity,
            occupancy,
            departureTime: trip.departureTime,
        };
    });
}

function renderTable() {
    let data = [...tableData];

    // Search
    if (searchQuery) {
        data = data.filter(row =>
            `${row.tripId} ${row.route} ${row.bus} ${row.driver}`.toLowerCase().includes(searchQuery)
        );
    }

    // Sort
    data.sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        let av = a[sortField], bv = b[sortField];
        if (sortField === 'date') {
            av = new Date(av || 0).getTime();
            bv = new Date(bv || 0).getTime();
        }
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
    });

    const total = data.length;
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageData = data.slice(start, end);

    const tbody = document.getElementById('reportTableBody');

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray);">
            <i class="fas fa-inbox" style="font-size:1.8rem;opacity:0.4;display:block;margin-bottom:8px;"></i>
            No trips found for this range
        </td></tr>`;
    } else {
        tbody.innerHTML = pageData.map(row => {
            const occClass = row.occupancy >= 70 ? 'high' : row.occupancy < 30 ? 'low' : '';
            return `
                <tr>
                    <td>${row.date ? new Date(row.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '—'}</td>
                    <td class="cell-trip">${row.tripId}</td>
                    <td>${escapeHtml(row.route)}</td>
                    <td class="cell-bus">${escapeHtml(row.bus)}</td>
                    <td>${escapeHtml(row.driver)}</td>
                    <td>${row.booked} / ${row.capacity}</td>
                    <td>${row.cancelled}</td>
                    <td>
                        <div class="occupancy-bar">
                            <div class="occupancy-track">
                                <div class="occupancy-fill ${occClass}" style="width:${row.occupancy}%"></div>
                            </div>
                            <span>${row.occupancy}%</span>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    }

    // Info
    document.getElementById('tableInfo').textContent =
        total === 0 ? 'Showing 0 of 0 trips' :
        `Showing ${start + 1}–${Math.min(end, total)} of ${total} trips`;

    // Pagination
    renderPagination(total);
}

function renderPagination(total) {
    const totalPages = Math.ceil(total / pageSize) || 1;
    const el = document.getElementById('pagination');

    if (totalPages <= 1) { el.innerHTML = ''; return; }

    const pages = [];
    pages.push(`<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`);

    // Show first, current-1, current, current+1, last
    const showPages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    const sortedPages = [...showPages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);

    let lastPage = 0;
    sortedPages.forEach(p => {
        if (p - lastPage > 1) pages.push('<span style="padding:0 6px;color:var(--gray);">…</span>');
        pages.push(`<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`);
        lastPage = p;
    });

    pages.push(`<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`);

    el.innerHTML = pages.join('');
}

window.goToPage = function (page) {
    const total = tableData.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
};

/* =====================================================
   EXPORT CSV
===================================================== */
function exportCSV() {
    if (tableData.length === 0) {
        showToast('error', 'Nothing to export', 'No data for the selected range');
        return;
    }

    const headers = ['Date', 'Trip ID', 'Route', 'Bus', 'Driver', 'Booked', 'Cancelled', 'Occupancy %'];
    const rows = tableData.map(r => [
        r.date ? new Date(r.date).toLocaleDateString() : '',
        r.tripId,
        r.route,
        r.bus,
        r.driver,
        `${r.booked}/${r.capacity}`,
        r.cancelled,
        r.occupancy,
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unibus-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('success', 'Report exported', 'CSV file downloaded');
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
function formatHour(h) {
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}${ampm}`;
}

function formatTime(time) {
    if (!time) return '—';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}