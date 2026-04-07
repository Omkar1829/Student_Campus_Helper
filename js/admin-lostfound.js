let adminLostFound = [];
let adminLostFoundUsers = [];

function renderAdminLostFound(items) {
    const body = document.getElementById('adminLostFoundTableBody');
    body.innerHTML = items.map((item) => `
        <tr class="border-t">
            <td class="p-4 font-medium">
                <div>${CampusApp.escapeHtml(item.item_name)}</div>
                ${item.image_path ? `<a class="text-xs text-indigo-600 hover:underline" href="${CampusApp.route(item.image_path)}" target="_blank" rel="noopener noreferrer">Open image</a>` : ''}
            </td>
            <td>
                <span class="rounded-full px-2 py-1 text-xs ${item.report_type === 'lost' ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}">
                    ${item.report_type}
                </span>
            </td>
            <td>${CampusApp.escapeHtml(item.location)}</td>
            <td>${CampusApp.escapeHtml(item.owner_name || 'Unknown user')}</td>
            <td>${CampusApp.formatDate(item.reported_date)}</td>
            <td>${CampusApp.escapeHtml(item.status)}</td>
            <td class="space-x-3">
                <button class="font-medium text-indigo-600" data-admin-lf-edit="${item.id}">Edit</button>
                <button class="font-medium text-red-500" data-admin-lf-delete="${item.id}">Delete</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="7" class="p-6 text-center text-slate-500">No lost and found records found.</td></tr>';
}

function filterAdminLostFound() {
    const query = document.getElementById('adminLostFoundSearch').value.trim().toLowerCase();
    const filtered = adminLostFound.filter((item) =>
        [item.item_name, item.description, item.location, item.owner_name, item.owner_email, item.contact_info, item.report_type, item.status].some((value) =>
            String(value || '').toLowerCase().includes(query)
        )
    );

    renderAdminLostFound(filtered);
}

async function loadAdminLostFound() {
    try {
        const [itemsResponse, usersResponse] = await Promise.all([
            CampusApp.api('adminGetLostFound'),
            CampusApp.api('adminGetUsers')
        ]);

        adminLostFound = itemsResponse.items || [];
        adminLostFoundUsers = usersResponse.users || [];
        const select = document.getElementById('adminLostFoundUser');
        select.innerHTML = '<option value="">Select user</option>' + adminLostFoundUsers.map((user) => `
            <option value="${user.id}">${user.name} (${user.email})</option>
        `).join('');
        filterAdminLostFound();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

function toggleAdminLostFoundModal(forceState) {
    const modal = document.getElementById('adminLostFoundModal');
    const willShow = typeof forceState === 'boolean' ? forceState : modal.classList.contains('hidden');
    modal.classList.toggle('hidden', !willShow);

    if (!willShow) {
        modal.dataset.editId = '';
        document.getElementById('adminLostFoundForm').reset();
        document.getElementById('adminLostFoundModalTitle').textContent = 'Add Item';
    }
}

function openEditAdminLostFound(itemId) {
    const item = adminLostFound.find((entry) => Number(entry.id) === Number(itemId));
    if (!item) {
        return;
    }

    document.getElementById('adminLostFoundModal').dataset.editId = item.id;
    document.getElementById('adminLostFoundUser').value = item.user_id;
    document.getElementById('adminLostFoundType').value = item.report_type;
    document.getElementById('adminLostFoundName').value = item.item_name;
    document.getElementById('adminLostFoundDescription').value = item.description;
    document.getElementById('adminLostFoundLocation').value = item.location;
    document.getElementById('adminLostFoundContact').value = item.contact_info;
    document.getElementById('adminLostFoundDate').value = String(item.reported_date).slice(0, 10);
    document.getElementById('adminLostFoundStatus').value = item.status;
    document.getElementById('adminLostFoundImage').value = '';
    document.getElementById('adminLostFoundModalTitle').textContent = 'Edit Item';
    toggleAdminLostFoundModal(true);
}

async function saveAdminLostFound(event) {
    event.preventDefault();

    const modal = document.getElementById('adminLostFoundModal');
    const editId = Number(modal.dataset.editId || 0);
    const button = document.getElementById('saveAdminLostFoundBtn');
    const formData = new FormData();
    formData.set('user_id', Number(document.getElementById('adminLostFoundUser').value));
    formData.set('report_type', document.getElementById('adminLostFoundType').value);
    formData.set('item_name', document.getElementById('adminLostFoundName').value.trim());
    formData.set('description', document.getElementById('adminLostFoundDescription').value.trim());
    formData.set('location', document.getElementById('adminLostFoundLocation').value.trim());
    formData.set('contact_info', document.getElementById('adminLostFoundContact').value.trim());
    formData.set('reported_date', document.getElementById('adminLostFoundDate').value);
    formData.set('status', document.getElementById('adminLostFoundStatus').value);

    const itemImage = document.getElementById('adminLostFoundImage')?.files?.[0];
    if (itemImage) {
        formData.set('item_image', itemImage);
    }

    try {
        CampusApp.setButtonLoading(button, true, editId ? 'Update Item' : 'Create Item');
        if (editId) {
            formData.set('id', editId);
        }
        await CampusApp.upload(editId ? 'adminUpdateLostFound' : 'adminCreateLostFound', formData);
        CampusApp.showToast(editId ? 'Item updated.' : 'Item created.', 'success');
        toggleAdminLostFoundModal(false);
        await loadAdminLostFound();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    } finally {
        CampusApp.setButtonLoading(button, false, editId ? 'Update Item' : 'Create Item');
    }
}

async function deleteAdminLostFound(itemId) {
    try {
        await CampusApp.api('adminDeleteLostFound', { id: itemId });
        CampusApp.showToast('Item deleted.', 'success');
        await loadAdminLostFound();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openAdminLostFoundModal')?.addEventListener('click', () => toggleAdminLostFoundModal(true));
    document.getElementById('closeAdminLostFoundModal')?.addEventListener('click', () => toggleAdminLostFoundModal(false));
    document.getElementById('adminLostFoundModal')?.addEventListener('click', (event) => {
        if (event.target.id === 'adminLostFoundModal') {
            toggleAdminLostFoundModal(false);
        }
    });
    document.getElementById('adminLostFoundForm')?.addEventListener('submit', saveAdminLostFound);
    document.getElementById('adminLostFoundSearch')?.addEventListener('input', filterAdminLostFound);
    document.getElementById('adminLostFoundTableBody')?.addEventListener('click', (event) => {
        const editButton = event.target.closest('[data-admin-lf-edit]');
        const deleteButton = event.target.closest('[data-admin-lf-delete]');

        if (editButton) {
            openEditAdminLostFound(editButton.dataset.adminLfEdit);
        }

        if (deleteButton) {
            deleteAdminLostFound(deleteButton.dataset.adminLfDelete);
        }
    });

    loadAdminLostFound();
});

window.addEventListener('pageshow', () => {
    loadAdminLostFound();
});

