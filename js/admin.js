document.addEventListener('DOMContentLoaded', () => {
    const gate = document.getElementById('adminGate');
    const content = document.getElementById('adminContent');
    const renderFullPageMessage = (message) => {
        document.body.innerHTML = `
            <div class="min-h-screen bg-gray-50 p-6 text-gray-800">
                <div class="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
                    ${message}
                </div>
            </div>
        `;
    };

    if (!window.CampusApp) {
        return;
    }

    if (!CampusApp.isAuthenticated()) {
        if (content) {
            content.classList.add('hidden');
            CampusApp.renderAuthPrompt(gate || document.body, 'Please sign in with an admin account to open the admin panel.');
        } else {
            renderFullPageMessage(`
                <h2 class="text-2xl font-bold text-slate-900">Admin Login Required</h2>
                <p class="mt-3 text-sm text-slate-600">Please sign in with an admin account to open the admin panel.</p>
                <a href="../login-register.html" class="mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700">Open Login</a>
            `);
        }
        return;
    }

    if (!CampusApp.isAdmin()) {
        if (content) {
            content.classList.add('hidden');
        }
        if (gate) {
            gate.innerHTML = `
                <div class="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
                    <h2 class="text-2xl font-bold text-slate-900">Admin Access Required</h2>
                    <p class="mt-3 text-sm text-slate-600">This account is not marked as an admin. Update the user's <code>role</code> column to <code>admin</code> in the database, then log in again.</p>
                    <a href="../index.html" class="mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700">Back to Home</a>
                </div>
            `;
        } else {
            renderFullPageMessage(`
                <h2 class="text-2xl font-bold text-slate-900">Admin Access Required</h2>
                <p class="mt-3 text-sm text-slate-600">This account is not marked as an admin. Update the user's <code>role</code> column to <code>admin</code> in the database, then log in again.</p>
                <a href="../index.html" class="mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700">Back to Home</a>
            `);
        }
        return;
    }

    if (gate) {
        gate.innerHTML = '';
    }
    if (content) {
        content.classList.remove('hidden');
    }
});

