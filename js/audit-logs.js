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

// ── Action badge ───────────────────────────────
function actionBadge(name) {
    const n = (name || '').toLowerCase();
    if (n === 'create') return `<span class="action-badge action-create">Create</span>`;
    if (n === 'update') return `<span class="action-badge action-update">Update</span>`;
    if (n === 'delete') return `<span class="action-badge action-delete">Delete</span>`;
    if (n === 'login')  return `<span class="action-badge action-login">Login</span>`;
    if (n === 'logout') return `<span class="action-badge action-logout">Logout</span>`;
    return `<span class="action-badge action-other">${name}</span>`;
}

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-US', {
        year:'numeric', month:'short', day:'numeric',
        hour:'2-digit', minute:'2-digit'
    });
}

// ── Load logs ──────────────────────────────────
async function loadLogs(page = 1) {
    currentPage = page;
    const action = document.getElementById('filterAction').value;
    const entity = document.getElementById('filterEntity').value.trim();
    const user   = document.getElementById('filterUser').value.trim();
    const date   = document.getElementById('filterDate').value;

    let url = `/auditlogs?pageNumber=${page}&pageSize=20`;
    if (action) url += `&actionName=${encodeURIComponent(action)}`;
    if (entity) url += `&affectedEntity=${encodeURIComponent(entity)}`;
    if (date)   url += `&date=${date}`;

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:#aaa">Loading...</td></tr>`;

    try {
        const response = await api.get(url);
        const data     = response?.data ?? response;
        let   items    = Array.isArray(data) ? data : (data?.items ?? []);
        const total    = data?.totalCount ?? items.length;
        totalPages     = Math.ceil(total / 20) || 1;

        // Filtrar por usuario en el frontend si no hay endpoint
        if (user) {
            items = items.filter(l =>
                l.userFullName?.toLowerCase().includes(user.toLowerCase()));
        }

        document.getElementById('tableCount').textContent = `${total} log${total !== 1 ? 's' : ''} found`;
        document.getElementById('pgInfo').textContent     = `Page ${currentPage} of ${totalPages}`;
        renderPagination();

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="ti ti-file-off"></i><p>No audit logs found</p></div></td></tr>`;
            return;
        }

        tbody.innerHTML = items.map(l => `
            <tr>
                <td style="font-family:monospace;font-size:11px">#${l.id}</td>
                <td>${l.userFullName || `User ${l.userId}` || '—'}</td>
                <td>${actionBadge(l.actionName)}</td>
                <td><span class="entity-tag">${l.affectedEntity || '—'}</span></td>
                <td style="font-family:monospace">${l.affectedRecordId ?? '—'}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${l.description||''}">${l.description || '—'}</td>
                <td style="white-space:nowrap">${fmtDate(l.occurredAt)}</td>
            </tr>
        `).join('');

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
        container.innerHTML += `<button class="pg-btn ${i === currentPage ? 'active' : ''}" onclick="loadLogs(${i})">${i}</button>`;
    }
    document.getElementById('pgPrev').disabled = currentPage <= 1;
    document.getElementById('pgNext').disabled = currentPage >= totalPages;
}

document.getElementById('pgPrev').addEventListener('click', () => { if (currentPage > 1) loadLogs(currentPage - 1); });
document.getElementById('pgNext').addEventListener('click', () => { if (currentPage < totalPages) loadLogs(currentPage + 1); });

// ── Filters ────────────────────────────────────
document.getElementById('btnFilter').addEventListener('click', () => loadLogs(1));
document.getElementById('btnClear').addEventListener('click', () => {
    document.getElementById('filterAction').value = '';
    document.getElementById('filterEntity').value = '';
    document.getElementById('filterUser').value   = '';
    document.getElementById('filterDate').value   = '';
    loadLogs(1);
});
document.getElementById('globalSearch').addEventListener('keyup', e => {
    document.getElementById('filterUser').value = e.target.value;
    if (e.key === 'Enter') loadLogs(1);
});

// ── Init ───────────────────────────────────────
loadLogs(1);
