(function () {
    const inAdminFolder = /\/Admin\//i.test(window.location.pathname.replace(/\\/g, '/'));
    const API_URL = inAdminFolder ? '../php/auth.php' : './php/auth.php';
    function route(path) {
        return inAdminFolder ? `../${path}` : `./${path}`;
    }

    function readJSON(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    function writeJSON(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function getToken() {
        return localStorage.getItem('token') || '';
    }

    function getUser() {
        return readJSON('user');
    }

    function isAdmin() {
        const user = getUser();
        return Boolean(user && String(user.role || '').toLowerCase() === 'admin');
    }

    function isAuthenticated() {
        return getToken() !== '';
    }

    function saveSession(token, user) {
        localStorage.setItem('token', token);
        writeJSON('user', user);
        localStorage.setItem('isLoggedIn', 'true');
    }

    function clearSession() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const palette = {
            info: 'bg-slate-900 text-white',
            success: 'bg-emerald-600 text-white',
            error: 'bg-red-600 text-white'
        };

        toast.className = `fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-xl transition ${palette[type] || palette.info}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('translate-y-0', 'opacity-100');
        });

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 250);
        }, 2600);
    }

    async function api(action, payload = {}, options = {}) {
        const token = getToken();
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ action, ...(token ? { token } : {}), ...payload })
        });

        let data = {};
        try {
            data = await response.json();
        } catch (error) {
            throw new Error('Server returned an invalid response.');
        }

        if (!response.ok || data.success === false) {
            const message = data.message || options.errorMessage || 'Something went wrong.';
            if (response.status === 401 && options.logoutOnUnauthorized !== false) {
                clearSession();
                updateNavbarState();
            }
            throw new Error(message);
        }

        return data;
    }

    async function upload(action, formData, options = {}) {
        const token = getToken();
        formData.set('action', action);

        if (token) {
            formData.set('token', token);
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData
        });

        let data = {};
        try {
            data = await response.json();
        } catch (error) {
            throw new Error('Server returned an invalid response.');
        }

        if (!response.ok || data.success === false) {
            const message = data.message || options.errorMessage || 'Something went wrong.';
            if (response.status === 401 && options.logoutOnUnauthorized !== false) {
                clearSession();
                updateNavbarState();
            }
            throw new Error(message);
        }

        return data;
    }

    function setButtonLoading(button, loading, label) {
        if (!button) {
            return;
        }

        if (loading) {
            if (!button.dataset.originalLabel) {
                button.dataset.originalLabel = button.innerHTML;
            }
            button.disabled = true;
            button.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Loading...';
        } else {
            button.disabled = false;
            button.innerHTML = label || button.dataset.originalLabel || button.innerHTML;
        }
    }

    function formatDate(value, options = {}) {
        if (!value) {
            return 'N/A';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            ...options
        }).format(date);
    }

    function formatTime(value) {
        if (!value) {
            return '';
        }

        const [hours, minutes] = value.split(':');
        const date = new Date();
        date.setHours(Number(hours), Number(minutes || 0), 0, 0);
        return new Intl.DateTimeFormat('en-IN', {
            hour: 'numeric',
            minute: '2-digit'
        }).format(date);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function initTheme() {
        document.documentElement.classList.remove('dark');
    }

    function updateNavbarState() {
        const user = getUser();
        const loggedIn = isAuthenticated() && user;

        document.querySelectorAll('[data-guest-only]').forEach((element) => {
            element.classList.toggle('hidden', Boolean(loggedIn));
        });

        document.querySelectorAll('[data-user-only]').forEach((element) => {
            element.classList.toggle('hidden', !loggedIn);
        });

        document.querySelectorAll('[data-user-name]').forEach((element) => {
            element.textContent = loggedIn ? user.name.split(' ')[0] : 'Student';
        });

        document.querySelectorAll('[data-auth-link]').forEach((element) => {
            element.setAttribute('href', loggedIn ? route('profile.html') : route('login-register.html'));
            element.textContent = loggedIn ? 'Profile' : 'Sign In';
        });

        document.querySelectorAll('[data-profile-link]').forEach((element) => {
            element.setAttribute('href', loggedIn ? route('profile.html') : route('login-register.html'));
        });

        document.querySelectorAll('[data-profile-label]').forEach((element) => {
            element.textContent = loggedIn ? 'Profile' : 'Login';
        });

        lockAuthActions();
    }

    function setupLogoutButtons() {
        document.querySelectorAll('[data-logout]').forEach((button) => {
            button.addEventListener('click', () => {
                clearSession();
                updateNavbarState();
                showToast('You have been logged out.', 'success');
                if (location.pathname.endsWith('/profile.html') || inAdminFolder) {
                    location.href = route('login-register.html');
                }
            });
        });
    }

    function lockAuthActions() {
        const shouldLock = !isAuthenticated();
        document.querySelectorAll('[data-auth-required]').forEach((element) => {
            if (shouldLock) {
                element.setAttribute('disabled', 'disabled');
                element.classList.add('opacity-60', 'cursor-not-allowed');
            } else {
                element.removeAttribute('disabled');
                element.classList.remove('opacity-60', 'cursor-not-allowed');
            }
        });
    }

    function renderAuthPrompt(container, message) {
        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="rounded-2xl border border-dashed border-indigo-300 bg-white/80 p-8 text-center shadow-sm">
                <h3 class="text-xl font-semibold text-slate-900">Sign in to continue</h3>
                <p class="mt-2 text-sm text-slate-600">${message}</p>
                <a href="${route('login-register.html')}" class="mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700">
                    Open Login
                </a>
            </div>
        `;
    }

    function renderErrorPrompt(container, title, message) {
        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="rounded-2xl border border-dashed border-amber-300 bg-white/80 p-8 text-center shadow-sm">
                <h3 class="text-xl font-semibold text-slate-900">${title}</h3>
                <p class="mt-2 text-sm text-slate-600">${message}</p>
            </div>
        `;
    }

    function ensureAuth(actionDescription = 'Please sign in to continue.') {
        if (isAuthenticated()) {
            return true;
        }

        showToast(actionDescription, 'error');
        return false;
    }

    function setupMobileMenu() {
        const toggle = document.querySelector('[data-mobile-toggle]');
        const menu = document.querySelector('[data-mobile-menu]');
        const closeButton = document.querySelector('[data-mobile-close]');

        if (!toggle || !menu) {
            return;
        }

        const setOpen = (open) => {
            menu.classList.toggle('hidden', !open);
            toggle.setAttribute('aria-expanded', String(open));
            document.body.classList.toggle('overflow-hidden', open);
        };

        setOpen(false);

        toggle.addEventListener('click', () => {
            const isHidden = menu.classList.contains('hidden');
            setOpen(isHidden);
        });

        closeButton?.addEventListener('click', () => setOpen(false));

        menu.querySelectorAll('a, button[data-logout]').forEach((element) => {
            element.addEventListener('click', () => setOpen(false));
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth >= 768) {
                setOpen(false);
            }
        });
    }

    function highlightCurrentLinks() {
        const current = location.pathname.split('/').pop() || 'index.html';

        document.querySelectorAll('[data-nav-link], [data-footer-link]').forEach((link) => {
            const href = link.getAttribute('href') || '';
            const target = href.split('/').pop();
            const isActive = target === current;

            link.classList.toggle('text-indigo-600', isActive);
            link.classList.toggle('font-semibold', isActive);
            link.classList.toggle('bg-indigo-50', isActive && link.hasAttribute('data-mobile-link'));
        });
    }

    function initSharedUI() {
        initTheme();
        updateNavbarState();
        setupLogoutButtons();
        lockAuthActions();
        setupMobileMenu();
        highlightCurrentLinks();
    }

    window.CampusApp = {
        api,
        upload,
        API_URL,
        getToken,
        getUser,
        isAuthenticated,
        isAdmin,
        saveSession,
        clearSession,
        updateNavbarState,
        showToast,
        setButtonLoading,
        formatDate,
        formatTime,
        escapeHtml,
        ensureAuth,
        renderAuthPrompt,
        renderErrorPrompt,
        initSharedUI,
        lockAuthActions,
        route
    };

    document.addEventListener('DOMContentLoaded', initSharedUI);
})();

