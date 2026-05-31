document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('loginForm');
    const errorBox = document.getElementById('loginError');

    document
        .getElementById('togglePwd')
        .addEventListener('click', () => {

            const password =
                document.getElementById('password');

            password.type =
                password.type === 'password'
                ? 'text'
                : 'password';
        });

    form.addEventListener('submit', async (e) => {

        e.preventDefault();

        errorBox.style.display = 'none';

        try {

            const response =
                await api.post('/auth/login', {

                    email:
                        document.getElementById('email').value,

                    password:
                        document.getElementById('password').value
                });

            saveAuth(
                response.token,
                response.user
            );

            location.href =
                'dashboard.html';

        } catch (error) {

            errorBox.textContent =
                error.message;

            errorBox.style.display =
                'block';
        }
    });

    document
        .getElementById('btnGoogle')
        .addEventListener('click', () => {

            window.location.href =
                'http://localhost:5081/api/auth/google';
        });

});