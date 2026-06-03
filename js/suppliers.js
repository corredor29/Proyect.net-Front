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
let allSuppliers = [];

// ── Load suppliers ─────────────────────────────
async function loadSuppliers() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:#aaa">Loading...</td></tr>`;
    try {
        const res = await api.get('/suppliers');
        const raw = res?.data ?? res;
        allSuppliers = Array.isArray(raw) ? raw : (raw?.items ?? []);
        applyFiltersAndRender();
    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:#dc2626">Error: ${err.message}</td></tr>`;
    }
}

function applyFiltersAndRender() {
    const name     = document.getElementById('filterName').value.trim().toLowerCase();
    const status   = document.getElementById('filterStatus').value;

    let filtered = allSuppliers;
    if (name)   filtered = filtered.filter(s => s.companyName?.toLowerCase().includes(name));
    if (status !== '') filtered = filtered.filter(s => String(s.isActive) === status);

    const pageSize = 10;
    const total    = filtered.length;
    totalPages     = Math.ceil(total / pageSize) || 1;
    currentPage    = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    document.getElementById('tableCount').textContent = `${total} supplier${total !== 1 ? 's' : ''} found`;
    document.getElementById('pgInfo').textContent     = `Page ${currentPage} of ${totalPages}`;
    renderPagination();

    const tbody = document.getElementById('tableBody');
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="ti ti-building-off"></i><p>No suppliers found</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(s => `
        <tr>
            <td>
                <div class="supplier-cell">
                    <div class="supplier-icon"><i class="ti ti-building-store"></i></div>
                    <div>
                        <div class="supplier-name">${s.companyName || '—'}</div>
                        <div class="supplier-tax">${s.taxId || ''}</div>
                    </div>
                </div>
            </td>
            <td>${s.taxId || '—'}</td>
            <td>${s.contactName || '—'}</td>
            <td>${s.phone || '—'}</td>
            <td>${s.email || '—'}</td>
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.address || '—'}</td>
            <td><span class="${s.isActive ? 'badge-active' : 'badge-inactive'}">${s.isActive ? 'Active' : 'Inactive'}</span></td>
            <td>
                <div class="action-btns">
                    <button class="action-btn" title="Edit" onclick="editSupplier(${s.id})"><i class="ti ti-edit"></i></button>
                    <button class="action-btn danger" title="Delete" onclick="deleteSupplier(${s.id})"><i class="ti ti-trash"></i></button>
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

function goPage(page) { currentPage = page; applyFiltersAndRender(); }
document.getElementById('pgPrev').addEventListener('click', () => { if (currentPage > 1) goPage(currentPage - 1); });
document.getElementById('pgNext').addEventListener('click', () => { if (currentPage < totalPages) goPage(currentPage + 1); });

// ── Filters ────────────────────────────────────
document.getElementById('btnFilter').addEventListener('click', () => { currentPage = 1; applyFiltersAndRender(); });
document.getElementById('btnClear').addEventListener('click', () => {
    document.getElementById('filterName').value   = '';
    document.getElementById('filterStatus').value = '';
    currentPage = 1;
    applyFiltersAndRender();
});
document.getElementById('globalSearch').addEventListener('keyup', e => {
    document.getElementById('filterName').value = e.target.value;
    currentPage = 1;
    applyFiltersAndRender();
});

// ── Modal ──────────────────────────────────────
function openModal(title, showStatus = false) {
    document.getElementById('modalTitle').textContent   = title;
    document.getElementById('modalAlert').style.display = 'none';
    document.getElementById('statusGroup').style.display = showStatus ? '' : 'none';
    document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    ['fCompanyName','fTaxId','fContactName','fPhone','fEmail','fAddress']
        .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('fIsActive').value = 'true';
    editingId = null;
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('btnNew').addEventListener('click', () => { editingId = null; openModal('New Supplier', false); });

// ── Edit ───────────────────────────────────────
async function editSupplier(id) {
    try {
        const res = await api.get(`/suppliers/${id}`);
        const s   = res?.data ?? res;
        editingId = id;
        document.getElementById('fCompanyName').value = s.companyName  || '';
        document.getElementById('fTaxId').value       = s.taxId        || '';
        document.getElementById('fContactName').value = s.contactName  || '';
        document.getElementById('fPhone').value       = s.phone        || '';
        document.getElementById('fEmail').value       = s.email        || '';
        document.getElementById('fAddress').value     = s.address      || '';
        document.getElementById('fIsActive').value    = String(s.isActive);
        openModal('Edit Supplier', true);
    } catch(e) { alert('Error loading supplier'); }
}

// ── Delete ─────────────────────────────────────
async function deleteSupplier(id) {
    if (!confirm('Are you sure you want to delete this supplier?')) return;
    try {
        await api.delete(`/suppliers/${id}`);
        await loadSuppliers();
    } catch(e) { alert(`Error: ${e.message}`); }
}

// ── Save ───────────────────────────────────────
document.getElementById('btnSave').addEventListener('click', async () => {
    const alertEl     = document.getElementById('modalAlert');
    alertEl.style.display = 'none';

    const companyName = document.getElementById('fCompanyName').value.trim();
    if (!companyName) {
        alertEl.textContent   = 'Company name is required.';
        alertEl.style.display = 'block';
        return;
    }

    const body = {
        companyName,
        taxId:       document.getElementById('fTaxId').value.trim()       || null,
        contactName: document.getElementById('fContactName').value.trim() || null,
        phone:       document.getElementById('fPhone').value.trim()       || null,
        email:       document.getElementById('fEmail').value.trim()       || null,
        address:     document.getElementById('fAddress').value.trim()     || null
    };

    try {
        if (editingId) {
            await api.put(`/suppliers/${editingId}`, {
                ...body,
                isActive: document.getElementById('fIsActive').value === 'true'
            });
        } else {
            await api.post('/suppliers', body);
        }
        closeModal();
        await loadSuppliers();
    } catch(e) {
        alertEl.textContent   = e.message || 'Error saving supplier.';
        alertEl.style.display = 'block';
    }
});

// ── Init ───────────────────────────────────────
loadSuppliers();
