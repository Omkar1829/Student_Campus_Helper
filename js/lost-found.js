let lostFoundState = [];
let lostFoundFilter = 'all';
let selectedItemId = null;

function computeLostFoundStats(items) {
    const lost = items.filter((item) => item.report_type === 'lost').length;
    const found = items.filter((item) => item.report_type === 'found').length;
    const resolved = items.filter((item) => item.status === 'resolved').length;
    const total = items.length;

    return {
        total,
        lost,
        found,
        recoveryRate: total ? Math.round((resolved / total) * 100) : 0
    };
}

function renderLostFound(items) {
    const grid = document.getElementById('lostFoundGrid');
    const stats = computeLostFoundStats(items);
    document.getElementById('lfTotalCount').textContent = stats.total;
    document.getElementById('lfLostCount').textContent = stats.lost;
    document.getElementById('lfFoundCount').textContent = stats.found;
    document.getElementById('lfRecoveryRate').textContent = `${stats.recoveryRate}%`;

    if (!items.length) {
        grid.innerHTML = `
            <div class="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <h3 class="text-lg font-semibold text-slate-900">No matching items</h3>
                <p class="mt-2 text-sm text-slate-600">Try a different search or report a new lost or found item.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = items.map((item) => {
        const badgeClasses = item.report_type === 'found'
            ? 'bg-green-200 text-green-700'
            : 'bg-red-200 text-red-700';

        return `
            <article class="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                ${item.image_path
                    ? `<img src="${CampusApp.route(item.image_path)}" alt="${CampusApp.escapeHtml(item.item_name)}" class="h-32 w-full object-cover">`
                    : `<div class="flex h-32 items-center justify-center bg-indigo-100 text-4xl text-indigo-400"><i class="fa-solid fa-magnifying-glass"></i></div>`}
                <div class="p-5">
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <h3 class="font-semibold text-slate-900">${CampusApp.escapeHtml(item.item_name)}</h3>
                            <p class="mt-1 text-sm text-slate-500">${CampusApp.escapeHtml(item.description)}</p>
                        </div>
                        <span class="rounded-full px-2 py-1 text-xs font-semibold ${badgeClasses}">${item.report_type}</span>
                    </div>
                    <div class="mt-4 space-y-1 text-sm text-slate-600">
                        <p><i class="fa-solid fa-location-dot"></i> ${CampusApp.escapeHtml(item.location)}</p>
                        <p><i class="fa-regular fa-calendar"></i> ${CampusApp.formatDate(item.reported_date)}</p>
                        <p><i class="fa-solid fa-user"></i> ${CampusApp.escapeHtml(item.reported_by)}</p>
                    </div>
                    <button class="mt-4 w-full rounded-xl bg-indigo-600 py-2 font-semibold text-white transition hover:bg-indigo-700" data-item-details="${item.id}">
                        View Details
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

function filterLostFound() {
    const query = document.getElementById('lostFoundSearch').value.trim().toLowerCase();
    const filtered = lostFoundState.filter((item) => {
        const matchesFilter = lostFoundFilter === 'all' ? true : item.report_type === lostFoundFilter;
        const matchesQuery = [item.item_name, item.description, item.location, item.reported_by].some((value) =>
            String(value || '').toLowerCase().includes(query)
        );

        return matchesFilter && matchesQuery;
    });

    renderLostFound(filtered);
}

async function loadLostFound() {
    try {
        const response = await CampusApp.api('getLostFound', {}, { logoutOnUnauthorized: false });
        lostFoundState = response.items || [];
        filterLostFound();
    } catch (error) {
        document.getElementById('lostFoundGrid').innerHTML = `<p class="text-sm text-slate-500">${error.message}</p>`;
    }
}

function toggleReportModal(forceState) {
    const modal = document.getElementById('reportItemModal');
    const willShow = typeof forceState === 'boolean' ? forceState : modal.classList.contains('hidden');
    modal.classList.toggle('hidden', !willShow);

    if (!willShow) {
        selectedItemId = null;
        document.getElementById('lostFoundForm').reset();
        document.getElementById('saveLostFoundBtn').innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Report';
    }
}

function toggleDetailsModal(forceState) {
    const modal = document.getElementById('itemDetailsModal');
    const willShow = typeof forceState === 'boolean' ? forceState : modal.classList.contains('hidden');
    modal.classList.toggle('hidden', !willShow);
}

function openItemDetails(itemId) {
    const item = lostFoundState.find((entry) => String(entry.id) === String(itemId));
    if (!item) {
        return;
    }

    selectedItemId = item.id;
    document.getElementById('detailTitle').textContent = item.item_name;
    document.getElementById('detailType').textContent = item.report_type;
    document.getElementById('detailDescription').textContent = item.description;
    document.getElementById('detailLocation').textContent = item.location;
    document.getElementById('detailContact').textContent = item.contact_info;
    document.getElementById('detailDate').textContent = CampusApp.formatDate(item.reported_date);
    document.getElementById('detailStatus').textContent = item.status;
    document.getElementById('detailReporter').textContent = item.reported_by;
    const detailImage = document.getElementById('detailImage');
    if (detailImage) {
        if (item.image_path) {
            detailImage.src = CampusApp.route(item.image_path);
            detailImage.classList.remove('hidden');
        } else {
            detailImage.src = '';
            detailImage.classList.add('hidden');
        }
    }

    const currentUser = CampusApp.getUser();
    const isOwner = currentUser && Number(currentUser.id) === Number(item.user_id);
    const isAdmin = currentUser && currentUser.role === 'admin';
    document.getElementById('editLostFoundBtn').classList.toggle('hidden', !(isOwner || isAdmin));
    document.getElementById('deleteLostFoundBtn').classList.toggle('hidden', !(isOwner || isAdmin));

    toggleDetailsModal(true);
}

function fillLostFoundForm(itemId) {
    const item = lostFoundState.find((entry) => String(entry.id) === String(itemId));
    if (!item) {
        return;
    }

    selectedItemId = item.id;
    document.getElementById('reportType').value = item.report_type;
    document.getElementById('itemName').value = item.item_name;
    document.getElementById('itemDescription').value = item.description;
    document.getElementById('itemLocation').value = item.location;
    document.getElementById('contactInfo').value = item.contact_info;
    document.getElementById('reportedDate').value = item.reported_date;
    document.getElementById('itemStatus').value = item.status;
    const itemImageInput = document.getElementById('itemImage');
    if (itemImageInput) {
        itemImageInput.value = '';
    }
    document.getElementById('saveLostFoundBtn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Report';
    toggleDetailsModal(false);
    toggleReportModal(true);
}

async function saveLostFound(event) {
    event.preventDefault();

    if (!CampusApp.ensureAuth('Please sign in to report items.')) {
        return;
    }

    const button = document.getElementById('saveLostFoundBtn');
    const formData = new FormData();
    formData.set('report_type', document.getElementById('reportType').value);
    formData.set('item_name', document.getElementById('itemName').value.trim());
    formData.set('description', document.getElementById('itemDescription').value.trim());
    formData.set('location', document.getElementById('itemLocation').value.trim());
    formData.set('contact_info', document.getElementById('contactInfo').value.trim());
    formData.set('reported_date', document.getElementById('reportedDate').value);
    formData.set('status', document.getElementById('itemStatus').value);

    const itemImage = document.getElementById('itemImage')?.files?.[0];
    if (itemImage) {
        formData.set('item_image', itemImage);
    }

    try {
        CampusApp.setButtonLoading(button, true, selectedItemId ? '<i class="fa-solid fa-floppy-disk"></i> Update Report' : '<i class="fa-solid fa-paper-plane"></i> Submit Report');
        if (selectedItemId) {
            formData.set('id', selectedItemId);
        }
        await CampusApp.upload(selectedItemId ? 'updateLostFound' : 'addLostFound', formData);
        CampusApp.showToast(selectedItemId ? 'Item updated.' : 'Item reported.', 'success');
        toggleReportModal(false);
        await loadLostFound();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    } finally {
        CampusApp.setButtonLoading(button, false, selectedItemId ? '<i class="fa-solid fa-floppy-disk"></i> Update Report' : '<i class="fa-solid fa-paper-plane"></i> Submit Report');
    }
}

async function deleteLostFound() {
    if (!selectedItemId || !CampusApp.ensureAuth('Please sign in to manage your reports.')) {
        return;
    }

    try {
        await CampusApp.api('deleteLostFound', { id: selectedItemId });
        CampusApp.showToast('Item deleted.', 'success');
        toggleDetailsModal(false);
        await loadLostFound();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openLostFoundModal')?.addEventListener('click', () => {
        if (!CampusApp.ensureAuth('Please sign in to report items.')) {
            return;
        }
        toggleReportModal(true);
    });
    document.getElementById('closeLostFoundModal')?.addEventListener('click', () => toggleReportModal(false));
    document.getElementById('closeItemDetailsModal')?.addEventListener('click', () => toggleDetailsModal(false));
    document.getElementById('reportItemModal')?.addEventListener('click', (event) => {
        if (event.target.id === 'reportItemModal') {
            toggleReportModal(false);
        }
    });
    document.getElementById('itemDetailsModal')?.addEventListener('click', (event) => {
        if (event.target.id === 'itemDetailsModal') {
            toggleDetailsModal(false);
        }
    });
    document.getElementById('lostFoundForm')?.addEventListener('submit', saveLostFound);
    document.getElementById('lostFoundSearch')?.addEventListener('input', filterLostFound);
    document.querySelectorAll('[data-lf-filter]').forEach((button) => {
        button.addEventListener('click', () => {
            lostFoundFilter = button.dataset.lfFilter;
            document.querySelectorAll('[data-lf-filter]').forEach((filterButton) => {
                filterButton.classList.remove('bg-indigo-600', 'text-white');
            });
            button.classList.add('bg-indigo-600', 'text-white');
            filterLostFound();
        });
    });
    document.getElementById('lostFoundGrid')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-item-details]');
        if (button) {
            openItemDetails(button.dataset.itemDetails);
        }
    });
    document.getElementById('editLostFoundBtn')?.addEventListener('click', () => fillLostFoundForm(selectedItemId));
    document.getElementById('deleteLostFoundBtn')?.addEventListener('click', deleteLostFound);

    loadLostFound();
});

window.addEventListener('pageshow', () => {
    loadLostFound();
});

