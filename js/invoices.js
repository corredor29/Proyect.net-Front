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

let currentPage = 1;
let totalPages  = 1;
let editingId   = null;

// ── Auto-calculate ─────────────────────────────
function recalc() {
    const labor  = parseFloat(document.getElementById('fLaborCost').value) || 0;
    const taxPct = parseFloat(document.getElementById('fTaxPct').value)    || 0;
    const tax    = labor * taxPct / 100;
    const total  = labor + tax;
    document.getElementById('tLabor').textContent = '$' + labor.toLocaleString('es-CO');
    document.getElementById('tTax').textContent   = '$' + Math.round(tax).toLocaleString('es-CO');
    document.getElementById('tTotal').textContent = '$' + Math.round(total).toLocaleString('es-CO');
}
document.getElementById('fLaborCost').addEventListener('input', recalc);
document.getElementById('fTaxPct').addEventListener('input', recalc);

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
        const [orders, quotations] = await Promise.allSettled([
            api.get('/serviceorders?pageSize=100'),
            api.get('/quotations?pageSize=100')
        ]);

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

        if (quotations.status === 'fulfilled') {
            const raw   = quotations.value?.data ?? quotations.value;
            const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
            const sel   = document.getElementById('fQuotation');
            sel.innerHTML = '<option value="">No quotation</option>';
            items.forEach(q => {
                sel.innerHTML += `<option value="${q.id}">#Q-${q.id} — $${Number(q.total||0).toLocaleString('es-CO')}</option>`;
            });
        }
    } catch(e) { console.warn('Error loading catalogs', e); }
}

// ── Load invoices ──────────────────────────────
async function loadInvoices(page = 1) {
    currentPage = page;
    const orderId = document.getElementById('filterOrder').value;
    const diagOnly = document.getElementById('filterDiag').value;

    let url = `/invoices?pageNumber=${page}&pageSize=10`;
    if (orderId)  url += `&serviceOrderId=${orderId}`;
    if (diagOnly !== '') url += `&diagnosisOnlyCharged=${diagOnly}`;

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:32px;color:#aaa">Loading...</td></tr>`;

    try {
        const response = await api.get(url);
        const data     = response?.data ?? response;
        const items    = Array.isArray(data) ? data : (data?.items ?? []);
        const total    = data?.totalCount ?? items.length;
        totalPages     = Math.ceil(total / 10) || 1;

        document.getElementById('tableCount').textContent = `${total} invoice${total !== 1 ? 's' : ''} found`;
        document.getElementById('pgInfo').textContent     = `Page ${currentPage} of ${totalPages}`;
        renderPagination();

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state"><i class="ti ti-receipt-off"></i><p>No invoices found</p></div></td></tr>`;
            return;
        }

        tbody.innerHTML = items.map(inv => `
            <tr>
                <td style="font-weight:600;font-family:monospace">#INV-${inv.id}</td>
                <td>${inv.customerName || '—'}</td>
                <td style="font-family:monospace;font-size:11px">${inv.vehicleVin || '—'}</td>
                <td>#SO-${inv.serviceOrderId}</td>
                <td class="amount">${fmtCurrency(inv.laborCost)}</td>
                <td class="amount">${fmtCurrency(inv.subtotal)}</td>
                <td class="amount">${fmtCurrency(inv.tax)}</td>
                <td class="amount">${fmtCurrency(inv.total)}</td>
                <td>${inv.diagnosisOnlyCharged
                    ? '<span class="badge badge-diag">Diagnosis</span>'
                    : '<span class="badge badge-full">Full Service</span>'}</td>
                <td>${fmtDate(inv.issuedAt)}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn" title="View" onclick="viewInvoice(${inv.id})"><i class="ti ti-eye"></i></button>
                        <button class="action-btn danger" title="Delete" onclick="deleteInvoice(${inv.id})"><i class="ti ti-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:32px;color:#dc2626">Error: ${err.message}</td></tr>`;
    }
}

// ── Pagination ─────────────────────────────────
function renderPagination() {
    const container = document.getElementById('pgNumbers');
    container.innerHTML = '';
    const start = Math.max(1, currentPage - 2);
    const end   = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
        container.innerHTML += `<button class="pg-btn ${i === currentPage ? 'active' : ''}" onclick="loadInvoices(${i})">${i}</button>`;
    }
    document.getElementById('pgPrev').disabled = currentPage <= 1;
    document.getElementById('pgNext').disabled = currentPage >= totalPages;
}

document.getElementById('pgPrev').addEventListener('click', () => { if (currentPage > 1) loadInvoices(currentPage - 1); });
document.getElementById('pgNext').addEventListener('click', () => { if (currentPage < totalPages) loadInvoices(currentPage + 1); });

// ── Filters ────────────────────────────────────
document.getElementById('btnFilter').addEventListener('click', () => loadInvoices(1));
document.getElementById('btnClear').addEventListener('click', () => {
    document.getElementById('filterOrder').value = '';
    document.getElementById('filterDiag').value  = '';
    loadInvoices(1);
});

// ── Modal ──────────────────────────────────────
function openModal(title) {
    document.getElementById('modalTitle').textContent   = title;
    document.getElementById('modalAlert').style.display = 'none';
    document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    document.getElementById('fOrder').value      = '';
    document.getElementById('fQuotation').value  = '';
    document.getElementById('fLaborCost').value  = '';
    document.getElementById('fTaxPct').value     = '19';
    document.getElementById('fDiagOnly').checked = false;
    recalc();
    editingId = null;
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('btnNew').addEventListener('click', () => { editingId = null; openModal('New Invoice'); });

// ── View invoice ───────────────────────────────
async function viewInvoice(id) {
    try {
        const res = await api.get(`/invoices/${id}`);
        const inv = res?.data ?? res;
        alert(`Invoice #INV-${inv.id}\nCustomer: ${inv.customerName||'—'}\nVehicle: ${inv.vehicleVin||'—'}\nLabor: ${fmtCurrency(inv.laborCost)}\nTax: ${fmtCurrency(inv.tax)}\nTotal: ${fmtCurrency(inv.total)}\nType: ${inv.diagnosisOnlyCharged ? 'Diagnosis Only' : 'Full Service'}\nIssued: ${fmtDate(inv.issuedAt)}`);
    } catch(e) { alert('Error loading invoice'); }
}

// ── Delete ─────────────────────────────────────
async function deleteInvoice(id) {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    try {
        await api.delete(`/invoices/${id}`);
        loadInvoices(currentPage);
    } catch(e) { alert(`Error: ${e.message}`); }
}

// ── Save ───────────────────────────────────────
document.getElementById('btnSave').addEventListener('click', async () => {
    const alertEl = document.getElementById('modalAlert');
    alertEl.style.display = 'none';

    const orderId = parseInt(document.getElementById('fOrder').value);
    if (!orderId) {
        alertEl.textContent   = 'Service Order is required.';
        alertEl.style.display = 'block';
        return;
    }

    const laborCost  = parseFloat(document.getElementById('fLaborCost').value) || 0;
    const taxPct     = parseFloat(document.getElementById('fTaxPct').value)    || 0;
    const tax        = laborCost * taxPct / 100;
    const quotationId = parseInt(document.getElementById('fQuotation').value) || null;

    const body = {
        serviceOrderId:       orderId,
        quotationId,
        laborCost,
        tax:                  Math.round(tax),
        diagnosisOnlyCharged: document.getElementById('fDiagOnly').checked
    };

    try {
        await api.post('/invoices', body);
        closeModal();
        loadInvoices(currentPage);
    } catch(e) {
        alertEl.textContent   = e.message || 'Error saving invoice.';
        alertEl.style.display = 'block';
    }
});

// ── Init ───────────────────────────────────────
loadCatalogs();
loadInvoices(1);
