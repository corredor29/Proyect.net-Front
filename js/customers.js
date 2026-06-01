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
    document.getElementById('themeIcon').className  = theme === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
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
let currentPage  = 1;
let totalPages   = 1;
let totalCount   = 0;
const pageSize   = 10;
let editingId    = null;
let documentTypes = [];

// ── Load document types ────────────────────────
async function loadDocumentTypes() {
    try {
        const res = await api.get('/documenttypes');
        documentTypes = res?.data ?? res?.items ?? res ?? [];
        const sel = document.getElementById('fDocumentType');
        sel.innerHTML = '<option value="">Select type...</option>';
        documentTypes.forEach(dt => {
            sel.innerHTML += `<option value="${dt.id}">${dt.code} — ${dt.name}</option>`;
        });
    } catch(e) { console.warn('Could not load document types'); }
}

// ── Load customers ─────────────────────────────
async function loadCustomers(page = 1) {
    currentPage = page;
    const firstName  = document.getElementById('filterName').value.trim();
    const docNumber  = document.getElementById('filterDocument').value.trim();
    const isActive   = document.getElementById('filterStatus').value;

    let url = `/customers?pageNumber=${page}&pageSize=${pageSize}`;
    if (firstName) url += `&firstName=${encodeURIComponent(firstName)}`;
    if (docNumber) url += `&documentNumber=${encodeURIComponent(docNumber)}`;
    if (isActive !== '') url += `&isActive=${isActive}`;

    const tbody = document.getElementById('customersTableBody');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:#aaa">Loading...</td></tr>`;

    try {
        const response = await api.get(url);
        const data     = response?.data ?? response;
        const items    = data?.items ?? [];
        console.log('First item:', items[0]); // ← agrega esto
        const totalCount = data?.totalCount ?? 0;
        totalPages  = Math.ceil(totalCount / pageSize) || 1;

        document.getElementById('tableCount').textContent = `${totalCount} customer${totalCount !== 1 ? 's' : ''} found`;
        document.getElementById('pgInfo').textContent = `Page ${currentPage} of ${totalPages}`;

        renderPagination();

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="ti ti-users-off"></i><p>No customers found</p></div></td></tr>`;
            return;
        }

        tbody.innerHTML = items.map(c => {
            const name     = `${c.firstName || c.person?.firstName || ''} ${c.lastName || c.person?.lastName || ''}`.trim() || '—';
            const initials = (name.split(' ').map(n=>n[0]||'').join('').toUpperCase()).substring(0,2) || '?';
            const email    = c.primaryEmail || c.email || '—';
            const phone    = c.primaryPhone || c.phone || '—';
            const doc      = c.primaryDocument || c.document || '—';
            const active   = c.isActive !== false;
            return `
            <tr>
                <td>
                    <div class="customer-cell">
                        <div class="avatar">${initials}</div>
                        <div>
                            <div class="customer-name">${name}</div>
                            <div class="customer-email">${email}</div>
                        </div>
                    </div>
                </td>
                <td>${doc}</td>
                <td>${phone}</td>
                <td>${email}</td>
                <td><span class="${active ? 'badge-active' : 'badge-inactive'}">${active ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn" title="View" onclick="viewCustomer(${c.id})"><i class="ti ti-eye"></i></button>
                        <button class="action-btn" title="Edit" onclick="editCustomer(${c.id})"><i class="ti ti-edit"></i></button>
                        <button class="action-btn danger" title="Delete" onclick="deleteCustomer(${c.id}, '${name}')"><i class="ti ti-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');

    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:#dc2626">Error loading customers: ${err.message}</td></tr>`;
    }
}

// ── Pagination ─────────────────────────────────
function renderPagination() {
    const container = document.getElementById('pgNumbers');
    container.innerHTML = '';
    const start = Math.max(1, currentPage - 2);
    const end   = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
        container.innerHTML += `<button class="pg-btn ${i === currentPage ? 'active' : ''}" onclick="loadCustomers(${i})">${i}</button>`;
    }
    document.getElementById('pgPrev').disabled = currentPage <= 1;
    document.getElementById('pgNext').disabled = currentPage >= totalPages;
}

document.getElementById('pgPrev').addEventListener('click', () => { if (currentPage > 1) loadCustomers(currentPage - 1); });
document.getElementById('pgNext').addEventListener('click', () => { if (currentPage < totalPages) loadCustomers(currentPage + 1); });

// ── Filters ────────────────────────────────────
document.getElementById('btnFilter').addEventListener('click', () => loadCustomers(1));
document.getElementById('btnClear').addEventListener('click', () => {
    document.getElementById('filterName').value     = '';
    document.getElementById('filterDocument').value = '';
    document.getElementById('filterStatus').value   = '';
    loadCustomers(1);
});
document.getElementById('globalSearch').addEventListener('keyup', e => {
    document.getElementById('filterName').value = e.target.value;
    if (e.key === 'Enter') loadCustomers(1);
});

// ── Modal ──────────────────────────────────────
function openModal(title) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalAlert').style.display = 'none';
    document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    document.getElementById('fFirstName').value      = '';
    document.getElementById('fLastName').value       = '';
    document.getElementById('fDocumentType').value   = '';
    document.getElementById('fDocumentNumber').value = '';
    document.getElementById('fEmail').value          = '';
    document.getElementById('fPhone').value          = '';
    editingId = null;
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

document.getElementById('btnNewCustomer').addEventListener('click', () => {
    editingId = null;
    openModal('New Customer');
});

// ── View customer ──────────────────────────────
async function viewCustomer(id) {
    try {
        const c = await api.get(`/customers/${id}`);
        const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
        alert(`Customer: ${name}\nEmail: ${c.primaryEmail || '—'}\nPhone: ${c.primaryPhone || '—'}\nDocument: ${c.primaryDocument || '—'}\nStatus: ${c.isActive ? 'Active' : 'Inactive'}`);
    } catch(e) { alert('Error loading customer details'); }
}

// ── Edit customer ──────────────────────────────
async function editCustomer(id) {
    try {
        const c = await api.get(`/customers/${id}`);
        editingId = id;
        document.getElementById('fFirstName').value = c.firstName || c.person?.firstName || '';
        document.getElementById('fLastName').value  = c.lastName  || c.person?.lastName  || '';
        document.getElementById('fEmail').value     = c.primaryEmail || '';
        document.getElementById('fPhone').value     = c.primaryPhone || '';
        openModal('Edit Customer');
    } catch(e) { alert('Error loading customer'); }
}

// ── Delete customer ────────────────────────────
async function deleteCustomer(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
        await api.delete(`/customers/${id}`);
        loadCustomers(currentPage);
    } catch(e) { alert(`Error deleting customer: ${e.message}`); }
}

// ── Save customer ──────────────────────────────
document.getElementById('btnSave').addEventListener('click', async () => {
    const firstName      = document.getElementById('fFirstName').value.trim();
    const lastName       = document.getElementById('fLastName').value.trim();
    const documentTypeId = document.getElementById('fDocumentType').value;
    const documentNumber = document.getElementById('fDocumentNumber').value.trim();
    const email          = document.getElementById('fEmail').value.trim();
    const phone          = document.getElementById('fPhone').value.trim();
    const alertEl        = document.getElementById('modalAlert');

    if (!firstName || !lastName) {
        alertEl.textContent    = 'First name and last name are required.';
        alertEl.style.display  = 'block';
        return;
    }

    alertEl.style.display = 'none';

    try {
        if (editingId) {
            await api.put(`/customers/${editingId}`, { firstName, lastName, isActive: true });
        } else {
            await api.post('/customers', {
                firstName,
                lastName,
                documentTypeId: documentTypeId || undefined,
                documentNumber: documentNumber  || undefined,
                email:          email           || undefined,
                phone:          phone           || undefined
            });
        }
        closeModal();
        loadCustomers(currentPage);
    } catch(e) {
        alertEl.textContent   = e.message || 'Error saving customer.';
        alertEl.style.display = 'block';
    }
});

// ── Init ───────────────────────────────────────
loadDocumentTypes();
loadCustomers(1);