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

    loadAdminUsers();
});

window.addEventListener('pageshow', () => {
    loadAdminUsers();
});

