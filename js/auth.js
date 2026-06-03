function saveAuth(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function getToken() {
    return localStorage.getItem('token');
}

function isAuthenticated() {
    return !!getToken();
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = '/index.html';
        return;
    }
    applyRolePermissions();
}

function hasRole(role) {
    const user = getUser();
    if (!user) return false;
    return user.roles?.includes(role);
}

function getUserRole() {
    const user = getUser();
    return user?.roles?.[0] || '';
}

const ROLE_PERMISSIONS = {
    Admin: [
        'dashboard', 'customers', 'vehicles',
        'service-orders', 'appointments', 'quotations',
        'invoices', 'suppliers', 'parts',
        'users', 'audit-logs'
    ],
    Receptionist: [
        'dashboard', 'customers', 'vehicles',
        'service-orders', 'appointments', 'quotations',
        'invoices', 'parts'
    ],
    Mechanic: [
        'dashboard', 'customers', 'vehicles',
        'service-orders', 'appointments', 'parts'
    ]
};

const PAGE_KEYS = {
    'dashboard.html':      'dashboard',
    'customers.html':      'customers',
    'vehicles.html':       'vehicles',
    'service-orders.html': 'service-orders',
    'appointments.html':   'appointments',
    'quotations.html':     'quotations',
    'invoices.html':       'invoices',
    'suppliers.html':      'suppliers',
    'parts.html':          'parts',
    'users.html':          'users',
    'audit-logs.html':     'audit-logs'
};

function applyRolePermissions() {
    const role        = getUserRole();
    const allowed     = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['Mechanic'];
    const currentPage = window.location.pathname.split('/').pop();
    const currentKey  = PAGE_KEYS[currentPage];

    if (currentKey && !allowed.includes(currentKey)) {
        window.location.href = '/dashboard.html';
        return;
    }

    document.querySelectorAll('.sb-item').forEach(item => {
        const href = item.getAttribute('href') || '';
        const page = href.split('/').pop();
        const key  = PAGE_KEYS[page];
        if (key && !allowed.includes(key)) {
            item.style.display = 'none';
        }
    });

    document.querySelectorAll('.sb-section').forEach(section => {
        let next = section.nextElementSibling;
        let hasVisible = false;
        while (next && !next.classList.contains('sb-section') && !next.classList.contains('sb-bottom')) {
            if (next.style.display !== 'none') hasVisible = true;
            next = next.nextElementSibling;
        }
        if (!hasVisible) section.style.display = 'none';
    });
}