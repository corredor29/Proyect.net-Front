        requireAuth();

        // ── User info ──────────────────────────────
        const user = getUser();
        if (user) {
            const initials = ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || 'U';
            document.getElementById('sbAvatar').textContent    = initials;
            document.getElementById('sbUserName').textContent  = `${user.firstName || ''} ${user.lastName || ''}`.trim();
            document.getElementById('sbUserRole').textContent  = user.roles?.[0] || 'User';
        }

        document.getElementById('logoutBtn').addEventListener('click', logout);

        // ── Date ───────────────────────────────────
        document.getElementById('dateLabel').textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        // ── Charts setup ───────────────────────────
        let barChart, donutChart;

        function initCharts(statuses) {
            const labels = statuses.map(s => s.name);
            const values = statuses.map(s => s.count);
            const colors = ['#2563eb','#f59e0b','#16a34a','#dc2626'];

            // Bar chart
            const barCtx = document.getElementById('barChart').getContext('2d');
            barChart = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        data: values,
                        backgroundColor: colors,
                        borderRadius: 4,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } },
                        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
                    }
                }
            });

            // Donut chart
            const donutCtx = document.getElementById('donutChart').getContext('2d');
            donutChart = new Chart(donutCtx, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data: values,
                        backgroundColor: colors,
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: false,
                    plugins: { legend: { display: false } },
                    cutout: '65%'
                }
            });

            // Legend
            const legend = document.getElementById('donutLegend');
            legend.innerHTML = statuses.map((s, i) => `
                <div class="legend-item">
                    <div class="legend-left">
                        <div class="legend-dot" style="background:${colors[i]}"></div>
                        ${s.name}
                    </div>
                    <span class="legend-val">${s.count}</span>
                </div>
            `).join('');
        }

        // ── Status badge ───────────────────────────
        function statusBadge(name) {
            const n = (name || '').toLowerCase();
            if (n.includes('progress')) return `<span class="badge badge-progress">${name}</span>`;
            if (n.includes('pending'))  return `<span class="badge badge-pending">${name}</span>`;
            if (n.includes('complet'))  return `<span class="badge badge-done">${name}</span>`;
            if (n.includes('cancel'))   return `<span class="badge badge-cancelled">${name}</span>`;
            return `<span class="badge badge-pending">${name}</span>`;
        }

        // ── Load dashboard data ────────────────────
        async function loadDashboard() {
            try {
                // Stats
                const [customers, vehicles, orders, parts] = await Promise.allSettled([
                    api.get('/customers?pageSize=1'),
                    api.get('/vehicles?pageSize=1'),
                    api.get('/serviceorders?pageSize=10'),
                    api.get('/parts?belowMinStock=true&pageSize=1')
                ]);

                if (customers.status === 'fulfilled')
                    document.getElementById('statCustomers').textContent =
                        (customers.value?.totalCount ?? customers.value?.length ?? '—').toLocaleString();

                if (vehicles.status === 'fulfilled')
                    document.getElementById('statVehicles').textContent =
                        (vehicles.value?.totalCount ?? vehicles.value?.length ?? '—').toLocaleString();

                if (orders.status === 'fulfilled') {
                    const data = orders.value;
                    const items = data?.items ?? data ?? [];
                    const total = data?.totalCount ?? items.length;

                    document.getElementById('statOrders').textContent = total.toLocaleString();
                    document.getElementById('activeOrdersBadge').textContent = total;

                    // Table
                    const tbody = document.getElementById('ordersTableBody');
                    if (items.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#9ca3af">No orders found</td></tr>';
                    } else {
                        tbody.innerHTML = items.slice(0, 8).map(o => `
                            <tr>
                                <td>#SO-${o.id}</td>
                                <td>${o.vehicleVin || o.vin || '—'}</td>
                                <td>${o.serviceTypeName || '—'}</td>
                                <td>${o.mechanicName || '—'}</td>
                                <td>${o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-US') : '—'}</td>
                                <td>${statusBadge(o.orderStatusName || o.status || 'Pending')}</td>
                            </tr>
                        `).join('');
                    }

                    // Charts — group by status
                    const statusMap = {};
                    items.forEach(o => {
                        const s = o.orderStatusName || o.status || 'Unknown';
                        statusMap[s] = (statusMap[s] || 0) + 1;
                    });

                    const statuses = Object.entries(statusMap).map(([name, count]) => ({ name, count }));
                    if (statuses.length > 0) initCharts(statuses);
                    else initCharts([
                        { name: 'Pending', count: 0 },
                        { name: 'In Progress', count: 0 },
                        { name: 'Completed', count: 0 },
                        { name: 'Cancelled', count: 0 }
                    ]);
                }

                if (parts.status === 'fulfilled')
                    document.getElementById('statLowStock').textContent =
                        (parts.value?.totalCount ?? parts.value?.length ?? '—').toLocaleString();

            } catch (err) {
                console.error('Dashboard error:', err);
            }
        }

        loadDashboard();
