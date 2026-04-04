window.addEventListener('DOMContentLoaded', () => {

            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user'));

            (token)? console.log("token:", token):  console.log("token not found")

            const loginBtn = document.querySelector('.bg-indigo-600 a[href="./login-register.html"]');

            if (token && user && loginBtn) {

                loginBtn.textContent =  "Profile";

                loginBtn.href = './profile.html';
            }
        });