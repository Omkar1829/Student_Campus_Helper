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

function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    document.querySelectorAll('.success-message').forEach(el => el.textContent = '');
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
    }
}

function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
    }
}

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


document.getElementById('loginBtn').addEventListener('click', async () => {

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        alert("All fields required");
        return;
    }

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'login',
                email,
                password
            })
        });

        const data = await res.json();
        console.log("LOGIN RESPONSE:", data);

        if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);

            alert("Login successful");

            window.location.href = './index.html';

        } else {
            alert(data.message);
        }

    } catch (err) {
        console.error(err);
        alert("Error occurred");
    }
});


document.getElementById('registerBtn').addEventListener('click', async () => {

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const branch = document.getElementById('registerBranch').value.trim();
    const semester = document.getElementById('registerSemester').value;
    const password = document.getElementById('registerPassword').value;
    const confirm_password = document.getElementById('registerConfirm').value;

    if (!name || !email || !branch || !semester || !password || !confirm_password) {
        alert("All fields required");
        return;
    }

    if (password !== confirm_password) {
        alert("Passwords do not match");
        return;
    }

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'register',
                name,
                email,
                course: branch,
                semester,
                password,
                confirm_password
            })
        });

        const data = await res.json();
        console.log("REGISTER RESPONSE:", data);

        if (data.success) {
            alert("Registered successfully");

            document.getElementById('loginEmail').value = email;
            switchTab('login');

        } else {
            alert(data.message);
        }

    } catch (err) {
        console.error(err);
        alert("Error occurred");
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        window.location.href = './profile.html';
    }
});
