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
const canCreateOrders = !!user?.roles?.some(role => role === 'Admin' || role === 'Receptionist');
if (user) {
    const initials = ((user.firstName?.[0]||'')+(user.lastName?.[0]||'')).toUpperCase()||'U';
    document.getElementById('sbAvatar').textContent   = initials;
    document.getElementById('sbUserName').textContent = user.fullName || `${user.firstName||''} ${user.lastName||''}`.trim() || 'User';
    document.getElementById('sbUserRole').textContent = user.roles?.[0] || 'User';
}
document.getElementById('logoutBtn').addEventListener('click', logout);

if (!canCreateOrders) {
    document.getElementById('btnNewOrder').style.display = 'none';
}

// ── State ──────────────────────────────────────
let currentPage = 1;
let totalPages  = 1;
let editingId   = null;

// ── Status badge ───────────────────────────────
function statusBadge(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('progress')) return `<span class="badge badge-progress">${name}</span>`;
    if (n.includes('pending'))  return `<span class="badge badge-pending">${name}</span>`;
    if (n.includes('complet'))  return `<span class="badge badge-done">${name}</span>`;
    if (n.includes('cancel'))   return `<span class="badge badge-cancelled">${name}</span>`;
    return `<span class="badge badge-pending">${name}</span>`;
}

// ── Format date ────────────────────────────────
function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

// ── Load catalogs ──────────────────────────────
async function loadCatalogs() {
    try {
        const [statuses, serviceTypes, vehicles, mechanics] = await Promise.allSettled([
            api.get('/orderstatuses'),
            api.get('/servicetypes'),
            api.get('/vehicles?pageSize=100'),
            api.get('/users/mechanics')
        ]);

        fillSelect('fStatus',           statuses,     'Select status...',       'id', 'name');
        fillSelect('filterStatus',      statuses,     'All statuses',           'id', 'name');
        fillSelect('fServiceType',      serviceTypes, 'Select service type...', 'id', 'name');
        fillSelect('filterServiceType', serviceTypes, 'All service types',      'id', 'name');

        if (vehicles.status === 'fulfilled') {
            const raw   = vehicles.value?.data ?? vehicles.value;
            const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
            const sel   = document.getElementById('fVehicle');
            const fSel  = document.getElementById('filterVehicle');
            sel.innerHTML  = '<option value="">Select vehicle...</option>';
            fSel.innerHTML = '<option value="">All vehicles</option>';
            items.forEach(v => {
                const label = `${v.brandName || ''} ${v.modelName || ''} — ${v.vin || ''}`.trim();
                sel.innerHTML  += `<option value="${v.id}">${label}</option>`;
                fSel.innerHTML += `<option value="${v.id}">${label}</option>`;
            });
        }

        if (mechanics.status === 'fulfilled') {
            const raw   = mechanics.value?.data ?? mechanics.value;
            const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
            const sel   = document.getElementById('fMechanic');
            sel.innerHTML = '<option value="">Select mechanic...</option>';
            items.forEach(u => {
                const name = u.fullName || `${u.firstName||''} ${u.lastName||''}`.trim() || `User ${u.id}`;
                sel.innerHTML += `<option value="${u.id}">${name}</option>`;
            });
        }

        // ── Appointments ───────────────────────
        try {
            const appts = await api.get('/appointments?pageNumber=1&pageSize=100');
            const raw   = appts?.data ?? appts;
            const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
            const sel   = document.getElementById('fAppointment');
            sel.innerHTML = '<option value="">No appointment</option>';
            items.forEach(a => {
                const date     = a.appointmentDate ? new Date(a.appointmentDate).toLocaleDateString('en-US') : '';
                const customer = a.customerName || '';
                const label    = `#${a.id}${customer ? ' — ' + customer : ''}${date ? ' — ' + date : ''}`;
                sel.innerHTML += `<option value="${a.id}">${label}</option>`;
            });
        } catch(e) { console.warn('Could not load appointments'); }

    } catch(e) { console.warn('Error loading catalogs', e); }
}

function fillSelect(id, result, placeholder, valueKey, labelKey) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    if (result.status !== 'fulfilled') return;
    const raw   = result.value?.data ?? result.value;
    const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
    items.forEach(item => {
        const label = item[labelKey] || '—';
        sel.innerHTML += `<option value="${item[valueKey]}">${label}</option>`;
    });
}

// ── Load orders ────────────────────────────────
async function loadOrders(page = 1) {
    currentPage = page;
    const statusId      = document.getElementById('filterStatus').value;
    const serviceTypeId = document.getElementById('filterServiceType').value;
    const vehicleId     = document.getElementById('filterVehicle').value;

    let url = `/serviceorders?pageNumber=${page}&pageSize=10`;
    if (statusId)      url += `&orderStatusId=${statusId}`;
    if (serviceTypeId) url += `&serviceTypeId=${serviceTypeId}`;
    if (vehicleId)     url += `&vehicleId=${vehicleId}`;

    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:#aaa">Loading...</td></tr>`;

    try {
        const response = await api.get(url);
        const data     = response?.data ?? response;
        const items    = data?.items ?? [];
        const total    = data?.totalCount ?? 0;
        totalPages     = Math.ceil(total / 10) || 1;

        document.getElementById('tableCount').textContent = `${total} order${total !== 1 ? 's' : ''} found`;
        document.getElementById('pgInfo').textContent     = `Page ${currentPage} of ${totalPages}`;
        renderPagination();

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="ti ti-clipboard-x"></i><p>No service orders found</p></div></td></tr>`;
            return;
        }

        tbody.innerHTML = items.map(o => `
            <tr>
                <td><span class="order-id">#SO-${o.id}</span></td>
                <td>${o.vehicleDisplayName || o.vehicleVin || '—'}</td>
                <td>${o.serviceTypeName || '—'}</td>
                <td>${o.mechanicName || '—'}</td>
                <td>${statusBadge(o.orderStatusName)}</td>
                <td>${fmtDate(o.createdAt)}</td>
                <td>${fmtDate(o.estimatedDeliveryAt)}</td>
                <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${o.notes || ''}">${o.notes || '—'}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn" title="Edit"
                            onclick="editOrder(${o.id})"
                            ${o.closedAt ? 'disabled style="opacity:0.4;cursor:not-allowed"' : ''}>
                            <i class="ti ti-edit"></i>
                        </button>
                        <button class="action-btn danger" title="Delete" onclick="deleteOrder(${o.id})"><i class="ti ti-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:#dc2626">Error: ${err.message}</td></tr>`;
    }
}

// ── Pagination ─────────────────────────────────
function renderPagination() {
    const container = document.getElementById('pgNumbers');
    container.innerHTML = '';
    const start = Math.max(1, currentPage - 2);
    const end   = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
        container.innerHTML += `<button class="pg-btn ${i === currentPage ? 'active' : ''}" onclick="loadOrders(${i})">${i}</button>`;
    }
    document.getElementById('pgPrev').disabled = currentPage <= 1;
    document.getElementById('pgNext').disabled = currentPage >= totalPages;
}

document.getElementById('pgPrev').addEventListener('click', () => { if (currentPage > 1) loadOrders(currentPage - 1); });
document.getElementById('pgNext').addEventListener('click', () => { if (currentPage < totalPages) loadOrders(currentPage + 1); });

// ── Filters ────────────────────────────────────
document.getElementById('btnFilter').addEventListener('click', () => loadOrders(1));
document.getElementById('btnClear').addEventListener('click', () => {
    document.getElementById('filterStatus').value      = '';
    document.getElementById('filterServiceType').value = '';
    document.getElementById('filterVehicle').value     = '';
    loadOrders(1);
});
document.getElementById('globalSearch').addEventListener('keyup', e => {
    if (e.key === 'Enter') loadOrders(1);
});

// ── Modal ──────────────────────────────────────
function openModal(title) {
    document.getElementById('modalTitle').textContent   = title;
    document.getElementById('modalAlert').style.display = 'none';
    document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    ['fVehicle','fServiceType','fMechanic','fStatus','fEstimatedDelivery','fAppointment','fWorkPerformed','fNotes']
        .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    editingId = null;
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('btnNewOrder').addEventListener('click', () => { editingId = null; openModal('New Service Order'); });

// ── Edit order ─────────────────────────────────
async function editOrder(id) {
    try {
        const res = await api.get(`/serviceorders/${id}`);
        const o   = res?.data ?? res;

        if (o.closedAt) {
            Swal.fire({
                icon: 'warning', title: 'Order closed',
                text: 'This service order is closed and cannot be edited.',
                confirmButtonColor: '#4F46E5',
                background: document.body.classList.contains('dark') ? '#111' : '#fff',
                color:      document.body.classList.contains('dark') ? '#fff' : '#111',
            });
            return;
        }

        editingId = id;
        document.getElementById('fVehicle').value       = o.vehicleId     || '';
        document.getElementById('fServiceType').value   = o.serviceTypeId  || '';
        document.getElementById('fMechanic').value      = o.mechanicId     || '';
        document.getElementById('fStatus').value        = o.orderStatusId  || '';
        document.getElementById('fWorkPerformed').value = o.workPerformed  || '';
        document.getElementById('fNotes').value         = o.notes          || '';
        document.getElementById('fAppointment').value   = o.appointmentId  || '';
        if (o.estimatedDeliveryAt) {
            document.getElementById('fEstimatedDelivery').value =
                new Date(o.estimatedDeliveryAt).toISOString().slice(0, 16);
        }
        openModal('Edit Service Order');
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Could not load order.', confirmButtonColor: '#4F46E5' });
    }
}

// ── Delete order ───────────────────────────────
async function deleteOrder(id) {
    const result = await Swal.fire({
        title:              'Delete service order?',
        text:               'Are you sure? This action cannot be undone.',
        icon:               'warning',
        showCancelButton:   true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor:  document.body.classList.contains('dark') ? '#333' : '#6b7280',
        confirmButtonText:  'Yes, delete',
        cancelButtonText:   'Cancel',
        background: document.body.classList.contains('dark') ? '#111' : '#fff',
        color:      document.body.classList.contains('dark') ? '#fff' : '#111',
    });

    if (!result.isConfirmed) return;

    try {
        await api.delete(`/serviceorders/${id}`);
        loadOrders(currentPage);
        Swal.fire({ icon: 'success', title: 'Deleted!', timer: 2000, showConfirmButton: false });
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Error', text: e.message, confirmButtonColor: '#4F46E5' });
    }
}

// ── Save order ─────────────────────────────────
document.getElementById('btnSave').addEventListener('click', async () => {
    const alertEl = document.getElementById('modalAlert');
    alertEl.style.display = 'none';

    const vehicleId     = parseInt(document.getElementById('fVehicle').value);
    const serviceTypeId = parseInt(document.getElementById('fServiceType').value);
    const mechanicId    = parseInt(document.getElementById('fMechanic').value);
    const statusId      = parseInt(document.getElementById('fStatus').value);

    if (!vehicleId || !serviceTypeId || !mechanicId || !statusId) {
        alertEl.textContent   = 'Vehicle, Service Type, Mechanic and Status are required.';
        alertEl.style.display = 'block';
        return;
    }

    const estDelivery   = document.getElementById('fEstimatedDelivery').value;
    const appointmentId = parseInt(document.getElementById('fAppointment').value) || null;

    try {
        if (editingId) {
            // 1. Cambiar status primero
            await api.put(`/serviceorders/${editingId}/status`, {
                orderStatusId: statusId
            });

            // 2. Actualizar contenido (puede fallar si ya cerrada, se ignora)
            try {
                await api.put(`/serviceorders/${editingId}`, {
                    workPerformed:       document.getElementById('fWorkPerformed').value.trim() || null,
                    notes:               document.getElementById('fNotes').value.trim()         || null,
                    estimatedDeliveryAt: estDelivery ? new Date(estDelivery).toISOString() : null
                });
            } catch(updateErr) {
                console.warn('Could not update order content:', updateErr.message);
            }

        } else {
            if (!canCreateOrders) {
                throw new Error('Your role cannot create service orders.');
            }

            await api.post('/serviceorders', {
                vehicleId,
                serviceTypeId,
                mechanicId,
                orderStatusId:       statusId,
                estimatedDeliveryAt: estDelivery ? new Date(estDelivery).toISOString() : null,
                workPerformed:       document.getElementById('fWorkPerformed').value.trim() || null,
                notes:               document.getElementById('fNotes').value.trim()         || null,
                appointmentId
            });
        }

        closeModal();
        loadOrders(currentPage);

    } catch(e) {
        alertEl.textContent   = e.message || 'Error saving order.';
        alertEl.style.display = 'block';
    }
});

// ── Init ───────────────────────────────────────
loadCatalogs();
loadOrders(1);
