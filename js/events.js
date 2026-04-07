let eventsState = [];

const demoEvents = [
    {
        id: 'demo-event-1',
        title: 'Sample Campus Notice',
        description: 'Demo announcement for visitors. Sign in to view real campus notices.',
        event_date: '2026-04-08',
        event_time: '10:00:00',
        location: 'Notice Board',
        type: 'announcement'
    },
    {
        id: 'demo-event-2',
        title: 'Sample Important Seminar',
        description: 'Demo important event. Real event details are available after login.',
        event_date: '2026-04-09',
        event_time: '14:30:00',
        location: 'Auditorium',
        type: 'important'
    },
    {
        id: 'demo-event-3',
        title: 'Sample Club Meetup',
        description: 'Demo general event for public preview only.',
        event_date: '2026-04-11',
        event_time: '16:00:00',
        location: 'Student Activity Center',
        type: 'general'
    }
];

function isImportantEvent(event) {
    return ['important', 'imp', 'exam', 'placement'].includes(String(event.type || '').toLowerCase());
}

function isAnnouncementEvent(event) {
    return String(event.type || '').toLowerCase() === 'announcement';
}

function formatEventTime(value) {
    if (!value) {
        return '';
    }

    return CampusApp.formatTime(String(value).slice(0, 5));
}

function renderEvents(events) {
    const announcements = document.getElementById('announcementsGrid');
    const important = document.getElementById('importantEventsGrid');
    const other = document.getElementById('otherEventsGrid');
    const totalLabel = document.getElementById('eventsTotalLabel');
    const importantLabel = document.getElementById('eventsImportantLabel');

    if (!announcements || !important || !other || !totalLabel || !importantLabel) {
        return;
    }

    totalLabel.textContent = `${events.length} events total`;
    importantLabel.textContent = `${events.filter((item) => isImportantEvent(item)).length} important`;

    const announcementEvents = events.filter((item) => isAnnouncementEvent(item));
    const importantEvents = events.filter((item) => isImportantEvent(item));
    const otherEvents = events.filter((item) => !isAnnouncementEvent(item) && !isImportantEvent(item));

    announcements.innerHTML = announcementEvents.length ? announcementEvents.map((event) => `
        <div class="note">
            <div class="pin"></div>
            <h3 class="font-semibold">${CampusApp.escapeHtml(event.title)}</h3>
            <p class="mt-1 text-sm">${CampusApp.escapeHtml(event.description)}</p>
            <p class="mt-2 text-xs text-slate-600">Notice date: ${CampusApp.formatDate(event.event_date)}</p>
        </div>
    `).join('') : '<p class="text-sm text-white/80">No active notices right now.</p>';

    important.innerHTML = importantEvents.length ? importantEvents.map((event) => `
        <article class="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
            <h3 class="font-semibold text-slate-900">${CampusApp.escapeHtml(event.title)}</h3>
            <p class="text-sm text-slate-600">${CampusApp.escapeHtml(event.description)}</p>
            <p class="mt-3 text-sm"><i class="fa-regular fa-calendar"></i> ${CampusApp.formatDate(event.event_date)}${event.event_time ? ` • ${formatEventTime(event.event_time)}` : ''}</p>
            <p class="mt-1 text-sm text-slate-500">${CampusApp.escapeHtml(event.location || 'Location TBA')}${event.type ? ` | ${CampusApp.escapeHtml(event.type)}` : ''}</p>
        </article>
    `).join('') : '<p class="text-sm text-slate-500">No highlighted events available.</p>';

    other.innerHTML = otherEvents.length ? otherEvents.map((event) => `
        <article class="rounded-2xl border p-5 transition hover:-translate-y-1 hover:shadow-lg">
            <h3 class="font-semibold text-slate-900">${CampusApp.escapeHtml(event.title)}</h3>
            <p class="mt-2 text-sm text-slate-500">${CampusApp.formatDate(event.event_date)}${event.event_time ? ` • ${formatEventTime(event.event_time)}` : ''}</p>
            <p class="mt-2 text-sm text-slate-600">${CampusApp.escapeHtml(event.description)}</p>
        </article>
    `).join('') : '<p class="text-sm text-slate-500">No additional events available.</p>';
}

function filterEvents() {
    const search = document.getElementById('eventsSearch');
    const importantButton = document.getElementById('importantOnlyBtn');
    const query = search ? search.value.trim().toLowerCase() : '';
    const importantOnly = importantButton ? importantButton.dataset.active === 'true' : false;
    const filtered = eventsState.filter((event) => {
        const matchesQuery = [event.title, event.description, event.category, event.type, event.location].some((value) =>
            String(value || '').toLowerCase().includes(query)
        );
        const matchesImportant = importantOnly ? isImportantEvent(event) : true;
        return matchesQuery && matchesImportant;
    });

    renderEvents(filtered);
}

function renderHomeEvents() {
    const homeGrid = document.getElementById('homeEventsGrid');
    if (!homeGrid) {
        return;
    }

    const upcoming = eventsState.slice(0, 3);
    homeGrid.innerHTML = upcoming.map((event) => `
        <article class="rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <p class="text-sm font-semibold text-indigo-600">${CampusApp.formatDate(event.event_date)}</p>
            <h3 class="mt-2 text-xl font-semibold text-slate-900">${CampusApp.escapeHtml(event.title)}</h3>
            <p class="mt-2 text-sm text-slate-600">${CampusApp.escapeHtml(event.description)}</p>
        </article>
    `).join('');
}

async function loadEvents() {
    if (!CampusApp.isAuthenticated()) {
        eventsState = demoEvents;
        filterEvents();
        renderHomeEvents();
        return;
    }

    try {
        const response = await CampusApp.api('getEvents', {}, { logoutOnUnauthorized: false });
        eventsState = response.events || [];
        filterEvents();
        renderHomeEvents();
    } catch (error) {
        const fallbackTargets = ['announcementsGrid', 'importantEventsGrid', 'otherEventsGrid', 'homeEventsGrid'];
        fallbackTargets.forEach((targetId) => {
            const element = document.getElementById(targetId);
            if (element) {
                element.innerHTML = `<p class="text-sm text-slate-500">${error.message}</p>`;
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('eventsSearch')?.addEventListener('input', filterEvents);
    document.getElementById('importantOnlyBtn')?.addEventListener('click', (event) => {
        const button = event.currentTarget;
        const active = button.dataset.active === 'true';
        button.dataset.active = String(!active);
        button.classList.toggle('bg-indigo-600', !active);
        button.classList.toggle('text-white', !active);
        filterEvents();
    });

    loadEvents();
});

window.addEventListener('pageshow', () => {
    loadEvents();
});

