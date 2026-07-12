/**
 * Notes Section — JavaScript
 * Features:
 *  - Create notes WITHOUT admin login (local drafts + GitHub publish)
 *  - Private notes: AES-GCM encrypted before GitHub storage (safe in public repo)
 *  - Public notes: plain text on GitHub
 *  - Local draft notes: stored in browser localStorage only
 *  - Markdown rendering via marked.js
 */
'use strict';

// ── Constants ─────────────────────────────────────────────────────
const ADMIN_HASH      = '4d418171aaf4f34bc0213ff57935c26219e5fccfe39086d20bf21b3757cb3ee4';
const SESSION_KEY     = 'rk_notes_admin';
const PWD_SESSION_KEY = 'rk_notes_pwd';   // stores actual pwd in session for decryption
const LOCAL_NOTES_KEY = 'rk_local_notes'; // localStorage key for local drafts
const TOKEN_KEY       = 'rk_gh_token';
const USER_KEY        = 'rk_gh_user';
const REPO_KEY        = 'rk_gh_repo';
const NOTES_INDEX_URL = '../data/notes/index.json';

// ── State ──────────────────────────────────────────────────────────
let githubNotes  = [];   // notes from GitHub
let localNotes   = [];   // notes from localStorage
let isAdmin      = false;
let adminPwd     = null; // actual password, held in memory for encryption
let currentNote  = null; // currently open note {id, source:'github'|'local'}
let editingNoteId = null;

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Restore admin session
  if (sessionStorage.getItem(SESSION_KEY)) {
    isAdmin  = true;
    adminPwd = sessionStorage.getItem(PWD_SESSION_KEY);
  }

  localNotes = loadLocalNotes();
  updateAdminUI();
  await loadGithubNotes();
  renderAll();
  checkUrlHash();
});

window.addEventListener('hashchange', checkUrlHash);

function checkUrlHash() {
  const hash = location.hash.slice(1); // e.g. "local-123" or "note-abc"
  if (hash) openNote(hash);
}

// ── Local Notes Storage ───────────────────────────────────────────
function loadLocalNotes() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_NOTES_KEY) || '[]');
  } catch { return []; }
}

function saveLocalNotes() {
  localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(localNotes));
}

// ── GitHub API ─────────────────────────────────────────────────────
function ghConfig() {
  return {
    token: localStorage.getItem(TOKEN_KEY),
    user:  localStorage.getItem(USER_KEY)  || 'rajatkoorse',
    repo:  localStorage.getItem(REPO_KEY)  || 'rajatkoorse.github.io',
  };
}

async function ghGet(path) {
  const { token, user, repo } = ghConfig();
  if (!token) throw new Error('No GitHub token configured');
  const r = await fetch(`https://api.github.com/repos/${user}/${repo}/contents/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return r.json();
}

async function ghPut(path, content, message) {
  const { token, user, repo } = ghConfig();
  let sha;
  try { sha = (await ghGet(path)).sha; } catch {}
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    ...(sha ? { sha } : {}),
  };
  const r = await fetch(`https://api.github.com/repos/${user}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.message || r.status); }
  return r.json();
}

async function ghDelete(path, message) {
  const { token, user, repo } = ghConfig();
  let sha;
  try { sha = (await ghGet(path)).sha; } catch { return; }
  await fetch(`https://api.github.com/repos/${user}/${repo}/contents/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha }),
  });
}

// ── Encryption (AES-GCM + PBKDF2) ────────────────────────────────
// Private notes are encrypted BEFORE being stored in GitHub.
// The public repo only contains ciphertext — unreadable without the password.

async function deriveKey(password, salt) {
  const keyMat = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt']
  );
}

function b64(ab) { return btoa(String.fromCharCode(...new Uint8Array(ab))); }
function unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

async function encryptNote(plainObj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(password, salt);
  const enc  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(plainObj)));
  return { _enc: true, data: b64(enc), iv: b64(iv.buffer), salt: b64(salt.buffer) };
}

async function decryptNote(encObj, password) {
  try {
    const key = await deriveKey(password, unb64(encObj.salt));
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(encObj.iv) }, key, unb64(encObj.data));
    return JSON.parse(new TextDecoder().decode(dec));
  } catch {
    return null; // wrong password
  }
}

// ── Auth ───────────────────────────────────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Shows the login gate. Returns a promise that resolves to true/false.
function requireAdminPassword(hint = '') {
  return new Promise(resolve => {
    const gate = document.getElementById('notes-login-gate');
    document.getElementById('gate-sub-text').textContent = hint || 'Enter admin password to continue.';
    document.getElementById('gate-password').value = '';
    document.getElementById('gate-error').classList.remove('show');
    gate.classList.add('show');
    gate.dataset.resolveId = Date.now();
    window._gateResolve = resolve;
  });
}

async function gateLogin() {
  const pwd  = document.getElementById('gate-password').value;
  const hash = await sha256(pwd);
  if (hash === ADMIN_HASH) {
    document.getElementById('notes-login-gate').classList.remove('show');
    isAdmin  = true;
    adminPwd = pwd;
    sessionStorage.setItem(SESSION_KEY, '1');
    sessionStorage.setItem(PWD_SESSION_KEY, pwd);
    updateAdminUI();
    renderAll();
    if (window._gateResolve) { window._gateResolve(pwd); window._gateResolve = null; }
  } else {
    document.getElementById('gate-error').classList.add('show');
    document.getElementById('gate-password').value = '';
    setTimeout(() => document.getElementById('gate-error').classList.remove('show'), 2500);
  }
}

function closeGate() {
  document.getElementById('notes-login-gate').classList.remove('show');
  if (window._gateResolve) { window._gateResolve(null); window._gateResolve = null; }
}

document.getElementById('gate-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') gateLogin();
});

function doAdminLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PWD_SESSION_KEY);
  isAdmin  = false;
  adminPwd = null;
  updateAdminUI();
  renderAll();
  backToHome();
}

function updateAdminUI() {
  document.getElementById('admin-badge').style.display    = isAdmin ? 'inline-flex' : 'none';
  document.getElementById('admin-login-btn').style.display  = isAdmin ? 'none' : 'inline-flex';
  document.getElementById('admin-logout-btn').style.display = isAdmin ? 'inline-flex' : 'none';
}

// ── Data Loading ──────────────────────────────────────────────────
async function loadGithubNotes() {
  try {
    const r = await fetch(NOTES_INDEX_URL + '?v=' + Date.now());
    const d = await r.json();
    githubNotes = d.notes || [];
  } catch {
    githubNotes = [];
  }
}

function getAllVisibleNotes(query = '', tag = '') {
  const combined = [
    ...githubNotes.map(n => ({ ...n, _src: 'github' })),
    ...localNotes.map(n => ({ ...n, _src: 'local' })),
  ];

  return combined.filter(note => {
    // Private GitHub notes require admin
    if (note._src === 'github' && !note.public && !isAdmin) return false;
    if (tag && !note.tags?.includes(tag)) return false;
    if (query) {
      const q = query.toLowerCase();
      const title = (note.title || '').toLowerCase();
      return title.includes(q) || note.tags?.some(t => t.toLowerCase().includes(q));
    }
    return true;
  });
}

// ── Render Everything ─────────────────────────────────────────────
function renderAll(query = '', tag = '') {
  renderSidebar(query, tag);
  renderCards(query, tag);
  renderTagsFilter();
}

// ── Sidebar ───────────────────────────────────────────────────────
function renderSidebar(query = '', tag = '') {
  const notes    = getAllVisibleNotes(query, tag);
  const container = document.getElementById('note-list-sidebar');

  if (!notes.length) {
    const hasPrivate = githubNotes.some(n => !n.public);
    container.innerHTML = `<div class="note-list-empty">
      ${githubNotes.length + localNotes.length === 0 ? 'No notes yet. Create one above!' : 'Nothing found.'}
      ${hasPrivate && !isAdmin ? '<br><br><a href="#" onclick="showGate(); return false;">Login to see private notes</a>' : ''}
    </div>`;
    return;
  }

  container.innerHTML = notes.map(note => `
    <div class="note-list-item" id="sidebar-${note.id}" onclick="openNote('${note.id}')">
      <div class="note-list-title">${note.title || 'Untitled'}</div>
      <div class="note-list-meta">
        <span>${note.date || ''}</span>
        ${note._src === 'local' ? '<span class="local-badge">Local</span>' : ''}
        ${!note.public && note._src === 'github' ? '<i class="fas fa-lock" style="font-size:0.65rem"></i>' : ''}
      </div>
    </div>
  `).join('');
}

// ── Cards Grid ────────────────────────────────────────────────────
let activeTag = '';

function renderTagsFilter() {
  const allTags = [...new Set([...githubNotes, ...localNotes].flatMap(n => n.tags || []))];
  const container = document.getElementById('tags-filter');
  if (!allTags.length) { container.style.display = 'none'; return; }
  container.style.display = 'flex';
  container.innerHTML = `
    <button class="tag-filter-btn ${!activeTag ? 'active' : ''}" onclick="filterByTag('')">All</button>
    ${allTags.map(t => `<button class="tag-filter-btn ${activeTag === t ? 'active' : ''}" onclick="filterByTag('${t}')">${t}</button>`).join('')}
  `;
}

function filterByTag(tag) {
  activeTag = tag;
  renderAll('', tag);
}

function filterNotes(query) {
  renderAll(query, activeTag);
}

function renderCards(query = '', tag = '') {
  const container = document.getElementById('notes-cards');
  const notes     = getAllVisibleNotes(query, tag);

  if (!notes.length) {
    container.innerHTML = `<div style="grid-column:1/-1; color:var(--text3); font-size:0.9rem; padding:20px 0;">
      No notes yet. Click <strong>+ New Note</strong> above to create your first note.
      ${!isAdmin && githubNotes.some(n => !n.public) ? '<br><a href="#" onclick="showGate(); return false;">Login to see private notes</a>' : ''}
    </div>`;
    return;
  }

  container.innerHTML = notes.map(note => `
    <div class="note-preview-card" onclick="openNote('${note.id}')">
      <div class="note-preview-title">${note.title || 'Untitled'}</div>
      <div class="note-preview-footer">
        ${(note.tags || []).slice(0, 3).map(t => `<span class="note-tag">${t}</span>`).join('')}
        ${note._src === 'local' ? '<span class="note-tag" style="background:rgba(245,158,11,0.15); color:#fbbf24; border-color:rgba(245,158,11,0.3);">📱 Local</span>' : ''}
        <span class="note-date">${note.date || ''}</span>
        ${!note.public && note._src === 'github' ? '<i class="fas fa-lock" style="color:var(--text3); font-size:0.7rem; margin-left:auto;"></i>' : ''}
      </div>
    </div>
  `).join('');
}

// ── Open Note ─────────────────────────────────────────────────────
async function openNote(id) {
  // Find in github or local
  const ghNote    = githubNotes.find(n => n.id === id);
  const localNote = localNotes.find(n => n.id === id);
  const meta      = ghNote || localNote;

  if (!meta) { backToHome(); return; }

  const isLocal = !ghNote;

  // Check access for private GitHub notes
  if (!isLocal && !meta.public && !isAdmin) {
    const pwd = await requireAdminPassword('This note is private. Enter admin password to view.');
    if (!pwd) return;
  }

  // Show reader
  document.getElementById('notes-home-view').style.display = 'none';
  document.getElementById('note-reader').classList.add('open');

  // Sidebar active state
  document.querySelectorAll('.note-list-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`sidebar-${id}`)?.classList.add('active');

  // Header
  document.getElementById('reader-title').textContent = meta.title || 'Untitled';
  document.getElementById('reader-meta').innerHTML = `
    <span><i class="fas fa-calendar-alt" style="margin-right:4px"></i>${meta.date || ''}</span>
    ${meta.category ? `<span>· ${meta.category}</span>` : ''}
    ${isLocal ? '<span style="color:var(--amber)">📱 Local Draft</span>' : ''}
    ${!meta.public && !isLocal ? '<span style="color:var(--cyan)"><i class="fas fa-lock" style="margin-right:4px"></i>Private (Encrypted)</span>' : ''}
  `;
  document.getElementById('reader-tags').innerHTML = (meta.tags || []).map(t => `<span class="note-tag">${t}</span>`).join('');

  // Show edit button for admin and local notes
  const editBtnWrap = document.getElementById('reader-edit-btn');
  if (editBtnWrap) {
    editBtnWrap.style.display = (isAdmin || isLocal) ? 'inline-flex' : 'none';
    editBtnWrap.onclick = () => openEditor(id);
  }

  // Load content
  document.getElementById('note-content-body').innerHTML = '<p style="color:var(--text3)">Loading...</p>';

  let content = '';

  if (isLocal) {
    content = meta.content || '';
  } else {
    try {
      const r   = await fetch(`../data/notes/${id}.json?v=${Date.now()}`);
      const raw = await r.json();

      if (raw._enc) {
        // Encrypted — need password to decrypt
        const pwd = adminPwd || sessionStorage.getItem(PWD_SESSION_KEY);
        if (!pwd) {
          const enteredPwd = await requireAdminPassword('Enter admin password to decrypt this private note.');
          if (!enteredPwd) { backToHome(); return; }
        }
        const decrypted = await decryptNote(raw, adminPwd || sessionStorage.getItem(PWD_SESSION_KEY));
        if (!decrypted) {
          document.getElementById('note-content-body').innerHTML = '<p style="color:var(--red)">❌ Could not decrypt — wrong password?</p>';
          return;
        }
        content = decrypted.content || '';
      } else {
        content = raw.content || '';
      }
    } catch {
      content = '*Could not load note content.*';
    }
  }

  document.getElementById('note-content-body').innerHTML = marked.parse(content);
  history.pushState(null, '', `#${id}`);
  document.getElementById('note-reader').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function backToHome() {
  document.getElementById('notes-home-view').style.display = 'block';
  document.getElementById('note-reader').classList.remove('open');
  document.querySelectorAll('.note-list-item').forEach(el => el.classList.remove('active'));
  history.pushState(null, '', location.pathname);
}

// ── Note Editor (available without login) ────────────────────────
function openEditor(id = null) {
  editingNoteId = id;

  if (id) {
    // Edit existing
    const ghMeta    = githubNotes.find(n => n.id === id);
    const localMeta = localNotes.find(n => n.id === id);
    const meta      = ghMeta || localMeta;

    if (meta) {
      document.getElementById('editor-title').value    = meta.title || '';
      document.getElementById('editor-category').value = meta.category || '';
      document.getElementById('editor-tags').value     = (meta.tags || []).join(', ');
      document.getElementById('editor-public').checked = !!meta.public;

      // Load content for editing
      if (localMeta) {
        document.getElementById('editor-content').value = localMeta.content || '';
      } else {
        // Load from GitHub (decrypting if needed)
        loadNoteContentForEdit(id, !!ghMeta?.public);
      }
    }
  } else {
    // New note
    document.getElementById('editor-title').value    = '';
    document.getElementById('editor-category').value = '';
    document.getElementById('editor-tags').value     = '';
    document.getElementById('editor-content').value  = '';
    document.getElementById('editor-public').checked = true;
    document.getElementById('editor-id').value       = '';
  }

  document.getElementById('note-editor-panel').classList.add('open');
  document.getElementById('editor-title').focus();
}

async function loadNoteContentForEdit(id, isPublic) {
  try {
    const r   = await fetch(`../data/notes/${id}.json?v=${Date.now()}`);
    const raw = await r.json();
    if (raw._enc) {
      const pwd = adminPwd || sessionStorage.getItem(PWD_SESSION_KEY);
      const dec = await decryptNote(raw, pwd);
      document.getElementById('editor-content').value = dec?.content || '';
    } else {
      document.getElementById('editor-content').value = raw.content || '';
    }
  } catch {
    document.getElementById('editor-content').value = '';
  }
}

function closeEditor() {
  document.getElementById('note-editor-panel').classList.remove('open');
}

// ── Save Note ─────────────────────────────────────────────────────
async function saveNote(destination) {
  // destination: 'local' | 'github'
  const title    = document.getElementById('editor-title').value.trim() || 'Untitled Note';
  const category = document.getElementById('editor-category').value.trim();
  const tags     = document.getElementById('editor-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const content  = document.getElementById('editor-content').value;
  const isPublic = document.getElementById('editor-public').checked;
  const date     = new Date().toISOString().slice(0, 10);
  const id       = editingNoteId || `note-${Date.now()}`;

  const meta = { id, title, category, tags, public: isPublic, date };

  if (destination === 'local') {
    // Save as local draft (always unencrypted in localStorage, on this device only)
    const existing = localNotes.findIndex(n => n.id === id);
    const fullNote = { ...meta, content, _src: 'local' };
    if (existing >= 0) localNotes[existing] = fullNote;
    else localNotes.push(fullNote);
    saveLocalNotes();
    toast('💾 Saved as local draft (on this device only)', 'success');
    closeEditor();
    renderAll();
    return;
  }

  // Save to GitHub
  const { token } = ghConfig();
  if (!token) {
    toast('⚠️ No GitHub token found. Saving locally instead.', 'info');
    await saveNote('local');
    return;
  }

  // If private, we need to encrypt — requires admin password
  let notePayload;
  if (!isPublic) {
    let pwd = adminPwd || sessionStorage.getItem(PWD_SESSION_KEY);
    if (!pwd) {
      pwd = await requireAdminPassword('Private notes are encrypted. Enter admin password to encrypt this note.');
      if (!pwd) return;
    }
    notePayload = await encryptNote({ title, content, category, tags }, pwd);
    // In the index, private notes show no title (just placeholder) for repo privacy
    meta.title = '🔒 Private Note';
    meta.tags  = [];
  } else {
    notePayload = { id, title, content, date };
  }

  showSavingToast(true);
  try {
    // Write note content file
    await ghPut(`data/notes/${id}.json`, JSON.stringify(notePayload, null, 2), `note: save "${title}"`);

    // Update GitHub index
    const idx = githubNotes.findIndex(n => n.id === id);
    if (idx >= 0) githubNotes[idx] = meta;
    else githubNotes.push(meta);

    // Remove from local if it was a local draft being promoted
    const li = localNotes.findIndex(n => n.id === id);
    if (li >= 0) { localNotes.splice(li, 1); saveLocalNotes(); }

    await ghPut('data/notes/index.json', JSON.stringify({ notes: githubNotes }, null, 2), 'note: update index');

    toast(`✅ Note ${isPublic ? 'published' : 'encrypted & saved'} to GitHub!`, 'success');
    closeEditor();
    await loadGithubNotes();
    renderAll();
  } catch (e) {
    toast(`❌ GitHub save failed: ${e.message}`, 'error');
  } finally {
    showSavingToast(false);
  }
}

// ── Delete Note ───────────────────────────────────────────────────
async function deleteNote(id) {
  if (!confirm('Delete this note permanently?')) return;

  // Local note
  const li = localNotes.findIndex(n => n.id === id);
  if (li >= 0) {
    localNotes.splice(li, 1);
    saveLocalNotes();
    backToHome();
    renderAll();
    toast('Local note deleted.', 'info');
    return;
  }

  // GitHub note
  const { token } = ghConfig();
  if (!token) { toast('No GitHub token — cannot delete from GitHub.', 'error'); return; }

  showSavingToast(true);
  try {
    await ghDelete(`data/notes/${id}.json`, `note: delete ${id}`);
    githubNotes = githubNotes.filter(n => n.id !== id);
    await ghPut('data/notes/index.json', JSON.stringify({ notes: githubNotes }, null, 2), 'note: update index after delete');
    toast('Note deleted from GitHub.', 'info');
    backToHome();
    renderAll();
  } catch (e) {
    toast(`❌ Delete failed: ${e.message}`, 'error');
  } finally {
    showSavingToast(false);
  }
}

// ── Sync local note to GitHub ─────────────────────────────────────
async function syncLocalToGitHub(id) {
  const localNote = localNotes.find(n => n.id === id);
  if (!localNote) return;

  editingNoteId = id;
  document.getElementById('editor-title').value    = localNote.title || '';
  document.getElementById('editor-category').value = localNote.category || '';
  document.getElementById('editor-tags').value     = (localNote.tags || []).join(', ');
  document.getElementById('editor-content').value  = localNote.content || '';
  document.getElementById('editor-public').checked = !!localNote.public;
  await saveNote('github');
}

// ── Admin Gate (for reading private notes) ────────────────────────
function showGate() {
  requireAdminPassword('Enter admin password to view private notes.');
}

// ── UI Helpers ─────────────────────────────────────────────────────
function showSavingToast(show) {
  // simple inline indicator
}

const _toastContainer = () => document.getElementById('toast-container') || (() => {
  const d = document.createElement('div');
  d.id = 'toast-container';
  d.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
  document.body.appendChild(d);
  return d;
})();

function toast(msg, type = 'info') {
  const c   = _toastContainer();
  const el  = document.createElement('div');
  el.style.cssText = `padding:12px 20px; border-radius:10px; font-size:0.84rem; font-weight:500;
    backdrop-filter:blur(12px); animation:toast-slide 0.3s ease;
    ${type === 'success' ? 'background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);color:#34d399;' : ''}
    ${type === 'error'   ? 'background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#f87171;' : ''}
    ${type === 'info'    ? 'background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.3);color:#00d4ff;' : ''}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
