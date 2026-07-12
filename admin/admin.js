/**
 * Admin Panel — Main JavaScript
 * Handles auth, GitHub API integration, and CMS functionality
 */
'use strict';

// ── Config ──────────────────────────────────────────────────
const ADMIN_PASSWORD_HASH = '4d418171aaf4f34bc0213ff57935c26219e5fccfe39086d20bf21b3757cb3ee4';
const PORTFOLIO_FILE = 'data/portfolio.json';
const NOTES_INDEX_FILE = 'data/notes/index.json';
const SESSION_KEY = 'rk_admin_session';
const TOKEN_KEY = 'rk_gh_token';
const USER_KEY = 'rk_gh_user';
const REPO_KEY = 'rk_gh_repo';

// ── State ────────────────────────────────────────────────────
let portfolioData = null;
let notesIndex = null;
let currentSection = 'dashboard';
let unsavedChanges = false;
let editingNoteId = null;

// ── Auth ─────────────────────────────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function doLogin() {
  const pwd = document.getElementById('login-password').value;
  if (!pwd) return;
  const hash = await sha256(pwd);
  if (hash === ADMIN_PASSWORD_HASH) {
    sessionStorage.setItem(SESSION_KEY, '1');
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-app').classList.add('show');
    init();
  } else {
    const err = document.getElementById('login-error');
    err.classList.add('show');
    document.getElementById('login-password').value = '';
    setTimeout(() => err.classList.remove('show'), 3000);
  }
}

function doLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
}

document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

// Check existing session
if (sessionStorage.getItem(SESSION_KEY)) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-app').classList.add('show');
  init();
}

// ── Init ─────────────────────────────────────────────────────
async function init() {
  updateTokenStatus();
  await loadPortfolioData();
  await loadNotesIndex();
  updateDashboard();
  renderPersonalForm();
  renderExperienceList();
  renderSkillsList();
  renderProjectsList();
  renderEducationList();
  renderCertsList();
  renderAchievementsList();
  renderNotesList();
}

// ── GitHub API ───────────────────────────────────────────────
function getGHConfig() {
  return {
    token: localStorage.getItem(TOKEN_KEY),
    user: localStorage.getItem(USER_KEY) || 'rajatkoorse',
    repo: localStorage.getItem(REPO_KEY) || 'rajatkoorse.github.io',
  };
}

async function ghApiGet(path) {
  const { token, user, repo } = getGHConfig();
  const url = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
    }
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

async function ghApiPut(path, content, message) {
  const { token, user, repo } = getGHConfig();
  const url = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;

  // Get current SHA first
  let sha;
  try {
    const current = await ghApiGet(path);
    sha = current.sha;
  } catch (e) {
    // File doesn't exist yet — that's fine
  }

  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }
  return res.json();
}

// ── Data Loading ─────────────────────────────────────────────
async function loadPortfolioData() {
  try {
    const res = await fetch('../data/portfolio.json?v=' + Date.now());
    portfolioData = await res.json();
  } catch (e) {
    portfolioData = getDefaultPortfolio();
    toast('Could not load portfolio.json — using local defaults', 'info');
  }
}

async function loadNotesIndex() {
  try {
    const res = await fetch('../data/notes/index.json?v=' + Date.now());
    notesIndex = await res.json();
  } catch (e) {
    notesIndex = { notes: [] };
  }
}

// ── Publish ───────────────────────────────────────────────────
async function publishChanges() {
  const { token } = getGHConfig();
  if (!token) {
    toast('Please configure your GitHub Token in Settings first!', 'error');
    showSection('settings');
    return;
  }

  const btn = document.getElementById('publish-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Publishing…';
  showSaveIndicator(true);

  try {
    // Collect current form data
    collectAllFormData();

    await ghApiPut(
      PORTFOLIO_FILE,
      JSON.stringify(portfolioData, null, 2),
      `chore: update portfolio content [${new Date().toISOString().slice(0, 10)}]`
    );
    await ghApiPut(
      NOTES_INDEX_FILE,
      JSON.stringify(notesIndex, null, 2),
      `chore: update notes index [${new Date().toISOString().slice(0, 10)}]`
    );

    toast('✅ Published! Changes are live on GitHub (~30 seconds)', 'success');
    unsavedChanges = false;
  } catch (e) {
    console.error(e);
    toast(`❌ Publish failed: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-cloud-arrow-up"></i> Publish';
    showSaveIndicator(false);
  }
}

function collectAllFormData() {
  collectPersonal();
  collectExperience();
  collectSkills();
  collectProjects();
  collectEducation();
  collectCerts();
  collectAchievements();
}

// ── Section Navigation ───────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const section = document.getElementById(`section-${name}`);
  const nav = document.getElementById(`nav-${name}`);
  if (section) section.classList.add('active');
  if (nav) nav.classList.add('active');

  const titles = {
    dashboard: 'Dashboard', personal: 'Personal Info', experience: 'Work Experience',
    skills: 'Technical Skills', projects: 'Projects', education: 'Education',
    certifications: 'Certifications', achievements: 'Achievements',
    notes: 'Manage Notes', settings: 'GitHub Settings',
  };
  document.getElementById('topbar-title').textContent = titles[name] || name;
  currentSection = name;
}

// ── Dashboard ────────────────────────────────────────────────
function updateDashboard() {
  if (!portfolioData) return;
  const skillCount = Object.values(portfolioData.skills || {}).reduce((s, c) => s + (c.items?.length || 0), 0);
  document.getElementById('dash-exp').textContent = portfolioData.experience?.length || 0;
  document.getElementById('dash-skills').textContent = skillCount;
  document.getElementById('dash-proj').textContent = portfolioData.projects?.length || 0;
  document.getElementById('dash-edu').textContent = portfolioData.education?.length || 0;
  document.getElementById('dash-cert').textContent = portfolioData.certifications?.length || 0;
  document.getElementById('dash-notes').textContent = notesIndex?.notes?.length || 0;
}

// ── Personal Form ────────────────────────────────────────────
function renderPersonalForm() {
  const p = portfolioData?.personal || {};
  setVal('p-name', p.name);
  setVal('p-title', p.title);
  setVal('p-subtitle', p.subtitle);
  setVal('p-bio', p.bio);
  setVal('p-location', p.location);
  setVal('p-email', p.email);
  setVal('p-phone', p.phone);
  setVal('p-linkedin', p.linkedin);
  setVal('p-github', p.github);
  setVal('p-resume', p.resumeUrl);
  setVal('p-photo', p.photoUrl);
  setVal('p-tagline', p.tagline);
  document.getElementById('p-available').checked = !!p.availableForWork;
}

function collectPersonal() {
  if (!portfolioData) portfolioData = {};
  portfolioData.personal = {
    ...(portfolioData.personal || {}),
    name: getVal('p-name'),
    title: getVal('p-title'),
    subtitle: getVal('p-subtitle'),
    bio: getVal('p-bio'),
    location: getVal('p-location'),
    email: getVal('p-email'),
    phone: getVal('p-phone'),
    linkedin: getVal('p-linkedin'),
    github: getVal('p-github'),
    resumeUrl: getVal('p-resume'),
    photoUrl: getVal('p-photo'),
    tagline: getVal('p-tagline'),
    availableForWork: document.getElementById('p-available').checked,
  };
}

async function savePersonal() {
  collectPersonal();
  toast('Personal info saved locally. Click Publish to go live.', 'success');
}

// ── Experience ────────────────────────────────────────────────
function renderExperienceList() {
  const list = document.getElementById('exp-list');
  const exps = portfolioData?.experience || [];
  if (!exps.length) { list.innerHTML = '<div style="color:var(--text3);font-size:0.84rem;padding:20px 0;">No experience entries yet.</div>'; return; }

  list.innerHTML = exps.map((exp, i) => `
    <div class="item-card" id="exp-card-${i}">
      <div class="item-card-header" onclick="toggleCard('exp-body-${i}')">
        <div>
          <div class="item-card-title">${exp.role} @ ${exp.company}</div>
          <div class="item-card-sub">${exp.duration} · ${exp.type}</div>
        </div>
        <div class="item-card-actions">
          <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation(); removeExperience(${i})" title="Delete"><i class="fas fa-trash"></i></button>
          <i class="fas fa-chevron-down" style="color:var(--text3)"></i>
        </div>
      </div>
      <div class="item-card-body" id="exp-body-${i}">
        <div class="form-row">
          <div class="field"><label>Company</label><input type="text" id="exp-${i}-company" value="${exp.company || ''}" /></div>
          <div class="field"><label>Role / Title</label><input type="text" id="exp-${i}-role" value="${exp.role || ''}" /></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Duration</label><input type="text" id="exp-${i}-duration" value="${exp.duration || ''}" placeholder="Mar 2024 – Present" /></div>
          <div class="field"><label>Location</label><input type="text" id="exp-${i}-location" value="${exp.location || ''}" /></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Type</label>
            <select id="exp-${i}-type">
              <option ${exp.type==='Full-time'?'selected':''}>Full-time</option>
              <option ${exp.type==='Part-time'?'selected':''}>Part-time</option>
              <option ${exp.type==='Freelance'?'selected':''}>Freelance</option>
              <option ${exp.type==='Contract'?'selected':''}>Contract</option>
              <option ${exp.type==='Internship'?'selected':''}>Internship</option>
            </select>
          </div>
          <div class="field"><label>Logo Letters (2-3 chars)</label><input type="text" id="exp-${i}-logo" value="${exp.logo || ''}" maxlength="3" /></div>
        </div>

        ${(exp.projects || []).map((proj, pi) => `
          <div style="margin-top:16px; padding:16px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;">
              <div style="font-weight:600; font-size:0.85rem; color:var(--cyan)">Project ${pi + 1}</div>
              <button class="btn btn-danger btn-sm btn-icon" onclick="removeProject_exp(${i}, ${pi})"><i class="fas fa-trash"></i></button>
            </div>
            <div class="field" style="margin-bottom:12px;"><label>Project Name</label><input type="text" id="exp-${i}-proj-${pi}-name" value="${proj.name || ''}" /></div>
            <label style="font-size:0.8rem; color:var(--text2); display:block; margin-bottom:8px;">Bullet Points</label>
            <div class="bullet-list" id="exp-${i}-proj-${pi}-bullets">
              ${(proj.bullets || []).map((b, bi) => `
                <div class="bullet-item" id="exp-${i}-proj-${pi}-bullet-${bi}">
                  <textarea id="exp-${i}-proj-${pi}-b-${bi}">${b}</textarea>
                  <button class="btn btn-danger btn-icon btn-sm" onclick="removeBullet('exp-${i}-proj-${pi}-bullet-${bi}')"><i class="fas fa-minus"></i></button>
                </div>
              `).join('')}
            </div>
            <button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="addBullet(${i}, ${pi})"><i class="fas fa-plus"></i> Add Bullet</button>
          </div>
        `).join('')}

        <button class="btn btn-secondary btn-sm" style="margin-top:14px" onclick="addProjectToExp(${i})">
          <i class="fas fa-plus"></i> Add Project
        </button>
        <div style="margin-top:16px">
          <button class="btn btn-primary btn-sm" onclick="saveExperience(${i})"><i class="fas fa-save"></i> Save Entry</button>
        </div>
      </div>
    </div>
  `).join('');
}

function toggleCard(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

function addExperience() {
  if (!portfolioData.experience) portfolioData.experience = [];
  portfolioData.experience.push({
    id: `exp-${Date.now()}`, company: 'Company Name', role: 'Your Role',
    duration: '20XX – Present', location: '', type: 'Full-time', logo: 'CO',
    color: '#00d4ff', projects: [{ name: 'Project', bullets: ['Your achievement here.'] }]
  });
  renderExperienceList();
  toast('New experience entry added. Fill in the details and save.', 'info');
}

function removeExperience(i) {
  if (!confirm('Delete this experience entry?')) return;
  portfolioData.experience.splice(i, 1);
  renderExperienceList();
  toast('Entry deleted. Click Publish to apply.', 'info');
}

function saveExperience(i) {
  const exp = portfolioData.experience[i];
  exp.company = getVal(`exp-${i}-company`);
  exp.role = getVal(`exp-${i}-role`);
  exp.duration = getVal(`exp-${i}-duration`);
  exp.location = getVal(`exp-${i}-location`);
  exp.type = getVal(`exp-${i}-type`);
  exp.logo = getVal(`exp-${i}-logo`);

  (exp.projects || []).forEach((proj, pi) => {
    proj.name = getVal(`exp-${i}-proj-${pi}-name`);
    proj.bullets = [];
    const container = document.getElementById(`exp-${i}-proj-${pi}-bullets`);
    if (container) {
      container.querySelectorAll('textarea').forEach(ta => {
        if (ta.value.trim()) proj.bullets.push(ta.value.trim());
      });
    }
  });

  renderExperienceList();
  toast('Experience saved locally. Click Publish to go live.', 'success');
}

function addProjectToExp(i) {
  if (!portfolioData.experience[i].projects) portfolioData.experience[i].projects = [];
  portfolioData.experience[i].projects.push({ name: 'New Project', bullets: ['Achievement here.'] });
  saveExperience(i);
}

function removeProject_exp(ei, pi) {
  portfolioData.experience[ei].projects.splice(pi, 1);
  renderExperienceList();
}

function addBullet(ei, pi) {
  const container = document.getElementById(`exp-${ei}-proj-${pi}-bullets`);
  if (!container) return;
  const idx = container.querySelectorAll('.bullet-item').length;
  const div = document.createElement('div');
  div.className = 'bullet-item';
  div.id = `exp-${ei}-proj-${pi}-bullet-${idx}`;
  div.innerHTML = `<textarea id="exp-${ei}-proj-${pi}-b-${idx}"></textarea>
    <button class="btn btn-danger btn-icon btn-sm" onclick="removeBullet('exp-${ei}-proj-${pi}-bullet-${idx}')"><i class="fas fa-minus"></i></button>`;
  container.appendChild(div);
}

function removeBullet(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function collectExperience() { /* Collected per-item in saveExperience */ }

// ── Skills ────────────────────────────────────────────────────
function renderSkillsList() {
  const list = document.getElementById('skills-list');
  const skills = portfolioData?.skills || {};
  const keys = Object.keys(skills);
  if (!keys.length) { list.innerHTML = '<div style="color:var(--text3);font-size:0.84rem;padding:20px 0;">No skill categories yet.</div>'; return; }

  list.innerHTML = keys.map((key, i) => {
    const cat = skills[key];
    return `
    <div class="item-card" id="skill-card-${key}">
      <div class="item-card-header" onclick="toggleCard('skill-body-${key}')">
        <div>
          <div class="item-card-title">${cat.label}</div>
          <div class="item-card-sub">${cat.items?.length || 0} skills</div>
        </div>
        <div class="item-card-actions">
          <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation(); removeSkillCategory('${key}')" title="Delete"><i class="fas fa-trash"></i></button>
          <i class="fas fa-chevron-down" style="color:var(--text3)"></i>
        </div>
      </div>
      <div class="item-card-body" id="skill-body-${key}">
        <div class="form-row">
          <div class="field"><label>Category Label</label><input type="text" id="sk-${key}-label" value="${cat.label}" /></div>
          <div class="field"><label>Category Key (no spaces)</label><input type="text" id="sk-${key}-key" value="${key}" /></div>
        </div>
        <div class="field" style="margin-bottom:14px;">
          <label>Skills (press Enter or comma to add)</label>
          <div class="tag-input-wrap" id="sk-${key}-tags">
            ${(cat.items || []).map(item => `
              <span class="tag-badge">${item}<button onclick="removeSkillTag('${key}', '${item.replace(/'/g, "\\'")}')">×</button></span>
            `).join('')}
            <input class="tag-input" id="sk-${key}-input" placeholder="Add skill..." onkeydown="handleSkillTagInput(event, '${key}')" />
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveSkillCategory('${key}')"><i class="fas fa-save"></i> Save Category</button>
      </div>
    </div>`;
  }).join('');
}

function addSkillCategory() {
  const key = 'category_' + Date.now();
  if (!portfolioData.skills) portfolioData.skills = {};
  portfolioData.skills[key] = { label: 'New Category', icon: 'fa-star', items: [] };
  renderSkillsList();
}

function removeSkillCategory(key) {
  if (!confirm('Delete this category?')) return;
  delete portfolioData.skills[key];
  renderSkillsList();
}

function saveSkillCategory(oldKey) {
  const newKey = getVal(`sk-${oldKey}-key`).replace(/\s+/g, '_');
  const label = getVal(`sk-${oldKey}-label`);
  const items = [];
  document.querySelectorAll(`#sk-${oldKey}-tags .tag-badge`).forEach(badge => {
    items.push(badge.textContent.trim().replace('×', '').trim());
  });

  const cat = { label, icon: portfolioData.skills[oldKey]?.icon || 'fa-star', items };
  delete portfolioData.skills[oldKey];
  portfolioData.skills[newKey] = cat;
  renderSkillsList();
  toast('Skill category saved locally.', 'success');
}

function handleSkillTagInput(e, key) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const input = document.getElementById(`sk-${key}-input`);
    const val = input.value.replace(',', '').trim();
    if (val) {
      const wrap = document.getElementById(`sk-${key}-tags`);
      const badge = document.createElement('span');
      badge.className = 'tag-badge';
      badge.innerHTML = `${val}<button onclick="this.parentElement.remove()">×</button>`;
      wrap.insertBefore(badge, input);
      input.value = '';
    }
  }
}

function removeSkillTag(key, item) {
  renderSkillsList();
  setTimeout(() => {
    const tags = document.getElementById(`sk-${key}-tags`);
    if (tags) {
      tags.querySelectorAll('.tag-badge').forEach(badge => {
        if (badge.textContent.replace('×','').trim() === item) badge.remove();
      });
    }
  }, 10);
}

function collectSkills() { /* Collected per-item */ }

// ── Projects ──────────────────────────────────────────────────
function renderProjectsList() {
  const list = document.getElementById('projects-list');
  const projects = portfolioData?.projects || [];
  if (!projects.length) { list.innerHTML = '<div style="color:var(--text3);font-size:0.84rem;padding:20px 0;">No projects yet.</div>'; return; }

  list.innerHTML = projects.map((proj, i) => `
    <div class="item-card">
      <div class="item-card-header" onclick="toggleCard('proj-body-${i}')">
        <div>
          <div class="item-card-title">${proj.title}</div>
          <div class="item-card-sub">${proj.tags?.join(', ')}</div>
        </div>
        <div class="item-card-actions">
          <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation(); removeProjectItem(${i})"><i class="fas fa-trash"></i></button>
          <i class="fas fa-chevron-down" style="color:var(--text3)"></i>
        </div>
      </div>
      <div class="item-card-body" id="proj-body-${i}">
        <div class="field" style="margin-bottom:14px;"><label>Project Title</label><input type="text" id="proj-${i}-title" value="${proj.title || ''}" /></div>
        <div class="field" style="margin-bottom:14px;"><label>Description</label><textarea id="proj-${i}-desc">${proj.description || ''}</textarea></div>
        <div class="form-row">
          <div class="field"><label>GitHub URL</label><input type="url" id="proj-${i}-github" value="${proj.github || ''}" placeholder="https://github.com/..." /></div>
          <div class="field"><label>Demo URL</label><input type="url" id="proj-${i}-demo" value="${proj.demo || ''}" placeholder="https://..." /></div>
        </div>
        <div class="field" style="margin-bottom:14px;">
          <label>Tags (press Enter to add)</label>
          <div class="tag-input-wrap" id="proj-${i}-tags-wrap">
            ${(proj.tags||[]).map(t=>`<span class="tag-badge">${t}<button onclick="this.parentElement.remove()">×</button></span>`).join('')}
            <input class="tag-input" placeholder="Add tag..." onkeydown="handleTagInput(event, 'proj-${i}-tags-wrap')" />
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveProjectItem(${i})"><i class="fas fa-save"></i> Save</button>
      </div>
    </div>
  `).join('');
}

function addProject() {
  if (!portfolioData.projects) portfolioData.projects = [];
  portfolioData.projects.push({ id: `proj-${Date.now()}`, title: 'New Project', description: '', tags: [], github: '', demo: '', featured: false });
  renderProjectsList();
}

function removeProjectItem(i) {
  if (!confirm('Delete this project?')) return;
  portfolioData.projects.splice(i, 1);
  renderProjectsList();
}

function saveProjectItem(i) {
  const proj = portfolioData.projects[i];
  proj.title = getVal(`proj-${i}-title`);
  proj.description = getVal(`proj-${i}-desc`);
  proj.github = getVal(`proj-${i}-github`);
  proj.demo = getVal(`proj-${i}-demo`);
  proj.tags = [];
  document.querySelectorAll(`#proj-${i}-tags-wrap .tag-badge`).forEach(b => {
    proj.tags.push(b.textContent.replace('×', '').trim());
  });
  renderProjectsList();
  toast('Project saved locally.', 'success');
}

function handleTagInput(e, wrapperId) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const input = e.target;
    const val = input.value.trim();
    if (val) {
      const wrap = document.getElementById(wrapperId);
      const badge = document.createElement('span');
      badge.className = 'tag-badge';
      badge.innerHTML = `${val}<button onclick="this.parentElement.remove()">×</button>`;
      wrap.insertBefore(badge, input);
      input.value = '';
    }
  }
}

function collectProjects() { /* Collected per-item */ }

// ── Education ─────────────────────────────────────────────────
function renderEducationList() {
  const list = document.getElementById('edu-list');
  const edu = portfolioData?.education || [];
  if (!edu.length) { list.innerHTML = '<div style="color:var(--text3);font-size:0.84rem;padding:20px 0;">No education entries yet.</div>'; return; }

  list.innerHTML = edu.map((e, i) => `
    <div class="item-card">
      <div class="item-card-header" onclick="toggleCard('edu-body-${i}')">
        <div>
          <div class="item-card-title">${e.degree}</div>
          <div class="item-card-sub">${e.institution} · ${e.duration}</div>
        </div>
        <div class="item-card-actions">
          <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation(); removeEducation(${i})"><i class="fas fa-trash"></i></button>
          <i class="fas fa-chevron-down" style="color:var(--text3)"></i>
        </div>
      </div>
      <div class="item-card-body" id="edu-body-${i}">
        <div class="form-row">
          <div class="field"><label>Degree</label><input type="text" id="edu-${i}-degree" value="${e.degree || ''}" /></div>
          <div class="field"><label>Institution</label><input type="text" id="edu-${i}-institution" value="${e.institution || ''}" /></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Duration</label><input type="text" id="edu-${i}-duration" value="${e.duration || ''}" /></div>
          <div class="field"><label>Logo Text</label><input type="text" id="edu-${i}-logo" value="${e.logo || ''}" maxlength="6" /></div>
        </div>
        <div class="field" style="margin-bottom:14px;">
          <label>Status</label>
          <select id="edu-${i}-status">
            <option ${e.status==='Ongoing'?'selected':''}>Ongoing</option>
            <option ${e.status==='Completed'?'selected':''}>Completed</option>
          </select>
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveEducation(${i})"><i class="fas fa-save"></i> Save</button>
      </div>
    </div>
  `).join('');
}

function addEducation() {
  if (!portfolioData.education) portfolioData.education = [];
  portfolioData.education.push({ id: `edu-${Date.now()}`, degree: 'Degree Name', institution: 'Institution', duration: '20XX – 20XX', status: 'Completed', logo: 'UNI' });
  renderEducationList();
}

function removeEducation(i) {
  if (!confirm('Delete this education entry?')) return;
  portfolioData.education.splice(i, 1);
  renderEducationList();
}

function saveEducation(i) {
  const e = portfolioData.education[i];
  e.degree = getVal(`edu-${i}-degree`);
  e.institution = getVal(`edu-${i}-institution`);
  e.duration = getVal(`edu-${i}-duration`);
  e.logo = getVal(`edu-${i}-logo`);
  e.status = getVal(`edu-${i}-status`);
  renderEducationList();
  toast('Education saved locally.', 'success');
}

function collectEducation() {}

// ── Certifications ────────────────────────────────────────────
function renderCertsList() {
  const list = document.getElementById('certs-list');
  const certs = portfolioData?.certifications || [];
  if (!certs.length) { list.innerHTML = '<div style="color:var(--text3);font-size:0.84rem;padding:20px 0;">No certifications yet.</div>'; return; }

  list.innerHTML = certs.map((c, i) => `
    <div class="item-card">
      <div class="item-card-header" onclick="toggleCard('cert-body-${i}')">
        <div>
          <div class="item-card-title">${c.title}</div>
          <div class="item-card-sub">${c.issuer} · ${c.year}</div>
        </div>
        <div class="item-card-actions">
          <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation(); removeCert(${i})"><i class="fas fa-trash"></i></button>
          <i class="fas fa-chevron-down" style="color:var(--text3)"></i>
        </div>
      </div>
      <div class="item-card-body" id="cert-body-${i}">
        <div class="form-row">
          <div class="field"><label>Certificate Title</label><input type="text" id="cert-${i}-title" value="${c.title || ''}" /></div>
          <div class="field"><label>Issuing Organization</label><input type="text" id="cert-${i}-issuer" value="${c.issuer || ''}" /></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Year</label><input type="text" id="cert-${i}-year" value="${c.year || ''}" placeholder="2024" /></div>
          <div class="field"><label>Certificate URL (optional)</label><input type="url" id="cert-${i}-url" value="${c.url || ''}" placeholder="https://..." /></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveCert(${i})"><i class="fas fa-save"></i> Save</button>
      </div>
    </div>
  `).join('');
}

function addCertification() {
  if (!portfolioData.certifications) portfolioData.certifications = [];
  portfolioData.certifications.push({ id: `cert-${Date.now()}`, title: 'Certificate Name', issuer: 'Organization', year: '2025' });
  renderCertsList();
}

function removeCert(i) {
  if (!confirm('Delete this certification?')) return;
  portfolioData.certifications.splice(i, 1);
  renderCertsList();
}

function saveCert(i) {
  const c = portfolioData.certifications[i];
  c.title = getVal(`cert-${i}-title`);
  c.issuer = getVal(`cert-${i}-issuer`);
  c.year = getVal(`cert-${i}-year`);
  c.url = getVal(`cert-${i}-url`);
  renderCertsList();
  toast('Certification saved locally.', 'success');
}

function collectCerts() {}

// ── Achievements ──────────────────────────────────────────────
function renderAchievementsList() {
  const list = document.getElementById('ach-list');
  const achs = portfolioData?.achievements || [];
  if (!achs.length) { list.innerHTML = '<div style="color:var(--text3);font-size:0.84rem;padding:20px 0;">No achievements yet.</div>'; return; }

  list.innerHTML = achs.map((a, i) => `
    <div class="item-card">
      <div class="item-card-header" onclick="toggleCard('ach-body-${i}')">
        <div>
          <div class="item-card-title">${a.title}</div>
          <div class="item-card-sub">${a.org}</div>
        </div>
        <div class="item-card-actions">
          <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation(); removeAchievement(${i})"><i class="fas fa-trash"></i></button>
          <i class="fas fa-chevron-down" style="color:var(--text3)"></i>
        </div>
      </div>
      <div class="item-card-body" id="ach-body-${i}">
        <div class="form-row">
          <div class="field"><label>Title</label><input type="text" id="ach-${i}-title" value="${a.title || ''}" /></div>
          <div class="field"><label>Organization</label><input type="text" id="ach-${i}-org" value="${a.org || ''}" /></div>
        </div>
        <div class="field" style="margin-bottom:14px;"><label>Description</label><textarea id="ach-${i}-desc">${a.description || ''}</textarea></div>
        <div class="form-row">
          <div class="field">
            <label>Icon</label>
            <select id="ach-${i}-icon">
              <option value="trophy" ${a.icon==='trophy'?'selected':''}>🏆 Trophy</option>
              <option value="users" ${a.icon==='users'?'selected':''}>👥 Team</option>
              <option value="star" ${a.icon==='star'?'selected':''}>⭐ Star</option>
              <option value="medal" ${a.icon==='medal'?'selected':''}>🎖️ Medal</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveAchievement(${i})"><i class="fas fa-save"></i> Save</button>
      </div>
    </div>
  `).join('');
}

function addAchievement() {
  if (!portfolioData.achievements) portfolioData.achievements = [];
  portfolioData.achievements.push({ id: `ach-${Date.now()}`, title: 'Achievement', org: 'Organization', description: '', icon: 'trophy' });
  renderAchievementsList();
}

function removeAchievement(i) {
  if (!confirm('Delete this achievement?')) return;
  portfolioData.achievements.splice(i, 1);
  renderAchievementsList();
}

function saveAchievement(i) {
  const a = portfolioData.achievements[i];
  a.title = getVal(`ach-${i}-title`);
  a.org = getVal(`ach-${i}-org`);
  a.description = getVal(`ach-${i}-desc`);
  a.icon = getVal(`ach-${i}-icon`);
  renderAchievementsList();
  toast('Achievement saved locally.', 'success');
}

function collectAchievements() {}

// ── Notes ─────────────────────────────────────────────────────
function renderNotesList() {
  const list = document.getElementById('notes-list');
  const notes = notesIndex?.notes || [];
  if (!notes.length) {
    list.innerHTML = '<div style="color:var(--text3);font-size:0.84rem;padding:20px 0;">No notes yet. Create your first note!</div>';
    document.getElementById('dash-notes').textContent = 0;
    return;
  }

  document.getElementById('dash-notes').textContent = notes.length;

  list.innerHTML = notes.map(note => `
    <div class="item-card">
      <div class="item-card-header">
        <div>
          <div class="item-card-title">${note.title}</div>
          <div class="item-card-sub">
            ${note.tags?.join(', ')} · ${note.date}
            ${note.public ? '<span style="color:var(--green); margin-left:8px;"><i class="fas fa-globe"></i> Public</span>' : '<span style="color:var(--text3); margin-left:8px;"><i class="fas fa-lock"></i> Private</span>'}
          </div>
        </div>
        <div class="item-card-actions">
          <button class="btn btn-secondary btn-sm" onclick="editNote('${note.id}')"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteNote('${note.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>
  `).join('');
}

function createNote() {
  editingNoteId = null;
  document.getElementById('note-title').value = '';
  document.getElementById('note-category').value = '';
  document.getElementById('note-tags-input').value = '';
  document.getElementById('note-content').value = '';
  document.getElementById('note-public').checked = false;
  document.getElementById('note-id').value = '';
  document.getElementById('note-modal').style.display = 'flex';
}

async function editNote(id) {
  editingNoteId = id;
  const note = notesIndex.notes.find(n => n.id === id);
  if (!note) return;

  document.getElementById('note-title').value = note.title || '';
  document.getElementById('note-category').value = note.category || '';
  document.getElementById('note-tags-input').value = (note.tags || []).join(', ');
  document.getElementById('note-public').checked = !!note.public;
  document.getElementById('note-id').value = id;

  // Load content
  try {
    const res = await fetch(`../data/notes/${id}.json?v=${Date.now()}`);
    const data = await res.json();
    document.getElementById('note-content').value = data.content || '';
  } catch (e) {
    document.getElementById('note-content').value = '';
  }

  document.getElementById('note-modal').style.display = 'flex';
}

function closeNoteModal() {
  document.getElementById('note-modal').style.display = 'none';
}

async function saveNote() {
  const id = editingNoteId || `note-${Date.now()}`;
  const title = document.getElementById('note-title').value.trim() || 'Untitled Note';
  const category = document.getElementById('note-category').value.trim();
  const tags = document.getElementById('note-tags-input').value.split(',').map(t => t.trim()).filter(Boolean);
  const content = document.getElementById('note-content').value;
  const isPublic = document.getElementById('note-public').checked;
  const date = new Date().toISOString().slice(0, 10);

  // Update or add to index
  const existing = notesIndex.notes.findIndex(n => n.id === id);
  const noteEntry = { id, title, category, tags, public: isPublic, date };
  if (existing >= 0) {
    notesIndex.notes[existing] = noteEntry;
  } else {
    notesIndex.notes.push(noteEntry);
  }

  const { token } = getGHConfig();
  if (!token) {
    // Save locally only
    toast('Note saved locally. Add GitHub token in Settings to persist.', 'info');
    closeNoteModal();
    renderNotesList();
    return;
  }

  showSaveIndicator(true);
  try {
    const noteContent = JSON.stringify({ id, title, content, date }, null, 2);
    await ghApiPut(`data/notes/${id}.json`, noteContent, `note: save "${title}"`);
    await ghApiPut(NOTES_INDEX_FILE, JSON.stringify(notesIndex, null, 2), `note: update index`);
    toast('✅ Note saved to GitHub!', 'success');
  } catch (e) {
    toast(`❌ Failed to save note: ${e.message}`, 'error');
  } finally {
    showSaveIndicator(false);
  }

  closeNoteModal();
  renderNotesList();
}

async function deleteNote(id) {
  if (!confirm('Delete this note permanently?')) return;
  notesIndex.notes = notesIndex.notes.filter(n => n.id !== id);

  const { token } = getGHConfig();
  if (token) {
    try {
      await ghApiPut(NOTES_INDEX_FILE, JSON.stringify(notesIndex, null, 2), `note: delete ${id}`);
      toast('Note deleted.', 'info');
    } catch (e) {
      toast(`Error: ${e.message}`, 'error');
    }
  }
  renderNotesList();
}

// ── Token Settings ────────────────────────────────────────────
function saveGitHubToken() {
  const token = document.getElementById('gh-token').value.trim();
  const user = document.getElementById('gh-username').value.trim() || 'rajatkoorse';
  const repo = document.getElementById('gh-repo').value.trim() || 'rajatkoorse.github.io';

  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, user);
    localStorage.setItem(REPO_KEY, repo);
    updateTokenStatus();
    toast('GitHub token saved to browser storage!', 'success');
  } else {
    toast('Please enter a valid token.', 'error');
  }
}

async function testGitHubToken() {
  const { token, user, repo } = getGHConfig();
  if (!token) { toast('No token configured.', 'error'); return; }
  try {
    const res = await fetch(`https://api.github.com/repos/${user}/${repo}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      toast(`✅ Connected to: ${data.full_name}`, 'success');
    } else {
      toast(`❌ Connection failed: ${res.status}`, 'error');
    }
  } catch (e) {
    toast(`❌ Error: ${e.message}`, 'error');
  }
}

function clearToken() {
  if (!confirm('Remove stored GitHub token?')) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REPO_KEY);
  updateTokenStatus();
  toast('Token cleared.', 'info');
}

function updateTokenStatus() {
  const token = localStorage.getItem(TOKEN_KEY);
  const dot = document.getElementById('token-dot');
  const text = document.getElementById('token-status-text');
  if (dot && text) {
    if (token) {
      dot.classList.add('ok');
      text.textContent = 'GitHub connected';
    } else {
      dot.classList.remove('ok');
      text.textContent = 'No token configured';
    }
  }

  // Pre-fill settings form
  const user = localStorage.getItem(USER_KEY);
  const repo = localStorage.getItem(REPO_KEY);
  if (user) setVal('gh-username', user);
  if (repo) setVal('gh-repo', repo);
}

// ── UI Helpers ─────────────────────────────────────────────────
function showSaveIndicator(show) {
  const el = document.getElementById('save-indicator');
  if (el) el.classList.toggle('show', show);
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = `toast-msg ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = val || '';
  else if (el.tagName === 'SELECT') el.value = val || '';
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function getDefaultPortfolio() {
  return { personal: {}, experience: [], skills: {}, projects: [], education: [], certifications: [], achievements: [] };
}
