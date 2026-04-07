const noteColors = [
    'bg-yellow-100 border-yellow-200',
    'bg-blue-100 border-blue-200',
    'bg-green-100 border-green-200'
];

let notesState = [];

function renderNotes(notes) {
    const grid = document.getElementById('notesGrid');
    const count = document.getElementById('notesCountLabel');
    const shown = document.getElementById('notesShownLabel');

    count.textContent = `${notesState.length} notes`;
    shown.textContent = `${notes.length} shown`;

    if (!notes.length) {
        grid.innerHTML = `
            <div class="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <h3 class="text-lg font-semibold text-slate-900">No notes yet</h3>
                <p class="mt-2 text-sm text-slate-600">Create your first note to start building your study library.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = notes.map((note, index) => {
        const canDelete = Boolean(note.can_delete);

        return `
        <article class="rounded-2xl border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${noteColors[index % noteColors.length]}">
            <div class="flex items-start justify-between gap-4">
                <div class="flex gap-3">
                    <div class="rounded-xl bg-indigo-200 p-3 text-indigo-700">
                        <i class="fa-solid fa-file-lines"></i>
                    </div>
                    <div>
                        <h3 class="font-semibold text-slate-900">${CampusApp.escapeHtml(note.title)}</h3>
                        <p class="text-sm text-slate-600">${note.owner_name ? `Uploaded by ${CampusApp.escapeHtml(note.owner_name)}` : 'Campus note'}</p>
                    </div>
                </div>
                ${canDelete ? `
                    <button class="text-slate-500 transition hover:text-red-500" data-note-delete="${note.id}" data-auth-required title="Delete your note">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                ` : ''}
            </div>
            <hr class="my-4 border-white/60">
            <p class="line-clamp-4 text-sm text-slate-700">${CampusApp.escapeHtml(note.description || '')}</p>
            <div class="mt-4 flex items-center justify-between text-sm text-slate-600">
                <span>${note.downloads || 0} downloads${note.file_path ? ' | Attachment available' : ''}</span>
                <span>${CampusApp.formatDate(note.created_at)}</span>
            </div>
            ${note.file_path ? `
                <button class="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700" data-note-download="${note.id}">
                    <i class="fa-solid fa-download mr-2"></i> Download
                </button>
            ` : ''}
        </article>
    `;
    }).join('');

    CampusApp.lockAuthActions();
}

function filterNotes() {
    const query = document.getElementById('notesSearch').value.trim().toLowerCase();
    const filtered = notesState.filter((note) => {
        return [note.title, note.description, note.file_path].some((value) =>
            String(value).toLowerCase().includes(query)
        );
    });

    renderNotes(filtered);
}

async function loadNotes() {
    const gate = document.getElementById('notesGate');

    if (!CampusApp.isAuthenticated()) {
        notesState = [];
        CampusApp.renderAuthPrompt(gate, 'Sign in to upload and download shared campus notes.');
        renderNotes([]);
        return;
    }

    gate.innerHTML = '';

    try {
        const response = await CampusApp.api('getNotes');
        notesState = response.notes || [];
        filterNotes();
    } catch (error) {
        if (/authentication required|session expired|sign in/i.test(error.message)) {
            CampusApp.renderAuthPrompt(gate, error.message);
            return;
        }

        CampusApp.renderErrorPrompt(gate, 'Unable to load notes', error.message);
    }
}

function toggleNoteModal(forceState) {
    const modal = document.getElementById('noteModal');
    const willShow = typeof forceState === 'boolean' ? forceState : modal.classList.contains('hidden');
    modal.classList.toggle('hidden', !willShow);

    if (!willShow) {
        document.getElementById('noteForm').reset();
    }
}

async function saveNote(event) {
    event.preventDefault();

    if (!CampusApp.ensureAuth('Please sign in to add notes.')) {
        return;
    }

    const button = document.getElementById('saveNoteBtn');
    const formData = new FormData();
    formData.set('title', document.getElementById('noteTitle').value.trim());
    formData.set('description', document.getElementById('noteDescription').value.trim());

    const noteFile = document.getElementById('noteFile')?.files?.[0];
    if (noteFile) {
        formData.set('note_file', noteFile);
    }

    try {
        CampusApp.setButtonLoading(button, true, '<i class="fa-solid fa-plus"></i> Save Note');
        await CampusApp.upload('addNote', formData);
        CampusApp.showToast('Note added successfully.', 'success');
        toggleNoteModal(false);
        await loadNotes();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    } finally {
        CampusApp.setButtonLoading(button, false, '<i class="fa-solid fa-plus"></i> Save Note');
    }
}

async function deleteNote(noteId) {
    if (!CampusApp.ensureAuth('Please sign in to delete notes.')) {
        return;
    }

    try {
        await CampusApp.api('deleteNote', { id: noteId });
        CampusApp.showToast('Note deleted.', 'success');
        await loadNotes();
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

async function downloadNote(noteId) {
    if (!CampusApp.ensureAuth('Please sign in to download notes.')) {
        return;
    }

    try {
        const response = await CampusApp.api('downloadNote', { id: noteId });
        await loadNotes();
        window.open(CampusApp.route(response.file_path), '_blank', 'noopener,noreferrer');
    } catch (error) {
        CampusApp.showToast(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openNoteModal')?.addEventListener('click', () => {
        if (!CampusApp.ensureAuth('Please sign in to add notes.')) {
            return;
        }
        toggleNoteModal(true);
    });
    document.getElementById('closeNoteModal')?.addEventListener('click', () => toggleNoteModal(false));
    document.getElementById('noteModal')?.addEventListener('click', (event) => {
        if (event.target.id === 'noteModal') {
            toggleNoteModal(false);
        }
    });
    document.getElementById('noteForm')?.addEventListener('submit', saveNote);
    document.getElementById('notesSearch')?.addEventListener('input', filterNotes);
    document.getElementById('notesGrid')?.addEventListener('click', (event) => {
        const deleteButton = event.target.closest('[data-note-delete]');
        const downloadButton = event.target.closest('[data-note-download]');

        if (deleteButton) {
            deleteNote(deleteButton.dataset.noteDelete);
        }

        if (downloadButton) {
            downloadNote(downloadButton.dataset.noteDownload);
        }
    });

    loadNotes();
});

window.addEventListener('pageshow', () => {
    loadNotes();
});

