// script.js — MediQueue V3 Shared Utilities
const API = 'https://mediqueue-le7k.onrender.com/api';


/* ── Session ── */
function getUser() { try { return JSON.parse(localStorage.getItem('hq_user')); } catch { return null; } }

function getToken() { return localStorage.getItem('hq_token') || ''; }

function requireAuth(allowedRoles = []) {
    const u = getUser();
    if (!u) { window.location.href = 'index.html'; return false; }
    if (allowedRoles.length && !allowedRoles.includes(u.role)) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

function redirectByRole(role) {
    const map = { patient: 'dashboard.html', doctor: 'doctor-panel.html', medicine_staff: 'medicine-admin.html', admin: 'admin-panel.html' };
    window.location.href = map[role] || 'dashboard.html';
}

/* ── API wrapper (auto-attaches JWT) ── */
async function apiCall(path, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
}

/* ── Toast ── */
function showToast(title, msg = '', type = 'info') {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    let c = document.getElementById('toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'toast-container';
        document.body.appendChild(c);
    }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span>
    <div class="toast-body"><div class="toast-title">${title}</div>${msg?`<div class="toast-msg">${msg}</div>`:''}</div>
    <span class="toast-close" onclick="this.parentElement.remove()">✕</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 4500);
}

/* ── Loading ── */
function showLoading(msg = 'Loading…') {
  let el = document.getElementById('globalLoader');
  if (!el) {
    el = document.createElement('div'); el.id = 'globalLoader'; el.className = 'loading-overlay';
    el.innerHTML = `<div class="spinner spinner-blue" style="width:40px;height:40px;border-width:4px"></div><p>${msg}</p>`;
    document.body.appendChild(el);
  } else { el.querySelector('p').textContent = msg; el.style.display = 'flex'; }
}
function hideLoading() { const el = document.getElementById('globalLoader'); if (el) el.style.display = 'none'; }

/* ── Sidebar (role-aware) ── */
function buildSidebar(active) {
  const user = getUser();
  const role = user?.role || 'patient';

  const patientLinks = [
    { href:'dashboard.html',     icon:'🏠', label:'Dashboard',        id:'dashboard'   },
    { href:'queue-display.html', icon:'📺', label:'Live Queue',       id:'queueboard'  },
    { href:'appointment.html',   icon:'📅', label:'Appointments',     id:'appointment' },
    { href:'token.html',         icon:'🎟️', label:'My Token',         id:'token'       },
    { href:'opd.html',           icon:'📋', label:'OPD Card',         id:'opd'         },
    { href:'medicines.html',     icon:'💊', label:'Medicine Stock',   id:'medicines'   },
    { href:'history.html',       icon:'🕑', label:'Visit History',    id:'history'     },
  ];

  const staffLinks = [];
  if (role === 'doctor' || role === 'admin') {
    staffLinks.push({ href:'doctor-panel.html', icon:'◈', label:'Doctor Panel',   id:'doctor'   });
    staffLinks.push({ href:'entry-scan.html',   icon:'◧', label:'Entry Gate',     id:'entry'    });
  }
  if (role === 'medicine_staff' || role === 'admin') {
    staffLinks.push({ href:'medicine-admin.html', icon:'◦', label:'Medicine Store', id:'medadmin' });
  }
  if (role === 'admin') {
    staffLinks.push({ href:'admin-panel.html', icon:'◉', label:'Administration', id:'admin' });
  }

  const makeLink = l => `<a href="${l.href}" class="sidebar-link ${active===l.id?'active':''}">
    <span class="icon">${l.icon}</span>${l.label}</a>`;

  const avatar = user?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name||'U')}&background=2563eb&color=fff`;
  const roleLabel = { patient:'Patient', doctor:'Doctor', admin:'Administrator', medicine_staff:'Pharmacy Staff' }[role] || role;

  return `
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">🏥</div>
      <div><div class="sidebar-logo-name">MediQueue</div><div class="sidebar-logo-sub">Hospital System</div></div>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-section-label">Patient Services</div>
      ${patientLinks.map(makeLink).join('')}
      ${staffLinks.length ? `<div class="sidebar-section-label" style="margin-top:8px">Staff Access</div>${staffLinks.map(makeLink).join('')}` : ''}
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <img src="${avatar}" class="sidebar-user-avatar" alt="avatar"/>
        <div style="overflow:hidden;flex:1">
          <div class="sidebar-user-name">${user?.name||'User'}</div>
          <div class="sidebar-user-email">${roleLabel}</div>
        </div>
      </div>
      <button class="sidebar-signout" onclick="logout()">
        <span style="font-size:12px">→</span> Sign Out
      </button>
    </div>`;
}

/* ── Navbar ── */
function buildNavbar(title, subtitle = '') {
  const user = getUser();
  const avatar = user?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name||'U')}&background=2563eb&color=fff`;
  return `
    <button class="hamburger" onclick="toggleMobileSidebar()"><span></span><span></span><span></span></button>
    <div class="navbar-left">
      <div><div class="navbar-title">${title}</div>${subtitle?`<div class="navbar-subtitle">${subtitle}</div>`:''}</div>
    </div>
    <div class="navbar-right">
      <img src="${avatar}" class="navbar-avatar" alt="avatar"/>
      <span class="navbar-user-name">${user?.name||'User'}</span>
      <button class="btn btn-surface btn-sm" onclick="logout()">Sign Out</button>
    </div>`;
}

/* ── Mobile sidebar ── */
function toggleMobileSidebar() {
  document.querySelector('.sidebar')?.classList.toggle('mobile-open');
  document.getElementById('sidebarBackdrop')?.classList.toggle('show');
}

/* ── Status badges ── */
function statusBadge(s) {
  const m = {
    waiting:   ['badge-yellow','⏳','Waiting'],
    called:    ['badge-blue',  '📢','Called'],
    completed: ['badge-green', '✅','Completed'],
    cancelled: ['badge-red',   '❌','Cancelled'],
  };
  const [cls,icon,label] = m[s]||['badge-gray','❔',s];
  return `<span class="badge ${cls}"><span>${icon}</span>${label}</span>`;
}
function apptStatusBadge(s) {
  const m = {
    pending:   ['badge-yellow','⏳','Pending'],
    confirmed: ['badge-blue', '✅','Confirmed'],
    visited:   ['badge-green','🏥','Visited'],
    cancelled: ['badge-red',  '❌','Cancelled'],
  };
  const [cls,icon,label] = m[s]||['badge-gray','❔',s];
  return `<span class="badge ${cls}"><span>${icon}</span>${label}</span>`;
}
function medStatusBadge(s) {
  const cls   = { pending:'med-status-pending', preparing:'med-status-preparing', ready:'med-status-ready', dispensed:'med-status-dispensed' };
  const icons = { pending:'⏳', preparing:'🔄', ready:'✅', dispensed:'📦' };
  const label = { pending:'Pending', preparing:'Preparing', ready:'Ready for Pickup', dispensed:'Dispensed' };
  return `<span class="${cls[s]||'med-status-pending'}">${icons[s]||'⏳'} ${label[s]||s}</span>`;
}

/* ── Date helpers ── */
function fmtDate(d) { if(!d) return '—'; return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function fmtTime(d) { if(!d) return '—'; return new Date(d).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}); }
function fmtDateTime(d) { return d ? `${fmtDate(d)}, ${fmtTime(d)}` : '—'; }

const DEPARTMENTS = [
  { id:'General',     icon:'🏥', label:'General OPD',  room:'OPD-101' },
  { id:'ENT',         icon:'👂', label:'ENT',           room:'OPD-205' },
  { id:'Cardiology',  icon:'❤️', label:'Cardiology',    room:'OPD-310' },
  { id:'Orthopedics', icon:'🦴', label:'Orthopedics',   room:'OPD-412' },
  { id:'Pediatrics',  icon:'👶', label:'Pediatrics',    room:'OPD-115' },
];