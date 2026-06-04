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

// ── Load catalogs ──────────────────────────────
async function loadCatalogs() {
    try {
        const [brands, colors, fuels, transmissions, customers] = await Promise.allSettled([
            api.get('/vehiclebrands'),
            api.get('/vehiclecolors'),
            api.get('/fueltypes'),
            api.get('/transmissiontypes'),
            api.get('/customers?pageSize=100')
        ]);

        fillSelect('fBrand',        brands,        'Select brand...',        'id', ['brandName']);
        fillSelect('fColor', colors, 'Select color...', 'id', ['name']);
        fillSelect('fFuel',         fuels,         'Select fuel...',         'id', ['name']);
        fillSelect('fTransmission', transmissions, 'Select transmission...', 'id', ['name']);

        if (customers.status === 'fulfilled') {
            const raw   = customers.value?.data ?? customers.value;
            const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
            const sel       = document.getElementById('fOwner');
            const filterSel = document.getElementById('filterCustomer');
            sel.innerHTML       = '<option value="">Select owner...</option>';
            filterSel.innerHTML = '<option value="">All customers</option>';
            items.forEach(c => {
                const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || `Customer ${c.id}`;
                sel.innerHTML       += `<option value="${c.id}">${name}</option>`;
                filterSel.innerHTML += `<option value="${c.id}">${name}</option>`;
            });
        }
    } catch(e) { console.warn('Error loading catalogs', e); }
}

function fillSelect(id, result, placeholder, valueKey, labelKeys) {
    const sel = document.getElementById(id);
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    if (result.status !== 'fulfilled') return;
    const raw   = result.value?.data ?? result.value;
    const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
    items.forEach(item => {
        const label = labelKeys.map(k => item[k] || '').join(' ');
        sel.innerHTML += `<option value="${item[valueKey]}">${label}</option>`;
    });
}

// Brand → load models
document.getElementById('fBrand').addEventListener('change', async () => {
    const brandId  = document.getElementById('fBrand').value;
    const modelSel = document.getElementById('fModel');
    modelSel.innerHTML = '<option value="">Select model...</option>';
    if (!brandId) return;
    try {
        const res = await api.get(`/vehiclemodels/brand/${brandId}`);
        const raw   = res?.data ?? res;
        const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
        items.forEach(m => {
            modelSel.innerHTML += `<option value="${m.id}">${m.modelName || m.name || '—'}</option>`;
        });
    } catch(e) { console.warn('Error loading models'); }
});

// ── Load vehicles ──────────────────────────────
async function loadVehicles(page = 1) {
    currentPage = page;
    const vin        = document.getElementById('filterVin').value.trim();
    const plate      = document.getElementById('filterPlate').value.trim();
    const customerId = document.getElementById('filterCustomer').value;

    let url = `/vehicles?pageNumber=${page}&pageSize=10`;
    if (vin)        url += `&vin=${encodeURIComponent(vin)}`;
    if (plate)      url += `&licensePlate=${encodeURIComponent(plate)}`;
    if (customerId) url += `&customerId=${customerId}`;

    const tbody = document.getElementById('vehiclesTableBody');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:#aaa">Loading...</td></tr>`;

    try {
        const response = await api.get(url);
        const data     = response?.data ?? response;
        const items    = data?.items ?? [];
        const total    = data?.totalCount ?? 0;
        totalPages     = Math.ceil(total / 10) || 1;

        document.getElementById('tableCount').textContent = `${total} vehicle${total !== 1 ? 's' : ''} found`;
        document.getElementById('pgInfo').textContent     = `Page ${currentPage} of ${totalPages}`;
        renderPagination();

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="ti ti-car-off"></i><p>No vehicles found</p></div></td></tr>`;
            return;
        }

        tbody.innerHTML = items.map(v => {
            const brand = v.brandName  || v.brand?.brandName  || v.brand?.name  || '—';
            const model = v.modelName  || v.model?.modelName  || v.model?.name  || '—';
            const color = v.colorName  || v.color?.colorName  || v.color?.name  || '—';
            const fuel = v.fuelTypeName || v.fuelType?.name || '—';
            const owner = v.currentOwnerName || v.ownerName   || '—';
            const vin   = v.vin        || '—';
            const year  = v.year       || '—';
            return `
            <tr>
                <td>
                    <div class="vehicle-cell">
                        <div class="vehicle-icon"><i class="ti ti-car"></i></div>
                        <div>
                            <div class="vehicle-name">${brand} ${model}</div>
                            <div class="vehicle-vin">${v.licensePlate || '—'}</div>
                        </div>
                    </div>
                </td>
                <td style="font-family:monospace;font-size:11px">${vin}</td>
                <td>${year}</td>
                <td>${color}</td>
                <td>${fuel}</td>
                <td>${owner}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn" title="Edit" onclick="editVehicle(${v.id})"><i class="ti ti-edit"></i></button>
                        <button class="action-btn danger" title="Delete" onclick="deleteVehicle(${v.id})"><i class="ti ti-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');

    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:#dc2626">Error: ${err.message}</td></tr>`;
    }
}

// ── Pagination ─────────────────────────────────
function renderPagination() {
    const container = document.getElementById('pgNumbers');
    container.innerHTML = '';
    const start = Math.max(1, currentPage - 2);
    const end   = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
        container.innerHTML += `<button class="pg-btn ${i === currentPage ? 'active' : ''}" onclick="loadVehicles(${i})">${i}</button>`;
    }
    document.getElementById('pgPrev').disabled = currentPage <= 1;
    document.getElementById('pgNext').disabled = currentPage >= totalPages;
}

document.getElementById('pgPrev').addEventListener('click', () => { if (currentPage > 1) loadVehicles(currentPage - 1); });
document.getElementById('pgNext').addEventListener('click', () => { if (currentPage < totalPages) loadVehicles(currentPage + 1); });

// ── Filters ────────────────────────────────────
document.getElementById('btnFilter').addEventListener('click', () => loadVehicles(1));
document.getElementById('btnClear').addEventListener('click', () => {
    document.getElementById('filterVin').value      = '';
    document.getElementById('filterPlate').value    = '';
    document.getElementById('filterCustomer').value = '';
    loadVehicles(1);
});
document.getElementById('globalSearch').addEventListener('keyup', e => {
    document.getElementById('filterVin').value = e.target.value;
    if (e.key === 'Enter') loadVehicles(1);
});

// ── Modal ──────────────────────────────────────
function openModal(title) {
    document.getElementById('modalTitle').textContent   = title;
    document.getElementById('modalAlert').style.display = 'none';
    document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    ['fBrand','fModel','fYear','fColor','fVin','fPlate','fFuel','fTransmission','fOwner','fMileage']
        .forEach(id => { document.getElementById(id).value = ''; });
    editingId = null;
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('btnNewVehicle').addEventListener('click', () => { editingId = null; openModal('New Vehicle'); });

// ── Edit vehicle ───────────────────────────────
async function editVehicle(id) {
    try {
        const res = await api.get(`/vehicles/${id}`);
        const v   = res?.data ?? res;
        editingId = id;
        document.getElementById('fYear').value    = v.year           || '';
        document.getElementById('fVin').value     = v.vin            || '';
        document.getElementById('fPlate').value   = v.licensePlate   || '';
        document.getElementById('fMileage').value = v.currentMileage || 0;
        openModal('Edit Vehicle');
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Could not load vehicle.', confirmButtonColor: '#4F46E5' });
    }
}

// ── Delete vehicle ─────────────────────────────
async function deleteVehicle(id) {
    const result = await Swal.fire({
        title:              'Delete vehicle?',
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
        await api.delete(`/vehicles/${id}`);
        loadVehicles(currentPage);
        Swal.fire({ icon: 'success', title: 'Deleted!', timer: 2000, showConfirmButton: false });
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Error', text: e.message, confirmButtonColor: '#4F46E5' });
    }
}

// ── Save vehicle ───────────────────────────────
document.getElementById('btnSave').addEventListener('click', async () => {
    const alertEl = document.getElementById('modalAlert');
    alertEl.style.display = 'none';

    const body = {
        modelId:            parseInt(document.getElementById('fModel').value)        || undefined,
        year:               parseInt(document.getElementById('fYear').value)         || 2024,
        colorId:            parseInt(document.getElementById('fColor').value)        || undefined,
        vin:                document.getElementById('fVin').value.trim()             || undefined,
        licensePlate:       document.getElementById('fPlate').value.trim()           || undefined,
        fuelTypeId:         parseInt(document.getElementById('fFuel').value)         || undefined,
        transmissionTypeId: parseInt(document.getElementById('fTransmission').value) || undefined,
        mileage:            parseInt(document.getElementById('fMileage').value)      || 0,
        customerId:         parseInt(document.getElementById('fOwner').value)        || undefined
    };

    if (!body.vin) {
        alertEl.textContent   = 'VIN is required.';
        alertEl.style.display = 'block';
        return;
    }

    if (!body.modelId) {
        alertEl.textContent   = 'Brand and Model are required.';
        alertEl.style.display = 'block';
        return;
    }

    try {
        if (editingId) {
            await api.put(`/vehicles/${editingId}`, body);
        } else {
            await api.post('/vehicles', body);
        }
        closeModal();
        loadVehicles(currentPage);
    } catch(e) {
        alertEl.textContent   = e.message || 'Error saving vehicle.';
        alertEl.style.display = 'block';
    }
});

loadCatalogs();
loadVehicles(1);