// ── Callback global que Google llama con el ID token ──
async function handleGoogleLogin(response) {
    const errorBox = document.getElementById('loginError');
    errorBox.style.display = 'none';

    try {
        // Envía el ID token al backend para validarlo y obtener JWT
        const result = await api.post('/auth/google-token', {
            idToken: response.credential
        });

        saveAuth(result.data.token, {
            firstName: result.data.fullName?.split(' ')[0] || '',
            lastName:  result.data.fullName?.split(' ').slice(1).join(' ') || '',
            fullName:  result.data.fullName,
            roles:     result.data.roles,
            userId:    result.data.userId
        });

        location.href = 'dashboard.html';

    } catch(e) {
        errorBox.textContent   = e.message || 'Google login failed.';
        errorBox.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', () => {

    const form     = document.getElementById('loginForm');
    const errorBox = document.getElementById('loginError');

    // ── Muestra error de Google si viene en la URL ──
    const urlParams   = new URLSearchParams(window.location.search);
    const googleError = urlParams.get('error');
    if (googleError) {
        errorBox.textContent   = decodeURIComponent(googleError);
        errorBox.style.display = 'block';
    }

    document
        .getElementById('togglePwd')
        .addEventListener('click', () => {
            const password = document.getElementById('password');
            password.type  = password.type === 'password' ? 'text' : 'password';
        });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorBox.style.display = 'none';

        try {
            const response = await api.post('/auth/login', {
                email:    document.getElementById('email').value,
                password: document.getElementById('password').value
            });

            saveAuth(response.data.token, {
                firstName: response.data.fullName?.split(' ')[0] || '',
                lastName:  response.data.fullName?.split(' ').slice(1).join(' ') || '',
                fullName:  response.data.fullName,
                roles:     response.data.roles,
                userId:    response.data.userId
            });

            location.href = 'dashboard.html';

        } catch (error) {
            errorBox.textContent   = error.message;
            errorBox.style.display = 'block';
        }
    });

    // ── Google Identity Services ───────────────────
    // Espera a que el SDK de Google cargue e inicializa el botón oficial
    window.addEventListener('load', () => {
        if (typeof google !== 'undefined') {
            google.accounts.id.initialize({
                client_id: '801237302057-j3ise91bju39hvchmubs9j5rch1h7pb0.apps.googleusercontent.com',
                callback:  handleGoogleLogin
            });

            // Renderiza el botón oficial de Google en el contenedor
            google.accounts.id.renderButton(
                document.getElementById('googleSignInBtn'),
                {
                    theme: 'outline',
                    size:  'large',
                    width: 360,
                    text:  'signin_with_google'
                }
            );
        }
    });

    // Botón custom como fallback por si el SDK tarda en cargar
    document
        .getElementById('btnGoogle')
        .addEventListener('click', () => {
            if (typeof google !== 'undefined') {
                google.accounts.id.prompt();
            } else {
                errorBox.textContent   = 'Google SDK not loaded. Please try again.';
                errorBox.style.display = 'block';
            }
        });
});