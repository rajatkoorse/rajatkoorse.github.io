# Rajat Koorse — GitHub Pages Portfolio

> A fully interactive portfolio website with a dynamic CMS admin panel and personal notes section.
> Live at: **https://rajatkoorse.github.io/**

---

## 🗂 Project Structure

```
rajatkoorse.github.io/
├── index.html              ← Main portfolio page
├── 404.html                ← Custom 404 page
├── _config.yml             ← GitHub Pages config
│
├── assets/
│   ├── css/main.css        ← Portfolio stylesheet (dark navy + cyan theme)
│   └── js/
│       ├── portfolio.js    ← Dynamic content rendering
│       └── particles.js    ← Neural network particle background
│
├── data/
│   ├── portfolio.json      ← All portfolio content (edit via Admin panel)
│   └── notes/
│       ├── index.json      ← Notes metadata index
│       └── note-xxx.json   ← Individual note files
│
├── admin/
│   ├── index.html          ← Admin CMS panel
│   ├── admin.css           ← Admin styles
│   └── admin.js            ← CMS logic + GitHub API integration
│
└── notes/
    ├── index.html          ← Notes viewer
    ├── notes.css           ← Notes styles
    └── notes.js            ← Notes reader + auth logic
```

---

## 🚀 Deployment

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial portfolio setup"
git branch -M main
git remote add origin https://github.com/rajatkoorse/rajatkoorse.github.io.git
git push -u origin main
```

### Step 2: Enable GitHub Pages
1. Go to your repo → **Settings** → **Pages**
2. Source: **Deploy from branch** → `main` → `/ (root)`
3. Click **Save**
4. Your site will be live at `https://rajatkoorse.github.io/` in ~1-2 minutes

---

## ⚙️ Admin Panel Setup (One-Time)

### Step 1: Create a GitHub Personal Access Token
1. Go to [github.com/settings/tokens/new](https://github.com/settings/tokens/new)
2. **Note:** `portfolio-cms`
3. **Expiration:** No expiration (or 1 year)
4. **Scopes:** Check ✅ `repo` (full repository access)
5. Click **Generate token** — copy it immediately!

### Step 2: Configure in Admin Panel
1. Visit `https://rajatkoorse.github.io/admin/`
2. Login with your admin password
3. Go to **Settings** → **GitHub Token**
4. Enter:
   - GitHub Username: `rajatkoorse`
   - Repository: `rajatkoorse.github.io`
   - Token: `ghp_xxxxxxxx...`
5. Click **Save Token** then **Test Connection**

**That's it!** Now when you click **Publish** in the admin panel, your changes go live in ~30 seconds.

---

## 📓 Notes Section

- Visit `https://rajatkoorse.github.io/notes/`
- **Public notes** are visible to anyone
- **Private notes** require admin login
- Create/edit notes from the Admin panel → **Manage Notes**
- Supports full **Markdown** syntax

---

## 🔐 Security Notes

- Admin password is stored as a **SHA-256 hash** — not plain text
- GitHub token is stored in **browser localStorage only** — never committed to the repo
- Notes marked as **private** won't show up for visitors (content is still in the repo though — don't store highly sensitive data)
- To change your admin password: compute SHA-256 of new password and replace the hash in `admin/admin.js` and `notes/notes.js`

### Change Admin Password
```python
import hashlib
new_password = "your-new-password"
print(hashlib.sha256(new_password.encode()).hexdigest())
```
Then replace `ADMIN_PASSWORD_HASH` in `admin/admin.js` and `ADMIN_HASH` in `notes/notes.js`.

---

## 🎨 Customization

All content is in `data/portfolio.json` — edit via the Admin panel or directly.

| File | Purpose |
|------|---------|
| `data/portfolio.json` | All portfolio content |
| `assets/css/main.css` | Colors, fonts, animations |
| `assets/js/portfolio.js` | Rendering logic |
| `data/notes/index.json` | Notes index |

---

Built with ❤️ — No frameworks, no build steps, pure HTML/CSS/JS hosted on GitHub Pages.
