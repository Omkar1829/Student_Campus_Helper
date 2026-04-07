let adminTimetableEntries = [];
let adminTimetableUsers = [];
const weeklyDayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function sortWeeklyTimetable(entries) {
    return [...entries].sort((first, second) => {
        const dateDifference = String(first.class_date || '').localeCompare(String(second.class_date || ''));
        if (dateDifference !== 0) {
            return dateDifference;
        }

        const firstDay = weeklyDayOrder.indexOf(first.day_of_week);
        const secondDay = weeklyDayOrder.indexOf(second.day_of_week);
        const dayDifference = (firstDay === -1 ? 99 : firstDay) - (secondDay === -1 ? 99 : secondDay);

        if (dayDifference !== 0) {
            return dayDifference;
        }

        return String(first.start_time || '').localeCompare(String(second.start_time || ''));
    });
}

function renderAdminTimetable(entries) {
    const body = document.getElementById('adminTimetableTableBody');
    body.innerHTML = sortWeeklyTimetable(entries).map((entry) => `
        <tr class="border-t">
            <td class="p-4">${CampusApp.escapeHtml(entry.day_of_week)}${entry.class_date ? `<div class="text-xs text-slate-500">${CampusApp.formatDate(entry.class_date)}</div>` : ''}</td>
            <td>${CampusApp.formatTime(String(entry.start_time).slice(0, 5))}</td>
            <td>${CampusApp.formatTime(String(entry.end_time).slice(0, 5))}</td>
            <td>${CampusApp.escapeHtml(entry.subject)}</td>
            <td>${CampusApp.escapeHtml(entry.teacher)}</td>
            <td>${CampusApp.escapeHtml(entry.room || 'Room TBA')}</td>
            <td>${CampusApp.escapeHtml(entry.owner_name || 'Unknown user')}</td>
            <td class="space-x-3">
                <button class="font-medium text-indigo-600" data-admin-timetable-edit="${entry.id}">Edit</button>
                <button class="font-medium text-red-500" data-admin-timetable-delete="${entry.id}">Delete</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="8" class="p-6 text-center text-slate-500">No timetable entries found.</td></tr>';
}

function filterAdminTimetable() {
    const query = document.getElementById('adminTimetableSearch').value.trim().toLowerCase();
    const filtered = adminTimetableEntries.filter((entry) =>
        [entry.day_of_week, entry.subject, entry.teacher, entry.room, entry.owner_name].some((value) =>
            String(value || '').toLowerCase().includes(query)
        )
    );

    renderAdminTimetable(filtered);
}

function populateAdminTimetableUsers(users) {
    const select = document.getElementById('adminTimetableUser');
    select.innerHTML = '<option value="">Select user</option>' + users.map((user) => `
        <option value="${user.id}">${CampusApp.escapeHtml(user.name)} (${CampusApp.escapeHtml(user.email)})</option>
    `).join('');
}

async function loadAdminTimetable() {
    try {
        const [entriesResponse, usersResponse] = await Promise.all([
            CampusApp.api('getTimetable'),
            CampusApp.api('adminGetUsers')
        ]);

        adminTimetableUsers = usersResponse.users || [];
        const userMap = new Map(adminTimetableUsers.map((user) => [String(user.id), user]));
        adminTimetableEntries = (entriesResponse.entries || []).map((entry) => ({
            ...entry,
            owner_name: userMap.get(String(entry.user_id))?.name || ''
        }));

        populateAdminTimetableUsers(adminTimetableUsers);
        filterAdminTimetable();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

function toggleAdminTimetableModal(forceState) {
    const modal = document.getElementById('adminTimetableModal');
    const willShow = typeof forceState === 'boolean' ? forceState : modal.classList.contains('hidden');
    modal.classList.toggle('hidden', !willShow);

    if (!willShow) {
        modal.dataset.editId = '';
        document.getElementById('adminTimetableForm').reset();
        document.getElementById('adminTimetableModalTitle').textContent = 'Add Timetable Slot';
        document.getElementById('saveAdminTimetableBtn').textContent = 'Create Slot';
    }
}

function openEditAdminTimetable(entryId) {
    const entry = adminTimetableEntries.find((item) => Number(item.id) === Number(entryId));
    if (!entry) {
        return;
    }

    const modal = document.getElementById('adminTimetableModal');
    modal.dataset.editId = entry.id;
    document.getElementById('adminTimetableUser').value = entry.user_id;
    document.getElementById('adminTimetableDate').value = entry.class_date ? String(entry.class_date).slice(0, 10) : '';
    document.getElementById('adminTimetableDay').value = entry.day_of_week;
    document.getElementById('adminTimetableSubject').value = entry.subject;
    document.getElementById('adminTimetableStart').value = String(entry.start_time).slice(0, 5);
    document.getElementById('adminTimetableEnd').value = String(entry.end_time).slice(0, 5);
    document.getElementById('adminTimetableTeacher').value = entry.teacher;
    document.getElementById('adminTimetableRoom').value = entry.room || '';
    document.getElementById('adminTimetableModalTitle').textContent = 'Edit Timetable Slot';
    document.getElementById('saveAdminTimetableBtn').textContent = 'Update Slot';
    toggleAdminTimetableModal(true);
}

async function saveAdminTimetable(event) {
    event.preventDefault();

    const modal = document.getElementById('adminTimetableModal');
    const editId = Number(modal.dataset.editId || 0);
    const button = document.getElementById('saveAdminTimetableBtn');
    const payload = {
        user_id: Number(document.getElementById('adminTimetableUser').value),
        class_date: document.getElementById('adminTimetableDate').value,
        day_of_week: document.getElementById('adminTimetableDay').value,
        subject: document.getElementById('adminTimetableSubject').value.trim(),
        start_time: document.getElementById('adminTimetableStart').value,
        end_time: document.getElementById('adminTimetableEnd').value,
        teacher: document.getElementById('adminTimetableTeacher').value.trim(),
        room: document.getElementById('adminTimetableRoom').value.trim()
    };

    try {
        CampusApp.setButtonLoading(button, true, editId ? 'Update Slot' : 'Create Slot');
        await CampusApp.api(editId ? 'updateTimetable' : 'addTimetable', {
            ...payload,
            ...(editId ? { id: editId } : {})
        });
        CampusApp.showToast(editId ? 'Timetable slot updated.' : 'Timetable slot created.', 'success');
        toggleAdminTimetableModal(false);
        await loadAdminTimetable();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    } finally {
        CampusApp.setButtonLoading(button, false, editId ? 'Update Slot' : 'Create Slot');
    }
}

async function deleteAdminTimetable(entryId) {
    try {
        await CampusApp.api('deleteTimetable', { id: entryId });
        CampusApp.showToast('Timetable slot deleted.', 'success');
        await loadAdminTimetable();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openAdminTimetableModal')?.addEventListener('click', () => toggleAdminTimetableModal(true));
    document.getElementById('closeAdminTimetableModal')?.addEventListener('click', () => toggleAdminTimetableModal(false));
    document.getElementById('adminTimetableModal')?.addEventListener('click', (event) => {
        if (event.target.id === 'adminTimetableModal') {
            toggleAdminTimetableModal(false);
        }
    });
    document.getElementById('adminTimetableForm')?.addEventListener('submit', saveAdminTimetable);
    document.getElementById('adminTimetableDate')?.addEventListener('change', (event) => {
        const date = new Date(`${event.target.value}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return;
        }

        const dayName = weeklyDayOrder[(date.getDay() + 6) % 7];
        document.getElementById('adminTimetableDay').value = dayName;
    });
    document.getElementById('adminTimetableSearch')?.addEventListener('input', filterAdminTimetable);
    document.getElementById('adminTimetableTableBody')?.addEventListener('click', (event) => {
        const editButton = event.target.closest('[data-admin-timetable-edit]');
        const deleteButton = event.target.closest('[data-admin-timetable-delete]');

        if (editButton) {
            openEditAdminTimetable(editButton.dataset.adminTimetableEdit);
        }

        if (deleteButton) {
            deleteAdminTimetable(deleteButton.dataset.adminTimetableDelete);
        }
    });

    loadAdminTimetable();
});

window.addEventListener('pageshow', () => {
    loadAdminTimetable();
});
