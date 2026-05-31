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
    }
}

function hasRole(role) {
    const user = getUser();
    if (!user) return false;
    return user.roles?.includes(role);
}