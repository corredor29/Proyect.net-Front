requireAuth();

// ── Theme ──────────────────────────────────────
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.className = savedTheme;
updateThemeBtn(savedTheme);
document.getElementById('themeBtn').addEventListener('click', () => {
    const newTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
    document.body.className = newTheme;
    localStorage.setItem('theme', newTheme);
    updateThemeBtn(newTheme);
});
function updateThemeBtn(theme) {
    document.getElementById('themeIcon').className    = theme === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
    document.getElementById('themeLabel').textContent = theme === 'dark' ? 'Light' : 'Dark';
}

// ── User info ──────────────────────────────────
const user = getUser();
if (user) {
    const initials = ((user.firstName?.[0]||'')+(user.lastName?.[0]||'')).toUpperCase()||'U';
    document.getElementById('sbAvatar').textContent   = initials;
    document.getElementById('sbUserName').textContent = user.fullName || `${user.firstName||''} ${user.lastName||''}`.trim() || 'User';
    document.getElementById('sbUserRole').textContent = user.roles?.[0] || 'User';
}
document.getElementById('logoutBtn').addEventListener('click', logout);

// ── State ──────────────────────────────────────
let currentPage = 1;
let totalPages  = 1;
let editingId   = null;
let allAppointments = [];

// ── Status badge ───────────────────────────────
function statusBadge(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('confirm')) return `<span class="badge badge-confirmed">${name}</span>`;
    if (n.includes('pending')) return `<span class="badge badge-pending">${name}</span>`;
    if (n.includes('complet')) return `<span class="badge badge-done">${name}</span>`;
    if (n.includes('cancel'))  return `<span class="badge badge-cancelled">${name}</span>`;
    return `<span class="badge badge-pending">${name}</span>`;
}

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

// ── Load catalogs ──────────────────────────────
async function loadCatalogs() {
    try {
        const [statuses, serviceTypes, customers, users] = await Promise.allSettled([
            api.get('/appointmentstatuses'),
            api.get('/servicetypes'),
            api.get('/customers?pageSize=100'),
            api.get('/users?pageSize=100')
        ]);

        fillSelect('fStatus',      statuses,     'Select status...',       'id', 'name');
        fillSelect('filterStatus', statuses,     'All statuses',           'id', 'name');
        fillSelect('fServiceType', serviceTypes, 'Select service type...', 'id', 'name');

        if (customers.status === 'fulfilled') {
            const raw   = customers.value?.data ?? customers.value;
            const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
            const sel       = document.getElementById('fCustomer');
            const filterSel = document.getElementById('filterCustomer');
            sel.innerHTML       = '<option value="">Select customer...</option>';
            filterSel.innerHTML = '<option value="">All customers</option>';
            items.forEach(c => {
                const name = `${c.firstName||''} ${c.lastName||''}`.trim() || `Customer ${c.id}`;
                sel.innerHTML       += `<option value="${c.id}">${name}</option>`;
                filterSel.innerHTML += `<option value="${c.id}">${name}</option>`;
            });
        }

        if (users.status === 'fulfilled') {
            const raw   = users.value?.data ?? users.value;
            const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
            const sel   = document.getElementById('fAssigned');
            sel.innerHTML = '<option value="">Not assigned</option>';
            items.forEach(u => {
                const name = u.fullName || `${u.firstName||''} ${u.lastName||''}`.trim() || `User ${u.id}`;
                sel.innerHTML += `<option value="${u.id}">${name}</option>`;
            });
        }

    } catch(e) { console.warn('Error loading catalogs', e); }
}

// Customer → load vehicles
document.getElementById('fCustomer').addEventListener('change', async () => {
    const customerId = document.getElementById('fCustomer').value;
    const vehicleSel = document.getElementById('fVehicle');
    vehicleSel.innerHTML = '<option value="">Select vehicle...</option>';
    if (!customerId) return;
    try {
        const res   = await api.get(`/vehicles?customerId=${customerId}&pageSize=50`);
        const raw   = res?.data ?? res;
        const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
        items.forEach(v => {
            const label = `${v.brandName||''} ${v.modelName||''} — ${v.vin||''}`.trim();
            vehicleSel.innerHTML += `<option value="${v.id}">${label}</option>`;
        });
    } catch(e) { console.warn('Error loading vehicles'); }
});

function fillSelect(id, result, placeholder, valueKey, labelKey) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    if (result.status !== 'fulfilled') return;
    const raw   = result.value?.data ?? result.value;
    const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
    items.forEach(item => {
        sel.innerHTML += `<option value="${item[valueKey]}">${item[labelKey] || '—'}</option>`;
    });
}

// ── Load appointments ──────────────────────────
async function loadAppointments(page = 1) {
    currentPage = page;
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:#aaa">Loading...</td></tr>`;

    try {
        const response = await api.get('/appointments');
        const raw      = response?.data ?? response;
        allAppointments = Array.isArray(raw) ? raw : (raw?.items ?? []);

        applyFiltersAndRender();

    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:#dc2626">Error: ${err.message}</td></tr>`;
    }
}

function applyFiltersAndRender() {
    const statusId   = document.getElementById('filterStatus').value;
    const customerId = document.getElementById('filterCustomer').value;
    const date       = document.getElementById('filterDate').value;

    let filtered = allAppointments;

    if (statusId)
        filtered = filtered.filter(a => String(a.appointmentStatusId) === statusId);

    if (customerId)
        filtered = filtered.filter(a => String(a.customerId) === customerId);

    if (date)
        filtered = filtered.filter(a => a.appointmentDate?.startsWith(date));

    const pageSize = 10;
    const total    = filtered.length;
    totalPages     = Math.ceil(total / pageSize) || 1;
    currentPage    = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    document.getElementById('tableCount').textContent = `${total} appointment${total !== 1 ? 's' : ''} found`;
    document.getElementById('pgInfo').textContent     = `Page ${currentPage} of ${totalPages}`;
    renderPagination();

    const tbody = document.getElementById('tableBody');

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="ti ti-calendar-off"></i><p>No appointments found</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(a => `
        <tr>
            <td style="font-weight:600;font-family:monospace">#A-${a.id}</td>
            <td>${a.customerName || '—'}</td>
            <td>${a.vehicleDisplayName || a.vehicleVin || '—'}</td>
            <td>${a.serviceTypeName || '—'}</td>
            <td>${a.assignedUserName || '—'}</td>
            <td>${fmtDate(a.appointmentDate)}</td>
            <td>${statusBadge(a.appointmentStatusName)}</td>
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${a.notes||''}">${a.notes||'—'}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn" title="Edit" onclick="editAppointment(${a.id})"><i class="ti ti-edit"></i></button>
                    <button class="action-btn danger" title="Delete" onclick="deleteAppointment(${a.id})"><i class="ti ti-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ── Pagination ─────────────────────────────────
function renderPagination() {
    const container = document.getElementById('pgNumbers');
    container.innerHTML = '';
    const start = Math.max(1, currentPage - 2);
    const end   = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
        container.innerHTML += `<button class="pg-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
    }
    document.getElementById('pgPrev').disabled = currentPage <= 1;
    document.getElementById('pgNext').disabled = currentPage >= totalPages;
}

function goPage(page) {
    currentPage = page;
    applyFiltersAndRender();
}

document.getElementById('pgPrev').addEventListener('click', () => { if (currentPage > 1) goPage(currentPage - 1); });
document.getElementById('pgNext').addEventListener('click', () => { if (currentPage < totalPages) goPage(currentPage + 1); });

// ── Filters ────────────────────────────────────
document.getElementById('btnFilter').addEventListener('click', () => { currentPage = 1; applyFiltersAndRender(); });
document.getElementById('btnClear').addEventListener('click', () => {
    document.getElementById('filterStatus').value   = '';
    document.getElementById('filterCustomer').value = '';
    document.getElementById('filterDate').value     = '';
    currentPage = 1;
    applyFiltersAndRender();
});

// ── Modal ──────────────────────────────────────
function openModal(title) {
    document.getElementById('modalTitle').textContent   = title;
    document.getElementById('modalAlert').style.display = 'none';
    document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    ['fCustomer','fVehicle','fServiceType','fStatus','fDate','fAssigned','fNotes']
        .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    editingId = null;
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('btnNew').addEventListener('click', () => { editingId = null; openModal('New Appointment'); });

// ── Edit ───────────────────────────────────────
async function editAppointment(id) {
    try {
        const res = await api.get(`/appointments/${id}`);
        const a   = res?.data ?? res;
        editingId = id;
        document.getElementById('fCustomer').value    = a.customerId          || '';
        document.getElementById('fVehicle').value     = a.vehicleId           || '';
        document.getElementById('fServiceType').value = a.serviceTypeId       || '';
        document.getElementById('fStatus').value      = a.appointmentStatusId || '';
        document.getElementById('fAssigned').value    = a.assignedUserId      || '';
        document.getElementById('fNotes').value       = a.notes               || '';
        if (a.appointmentDate)
            document.getElementById('fDate').value = new Date(a.appointmentDate).toISOString().slice(0,16);
        openModal('Edit Appointment');
    } catch(e) { alert('Error loading appointment'); }
}

// ── Delete ─────────────────────────────────────
async function deleteAppointment(id) {
    if (!confirm('Are you sure you want to delete this appointment?')) return;
    try {
        await api.delete(`/appointments/${id}`);
        loadAppointments(currentPage);
    } catch(e) { alert(`Error: ${e.message}`); }
}

// ── Save ───────────────────────────────────────
document.getElementById('btnSave').addEventListener('click', async () => {
    const alertEl = document.getElementById('modalAlert');
    alertEl.style.display = 'none';

    const customerId    = parseInt(document.getElementById('fCustomer').value);
    const vehicleId     = parseInt(document.getElementById('fVehicle').value);
    const serviceTypeId = parseInt(document.getElementById('fServiceType').value);
    const statusId      = parseInt(document.getElementById('fStatus').value);
    const date          = document.getElementById('fDate').value;

    if (!customerId || !vehicleId || !serviceTypeId || !statusId || !date) {
        alertEl.textContent   = 'Customer, Vehicle, Service Type, Status and Date are required.';
        alertEl.style.display = 'block';
        return;
    }

    const body = {
        customerId,
        vehicleId,
        serviceTypeId,
        appointmentStatusId: statusId,
        assignedUserId:      parseInt(document.getElementById('fAssigned').value) || null,
        appointmentDate:     new Date(date).toISOString(),
        notes:               document.getElementById('fNotes').value.trim() || null
    };

    try {
        if (editingId) {
            await api.put(`/appointments/${editingId}`, body);
        } else {
            await api.post('/appointments', body);
        }
        closeModal();
        loadAppointments(currentPage);
    } catch(e) {
        alertEl.textContent   = e.message || 'Error saving appointment.';
        alertEl.style.display = 'block';
    }
});

// ── Init ───────────────────────────────────────
loadCatalogs();
loadAppointments(1);