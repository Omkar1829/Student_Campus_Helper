// Authentication API endpoint
const API_URL = './php/auth.php';

// Switch between login and register tabs
function switchTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        loginTab.classList.add('border-b-2', 'border-indigo-600', 'text-indigo-600');
        loginTab.classList.remove('border-transparent', 'text-gray-500');
        registerTab.classList.remove('border-b-2', 'border-indigo-600', 'text-indigo-600');
        registerTab.classList.add('border-transparent', 'text-gray-500');
        clearErrors();
    } else {
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        registerTab.classList.add('border-b-2', 'border-indigo-600', 'text-indigo-600');
        registerTab.classList.remove('border-transparent', 'text-gray-500');
        loginTab.classList.remove('border-b-2', 'border-indigo-600', 'text-indigo-600');
        loginTab.classList.add('border-transparent', 'text-gray-500');
        clearErrors();
    }
}

// Clear all error messages
function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    document.querySelectorAll('.success-message').forEach(el => el.textContent = '');
}

// Show error message
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
    }
}

// Show success message
function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
    }
}

// Disable/Enable button
function setButtonState(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = isLoading;
        if (isLoading) {
            button.innerHTML = '<i class="fa-solid fa-spinner loading"></i> Processing...';
        } else if (buttonId === 'loginBtn') {
            button.innerHTML = '<i class="fa-solid fa-sign-in-alt"></i> Login';
        } else {
            button.innerHTML = '<i class="fa-solid fa-user-plus"></i> Register';
        }
    }
}

// LOGIN HANDLER
function handleLogin() {
    return async function() {
    clearErrors();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    // Validation
    if (!email) {
        showError('loginEmailError', 'Email is required');
        return;
    }
    if (!password) {
        showError('loginPasswordError', 'Password is required');
        return;
    }

    setButtonState('loginBtn', true);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'login',
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (data.success) {
            // Store JWT token in localStorage
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('isLoggedIn', 'true');

            showSuccess('loginSuccess', 'Login successful! Redirecting...');
            setTimeout(() => {
                window.location.href = './profile.html';
            }, 1500);
        } else {
            showError('loginError', data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('loginError', 'An error occurred. Please try again.');
    } finally {
        setButtonState('loginBtn', false);
    }
    };
}

const loginBtn = document.getElementById('loginBtn');
if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin());
}

// REGISTER HANDLER
function handleRegister() {
    return async function() {
    clearErrors();

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const branch = document.getElementById('registerBranch').value.trim();
    const semester = document.getElementById('registerSemester').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirm').value;

    // Validation
    if (!name) {
        showError('registerNameError', 'Name is required');
        return;
    }
    if (!email) {
        showError('registerEmailError', 'Email is required');
        return;
    }
    if (!branch) {
        showError('registerBranchError', 'Branch is required');
        return;
    }
    if (!semester) {
        showError('registerSemesterError', 'Semester is required');
        return;
    }
    if (!password) {
        showError('registerPasswordError', 'Password is required');
        return;
    }
    if (password.length < 6) {
        showError('registerPasswordError', 'Password must be at least 6 characters');
        return;
    }
    if (!confirmPassword) {
        showError('registerConfirmError', 'Please confirm your password');
        return;
    }
    if (password !== confirmPassword) {
        showError('registerConfirmError', 'Passwords do not match');
        return;
    }

    setButtonState('registerBtn', true);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'register',
                name: name,
                email: email,
                branch: branch,
                semester: semester,
                password: password,
                confirm_password: confirmPassword
            })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('registerSuccess', 'Registration successful! Switching to login...');
            document.getElementById('registerName').value = '';
            document.getElementById('registerEmail').value = '';
            document.getElementById('registerBranch').value = '';
            document.getElementById('registerSemester').value = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('registerConfirm').value = '';

            setTimeout(() => {
                switchTab('login');
                document.getElementById('loginEmail').value = email;
            }, 1500);
        } else {
            showError('registerError', data.message || 'Registration failed');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('registerError', 'An error occurred. Please try again.');
    } finally {
        setButtonState('registerBtn', false);
    }
    };
}

const registerBtn = document.getElementById('registerBtn');
if (registerBtn) {
    registerBtn.addEventListener('click', handleRegister());
}

// Check if user is already logged in and redirect
window.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        window.location.href = './profile.html';
    }
});
