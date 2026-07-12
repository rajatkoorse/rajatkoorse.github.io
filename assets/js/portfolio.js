/**
 * Portfolio — Main JavaScript
 * Fetches data/portfolio.json and renders all sections dynamically.
 */
'use strict';

// ── Constants (defaults — overridden by portfolio.json) ────
let TYPED_STRINGS = [
  'AI-ML Engineer',
  'GenAI Architect',
  'LLM Pipeline Builder',
  'Multimodal AI Specialist',
  'Agentic Workflow Engineer',
];

const ACHIEVEMENT_ICONS = {
  trophy: '🏆',
  users: '👥',
  star: '⭐',
  medal: '🎖️',
  default: '🎯',
};

const SKILL_ICONS = {
  languages: 'fa-code',
  ml: 'fa-brain',
  tools: 'fa-tools',
  databases: 'fa-database',
  default: 'fa-microchip',
};

// ── State ───────────────────────────────────────────────────
let portfolioData = null;
let typingInstance = null;

// ── Entry Point ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initScrollProgress();
  initNavbar();
  await loadPortfolioData();
  initTypingEffect();
  initScrollReveal();
});

// ── Data Loading ────────────────────────────────────────────
async function loadPortfolioData() {
  try {
    const res = await fetch(DATA_URL + '?v=' + Date.now());
    portfolioData = await res.json();
    renderAll();
  } catch (err) {
    console.warn('Could not load portfolio.json — using defaults', err);
  }
}

function renderAll() {
  const d = portfolioData;
  if (!d) return;

  // Update typed strings from JSON if provided
  if (d.hero?.typedStrings?.length) {
    TYPED_STRINGS.length = 0;
    d.hero.typedStrings.forEach(s => TYPED_STRINGS.push(s));
  }

  renderHero(d.personal, d.hero);
  renderAbout(d.personal, d.skills);
  renderExperience(d.experience);
  renderSkills(d.skills);
  renderProjects(d.projects);
  renderEducation(d.education);
  renderCertifications(d.certifications);
  renderAchievements(d.achievements);
  renderContact(d.personal);
}

// ── Hero ────────────────────────────────────────────────────
function renderHero(p, hero) {
  if (!p) return;

  setInnerHTML('hero-name', p.name);
  setInnerHTML('hero-desc', p.bio || p.tagline);

  // Render dynamic stats from JSON
  const statsEl = document.getElementById('hero-stats');
  if (statsEl && hero?.stats?.length) {
    statsEl.innerHTML = hero.stats.map(s => `
      <div class="stat">
        <div class="stat-number">${s.number}</div>
        <div class="stat-label">${s.label}</div>
      </div>
    `).join('');
  }

  // Avatar
  const avatarEl = document.getElementById('hero-avatar');
  if (p.photoUrl && avatarEl) {
    avatarEl.innerHTML = `<img src="${p.photoUrl}" alt="${p.name}" />`;
  } else {
    const initials = (p.name || 'RK').split(' ').map(n => n[0]).join('').slice(0, 2);
    setInnerHTML('hero-avatar-initials', initials);
  }

  // Badge
  if (!p.availableForWork) {
    const badge = document.getElementById('hero-badge-text');
    if (badge) badge.textContent = 'Open to connections';
  }

  // CV link
  const cvLink = document.getElementById('hero-cta-cv');
  if (cvLink && p.resumeUrl) cvLink.href = p.resumeUrl;

  // Social links
  const liEl = document.getElementById('social-linkedin');
  const ghEl = document.getElementById('social-github');
  const emEl = document.getElementById('social-email');
  if (liEl && p.linkedin) liEl.href = p.linkedin;
  if (ghEl && p.github) ghEl.href = p.github;
  if (emEl && p.email) emEl.href = `mailto:${p.email}`;

  // Page title / meta
  document.title = `${p.name} — ${p.title}`;
}

// ── About ───────────────────────────────────────────────────
function renderAbout(p, skills) {
  if (!p) return;
  setInnerHTML('about-bio', p.bio || '');

  // Contact info list
  const infoList = document.getElementById('about-info-list');
  if (infoList) {
    const items = [
      { icon: 'fa-map-marker-alt', text: p.location || '' },
      { icon: 'fa-envelope', text: p.email || '', href: `mailto:${p.email}` },
      { icon: 'fa-phone', text: p.phone || '', href: `tel:${p.phone}` },
      { icon: 'fa-linkedin', text: 'linkedin.com/in/rajatkoorse', href: p.linkedin, target: '_blank' },
    ].filter(i => i.text);

    infoList.innerHTML = items.map(item => `
      <li class="about-info-item reveal">
        <i class="fas ${item.icon}"></i>
        ${item.href
          ? `<a href="${item.href}" ${item.target ? 'target="_blank" rel="noopener"' : ''} style="color:var(--text-secondary)">${item.text}</a>`
          : `<span>${item.text}</span>`
        }
      </li>
    `).join('');
  }

  // Tag cloud from ML skills
  const tagCloud = document.getElementById('about-tags');
  if (tagCloud && skills?.ml?.items) {
    tagCloud.innerHTML = skills.ml.items.slice(0, 10).map(s =>
      `<span class="tag">${s}</span>`
    ).join('');
  }
}

// ── Experience ──────────────────────────────────────────────
function renderExperience(experiences) {
  const container = document.getElementById('experience-timeline');
  if (!container || !experiences) return;

  container.innerHTML = experiences.map((exp, i) => `
    <div class="timeline-item" style="transition-delay: ${i * 100}ms">
      <div class="timeline-dot"></div>
      <div class="exp-card">
        <div class="exp-header">
          <div class="exp-logo" style="background: ${exp.color}22; border: 1.5px solid ${exp.color}44; color: ${exp.color};">
            ${exp.logo}
          </div>
          <div class="exp-meta">
            <div class="exp-role">${exp.role}</div>
            <div class="exp-company">${exp.company}</div>
            <div class="exp-duration">
              <i class="fas fa-calendar-alt" style="margin-right:4px; opacity:0.6"></i>${exp.duration}
              &nbsp;·&nbsp;
              <i class="fas fa-map-marker-alt" style="margin-right:4px; opacity:0.6"></i>${exp.location}
            </div>
          </div>
          <div>
            <span class="tag" style="font-size:0.7rem">${exp.type}</span>
          </div>
        </div>
        ${(exp.projects || []).map(proj => `
          <div class="exp-project">
            <div class="exp-project-name">${proj.name}</div>
            <ul>
              ${proj.bullets.map(b => `<li>${b}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ── Skills ──────────────────────────────────────────────────
function renderSkills(skills) {
  const container = document.getElementById('skills-grid');
  if (!container || !skills) return;

  container.innerHTML = Object.entries(skills).map(([key, cat], i) => `
    <div class="skill-category-card" style="transition-delay: ${i * 80}ms">
      <div class="skill-cat-header">
        <div class="skill-cat-icon">
          <i class="fas ${SKILL_ICONS[key] || SKILL_ICONS.default}"></i>
        </div>
        <div class="skill-cat-label">${cat.label}</div>
      </div>
      <div class="skill-tags">
        ${cat.items.map(item => `<span class="tag">${item}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

// ── Projects ────────────────────────────────────────────────
function renderProjects(projects) {
  const container = document.getElementById('projects-grid');
  if (!container || !projects) return;

  container.innerHTML = projects.map((proj, i) => `
    <div class="project-card" style="transition-delay: ${i * 100}ms">
      <div class="project-title">${proj.title}</div>
      <p class="project-desc">${proj.description}</p>
      <div class="project-tags">
        ${proj.tags.map(t => `<span class="project-tag">${t}</span>`).join('')}
      </div>
      <div class="project-links">
        ${proj.github ? `<a href="${proj.github}" target="_blank" rel="noopener" class="project-link"><i class="fab fa-github"></i> Code</a>` : ''}
        ${proj.demo ? `<a href="${proj.demo}" target="_blank" rel="noopener" class="project-link"><i class="fas fa-external-link-alt"></i> Demo</a>` : ''}
        ${!proj.github && !proj.demo ? `<span style="font-size:0.8rem; color:var(--text-muted)"><i class="fas fa-lock" style="margin-right:4px"></i>Private / Enterprise Project</span>` : ''}
      </div>
    </div>
  `).join('');
}

// ── Education ───────────────────────────────────────────────
function renderEducation(education) {
  const container = document.getElementById('education-grid');
  if (!container || !education) return;

  container.innerHTML = education.map(edu => `
    <div class="edu-card reveal">
      <div class="edu-logo">${edu.logo}</div>
      <div>
        <div class="edu-degree">${edu.degree}</div>
        <div class="edu-institution">${edu.institution}</div>
        <div class="edu-duration">${edu.duration}</div>
        <span class="edu-status ${edu.status.toLowerCase()}">${edu.status}</span>
      </div>
    </div>
  `).join('');
}

// ── Certifications ──────────────────────────────────────────
function renderCertifications(certs) {
  const container = document.getElementById('certs-grid');
  if (!container || !certs) return;

  container.innerHTML = certs.map(cert => `
    <div class="cert-card reveal">
      <div class="cert-icon"><i class="fas fa-certificate"></i></div>
      <div>
        <div class="cert-title">${cert.title}</div>
        <div class="cert-meta">${cert.issuer} · ${cert.year}</div>
      </div>
    </div>
  `).join('');
}

// ── Achievements ─────────────────────────────────────────────
function renderAchievements(achievements) {
  const container = document.getElementById('achievements-grid');
  if (!container || !achievements) return;

  container.innerHTML = achievements.map((ach, i) => `
    <div class="ach-card reveal" style="transition-delay: ${i * 80}ms">
      <span class="ach-icon">${ACHIEVEMENT_ICONS[ach.icon] || ACHIEVEMENT_ICONS.default}</span>
      <div class="ach-title">${ach.title}</div>
      <div class="ach-org">${ach.org}</div>
      <p class="ach-desc">${ach.description}</p>
    </div>
  `).join('');
}

// ── Contact ─────────────────────────────────────────────────
function renderContact(p) {
  const container = document.getElementById('contact-links');
  if (!container || !p) return;

  const links = [
    { icon: 'fa-envelope', label: p.email, href: `mailto:${p.email}` },
    { icon: 'fa-phone', label: p.phone, href: `tel:${p.phone}` },
    { icon: 'fa-linkedin', label: 'LinkedIn', href: p.linkedin, target: true },
    { icon: 'fa-github', label: 'GitHub', href: p.github, target: true },
    { icon: 'fa-map-marker-alt', label: p.location, href: null },
  ].filter(l => l.label);

  container.innerHTML = links.map(link => `
    ${link.href
      ? `<a href="${link.href}" ${link.target ? 'target="_blank" rel="noopener"' : ''} class="contact-item">
           <i class="fas ${link.icon}"></i> ${link.label}
         </a>`
      : `<div class="contact-item"><i class="fas ${link.icon}"></i> ${link.label}</div>`
    }
  `).join('');
}

// ── Typing Effect ────────────────────────────────────────────
function initTypingEffect() {
  const el = document.getElementById('typed-text');
  if (!el) return;

  let strIdx = 0, charIdx = 0, deleting = false;

  function tick() {
    const str = TYPED_STRINGS[strIdx % TYPED_STRINGS.length];
    if (!str) return;
    if (!deleting) {
      el.textContent = str.slice(0, ++charIdx);
      if (charIdx === str.length) { deleting = true; setTimeout(tick, 2200); return; }
      setTimeout(tick, 70);
    } else {
      el.textContent = str.slice(0, --charIdx);
      if (charIdx === 0) { deleting = false; strIdx = (strIdx + 1) % TYPED_STRINGS.length; setTimeout(tick, 400); return; }
      setTimeout(tick, 35);
    }
  }

  tick();
}

// ── Scroll Progress ──────────────────────────────────────────
function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;

  window.addEventListener('scroll', () => {
    const pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight) * 100;
    bar.style.width = Math.min(pct, 100) + '%';
  }, { passive: true });
}

// ── Navbar ───────────────────────────────────────────────────
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

window.toggleNav = function () {
  const navbar = document.getElementById('navbar');
  if (navbar) navbar.classList.toggle('nav-open');
};

// ── Scroll Reveal ────────────────────────────────────────────
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  // Observe existing elements
  document.querySelectorAll('.reveal, .timeline-item, .skill-category-card, .project-card').forEach(el => observer.observe(el));

  // Observe dynamic content as it's added
  const mutObserver = new MutationObserver(() => {
    document.querySelectorAll('.reveal:not(.observed), .timeline-item:not(.observed), .skill-category-card:not(.observed), .project-card:not(.observed)').forEach(el => {
      el.classList.add('observed');
      observer.observe(el);
    });
  });
  mutObserver.observe(document.body, { childList: true, subtree: true });
}

// ── Utilities ────────────────────────────────────────────────
function setInnerHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html || '';
}
