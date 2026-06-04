requireAuth();
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.className = savedTheme;
updateThemeBtn(savedTheme);
document.getElementById('themeBtn').addEventListener('click', () => {
    const newTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
    document.body.className = newTheme;
    localStorage.setItem('theme', newTheme);
    updateThemeBtn(newTheme);
    if (barChart) updateChartColors();
});
function updateThemeBtn(theme) {
    document.getElementById('themeIcon').className    = theme === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
    document.getElementById('themeLabel').textContent = theme === 'dark' ? 'Light' : 'Dark';
}
const user = getUser();
if (user) {
    const initials = ((user.firstName?.[0]||'')+(user.lastName?.[0]||'')).toUpperCase()||'U';
    document.getElementById('sbAvatar').textContent   = initials;
    document.getElementById('sbUserName').textContent = `${user.firstName||''} ${user.lastName||''}`.trim() || user.fullName || 'User';
    document.getElementById('sbUserRole').textContent = user.roles?.[0] || 'User';
}
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('dateLabel').textContent = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});


let barChart, donutChart;
const colors = ['#4F46E5','#7C3AED','#16a34a','#dc2626'];

function initCharts(statuses) {
    const labels    = statuses.map(s => s.name);
    const values    = statuses.map(s => s.count);
    const isDark    = document.body.classList.contains('dark');
    const gridColor = isDark ? '#1a1a1a' : '#f5f5f5';
    const tickColor = isDark ? '#555'    : '#aaa';

    const barCtx = document.getElementById('barChart').getContext('2d');
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
        type: 'bar',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 6, borderSkipped: false }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { font: { size: 11 }, color: tickColor } },
                x: { grid: { display: false }, ticks: { font: { size: 11 }, color: tickColor } }
            }
        }
    });

    const donutCtx = document.getElementById('donutChart').getContext('2d');
    if (donutChart) donutChart.destroy();
    donutChart = new Chart(donutCtx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
        options: { responsive: false, plugins: { legend: { display: false } }, cutout: '65%' }
    });

    document.getElementById('donutLegend').innerHTML = statuses.map((s, i) => `
        <div class="legend-row">
            <div class="legend-left"><div class="legend-dot" style="background:${colors[i]}"></div>${s.name}</div>
            <span class="legend-val">${s.count}</span>
        </div>
    `).join('');
}

function updateChartColors() {
    if (!barChart) return;
    const isDark = document.body.classList.contains('dark');
    barChart.options.scales.y.grid.color  = isDark ? '#1a1a1a' : '#f5f5f5';
    barChart.options.scales.y.ticks.color = isDark ? '#555' : '#aaa';
    barChart.options.scales.x.ticks.color = isDark ? '#555' : '#aaa';
    barChart.update();
}

function statusBadge(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('progress')) return `<span class="badge b-progress">${name}</span>`;
    if (n.includes('pending'))  return `<span class="badge b-pending">${name}</span>`;
    if (n.includes('complet'))  return `<span class="badge b-done">${name}</span>`;
    if (n.includes('cancel'))   return `<span class="badge b-cancelled">${name}</span>`;
    return `<span class="badge b-pending">${name}</span>`;
}

// ── Helper para extraer totalCount ─────────────
function extractTotal(result) {
    if (result.status !== 'fulfilled') return '—';
    const raw = result.value?.data ?? result.value;
    return (raw?.totalCount ?? raw?.items?.length ?? 0).toLocaleString();
}

async function loadDashboard() {
    try {
        const [customers, vehicles, orders, parts] = await Promise.allSettled([
            api.get('/customers?pageNumber=1&pageSize=1'),
            api.get('/vehicles?pageNumber=1&pageSize=1'),
            api.get('/serviceorders?pageNumber=1&pageSize=10'),
            api.get('/parts?belowMinStock=true&pageSize=1')
        ]);

        // ── Stats ──────────────────────────────────
        document.getElementById('statCustomers').textContent = extractTotal(customers);
        document.getElementById('statVehicles').textContent  = extractTotal(vehicles);
        document.getElementById('statLowStock').textContent  = extractTotal(parts);

        // ── Orders ─────────────────────────────────
        if (orders.status === 'fulfilled') {
            const raw   = orders.value?.data ?? orders.value;
            const items = raw?.items ?? (Array.isArray(raw) ? raw : []);
            const total = raw?.totalCount ?? items.length;

            document.getElementById('statOrders').textContent      = total.toLocaleString();
            document.getElementById('activeOrdersBadge').textContent = total;

            const tbody = document.getElementById('ordersTableBody');
            tbody.innerHTML = items.length === 0
                ? '<tr><td colspan="6" style="text-align:center;padding:24px;color:#aaa">No orders found</td></tr>'
                : items.slice(0, 8).map(o => `
                    <tr>
                        <td>#SO-${o.id}</td>
                        <td>${o.vehicleDisplayName || o.vehicleVin || '—'}</td>
                        <td>${o.serviceTypeName || '—'}</td>
                        <td>${o.mechanicName || '—'}</td>
                        <td>${o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-US') : '—'}</td>
                        <td>${statusBadge(o.orderStatusName || 'Pending')}</td>
                    </tr>`).join('');

            // ── Chart data ─────────────────────────
            const statusMap = {};
            items.forEach(o => {
                const s = o.orderStatusName || 'Unknown';
                statusMap[s] = (statusMap[s] || 0) + 1;
            });
            const statuses = Object.entries(statusMap).map(([name, count]) => ({ name, count }));
            initCharts(statuses.length > 0 ? statuses : [
                { name: 'Pending',     count: 0 },
                { name: 'In Progress', count: 0 },
                { name: 'Completed',   count: 0 },
                { name: 'Cancelled',   count: 0 }
            ]);
        }

    } catch(err) { console.error('Dashboard error:', err); }
}

loadDashboard();