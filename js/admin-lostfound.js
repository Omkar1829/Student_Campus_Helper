let adminLostFound = [];
let adminLostFoundUsers = [];
let adminLostFoundClaims = [];

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
                    ${CampusApp.escapeHtml(item.report_type)}
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

function renderAdminClaims(claims) {
    const grid = document.getElementById('adminClaimsGrid');
    if (!grid) {
        return;
    }

    grid.innerHTML = claims.map((claim) => `
        <article class="rounded-2xl border p-5">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h3 class="font-semibold">${CampusApp.escapeHtml(claim.item_name || 'Unknown item')}</h3>
                    <p class="text-sm text-slate-500">Claimed by ${CampusApp.escapeHtml(claim.claimant_name || 'Unknown')}${claim.claimant_email ? ` (${CampusApp.escapeHtml(claim.claimant_email)})` : ''}</p>
                </div>
                <span class="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">${CampusApp.escapeHtml(claim.status)}</span>
            </div>
            <div class="mt-4 space-y-2 text-sm text-slate-600">
                <p><strong>Reason:</strong> ${CampusApp.escapeHtml(claim.claim_reason)}</p>
                <p><strong>Identification:</strong> ${CampusApp.escapeHtml(claim.identifying_details)}</p>
                <p><strong>Contact:</strong> ${CampusApp.escapeHtml(claim.contact_info)}</p>
                <p><strong>Submitted:</strong> ${CampusApp.formatDate(claim.created_at, { hour: 'numeric', minute: '2-digit' })}</p>
                ${claim.admin_notes ? `<p><strong>Admin notes:</strong> ${CampusApp.escapeHtml(claim.admin_notes)}</p>` : ''}
            </div>
            <div class="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <input data-claim-note="${claim.id}" type="text" placeholder="Admin note / distribution remark" value="${CampusApp.escapeHtml(claim.admin_notes || '')}" class="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <div class="flex flex-wrap gap-2">
                    <button class="rounded-lg bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-700" data-claim-status="${claim.id}" data-status="approved">Approve</button>
                    <button class="rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700" data-claim-status="${claim.id}" data-status="rejected">Reject</button>
                    <button class="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-700" data-claim-status="${claim.id}" data-status="distributed">Distributed</button>
                </div>
            </div>
        </article>
    `).join('') || '<div class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">No claims to review.</div>';
}

function filterAdminLostFound() {
    const query = document.getElementById('adminLostFoundSearch').value.trim().toLowerCase();
    const filteredItems = adminLostFound.filter((item) =>
        [item.item_name, item.description, item.location, item.owner_name, item.owner_email, item.contact_info, item.report_type, item.status].some((value) =>
            String(value || '').toLowerCase().includes(query)
        )
    );
    const filteredClaims = adminLostFoundClaims.filter((claim) =>
        [claim.item_name, claim.claimant_name, claim.claimant_email, claim.claim_reason, claim.identifying_details, claim.status].some((value) =>
            String(value || '').toLowerCase().includes(query)
        )
    );

    renderAdminLostFound(filteredItems);
    renderAdminClaims(filteredClaims);
}

async function loadAdminLostFound() {
    try {
        const [itemsResponse, usersResponse, claimsResponse] = await Promise.all([
            CampusApp.api('adminGetLostFound'),
            CampusApp.api('adminGetUsers'),
            CampusApp.api('adminGetLostFoundClaims')
        ]);

        adminLostFound = itemsResponse.items || [];
        adminLostFoundUsers = usersResponse.users || [];
        adminLostFoundClaims = claimsResponse.claims || [];
        const select = document.getElementById('adminLostFoundUser');
        select.innerHTML = '<option value="">Select user</option>' + adminLostFoundUsers.map((user) => `
            <option value="${user.id}">${CampusApp.escapeHtml(user.name)} (${CampusApp.escapeHtml(user.email)})</option>
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

async function updateClaimStatus(claimId, status) {
    const note = document.querySelector(`[data-claim-note="${claimId}"]`)?.value.trim() || '';

    try {
        await CampusApp.api('adminUpdateLostFoundClaim', {
            id: claimId,
            status,
            admin_notes: note
        });
        CampusApp.showToast(`Claim marked ${status}.`, 'success');
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
    document.getElementById('adminClaimsGrid')?.addEventListener('click', (event) => {
        const statusButton = event.target.closest('[data-claim-status]');
        if (statusButton) {
            updateClaimStatus(statusButton.dataset.claimStatus, statusButton.dataset.status);
        }
    });

    loadAdminLostFound();
});

window.addEventListener('pageshow', () => {
    loadAdminLostFound();
});
