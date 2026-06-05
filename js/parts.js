requireAuth();

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
    document.getElementById('themeIcon').className = theme === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
    document.getElementById('themeLabel').textContent = theme === 'dark' ? 'Light' : 'Dark';
}

const user = getUser();
const canManageParts = hasRole('Admin');

if (user) {
    const initials = ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || 'U';
    document.getElementById('sbAvatar').textContent = initials;
    document.getElementById('sbUserName').textContent =
        user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
    document.getElementById('sbUserRole').textContent = user.roles?.[0] || 'User';
}

document.getElementById('logoutBtn').addEventListener('click', logout);

if (!canManageParts) {
    document.getElementById('btnNew').style.display = 'none';
}

let currentPage = 1;
let totalPages = 1;
let editingId = null;
let allParts = [];

async function loadCatalogs() {
    try {
        const [categories, units] = await Promise.allSettled([
            api.get('/partcategories'),
            api.get('/measurementunits'),
        ]);

        if (categories.status === 'fulfilled') {
            const raw = categories.value?.data ?? categories.value;
            const items = Array.isArray(raw) ? raw : raw?.items ?? [];
            const select = document.getElementById('fCategory');
            const filterSelect = document.getElementById('filterCategory');

            select.innerHTML = '<option value="">Select category...</option>';
            filterSelect.innerHTML = '<option value="">All categories</option>';

            items.forEach(category => {
                const label = category.name || '-';
                select.innerHTML += `<option value="${category.id}">${label}</option>`;
                filterSelect.innerHTML += `<option value="${category.id}">${label}</option>`;
            });
        }

        if (units.status === 'fulfilled') {
            const raw = units.value?.data ?? units.value;
            const items = Array.isArray(raw) ? raw : raw?.items ?? [];
            const select = document.getElementById('fUnit');

            select.innerHTML = '<option value="">No unit</option>';
            items.forEach(unit => {
                const label = unit.abbreviation ? `${unit.name} (${unit.abbreviation})` : unit.name || '-';
                select.innerHTML += `<option value="${unit.id}">${label}</option>`;
            });
        }
    } catch (error) {
        console.warn('Error loading catalogs', error);
    }
}

async function loadParts() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:#aaa">Loading...</td></tr>';

    try {
        const response = await api.get('/parts?pageSize=200');
        const raw = response?.data ?? response;
        allParts = Array.isArray(raw) ? raw : raw?.items ?? [];
        applyFiltersAndRender();
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:#dc2626">Error: ${error.message}</td></tr>`;
    }
}

function applyFiltersAndRender() {
    const code = document.getElementById('filterCode').value.trim().toLowerCase();
    const description = document.getElementById('filterDesc').value.trim().toLowerCase();
    const categoryId = document.getElementById('filterCategory').value;
    const status = document.getElementById('filterStatus').value;

    let filtered = allParts;
    if (code) filtered = filtered.filter(part => part.code?.toLowerCase().includes(code));
    if (description) filtered = filtered.filter(part => part.description?.toLowerCase().includes(description));
    if (categoryId) filtered = filtered.filter(part => String(part.partCategoryId) === categoryId);
    if (status !== '') filtered = filtered.filter(part => String(part.isActive) === status);

    const pageSize = 10;
    const total = filtered.length;
    totalPages = Math.ceil(total / pageSize) || 1;
    currentPage = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    document.getElementById('tableCount').textContent = `${total} part${total !== 1 ? 's' : ''} found`;
    document.getElementById('pgInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    renderPagination();

    const tbody = document.getElementById('tableBody');
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><i class="ti ti-tools-off"></i><p>No parts found</p></div></td></tr>';
        return;
    }

    tbody.innerHTML = items.map(part => {
        const stockClass = part.stock <= part.minStock ? 'stock-low' : 'stock-ok';
        const price = '$' + Number(part.unitPrice || 0).toLocaleString('es-CO');
        const unit = part.unitAbbreviation || part.unitName || '-';
        const actions = canManageParts
            ? `
                <div class="action-btns">
                    <button class="action-btn" title="Edit" onclick="editPart(${part.id})"><i class="ti ti-edit"></i></button>
                    <button class="action-btn danger" title="Delete" onclick="deletePart(${part.id})"><i class="ti ti-trash"></i></button>
                </div>`
            : '';

        return `
        <tr>
            <td><span class="part-code">${part.code || '-'}</span></td>
            <td>${part.description || '-'}</td>
            <td>${part.partCategoryName || '-'}</td>
            <td>${unit}</td>
            <td><span class="${stockClass}">${part.stock ?? '-'}</span></td>
            <td>${part.minStock ?? '-'}</td>
            <td style="font-weight:600">${price}</td>
            <td><span class="${part.isActive ? 'badge-active' : 'badge-inactive'}">${part.isActive ? 'Active' : 'Inactive'}</span></td>
            <td>${actions}</td>
        </tr>`;
    }).join('');
}

function renderPagination() {
    const container = document.getElementById('pgNumbers');
    container.innerHTML = '';

    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

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

document.getElementById('pgPrev').addEventListener('click', () => {
    if (currentPage > 1) goPage(currentPage - 1);
});

document.getElementById('pgNext').addEventListener('click', () => {
    if (currentPage < totalPages) goPage(currentPage + 1);
});

document.getElementById('btnFilter').addEventListener('click', () => {
    currentPage = 1;
    applyFiltersAndRender();
});

document.getElementById('btnClear').addEventListener('click', () => {
    document.getElementById('filterCode').value = '';
    document.getElementById('filterDesc').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterStatus').value = '';
    currentPage = 1;
    applyFiltersAndRender();
});

document.getElementById('globalSearch').addEventListener('keyup', event => {
    document.getElementById('filterDesc').value = event.target.value;
    currentPage = 1;
    applyFiltersAndRender();
});

function openModal(title) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalAlert').style.display = 'none';
    document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    ['fCode', 'fCategory', 'fDescription', 'fUnit', 'fUnitPrice', 'fStock', 'fMinStock'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
    editingId = null;
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
});
document.getElementById('btnNew').addEventListener('click', async () => {
    if (!canManageParts) {
        await showUnauthorizedPartsMessage();
        return;
    }

    editingId = null;
    openModal('New Part');
});

async function editPart(id) {
    if (!canManageParts) {
        await showUnauthorizedPartsMessage();
        return;
    }

    try {
        const response = await api.get(`/parts/${id}`);
        const part = response?.data ?? response;

        editingId = id;
        document.getElementById('fCode').value = part.code || '';
        document.getElementById('fCategory').value = part.partCategoryId || '';
        document.getElementById('fDescription').value = part.description || '';
        document.getElementById('fUnit').value = part.unitId || '';
        document.getElementById('fUnitPrice').value = part.unitPrice || 0;
        document.getElementById('fStock').value = part.stock || 0;
        document.getElementById('fMinStock').value = part.minStock || 0;

        openModal('Edit Part');
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Could not load part.',
            confirmButtonColor: '#4F46E5',
        });
    }
}

async function deletePart(id) {
    if (!canManageParts) {
        await showUnauthorizedPartsMessage();
        return;
    }

    const result = await Swal.fire({
        title: 'Delete part?',
        text: 'Are you sure? This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: document.body.classList.contains('dark') ? '#333' : '#6b7280',
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel',
        background: document.body.classList.contains('dark') ? '#111' : '#fff',
        color: document.body.classList.contains('dark') ? '#fff' : '#111',
    });

    if (!result.isConfirmed) return;

    try {
        await api.delete(`/parts/${id}`);
        await loadParts();
        Swal.fire({ icon: 'success', title: 'Deleted!', timer: 2000, showConfirmButton: false });
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
            confirmButtonColor: '#4F46E5',
        });
    }
}

document.getElementById('btnSave').addEventListener('click', async () => {
    const alertEl = document.getElementById('modalAlert');
    alertEl.style.display = 'none';

    if (!canManageParts) {
        await showUnauthorizedPartsMessage();
        return;
    }

    const code = document.getElementById('fCode').value.trim();
    const categoryId = parseInt(document.getElementById('fCategory').value);
    const description = document.getElementById('fDescription').value.trim();
    const unitPrice = parseFloat(document.getElementById('fUnitPrice').value) || 0;

    if (!code || !categoryId || !description) {
        alertEl.textContent = 'Code, Category and Description are required.';
        alertEl.style.display = 'block';
        return;
    }

    const body = {
        partCategoryId: categoryId,
        unitId: parseInt(document.getElementById('fUnit').value) || null,
        code,
        description,
        stock: parseInt(document.getElementById('fStock').value) || 0,
        minStock: parseInt(document.getElementById('fMinStock').value) || 0,
        unitPrice,
    };

    try {
        if (editingId) {
            await api.put(`/parts/${editingId}`, body);
        } else {
            await api.post('/parts', body);
        }

        closeModal();
        await loadParts();
    } catch (error) {
        alertEl.textContent = error.message || 'Error saving part.';
        alertEl.style.display = 'block';
    }
});

async function showUnauthorizedPartsMessage() {
    await Swal.fire({
        icon: 'warning',
        title: 'Unauthorized',
        text: 'Only admins can create, edit, or delete parts.',
        confirmButtonColor: '#4F46E5',
        background: document.body.classList.contains('dark') ? '#111' : '#fff',
        color: document.body.classList.contains('dark') ? '#fff' : '#111',
    });
}

loadCatalogs();
loadParts();
