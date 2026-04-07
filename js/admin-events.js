let adminEvents = [];

function splitEvents(events) {
    return {
        announcements: events.filter((event) => String(event.type || '').toLowerCase() === 'announcement'),
        important: events.filter((event) => ['important', 'imp', 'exam', 'placement'].includes(String(event.type || '').toLowerCase())),
        others: events.filter((event) => !['announcement', 'important', 'imp', 'exam', 'placement'].includes(String(event.type || '').toLowerCase()))
    };
}

function eventCard(event) {
    return `
        <article class="rounded-2xl border bg-white p-5 shadow-sm">
            <h3 class="font-semibold">${CampusApp.escapeHtml(event.title)}</h3>
            <p class="mt-2 text-sm text-slate-600">${CampusApp.escapeHtml(event.description)}</p>
            <p class="mt-3 text-sm text-slate-500">${CampusApp.formatDate(event.event_date)}${event.event_time ? ` | ${CampusApp.formatTime(String(event.event_time).slice(0, 5))}` : ''}</p>
            <p class="mt-1 text-sm text-slate-500">${CampusApp.escapeHtml(event.location || 'Location TBA')}${event.type ? ` | ${CampusApp.escapeHtml(event.type)}` : ''}</p>
            <div class="mt-4 space-x-3">
                <button class="font-medium text-indigo-600" data-admin-event-edit="${event.id}">Edit</button>
                <button class="font-medium text-red-500" data-admin-event-delete="${event.id}">Delete</button>
            </div>
        </article>
    `;
}

function renderAdminEvents(events) {
    const groups = splitEvents(events);
    document.getElementById('adminAnnouncementBoard').innerHTML = groups.announcements.map((event) => `
        <div class="note">
            <div class="pin"></div>
            <h3 class="font-semibold">${CampusApp.escapeHtml(event.title)}</h3>
            <p class="mt-1 text-sm">${CampusApp.escapeHtml(event.description)}</p>
            <p class="mt-2 text-xs text-slate-600">Valid till: ${CampusApp.formatDate(event.event_date)}</p>
            <div class="mt-3 space-x-3 text-right">
                <button class="font-medium text-indigo-600" data-admin-event-edit="${event.id}">Edit</button>
                <button class="font-medium text-red-500" data-admin-event-delete="${event.id}">Delete</button>
            </div>
        </div>
    `).join('') || '<p class="text-sm text-white/80">No announcements available.</p>';

    document.getElementById('adminImportantEvents').innerHTML = groups.important.map(eventCard).join('') || '<p class="text-sm text-slate-500">No important events.</p>';
    document.getElementById('adminOtherEvents').innerHTML = groups.others.map(eventCard).join('') || '<p class="text-sm text-slate-500">No other events.</p>';
}

function filterAdminEvents() {
    const query = document.getElementById('adminEventsSearch').value.trim().toLowerCase();
    const filtered = adminEvents.filter((event) =>
        [event.title, event.description, event.location, event.type].some((value) =>
            String(value || '').toLowerCase().includes(query)
        )
    );

    renderAdminEvents(filtered);
}

async function loadAdminEvents() {
    try {
        const response = await CampusApp.api('adminGetEvents');
        adminEvents = response.events || [];
        filterAdminEvents();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

function toggleAdminEventModal(forceState) {
    const modal = document.getElementById('adminEventModal');
    const willShow = typeof forceState === 'boolean' ? forceState : modal.classList.contains('hidden');
    modal.classList.toggle('hidden', !willShow);

    if (!willShow) {
        modal.dataset.editId = '';
        document.getElementById('adminEventForm').reset();
        document.getElementById('adminEventModalTitle').textContent = 'Add Event';
    }
}

function openEditAdminEvent(eventId) {
    const event = adminEvents.find((item) => Number(item.id) === Number(eventId));
    if (!event) {
        return;
    }

    document.getElementById('adminEventModal').dataset.editId = event.id;
    document.getElementById('adminEventTitle').value = event.title;
    document.getElementById('adminEventDescription').value = event.description;
    document.getElementById('adminEventDate').value = String(event.event_date).slice(0, 10);
    document.getElementById('adminEventTime').value = event.event_time ? String(event.event_time).slice(0, 5) : '';
    document.getElementById('adminEventLocation').value = event.location || '';
    document.getElementById('adminEventType').value = event.type || 'General';
    document.getElementById('adminEventModalTitle').textContent = 'Edit Event';
    toggleAdminEventModal(true);
}

async function saveAdminEvent(event) {
    event.preventDefault();

    const modal = document.getElementById('adminEventModal');
    const editId = Number(modal.dataset.editId || 0);
    const button = document.getElementById('saveAdminEventBtn');
    const payload = {
        title: document.getElementById('adminEventTitle').value.trim(),
        description: document.getElementById('adminEventDescription').value.trim(),
        event_date: document.getElementById('adminEventDate').value,
        event_time: document.getElementById('adminEventTime').value,
        location: document.getElementById('adminEventLocation').value.trim(),
        type: document.getElementById('adminEventType').value.trim(),
        category: document.getElementById('adminEventType').value.trim()
    };

    try {
        CampusApp.setButtonLoading(button, true, editId ? 'Update Event' : 'Create Event');
        await CampusApp.api(editId ? 'adminUpdateEvent' : 'addEvent', {
            ...payload,
            ...(editId ? { id: editId } : {})
        });
        CampusApp.showToast(editId ? 'Event updated.' : 'Event created.', 'success');
        toggleAdminEventModal(false);
        await loadAdminEvents();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    } finally {
        CampusApp.setButtonLoading(button, false, editId ? 'Update Event' : 'Create Event');
    }
}

async function deleteAdminEvent(eventId) {
    try {
        await CampusApp.api('adminDeleteEvent', { id: eventId });
        CampusApp.showToast('Event deleted.', 'success');
        await loadAdminEvents();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openAdminEventModal')?.addEventListener('click', () => toggleAdminEventModal(true));
    document.getElementById('closeAdminEventModal')?.addEventListener('click', () => toggleAdminEventModal(false));
    document.getElementById('adminEventModal')?.addEventListener('click', (event) => {
        if (event.target.id === 'adminEventModal') {
            toggleAdminEventModal(false);
        }
    });
    document.getElementById('adminEventForm')?.addEventListener('submit', saveAdminEvent);
    document.getElementById('adminEventsSearch')?.addEventListener('input', filterAdminEvents);
    document.getElementById('adminEventsRoot')?.addEventListener('click', (event) => {
        const editButton = event.target.closest('[data-admin-event-edit]');
        const deleteButton = event.target.closest('[data-admin-event-delete]');

        if (editButton) {
            openEditAdminEvent(editButton.dataset.adminEventEdit);
        }

        if (deleteButton) {
            deleteAdminEvent(deleteButton.dataset.adminEventDelete);
        }
    });

    loadAdminEvents();
});

window.addEventListener('pageshow', () => {
    loadAdminEvents();
});

