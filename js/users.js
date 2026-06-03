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
let allUsers    = [];

// ── Role badge ─────────────────────────────────
function roleBadge(role) {
    const r = (role || '').toLowerCase();
    if (r === 'admin')        return `<span class="role-badge role-admin">Admin</span>`;
    if (r === 'mechanic')     return `<span class="role-badge role-mechanic">Mechanic</span>`;
    if (r === 'receptionist') return `<span class="role-badge role-receptionist">Receptionist</span>`;
    return `<span class="role-badge role-mechanic">${role}</span>`;
}

// ── Load users ─────────────────────────────────
async function loadUsers() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:#aaa">Loading...</td></tr>`;
    try {
        const res = await api.get('/users?pageSize=100');
        const raw = res?.data ?? res;
        allUsers  = Array.isArray(raw) ? raw : (raw?.items ?? []);
        applyFiltersAndRender();
    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:#dc2626">Error: ${err.message}</td></tr>`;
    }
}

function applyFiltersAndRender() {
    const name   = document.getElementById('filterName').value.trim().toLowerCase();
    const role   = document.getElementById('filterRole').value;
    const status = document.getElementById('filterStatus').value;

    let filtered = allUsers;
    if (name)        filtered = filtered.filter(u =>
        `${u.firstName||''} ${u.lastName||''}`.toLowerCase().includes(name));
    if (role)        filtered = filtered.filter(u =>
        u.roles?.some(r => r.toLowerCase() === role.toLowerCase()));
    if (status !== '') filtered = filtered.filter(u => String(u.isActive) === status);

    const pageSize = 10;
    const total    = filtered.length;
    totalPages     = Math.ceil(total / pageSize) || 1;
    currentPage    = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    document.getElementById('tableCount').textContent = `${total} user${total !== 1 ? 's' : ''} found`;
    document.getElementById('pgInfo').textContent     = `Page ${currentPage} of ${totalPages}`;
    renderPagination();

    const tbody = document.getElementById('tableBody');
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i class="ti ti-user-off"></i><p>No users found</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(u => {
        const name     = `${u.firstName||''} ${u.lastName||''}`.trim() || `User ${u.id}`;
        const initials = name.split(' ').map(n => n[0]||'').join('').toUpperCase().substring(0,2) || 'U';
        const roles    = (u.roles || []).map(roleBadge).join('');
        return `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-avatar">${initials}</div>
                    <div>
                        <div class="user-name">${name}</div>
                    </div>
                </div>
            </td>
            <td>${roles || '—'}</td>
            <td><span class="${u.isActive ? 'badge-active' : 'badge-inactive'}">${u.isActive ? 'Active' : 'Inactive'}</span></td>
            <td>
                <div class="action-btns">
                    <button class="action-btn danger" title="Deactivate" onclick="toggleUser(${u.id}, ${u.isActive})">
                        <i class="ti ti-${u.isActive ? 'user-off' : 'user-check'}"></i>
                    </button>
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
    document.getElementById('filterName').value   = '';
    document.getElementById('filterRole').value   = '';
    document.getElementById('filterStatus').value = '';
    currentPage = 1;
    applyFiltersAndRender();
});
document.getElementById('globalSearch').addEventListener('keyup', e => {
    document.getElementById('filterName').value = e.target.value;
    currentPage = 1;
    applyFiltersAndRender();
});

// ── Toggle user active ─────────────────────────
async function toggleUser(id, isActive) {
    const action = isActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
        await api.put(`/users/${id}/${action}`);
        await loadUsers();
    } catch(e) {
        // Try alternate endpoint
        try {
            await api.patch(`/users/${id}`, { isActive: !isActive });
            await loadUsers();
        } catch(e2) {
            alert(`Error: ${e2.message}`);
        }
    }
}

// ── Modal ──────────────────────────────────────
function openModal() {
    document.getElementById('modalTitle').textContent   = 'New User';
    document.getElementById('modalAlert').style.display = 'none';
    document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    ['fFirstName','fLastName','fEmail','fPassword','fRole']
        .forEach(id => { document.getElementById(id).value = ''; });
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('btnNew').addEventListener('click', openModal);

// ── Save ───────────────────────────────────────
document.getElementById('btnSave').addEventListener('click', async () => {
    const alertEl   = document.getElementById('modalAlert');
    alertEl.style.display = 'none';

    const firstName = document.getElementById('fFirstName').value.trim();
    const lastName  = document.getElementById('fLastName').value.trim();
    const email     = document.getElementById('fEmail').value.trim();
    const password  = document.getElementById('fPassword').value;
    const role      = document.getElementById('fRole').value;

    if (!firstName || !lastName || !email || !password || !role) {
        alertEl.textContent   = 'All fields are required.';
        alertEl.style.display = 'block';
        return;
    }

    try {
        await api.post('/auth/register', { firstName, lastName, email, password, role });
        closeModal();
        await loadUsers();
    } catch(e) {
        alertEl.textContent   = e.message || 'Error creating user.';
        alertEl.style.display = 'block';
    }
});

// ── Init ───────────────────────────────────────
loadUsers();
