const timetableDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
let timetableEntries = [];

function getWeekDates(mode) {
    const today = new Date();
    const mondayOffset = (today.getDay() + 6) % 7;
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(today.getDate() - mondayOffset + (mode === 'next' ? 7 : 0));

    return timetableDays.map((day, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return { day, date, iso: date.toISOString().slice(0, 10) };
    });
}

function renderTimetableHead(weekDates, mode) {
    const head = document.getElementById('timetableHead');
    if (!head) {
        return;
    }

    const columns = mode === 'all'
        ? timetableDays.map((day) => `<th>${day}</th>`).join('')
        : weekDates.map(({ day, date }) => `
            <th>
                <div>${day}</div>
                <div class="text-xs font-normal text-slate-500">${CampusApp.formatDate(date.toISOString().slice(0, 10))}</div>
            </th>
        `).join('');

    head.innerHTML = `
        <tr>
            <th class="p-4 text-left">Time</th>
            ${columns}
        </tr>
    `;
}

function getActiveTimetableEntries(entries, weekDates, mode) {
    if (mode === 'all') {
        return entries;
    }

    const allowedDates = new Set(weekDates.map((item) => item.iso));
    return entries.filter((entry) => {
        if (entry.class_date) {
            return allowedDates.has(String(entry.class_date).slice(0, 10));
        }

        return true;
    });
}

function groupTimetable(entries) {
    return entries.reduce((accumulator, entry) => {
        const slot = `${entry.start_time}-${entry.end_time}`;
        if (!accumulator[slot]) {
            accumulator[slot] = {};
        }

        const classDate = entry.class_date ? String(entry.class_date).slice(0, 10) : null;
        accumulator[slot][classDate || entry.day_of_week] = entry;
        return accumulator;
    }, {});
}

function renderTimetable(entries) {
    const tableBody = document.getElementById('timetableBody');
    const summary = document.getElementById('courseSummary');
    const legend = document.getElementById('subjectLegend');
    const stats = document.getElementById('timetableStats');
    const mode = document.getElementById('timetableWeekSelect')?.value || 'current';
    const weekDates = getWeekDates(mode);
    const activeEntries = getActiveTimetableEntries(entries, weekDates, mode);

    renderTimetableHead(weekDates, mode);

    if (!activeEntries.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-12 text-center text-slate-500">
                    No timetable entries found for this week.
                </td>
            </tr>
        `;
        summary.innerHTML = '';
        legend.innerHTML = '';
        stats.innerHTML = `
            <p><strong>Total Classes:</strong> 0</p>
            <p><strong>Subjects:</strong> 0</p>
        `;
        return;
    }

    const grouped = groupTimetable(activeEntries);
    const slots = Object.keys(grouped).sort();
    const columns = mode === 'all'
        ? timetableDays.map((day) => ({ day, key: day }))
        : weekDates.map((item) => ({ day: item.day, key: item.iso }));

    tableBody.innerHTML = slots.map((slot) => {
        const [start, end] = slot.split('-');
        const cells = columns.map((column) => {
            const entry = grouped[slot][column.key] || grouped[slot][column.day];
            if (!entry) {
                return '<td class="px-2 py-4 text-slate-400">-</td>';
            }

            return `
                <td class="px-2 py-4">
                    <div class="rounded-xl bg-indigo-100 p-3 text-left text-indigo-700">
                        <p class="font-semibold">${CampusApp.escapeHtml(entry.subject)}</p>
                        <p class="text-xs">${CampusApp.escapeHtml(entry.teacher)}</p>
                        <p class="mt-2 text-xs">${CampusApp.escapeHtml(entry.room || 'Room TBA')}</p>
                    </div>
                </td>
            `;
        }).join('');

        return `
            <tr class="border-t border-slate-200">
                <td class="px-4 py-4 text-left font-medium">${CampusApp.formatTime(start)} - ${CampusApp.formatTime(end)}</td>
                ${cells}
            </tr>
        `;
    }).join('');

    const uniqueSubjects = [...new Set(activeEntries.map((entry) => entry.subject))];
    legend.innerHTML = uniqueSubjects.map((subject) => `
        <div class="rounded-xl bg-indigo-100 p-4">${CampusApp.escapeHtml(subject)}</div>
    `).join('');

    summary.innerHTML = uniqueSubjects.map((subject) => {
        const subjectEntries = activeEntries.filter((entry) => entry.subject === subject);
        return `
            <div class="flex justify-between rounded-xl border p-4">
                <div>
                    <h4 class="font-semibold">${CampusApp.escapeHtml(subject)}</h4>
                    <p class="text-sm text-slate-500">${CampusApp.escapeHtml(subjectEntries[0].teacher)}</p>
                </div>
                <span class="rounded-full bg-indigo-100 px-3 py-1 text-sm">${subjectEntries.length} classes</span>
            </div>
        `;
    }).join('');

    stats.innerHTML = `
        <p><strong>Total Classes:</strong> ${activeEntries.length}</p>
        <p><strong>Subjects:</strong> ${uniqueSubjects.length}</p>
    `;

    CampusApp.lockAuthActions();
}

async function loadTimetable() {
    const gate = document.getElementById('timetableGate');

    if (!CampusApp.isAuthenticated()) {
        timetableEntries = [];
        CampusApp.renderAuthPrompt(gate, 'Sign in to view the timetable shared by your admin.');
        renderTimetable([]);
        return;
    }

    gate.innerHTML = '';

    try {
        const response = await CampusApp.api('getTimetable');
        timetableEntries = response.entries || [];
        renderTimetable(timetableEntries);
    } catch (error) {
        timetableEntries = [];
        renderTimetable([]);

        if (/authentication required|session expired|sign in/i.test(error.message)) {
            CampusApp.renderAuthPrompt(gate, error.message);
            return;
        }

        CampusApp.renderErrorPrompt(gate, 'Unable to load timetable', error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const adminNotice = document.getElementById('timetableAdminNotice');
    if (adminNotice) {
        adminNotice.textContent = 'Timetable updates are managed by the admin panel.';
    }

    document.getElementById('timetableWeekSelect')?.addEventListener('change', () => renderTimetable(timetableEntries));
    loadTimetable();
});

window.addEventListener('pageshow', () => {
    loadTimetable();
});
