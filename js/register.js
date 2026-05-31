document.addEventListener('DOMContentLoaded', () => {

    const form        = document.getElementById('registerForm');
    const errorBox    = document.getElementById('registerError');
    const successBox  = document.getElementById('registerSuccess');

    document
        .getElementById('togglePassword')
        .addEventListener('click', () => {
            const input = document.getElementById('password');
            input.type  = input.type === 'password' ? 'text' : 'password';
        });

    form.addEventListener('submit', async (e) => {

        e.preventDefault();

        errorBox.style.display   = 'none';
        successBox.style.display = 'none';

        const fullName        = document.getElementById('fullName').value.trim();
        const email           = document.getElementById('email').value.trim();
        const password        = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            errorBox.textContent   = 'Las contraseñas no coinciden';
            errorBox.style.display = 'block';
            return;
        }

        // Separar nombre y apellido
        const parts     = fullName.split(' ');
        const firstName = parts[0] || fullName;
        const lastName  = parts.slice(1).join(' ') || '.';

        try {
            const response = await api.post('/auth/register', {
                firstName,
                lastName,
                email,
                password
            });

            // El token viene en response.data
            saveAuth(response.data.token, {
                firstName,
                lastName,
                fullName:  response.data.fullName,
                roles:     response.data.roles
            });

            successBox.textContent   = '¡Cuenta creada correctamente! Redirigiendo...';
            successBox.style.display = 'block';

            form.reset();

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);

        } catch (error) {
            errorBox.textContent   = error.message || 'Error al registrar usuario';
            errorBox.style.display = 'block';
        }
    });
});