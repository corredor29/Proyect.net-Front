const API_BASE = 'https://autotallermanager-proyectnet.onrender.com/api';

function formatFieldName(fieldName) {
    return String(fieldName || '')
        .replace(/\./g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .trim();
}

function getApiErrorMessage(error, fallbackMessage) {
    const validationErrors = error?.Errors || error?.errors;
    if (validationErrors && typeof validationErrors === 'object') {
        const messages = Object.entries(validationErrors)
            .flatMap(([field, fieldErrors]) => {
                const items = Array.isArray(fieldErrors) ? fieldErrors : [fieldErrors];
                const label = formatFieldName(field);
                return items
                    .filter(Boolean)
                    .map(message => label ? `${label}: ${message}` : String(message));
            });

        if (messages.length > 0) {
            return messages.join(' ');
        }
    }

    return error?.Detail
        || error?.detail
        || error?.message
        || error?.Message
        || error?.title
        || error?.Title
        || fallbackMessage;
}

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
        return null;
    }

    if (response.status === 429) {
        const retryAfter   = response.headers.get('Retry-After') || '60';
        const currentPage  = encodeURIComponent(window.location.href);
        const isInPages    = window.location.pathname.includes('/pages/');
        const rateLimitUrl = isInPages
            ? `../rate-limit.html?retry=${retryAfter}&from=${currentPage}`
            : `rate-limit.html?retry=${retryAfter}&from=${currentPage}`;
        window.location.href = rateLimitUrl;
        return null;
    }

    if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
            const text = await response.text();
            if (text) {
                const error = JSON.parse(text);
                errorMessage = getApiErrorMessage(error, errorMessage);
            }
        } catch { }
        throw new Error(errorMessage);
    }

    if (response.status === 204) return null;

    const text = await response.text();
    if (!text || text.trim() === '') return null;

    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

const api = {
    get:    (url)       => apiFetch(url),
    post:   (url, body) => apiFetch(url, { method: 'POST',   body: JSON.stringify(body) }),
    put:    (url, body) => apiFetch(url, { method: 'PUT',    body: JSON.stringify(body) }),
    patch:  (url, body) => apiFetch(url, { method: 'PATCH',  body: JSON.stringify(body) }),
    delete: (url)       => apiFetch(url, { method: 'DELETE' })
};
