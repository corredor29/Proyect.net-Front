const API_BASE = 'http://localhost:5081/api';

async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        logout?.();
        return;
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({
            message: 'Error desconocido'
        }));

        throw new Error(error.message || `HTTP ${response.status}`);
    }

    if (response.status === 204) return null;

    return response.json();
}

const api = {
    get: (url) => apiFetch(url),
    post: (url, body) => apiFetch(url, {
        method: 'POST',
        body: JSON.stringify(body)
    }),
    put: (url, body) => apiFetch(url, {
        method: 'PUT',
        body: JSON.stringify(body)
    }),
    delete: (url) => apiFetch(url, {
        method: 'DELETE'
    })
};