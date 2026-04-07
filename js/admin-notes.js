let adminNotes = [];

function filterAdminNotes() {
    const query = document.getElementById('adminNotesSearch').value.trim().toLowerCase();
    const filtered = adminNotes.filter((note) =>
        [note.title, note.description, note.file_path, note.owner_name, note.owner_email].some((value) =>
            String(value || '').toLowerCase().includes(query)
        )
    );

    renderAdminNotes(filtered);
}

function renderAdminNotes(notes) {
    const grid = document.getElementById('adminNotesGrid');
    grid.innerHTML = notes.map((note) => `
        <article class="rounded-2xl border bg-white p-5 shadow-sm">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h3 class="font-semibold">${CampusApp.escapeHtml(note.title)}</h3>
                    <p class="text-sm text-slate-500">${CampusApp.escapeHtml(note.owner_name || 'Unknown user')}${note.owner_email ? ` | ${CampusApp.escapeHtml(note.owner_email)}` : ''}</p>
                </div>
                <div class="space-x-3">
                    <button class="font-medium text-indigo-600" data-admin-note-edit="${note.id}">Edit</button>
                    <button class="font-medium text-red-500" data-admin-note-delete="${note.id}">Delete</button>
                </div>
            </div>
            <p class="mt-4 text-sm text-slate-600">${CampusApp.escapeHtml(note.description)}</p>
            <div class="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>${note.file_path ? `<a class="text-indigo-600 hover:underline" href="${CampusApp.route(note.file_path)}" target="_blank" rel="noopener noreferrer">Open attachment</a>` : 'No file'} | ${note.downloads || 0} downloads</span>
                <span>${CampusApp.formatDate(note.created_at)}</span>
            </div>
        </article>
    `).join('') || '<div class="rounded-2xl border bg-white p-8 text-center text-slate-500 shadow-sm">No notes found.</div>';
}

async function loadAdminNotes() {
    try {
        const notesResponse = await CampusApp.api('adminGetNotes');

        adminNotes = notesResponse.notes || [];
        filterAdminNotes();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

function toggleAdminNoteModal(forceState) {
    const modal = document.getElementById('adminNoteModal');
    const willShow = typeof forceState === 'boolean' ? forceState : modal.classList.contains('hidden');
    modal.classList.toggle('hidden', !willShow);

    if (!willShow) {
        modal.dataset.editId = '';
        document.getElementById('adminNoteForm').reset();
        document.getElementById('adminNoteModalTitle').textContent = 'Add Note';
    }
}

function openEditAdminNote(noteId) {
    const note = adminNotes.find((item) => Number(item.id) === Number(noteId));
    if (!note) {
        return;
    }

    document.getElementById('adminNoteModal').dataset.editId = note.id;
    document.getElementById('adminNoteTitle').value = note.title;
    document.getElementById('adminNoteDescription').value = note.description;
    document.getElementById('adminNotePath').value = note.file_path || '';
    document.getElementById('adminNoteFile').value = '';
    document.getElementById('adminNoteDownloads').value = note.downloads || 0;
    document.getElementById('adminNoteModalTitle').textContent = 'Edit Note';
    toggleAdminNoteModal(true);
}

async function saveAdminNote(event) {
    event.preventDefault();

    const modal = document.getElementById('adminNoteModal');
    const editId = Number(modal.dataset.editId || 0);
    const button = document.getElementById('saveAdminNoteBtn');
    const formData = new FormData();
    const currentUser = CampusApp.getUser();
    const existingNote = adminNotes.find((note) => Number(note.id) === editId);
    formData.set('user_id', editId ? existingNote?.user_id : currentUser?.id);
    formData.set('title', document.getElementById('adminNoteTitle').value.trim());
    formData.set('description', document.getElementById('adminNoteDescription').value.trim());
    formData.set('file_path', document.getElementById('adminNotePath').value.trim());
    formData.set('downloads', Number(document.getElementById('adminNoteDownloads').value || 0));

    const noteFile = document.getElementById('adminNoteFile')?.files?.[0];
    if (noteFile) {
        formData.set('note_file', noteFile);
    }

    try {
        CampusApp.setButtonLoading(button, true, editId ? 'Update Note' : 'Create Note');
        if (editId) {
            formData.set('id', editId);
        }
        await CampusApp.upload(editId ? 'adminUpdateNote' : 'adminCreateNote', formData);
        CampusApp.showToast(editId ? 'Note updated.' : 'Note created.', 'success');
        toggleAdminNoteModal(false);
        await loadAdminNotes();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    } finally {
        CampusApp.setButtonLoading(button, false, editId ? 'Update Note' : 'Create Note');
    }
}

async function deleteAdminNote(noteId) {
    try {
        await CampusApp.api('adminDeleteNote', { id: noteId });
        CampusApp.showToast('Note deleted.', 'success');
        await loadAdminNotes();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openAdminNoteModal')?.addEventListener('click', () => toggleAdminNoteModal(true));
    document.getElementById('closeAdminNoteModal')?.addEventListener('click', () => toggleAdminNoteModal(false));
    document.getElementById('adminNoteModal')?.addEventListener('click', (event) => {
        if (event.target.id === 'adminNoteModal') {
            toggleAdminNoteModal(false);
        }
    });
    document.getElementById('adminNoteForm')?.addEventListener('submit', saveAdminNote);
    document.getElementById('adminNotesSearch')?.addEventListener('input', filterAdminNotes);
    document.getElementById('adminNotesGrid')?.addEventListener('click', (event) => {
        const editButton = event.target.closest('[data-admin-note-edit]');
        const deleteButton = event.target.closest('[data-admin-note-delete]');

        if (editButton) {
            openEditAdminNote(editButton.dataset.adminNoteEdit);
        }

        if (deleteButton) {
            deleteAdminNote(deleteButton.dataset.adminNoteDelete);
        }
    });

    loadAdminNotes();
});

window.addEventListener('pageshow', () => {
    loadAdminNotes();
});

