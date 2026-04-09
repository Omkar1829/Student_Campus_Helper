function populateProfile(user, stats) {
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userInfo').innerHTML = `
        <i class="fa-solid fa-envelope"></i> ${user.email}
        <span class="mx-2">|</span>
        <i class="fa-solid fa-book-open-reader"></i> ${user.course}
        <span class="mx-2">|</span>
        <i class="fa-solid fa-layer-group"></i> ${user.semester}
    `;
    document.getElementById('userEmail').innerHTML = `<i class="fa-solid fa-envelope"></i> ${user.email}`;
    document.getElementById('userBranch').textContent = `Major: ${user.course}`;
    document.getElementById('userSemester').textContent = `Semester: ${user.semester}`;
    document.getElementById('userJoinDate').textContent = `Member Since: ${CampusApp.formatDate(user.created_at)}`;
    document.getElementById('editName').value = user.name;
    document.getElementById('editEmail').value = user.email;
    document.getElementById('editCourse').value = user.course;
    document.getElementById('editSemester').value = user.semester;

    document.getElementById('notesCount').textContent = stats.notes_count ?? 0;
    document.getElementById('timetableCount').textContent = stats.timetable_count ?? 0;
    document.getElementById('eventsCount').textContent = stats.upcoming_events ?? 0;
    document.getElementById('itemsCount').textContent = stats.items_reported ?? 0;
}

function toggleEditForm(forceState) {
    const form = document.getElementById('editProfilePanel');
    const willShow = typeof forceState === 'boolean' ? forceState : form.classList.contains('hidden');
    form.classList.toggle('hidden', !willShow);
}

async function loadProfile() {
    const content = document.getElementById('profileContent');
    const gate = document.getElementById('profileGate');

    if (!CampusApp.isAuthenticated()) {
        content.classList.add('hidden');
        CampusApp.renderAuthPrompt(gate, 'Your profile data stays protected. Sign in to view and manage it.');
        return;
    }

    gate.innerHTML = '';
    content.classList.remove('hidden');

    try {
        const response = await CampusApp.api('getUser');
        populateProfile(response.user, response.stats || {});
        CampusApp.saveSession(CampusApp.getToken(), response.user);
        CampusApp.updateNavbarState();
    } catch (error) {
        CampusApp.renderAuthPrompt(gate, error.message);
        content.classList.add('hidden');
    }
}

async function updateProfile(event) {
    event.preventDefault();

    if (!CampusApp.ensureAuth('Please sign in again to update your profile.')) {
        return;
    }

    const button = document.getElementById('saveProfileBtn');
    const payload = {
        name: document.getElementById('editName').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        course: document.getElementById('editCourse').value.trim(),
        semester: document.getElementById('editSemester').value.trim()
    };

    try {
        CampusApp.setButtonLoading(button, true, '<i class="fa-solid fa-floppy-disk"></i> Save Changes');
        const response = await CampusApp.api('updateUser', payload);
        CampusApp.saveSession(CampusApp.getToken(), response.user);
        CampusApp.updateNavbarState();
        populateProfile(response.user, {
            notes_count: document.getElementById('notesCount').textContent,
            timetable_count: document.getElementById('timetableCount').textContent,
            upcoming_events: document.getElementById('eventsCount').textContent,
            items_reported: document.getElementById('itemsCount').textContent
        });
        document.getElementById('profileStatus').textContent = 'Profile updated successfully.';
        toggleEditForm(false);
        CampusApp.showToast('Profile updated.', 'success');
    } catch (error) {
        document.getElementById('profileStatus').textContent = error.message;
    } finally {
        CampusApp.setButtonLoading(button, false, '<i class="fa-solid fa-floppy-disk"></i> Save Changes');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('editProfileBtn')?.addEventListener('click', () => toggleEditForm());
    document.getElementById('cancelEditBtn')?.addEventListener('click', () => toggleEditForm(false));
    document.getElementById('editProfileForm')?.addEventListener('submit', updateProfile);
    loadProfile();
});

