async function loadAdminDashboard() {
    try {
        const response = await CampusApp.api('adminGetDashboard');
        const summary = response.summary || {};

        document.getElementById('statStudents').textContent = summary.students ?? 0;
        document.getElementById('statNotes').textContent = summary.notes ?? 0;
        document.getElementById('statEvents').textContent = summary.events ?? 0;
        document.getElementById('statLostFound').textContent = summary.lost_found ?? 0;
        document.getElementById('statLogins').textContent = summary.login_logs ?? 0;
        document.getElementById('statActivities').textContent = summary.activity_logs ?? 0;

        document.getElementById('recentEvents').innerHTML = (response.recent_events || []).map((event) => `
            <li class="flex items-center justify-between rounded-xl border p-3">
                <span class="font-medium">${event.title}</span>
                <span class="text-xs text-slate-500">${CampusApp.formatDate(event.event_date)}</span>
            </li>
        `).join('') || '<li class="text-sm text-slate-500">No recent events.</li>';

        document.getElementById('recentNotes').innerHTML = (response.recent_notes || []).map((note) => `
            <li class="flex items-center justify-between rounded-xl border p-3">
                <div>
                    <p class="font-medium">${note.title}</p>
                    <p class="text-xs text-slate-500">${note.owner_name || 'Unknown user'}</p>
                </div>
                <span class="text-xs text-slate-500">${CampusApp.formatDate(note.created_at)}</span>
            </li>
        `).join('') || '<li class="text-sm text-slate-500">No recent notes.</li>';

        document.getElementById('recentLogs').innerHTML = (response.recent_logs || []).map((log) => `
            <li class="rounded-xl border p-3">
                <div class="flex items-center justify-between gap-4">
                    <p class="font-medium">${log.action}</p>
                    <span class="text-xs text-slate-500">${CampusApp.formatDate(log.created_at, { hour: 'numeric', minute: '2-digit' })}</span>
                </div>
                <p class="mt-1 text-sm text-slate-600">${log.name || 'System'}${log.details ? ` | ${log.details}` : ''}</p>
            </li>
        `).join('') || '<li class="text-sm text-slate-500">No recent logs.</li>';
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', loadAdminDashboard);

window.addEventListener('pageshow', () => {
    loadAdminDashboard();
});

