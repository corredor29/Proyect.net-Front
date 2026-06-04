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
let allParts    = [];

// ── Load catalogs ──────────────────────────────
async function loadCatalogs() {
    try {
        const [categories, units] = await Promise.allSettled([
            api.get('/partcategories'),
            api.get('/measurementunits')
        ]);

        if (categories.status === 'fulfilled') {
            const raw   = categories.value?.data ?? categories.value;
            const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
            const sel       = document.getElementById('fCategory');
            const filterSel = document.getElementById('filterCategory');
            sel.innerHTML       = '<option value="">Select category...</option>';
            filterSel.innerHTML = '<option value="">All categories</option>';
            items.forEach(c => {
                sel.innerHTML       += `<option value="${c.id}">${c.name || '—'}</option>`;
                filterSel.innerHTML += `<option value="${c.id}">${c.name || '—'}</option>`;
            });
        }

        if (units.status === 'fulfilled') {
            const raw   = units.value?.data ?? units.value;
            const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
            const sel   = document.getElementById('fUnit');
            sel.innerHTML = '<option value="">No unit</option>';
            items.forEach(u => {
                const label = u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name || '—';
                sel.innerHTML += `<option value="${u.id}">${label}</option>`;
            });
        }
    } catch(e) { console.warn('Error loading catalogs', e); }
}

// ── Load parts ─────────────────────────────────
async function loadParts() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:#aaa">Loading...</td></tr>`;
    try {
        const res = await api.get('/parts?pageSize=200');
        const raw = res?.data ?? res;
        allParts  = Array.isArray(raw) ? raw : (raw?.items ?? []);
        applyFiltersAndRender();
    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:#dc2626">Error: ${err.message}</td></tr>`;
    }
}

function applyFiltersAndRender() {
    const code   = document.getElementById('filterCode').value.trim().toLowerCase();
    const desc   = document.getElementById('filterDesc').value.trim().toLowerCase();
    const catId  = document.getElementById('filterCategory').value;
    const status = document.getElementById('filterStatus').value;

    let filtered = allParts;
    if (code)        filtered = filtered.filter(p => p.code?.toLowerCase().includes(code));
    if (desc)        filtered = filtered.filter(p => p.description?.toLowerCase().includes(desc));
    if (catId)       filtered = filtered.filter(p => String(p.partCategoryId) === catId);
    if (status !== '') filtered = filtered.filter(p => String(p.isActive) === status);

    const pageSize = 10;
    const total    = filtered.length;
    totalPages     = Math.ceil(total / pageSize) || 1;
    currentPage    = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    document.getElementById('tableCount').textContent = `${total} part${total !== 1 ? 's' : ''} found`;
    document.getElementById('pgInfo').textContent     = `Page ${currentPage} of ${totalPages}`;
    renderPagination();

    const tbody = document.getElementById('tableBody');
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="ti ti-tools-off"></i><p>No parts found</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(p => {
        const stockClass = p.stock <= p.minStock ? 'stock-low' : 'stock-ok';
        const price      = '$' + Number(p.unitPrice || 0).toLocaleString('es-CO');
        const unit       = p.unitAbbreviation || p.unitName || '—';
        return `
        <tr>
            <td><span class="part-code">${p.code || '—'}</span></td>
            <td>${p.description || '—'}</td>
            <td>${p.partCategoryName || '—'}</td>
            <td>${unit}</td>
            <td><span class="${stockClass}">${p.stock ?? '—'}</span></td>
            <td>${p.minStock ?? '—'}</td>
            <td style="font-weight:600">${price}</td>
            <td><span class="${p.isActive ? 'badge-active' : 'badge-inactive'}">${p.isActive ? 'Active' : 'Inactive'}</span></td>
            <td>
                <div class="action-btns">
                    <button class="action-btn" title="Edit" onclick="editPart(${p.id})"><i class="ti ti-edit"></i></button>
                    <button class="action-btn danger" title="Delete" onclick="deletePart(${p.id})"><i class="ti ti-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
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
    document.getElementById('filterCode').value     = '';
    document.getElementById('filterDesc').value     = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterStatus').value   = '';
    currentPage = 1;
    applyFiltersAndRender();
});
document.getElementById('globalSearch').addEventListener('keyup', e => {
    document.getElementById('filterDesc').value = e.target.value;
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
    ['fCode','fCategory','fDescription','fUnit','fUnitPrice','fStock','fMinStock']
        .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    editingId = null;
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('btnNew').addEventListener('click', () => { editingId = null; openModal('New Part'); });

// ── Edit ───────────────────────────────────────
async function editPart(id) {
    try {
        const res = await api.get(`/parts/${id}`);
        const p   = res?.data ?? res;
        editingId = id;
        document.getElementById('fCode').value        = p.code           || '';
        document.getElementById('fCategory').value    = p.partCategoryId || '';
        document.getElementById('fDescription').value = p.description    || '';
        document.getElementById('fUnit').value        = p.unitId         || '';
        document.getElementById('fUnitPrice').value   = p.unitPrice      || 0;
        document.getElementById('fStock').value       = p.stock          || 0;
        document.getElementById('fMinStock').value    = p.minStock       || 0;
        openModal('Edit Part');
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Could not load part.', confirmButtonColor: '#4F46E5' });
    }
}

// ── Delete ─────────────────────────────────────
async function deletePart(id) {
    const result = await Swal.fire({
        title:              'Delete part?',
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
        await api.delete(`/parts/${id}`);
        await loadParts();
        Swal.fire({ icon: 'success', title: 'Deleted!', timer: 2000, showConfirmButton: false });
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Error', text: e.message, confirmButtonColor: '#4F46E5' });
    }
}

// ── Delete ─────────────────────────────────────
async function deletePart(id) {
    if (!confirm('Are you sure you want to delete this part?')) return;
    try {
        await api.delete(`/parts/${id}`);
        await loadParts();
    } catch(e) { alert(`Error: ${e.message}`); }
}

// ── Save ───────────────────────────────────────
document.getElementById('btnSave').addEventListener('click', async () => {
    const alertEl = document.getElementById('modalAlert');
    alertEl.style.display = 'none';

    const code        = document.getElementById('fCode').value.trim();
    const categoryId  = parseInt(document.getElementById('fCategory').value);
    const description = document.getElementById('fDescription').value.trim();
    const unitPrice   = parseFloat(document.getElementById('fUnitPrice').value) || 0;

    if (!code || !categoryId || !description) {
        alertEl.textContent   = 'Code, Category and Description are required.';
        alertEl.style.display = 'block';
        return;
    }

    const body = {
        partCategoryId: categoryId,
        unitId:         parseInt(document.getElementById('fUnit').value) || null,
        code,
        description,
        stock:    parseInt(document.getElementById('fStock').value)    || 0,
        minStock: parseInt(document.getElementById('fMinStock').value) || 0,
        unitPrice
    };

    try {
        if (editingId) {
            await api.put(`/parts/${editingId}`, body);
        } else {
            await api.post('/parts', body);
        }
        closeModal();
        await loadParts();
    } catch(e) {
        alertEl.textContent   = e.message || 'Error saving part.';
        alertEl.style.display = 'block';
    }
});

// ── Init ───────────────────────────────────────
loadCatalogs();
loadParts();