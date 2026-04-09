function renderLoginLogs(logs) {
    document.getElementById('adminLoginLogs').innerHTML = logs.map((log) => `
        <tr class="border-t">
            <td class="p-4">${log.name || 'Unknown user'}</td>
            <td>${log.email || '-'}</td>
            <td>${log.ip_address || '-'}</td>
            <td>${CampusApp.formatDate(log.login_time, { hour: 'numeric', minute: '2-digit' })}</td>
            <td><button class="font-medium text-red-500" data-login-log-delete="${log.id}">Delete</button></td>
        </tr>
    `).join('') || '<tr><td colspan="5" class="p-6 text-center text-slate-500">No login logs available.</td></tr>';
}

function renderActivityLogs(logs) {
    document.getElementById('adminActivityLogs').innerHTML = logs.map((log) => `
        <tr class="border-t">
            <td class="p-4">${log.name || 'Unknown user'}</td>
            <td>${log.action}</td>
            <td>${log.details || '-'}</td>
            <td>${CampusApp.formatDate(log.created_at, { hour: 'numeric', minute: '2-digit' })}</td>
            <td><button class="font-medium text-red-500" data-activity-log-delete="${log.id}">Delete</button></td>
        </tr>
    `).join('') || '<tr><td colspan="5" class="p-6 text-center text-slate-500">No activity logs available.</td></tr>';
}

async function loadAdminLogs() {
    try {
        const response = await CampusApp.api('adminGetLogs');
        renderLoginLogs(response.login_logs || []);
        renderActivityLogs(response.activity_logs || []);
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

async function deleteLoginLog(logId) {
    try {
        await CampusApp.api('adminDeleteLoginLog', { id: logId });
        CampusApp.showToast('Login log deleted.', 'success');
        await loadAdminLogs();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

async function deleteActivityLog(logId) {
    try {
        await CampusApp.api('adminDeleteActivityLog', { id: logId });
        CampusApp.showToast('Activity log deleted.', 'success');
        await loadAdminLogs();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adminLoginLogs')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-login-log-delete]');
        if (button) {
            deleteLoginLog(button.dataset.loginLogDelete);
        }
    });

    document.getElementById('adminActivityLogs')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-activity-log-delete]');
        if (button) {
            deleteActivityLog(button.dataset.activityLogDelete);
        }
    });

    loadAdminLogs();
});

window.addEventListener('pageshow', () => {
    loadAdminLogs();
});

