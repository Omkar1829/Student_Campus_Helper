let adminUsers = [];
let editingUserId = null;

function filterAdminUsers() {
    const query = document.getElementById('usersSearch').value.trim().toLowerCase();
    const filtered = adminUsers.filter((user) =>
        [user.name, user.email, user.course, user.semester, user.role].some((value) =>
            String(value || '').toLowerCase().includes(query)
        )
    );

    renderAdminUsers(filtered);
}

function renderAdminUsers(users) {
    const body = document.getElementById('usersTableBody');
    const mobileList = document.getElementById('usersMobileList');

    body.innerHTML = users.map((user) => `
        <tr class="border-t">
            <td class="p-4 font-medium">${user.name}</td>
            <td>${user.email}</td>
            <td>${user.course}</td>
            <td>${user.semester}</td>
            <td>
                <span class="rounded-full px-2 py-1 text-xs ${user.role === 'admin' ? 'bg-purple-200 text-purple-800' : 'bg-emerald-200 text-emerald-800'}">
                    ${user.role}
                </span>
            </td>
            <td class="space-x-3">
                <button class="font-medium text-indigo-600" data-user-edit="${user.id}">Edit</button>
                <button class="font-medium text-red-500" data-user-delete="${user.id}">Delete</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6" class="p-6 text-center text-slate-500">No users found.</td></tr>';

    mobileList.innerHTML = users.map((user) => `
        <article class="rounded-2xl bg-white p-5 shadow-sm">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <h3 class="text-base font-semibold text-slate-900">${user.name}</h3>
                    <p class="mt-1 break-all text-sm text-slate-500">${user.email}</p>
                </div>
                <span class="rounded-full px-3 py-1 text-xs font-medium ${user.role === 'admin' ? 'bg-purple-200 text-purple-800' : 'bg-emerald-200 text-emerald-800'}">
                    ${user.role}
                </span>
            </div>
            <div class="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <div class="rounded-xl bg-slate-50 px-4 py-3">
                    <p class="text-xs uppercase tracking-wide text-slate-400">Course</p>
                    <p class="mt-1 font-medium text-slate-700">${user.course || 'N/A'}</p>
                </div>
                <div class="rounded-xl bg-slate-50 px-4 py-3">
                    <p class="text-xs uppercase tracking-wide text-slate-400">Semester</p>
                    <p class="mt-1 font-medium text-slate-700">${user.semester || 'N/A'}</p>
                </div>
            </div>
            <div class="mt-4 flex flex-col gap-3 sm:flex-row">
                <button class="flex-1 rounded-xl bg-indigo-50 px-4 py-3 font-medium text-indigo-600 transition hover:bg-indigo-100" data-user-edit="${user.id}">Edit</button>
                <button class="flex-1 rounded-xl bg-red-50 px-4 py-3 font-medium text-red-600 transition hover:bg-red-100" data-user-delete="${user.id}">Delete</button>
            </div>
        </article>
    `).join('') || '<div class="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">No users found.</div>';
}

async function loadAdminUsers() {
    try {
        const response = await CampusApp.api('adminGetUsers');
        adminUsers = response.users || [];
        filterAdminUsers();
        populateUserSelects(adminUsers);
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

function populateUserSelects(users) {
    document.querySelectorAll('[data-users-select]').forEach((select) => {
        select.innerHTML = '<option value="">Select user</option>' + users.map((user) => `
            <option value="${user.id}">${user.name} (${user.email})</option>
        `).join('');
    });
}

function toggleUserModal(forceState) {
    const modal = document.getElementById('userModal');
    const willShow = typeof forceState === 'boolean' ? forceState : modal.classList.contains('hidden');
    modal.classList.toggle('hidden', !willShow);

    if (!willShow) {
        editingUserId = null;
        document.getElementById('userForm').reset();
        document.getElementById('userPassword').required = true;
        document.getElementById('userModalTitle').textContent = 'Add Student';
    }
}

function openEditUser(userId) {
    const user = adminUsers.find((item) => Number(item.id) === Number(userId));
    if (!user) {
        return;
    }

    editingUserId = user.id;
    document.getElementById('userName').value = user.name;
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userCourse').value = user.course;
    document.getElementById('userSemester').value = user.semester;
    document.getElementById('userRole').value = user.role;
    document.getElementById('userPassword').required = false;
    document.getElementById('userModalTitle').textContent = 'Edit Student';
    toggleUserModal(true);
}

async function saveAdminUser(event) {
    event.preventDefault();

    const button = document.getElementById('saveUserBtn');
    const payload = {
        name: document.getElementById('userName').value.trim(),
        email: document.getElementById('userEmail').value.trim(),
        course: document.getElementById('userCourse').value.trim(),
        semester: document.getElementById('userSemester').value.trim(),
        role: document.getElementById('userRole').value,
        password: document.getElementById('userPassword').value
    };

    try {
        CampusApp.setButtonLoading(button, true, editingUserId ? 'Update User' : 'Create User');
        await CampusApp.api(editingUserId ? 'adminUpdateUser' : 'adminCreateUser', {
            ...payload,
            ...(editingUserId ? { id: editingUserId } : {})
        });
        CampusApp.showToast(editingUserId ? 'User updated.' : 'User created.', 'success');
        toggleUserModal(false);
        await loadAdminUsers();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    } finally {
        CampusApp.setButtonLoading(button, false, editingUserId ? 'Update User' : 'Create User');
    }
}

async function deleteAdminUser(userId) {
    try {
        await CampusApp.api('adminDeleteUser', { id: userId });
        CampusApp.showToast('User deleted.', 'success');
        await loadAdminUsers();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openUserModal')?.addEventListener('click', () => toggleUserModal(true));
    document.getElementById('closeUserModal')?.addEventListener('click', () => toggleUserModal(false));
    document.getElementById('userModal')?.addEventListener('click', (event) => {
        if (event.target.id === 'userModal') {
            toggleUserModal(false);
        }
    });
    document.getElementById('userForm')?.addEventListener('submit', saveAdminUser);
    document.getElementById('usersSearch')?.addEventListener('input', filterAdminUsers);
    document.getElementById('usersTableBody')?.addEventListener('click', (event) => {
        const editButton = event.target.closest('[data-user-edit]');
        const deleteButton = event.target.closest('[data-user-delete]');

        if (editButton) {
            openEditUser(editButton.dataset.userEdit);
        }

        if (deleteButton) {
            deleteAdminUser(deleteButton.dataset.userDelete);
        }
    });
    document.getElementById('usersMobileList')?.addEventListener('click', (event) => {
        const editButton = event.target.closest('[data-user-edit]');
        const deleteButton = event.target.closest('[data-user-delete]');

        if (editButton) {
            openEditUser(editButton.dataset.userEdit);
        }

        if (deleteButton) {
            deleteAdminUser(deleteButton.dataset.userDelete);
        }
    });

    loadAdminUsers();
});

window.addEventListener('pageshow', () => {
    loadAdminUsers();
});

