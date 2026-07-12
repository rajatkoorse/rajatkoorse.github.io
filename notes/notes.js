/**
 * Notes Section — JavaScript
 * Handles note listing, reading, markdown rendering, and admin auth
 */
'use strict';

const ADMIN_HASH = '4d418171aaf4f34bc0213ff57935c26219e5fccfe39086d20bf21b3757cb3ee4';
const NOTES_SESSION_KEY = 'rk_notes_admin';
const NOTES_INDEX_URL = '../data/notes/index.json';

let allNotes = [];
let isAdminMode = false;
let currentGateAction = null; // 'admin' | 'note:<id>'
let gateResolve = null;

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  isAdminMode = !!sessionStorage.getItem(NOTES_SESSION_KEY);
  updateAdminUI();
  await loadNotes();
  checkUrlHash();
});

window.addEventListener('hashchange', checkUrlHash);

function checkUrlHash() {
  const hash = location.hash.slice(1);
  if (hash) openNote(hash);
  else backToHome();
}

// ── Auth ─────────────────────────────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function showGate(action) {
  currentGateAction = action;
  const gate = document.getElementById('notes-login-gate');
  const sub = document.getElementById('gate-sub-text');
  sub.textContent = action === 'admin'
    ? 'Enter admin password to unlock all notes.'
    : 'This note is private. Enter admin password to view.';
  document.getElementById('gate-password').value = '';
  document.getElementById('gate-error').classList.remove('show');
  gate.classList.add('show');
  setTimeout(() => document.getElementById('gate-password').focus(), 100);
}

function closeGate() {
  document.getElementById('notes-login-gate').classList.remove('show');
  currentGateAction = null;
}

async function gateLogin() {
  const pwd = document.getElementById('gate-password').value;
  const hash = await sha256(pwd);
  if (hash === ADMIN_HASH) {
    closeGate();
    if (currentGateAction === 'admin' || currentGateAction === null) {
      sessionStorage.setItem(NOTES_SESSION_KEY, '1');
      isAdminMode = true;
      updateAdminUI();
      renderNoteList();
      renderNoteCards();
    } else if (currentGateAction?.startsWith('note:')) {
      isAdminMode = true;
      sessionStorage.setItem(NOTES_SESSION_KEY, '1');
      updateAdminUI();
      const noteId = currentGateAction.split(':')[1];
      openNote(noteId);
    }
  } else {
    document.getElementById('gate-error').classList.add('show');
    document.getElementById('gate-password').value = '';
    setTimeout(() => document.getElementById('gate-error').classList.remove('show'), 2500);
  }
}

document.getElementById('gate-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') gateLogin();
});

function doAdminLogout() {
  sessionStorage.removeItem(NOTES_SESSION_KEY);
  isAdminMode = false;
  updateAdminUI();
  backToHome();
  renderNoteList();
  renderNoteCards();
}

function updateAdminUI() {
  const badge = document.getElementById('admin-badge');
  const loginBtn = document.getElementById('admin-login-btn');
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (isAdminMode) {
    badge.style.display = 'inline-flex';
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
    loginBtn.style.display = 'inline-flex';
    logoutBtn.style.display = 'none';
  }
}

// ── Data Loading ─────────────────────────────────────────────
async function loadNotes() {
  try {
    const res = await fetch(NOTES_INDEX_URL + '?v=' + Date.now());
    const data = await res.json();
    allNotes = data.notes || [];
  } catch (e) {
    allNotes = [];
  }
  renderNoteList();
  renderNoteCards();
  renderTagsFilter();
}

function getVisibleNotes(query = '', tag = '') {
  return allNotes.filter(note => {
    const visible = isAdminMode || note.public;
    if (!visible) return false;
    if (tag && !note.tags?.includes(tag)) return false;
    if (query) {
      const q = query.toLowerCase();
      return note.title?.toLowerCase().includes(q) ||
             note.tags?.some(t => t.toLowerCase().includes(q)) ||
             note.category?.toLowerCase().includes(q);
    }
    return true;
  });
}

// ── Sidebar Note List ─────────────────────────────────────────
function renderNoteList(query = '') {
  const container = document.getElementById('note-list-sidebar');
  const notes = getVisibleNotes(query);

  if (!notes.length) {
    container.innerHTML = `<div class="note-list-empty">
      ${allNotes.length === 0 ? 'No notes yet.' : 'No notes found.'}
      ${!isAdminMode && allNotes.some(n => !n.public) ? '<br><br><a href="#" onclick="showGate(\'admin\'); return false;" style="color:var(--cyan)">Login to see private notes</a>' : ''}
    </div>`;
    return;
  }

  container.innerHTML = notes.map(note => `
    <div class="note-list-item" id="sidebar-${note.id}" onclick="openNote('${note.id}')">
      <div class="note-list-title">${note.title}</div>
      <div class="note-list-meta">
        <span>${note.date || ''}</span>
        ${!note.public ? '<i class="fas fa-lock" style="font-size:0.65rem"></i>' : ''}
      </div>
    </div>
  `).join('');
}

// ── Notes Grid ────────────────────────────────────────────────
let activeTag = '';

function renderTagsFilter() {
  const allTags = [...new Set(allNotes.flatMap(n => n.tags || []))];
  const container = document.getElementById('tags-filter');
  if (!allTags.length) { container.style.display = 'none'; return; }

  container.innerHTML = `
    <button class="tag-filter-btn active" id="tag-all" onclick="filterByTag('')">All</button>
    ${allTags.map(t => `<button class="tag-filter-btn" id="tag-${t}" onclick="filterByTag('${t}')">${t}</button>`).join('')}
  `;
}

function filterByTag(tag) {
  activeTag = tag;
  document.querySelectorAll('.tag-filter-btn').forEach(b => b.classList.remove('active'));
  const activeEl = document.getElementById(tag ? `tag-${tag}` : 'tag-all');
  if (activeEl) activeEl.classList.add('active');
  renderNoteCards();
}

function filterNotes(query) {
  renderNoteList(query);
  renderNoteCards(query);
}

function renderNoteCards(query = '') {
  const container = document.getElementById('notes-cards');
  const notes = getVisibleNotes(query, activeTag);

  if (!notes.length) {
    const hasPrivate = allNotes.some(n => !n.public) && !isAdminMode;
    container.innerHTML = `<div style="grid-column:1/-1; color:var(--text3); font-size:0.9rem; padding:20px 0;">
      ${allNotes.length === 0 ? '📝 No notes yet. Create some from the Admin panel.' : 'No matching notes.'}
      ${hasPrivate ? '<br><br><a href="#" onclick="showGate(\'admin\'); return false;">Login to see private notes</a>' : ''}
    </div>`;
    return;
  }

  container.innerHTML = notes.map(note => `
    <div class="note-preview-card" onclick="openNote('${note.id}')">
      <div class="note-preview-title">${note.title}</div>
      <div class="note-preview-footer">
        ${(note.tags || []).slice(0, 3).map(t => `<span class="note-tag">${t}</span>`).join('')}
        <span class="note-date">${note.date || ''}</span>
        ${!note.public ? '<i class="fas fa-lock" style="color:var(--text3); font-size:0.7rem; margin-left:auto;"></i>' : ''}
      </div>
    </div>
  `).join('');
}

// ── Note Reader ───────────────────────────────────────────────
async function openNote(id) {
  const note = allNotes.find(n => n.id === id);
  if (!note) { backToHome(); return; }

  // Check access
  if (!note.public && !isAdminMode) {
    showGate(`note:${id}`);
    return;
  }

  // Show reader
  document.getElementById('notes-home-view').style.display = 'none';
  document.getElementById('note-reader').classList.add('open');

  // Update sidebar active
  document.querySelectorAll('.note-list-item').forEach(el => el.classList.remove('active'));
  const sidebarItem = document.getElementById(`sidebar-${id}`);
  if (sidebarItem) sidebarItem.classList.add('active');

  // Set header
  document.getElementById('reader-title').textContent = note.title;
  document.getElementById('reader-meta').innerHTML = `
    <span><i class="fas fa-calendar-alt" style="margin-right:4px"></i>${note.date || 'Unknown'}</span>
    ${note.category ? `<span>· ${note.category}</span>` : ''}
    ${!note.public ? '<span style="color:var(--cyan)"><i class="fas fa-lock" style="margin-right:4px"></i>Private</span>' : ''}
  `;
  document.getElementById('reader-tags').innerHTML = (note.tags || []).map(t =>
    `<span class="note-tag">${t}</span>`
  ).join('');

  // Load content
  document.getElementById('note-content-body').innerHTML = '<p style="color:var(--text3);">Loading...</p>';

  try {
    const res = await fetch(`../data/notes/${id}.json?v=${Date.now()}`);
    const data = await res.json();
    const content = data.content || '*No content yet.*';
    document.getElementById('note-content-body').innerHTML = marked.parse(content);
  } catch (e) {
    document.getElementById('note-content-body').innerHTML =
      '<p style="color:var(--text3);">Could not load note content.</p>';
  }

  // Update URL hash without navigation
  history.pushState(null, '', `#${id}`);

  // Scroll to top of reader
  document.getElementById('note-reader').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function backToHome() {
  document.getElementById('notes-home-view').style.display = 'block';
  document.getElementById('note-reader').classList.remove('open');
  document.querySelectorAll('.note-list-item').forEach(el => el.classList.remove('active'));
  history.pushState(null, '', location.pathname);
}
