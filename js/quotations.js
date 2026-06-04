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

// ── Auto-calculate total ───────────────────────
function recalcTotal() {
    const labor    = parseFloat(document.getElementById('fLaborCost').value) || 0;
    const subtotal = parseFloat(document.getElementById('fSubtotal').value)  || 0;
    const total    = labor + subtotal;
    document.getElementById('fTotal').value       = total;
    document.getElementById('calculatedTotal').textContent = '$' + total.toLocaleString('es-CO');
}
document.getElementById('fLaborCost').addEventListener('input', recalcTotal);
document.getElementById('fSubtotal').addEventListener('input', recalcTotal);

// ── Status badge ───────────────────────────────
function statusBadge(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('accept')) return `<span class="badge badge-accepted">${name}</span>`;
    if (n.includes('reject')) return `<span class="badge badge-rejected">${name}</span>`;
    return `<span class="badge badge-pending">${name}</span>`;
}

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

function fmtCurrency(n) {
    if (n == null) return '—';
    return '$' + Number(n).toLocaleString('es-CO');
}

// ── Load catalogs ──────────────────────────────
async function loadCatalogs() {
    try {
        const [statuses, orders] = await Promise.allSettled([
            api.get('/quotationstatuses'),
            api.get('/serviceorders?pageSize=100')
        ]);

        fillSelect('fStatus',      statuses, 'Select status...',       'id', 'name');
        fillSelect('filterStatus', statuses, 'All statuses',           'id', 'name');

        if (orders.status === 'fulfilled') {
            const raw   = orders.value?.data ?? orders.value;
            const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
            const sel      = document.getElementById('fOrder');
            const filterSel = document.getElementById('filterOrder');
            sel.innerHTML      = '<option value="">Select service order...</option>';
            filterSel.innerHTML = '<option value="">All service orders</option>';
            items.forEach(o => {
                const label = `#SO-${o.id} — ${o.vehicleDisplayName || o.vehicleVin || ''}`;
                sel.innerHTML      += `<option value="${o.id}">${label}</option>`;
                filterSel.innerHTML += `<option value="${o.id}">${label}</option>`;
            });
        }
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
        sel.innerHTML += `<option value="${item[valueKey]}">${item[labelKey] || '—'}</option>`;
    });
}

// ── Load quotations ────────────────────────────
async function loadQuotations(page = 1) {
    currentPage = page;
    const statusId = document.getElementById('filterStatus').value;
    const orderId  = document.getElementById('filterOrder').value;

    let url = `/quotations?pageNumber=${page}&pageSize=10`;
    if (statusId) url += `&quotationStatusId=${statusId}`;
    if (orderId)  url += `&serviceOrderId=${orderId}`;

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;color:#aaa">Loading...</td></tr>`;

    try {
        const response = await api.get(url);
        const data     = response?.data ?? response;
        const items    = Array.isArray(data) ? data : (data?.items ?? []);
        const total    = data?.totalCount ?? items.length;
        totalPages     = Math.ceil(total / 10) || 1;

        document.getElementById('tableCount').textContent = `${total} quotation${total !== 1 ? 's' : ''} found`;
        document.getElementById('pgInfo').textContent     = `Page ${currentPage} of ${totalPages}`;
        renderPagination();

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><i class="ti ti-file-off"></i><p>No quotations found</p></div></td></tr>`;
            return;
        }

        tbody.innerHTML = items.map(q => `
            <tr>
                <td style="font-weight:600;font-family:monospace">#Q-${q.id}</td>
                <td>#SO-${q.serviceOrderId}</td>
                <td>${q.createdByUserName || '—'}</td>
                <td class="amount">${fmtCurrency(q.laborCost)}</td>
                <td class="amount">${fmtCurrency(q.subtotal)}</td>
                <td class="amount">${fmtCurrency(q.total)}</td>
                <td>${statusBadge(q.quotationStatusName)}</td>
                <td>${fmtDate(q.createdAt)}</td>
                <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${q.notes||''}">${q.notes||'—'}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn" title="Edit" onclick="editQuotation(${q.id})"><i class="ti ti-edit"></i></button>
                        <button class="action-btn danger" title="Delete" onclick="deleteQuotation(${q.id})"><i class="ti ti-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;color:#dc2626">Error: ${err.message}</td></tr>`;
    }
}

// ── Pagination ─────────────────────────────────
function renderPagination() {
    const container = document.getElementById('pgNumbers');
    container.innerHTML = '';
    const start = Math.max(1, currentPage - 2);
    const end   = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
        container.innerHTML += `<button class="pg-btn ${i === currentPage ? 'active' : ''}" onclick="loadQuotations(${i})">${i}</button>`;
    }
    document.getElementById('pgPrev').disabled = currentPage <= 1;
    document.getElementById('pgNext').disabled = currentPage >= totalPages;
}

document.getElementById('pgPrev').addEventListener('click', () => { if (currentPage > 1) loadQuotations(currentPage - 1); });
document.getElementById('pgNext').addEventListener('click', () => { if (currentPage < totalPages) loadQuotations(currentPage + 1); });

// ── Filters ────────────────────────────────────
document.getElementById('btnFilter').addEventListener('click', () => loadQuotations(1));
document.getElementById('btnClear').addEventListener('click', () => {
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterOrder').value  = '';
    loadQuotations(1);
});

// ── Modal ──────────────────────────────────────
function openModal(title) {
    document.getElementById('modalTitle').textContent   = title;
    document.getElementById('modalAlert').style.display = 'none';
    document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    ['fOrder','fStatus','fLaborCost','fSubtotal','fTotal','fNotes']
        .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    document.getElementById('calculatedTotal').textContent = '$0';
    editingId = null;
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('btnNew').addEventListener('click', () => { editingId = null; openModal('New Quotation'); });

// ── Edit ───────────────────────────────────────
async function editQuotation(id) {
    try {
        const res = await api.get(`/quotations/${id}`);
        const q   = res?.data ?? res;
        editingId = id;
        document.getElementById('fOrder').value     = q.serviceOrderId      || '';
        document.getElementById('fStatus').value    = q.quotationStatusId   || '';
        document.getElementById('fLaborCost').value = q.laborCost           || 0;
        document.getElementById('fSubtotal').value  = q.subtotal            || 0;
        document.getElementById('fTotal').value     = q.total               || 0;
        document.getElementById('fNotes').value     = q.notes               || '';
        document.getElementById('calculatedTotal').textContent = '$' + Number(q.total||0).toLocaleString('es-CO');
        openModal('Edit Quotation');
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Could not load quotation.', confirmButtonColor: '#4F46E5' });
    }
}

// ── Delete ─────────────────────────────────────
async function deleteQuotation(id) {
    const result = await Swal.fire({
        title:              'Delete quotation?',
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
        await api.delete(`/quotations/${id}`);
        loadQuotations(currentPage);
        Swal.fire({ icon: 'success', title: 'Deleted!', timer: 2000, showConfirmButton: false });
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Error', text: e.message, confirmButtonColor: '#4F46E5' });
    }
}

// ── Save ───────────────────────────────────────
document.getElementById('btnSave').addEventListener('click', async () => {
    const alertEl = document.getElementById('modalAlert');
    alertEl.style.display = 'none';

    const orderId  = parseInt(document.getElementById('fOrder').value);
    const statusId = parseInt(document.getElementById('fStatus').value);

    if (!orderId || !statusId) {
        alertEl.textContent   = 'Service Order and Status are required.';
        alertEl.style.display = 'block';
        return;
    }

    const laborCost = parseFloat(document.getElementById('fLaborCost').value) || 0;
    const subtotal  = parseFloat(document.getElementById('fSubtotal').value)  || 0;
    const total     = laborCost + subtotal;

    const body = {
        serviceOrderId:    orderId,
        createdByUserId:   user?.userId || 1,
        quotationStatusId: statusId,
        laborCost,
        subtotal,
        total,
        notes: document.getElementById('fNotes').value.trim() || null
    };

    try {
        if (editingId) {
            await api.put(`/quotations/${editingId}`, body);
        } else {
            await api.post('/quotations', body);
        }
        closeModal();
        loadQuotations(currentPage);
    } catch(e) {
        alertEl.textContent   = e.message || 'Error saving quotation.';
        alertEl.style.display = 'block';
    }
});

// ── Init ───────────────────────────────────────
loadCatalogs();
loadQuotations(1);
