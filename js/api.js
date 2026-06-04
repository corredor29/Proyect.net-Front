const API_BASE = 'https://autotallermanager-proyectnet.onrender.com';

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
    if (response.status === 429) {
        const retryAfter  = response.headers.get('Retry-After') || '60';
        const currentPage = encodeURIComponent(window.location.href);
        
        const isInPages = window.location.pathname.includes('/pages/');
        const rateLimitUrl = isInPages 
            ? `../rate-limit.html?retry=${retryAfter}&from=${currentPage}`
            : `rate-limit.html?retry=${retryAfter}&from=${currentPage}`;
        
        window.location.href = rateLimitUrl;
        return;
    }

    if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
            const error = await response.json();
            errorMessage = error.Detail
                || error.detail
                || error.message
                || error.Message
                || error.title
                || error.Title
                || errorMessage;
        } catch { }

        throw new Error(errorMessage);
    }

    if (response.status === 204) return null;

    return response.json();
}

const api = {
    get:    (url)       => apiFetch(url),
    post:   (url, body) => apiFetch(url, { method: 'POST',   body: JSON.stringify(body) }),
    put:    (url, body) => apiFetch(url, { method: 'PUT',    body: JSON.stringify(body) }),
    patch:  (url, body) => apiFetch(url, { method: 'PATCH',  body: JSON.stringify(body) }),
    delete: (url)       => apiFetch(url, { method: 'DELETE' })
};