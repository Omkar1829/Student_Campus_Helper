function switchTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');

    const showLogin = tab === 'login';
    loginForm.classList.toggle('hidden', !showLogin);
    registerForm.classList.toggle('hidden', showLogin);
    loginTab.classList.toggle('border-indigo-600', showLogin);
    loginTab.classList.toggle('text-indigo-600', showLogin);
    loginTab.classList.toggle('text-gray-500', !showLogin);
    registerTab.classList.toggle('border-indigo-600', !showLogin);
    registerTab.classList.toggle('text-indigo-600', !showLogin);
    registerTab.classList.toggle('text-gray-500', showLogin);

    clearMessages();
}

function clearMessages() {
    document.querySelectorAll('.error-message, .success-message').forEach((element) => {
        element.textContent = '';
    });
}

function showMessage(targetId, message, type = 'error') {
    const element = document.getElementById(targetId);
    if (!element) {
        return;
    }

    element.textContent = message;
    element.classList.toggle('text-red-600', type === 'error');
    element.classList.toggle('text-emerald-600', type === 'success');
}

async function getClientIp() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip || 'Unknown';
    } catch (error) {
        return 'Unknown';
    }
}

async function handleLogin() {
    clearMessages();

    const button = document.getElementById('loginBtn');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!email || !password) {
        showMessage('loginError', 'Email and password are required.');
        return;
    }

    try {
        CampusApp.setButtonLoading(button, true, '<i class="fa-solid fa-sign-in-alt"></i> Login');
        const ipAddress = await getClientIp();
        const data = await CampusApp.api('login', {
            email,
            password,
            ip_address: ipAddress
        }, {
            logoutOnUnauthorized: false
        });

        CampusApp.saveSession(data.token, data.user);
        localStorage.setItem('isLoggedIn', 'true');
        CampusApp.updateNavbarState();
        CampusApp.showToast('Login successful.', 'success');
        window.location.href = CampusApp.isAdmin() ? './Admin/admin-dashboard.html' : './profile.html';
    } catch (error) {
        showMessage('loginError', error.message);
    } finally {
        CampusApp.setButtonLoading(button, false, '<i class="fa-solid fa-sign-in-alt"></i> Login');
    }
}

async function handleRegister() {
    clearMessages();

    const button = document.getElementById('registerBtn');
    const payload = {
        name: document.getElementById('registerName').value.trim(),
        email: document.getElementById('registerEmail').value.trim(),
        course: document.getElementById('registerBranch').value.trim(),
        semester: document.getElementById('registerSemester').value.trim(),
        password: document.getElementById('registerPassword').value,
        confirm_password: document.getElementById('registerConfirm').value
    };

    if (!payload.name || !payload.email || !payload.course || !payload.semester || !payload.password || !payload.confirm_password) {
        showMessage('registerError', 'Please fill in all registration fields.');
        return;
    }

    if (payload.password !== payload.confirm_password) {
        showMessage('registerError', 'Passwords do not match.');
        return;
    }

    try {
        CampusApp.setButtonLoading(button, true, '<i class="fa-solid fa-user-plus"></i> Register');
        const response = await CampusApp.api('register', payload, {
            logoutOnUnauthorized: false
        });

        showMessage('registerSuccess', response.message, 'success');
        document.getElementById('loginEmail').value = payload.email;
        document.getElementById('registerForm').reset?.();
        switchTab('login');
    } catch (error) {
        showMessage('registerError', error.message);
    } finally {
        CampusApp.setButtonLoading(button, false, '<i class="fa-solid fa-user-plus"></i> Register');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
    document.getElementById('registerBtn')?.addEventListener('click', handleRegister);
});

