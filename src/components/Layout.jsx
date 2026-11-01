import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../lib/routes';
import { avatarUrl, ROLE_LABELS } from '../lib/utils';

const PATIENT_LINKS = [
  { to: ROUTES.dashboard, icon: '🏠', label: 'Dashboard', id: 'dashboard' },
  { to: ROUTES.queue, icon: '📺', label: 'Live Queue', id: 'queueboard' },
  { to: ROUTES.appointment, icon: '📅', label: 'Appointments', id: 'appointment' },
  { to: ROUTES.token, icon: '🎟️', label: 'My Token', id: 'token' },
  { to: ROUTES.opd, icon: '📋', label: 'OPD Card', id: 'opd' },
  { to: ROUTES.medicines, icon: '💊', label: 'Medicine Stock', id: 'medicines' },
  { to: ROUTES.history, icon: '🕑', label: 'Visit History', id: 'history' },
];

function staffLinks(role) {
  const l = [];
  if (role === 'doctor' || role === 'admin') {
    l.push({ to: ROUTES.doctor, icon: '◈', label: 'Doctor Panel', id: 'doctor' });
    l.push({ to: ROUTES.entry, icon: '◧', label: 'Entry Gate', id: 'entry' });
  }
  if (role === 'medicine_staff' || role === 'admin') l.push({ to: ROUTES.medicineAdmin, icon: '◦', label: 'Medicine Store', id: 'medadmin' });
  if (role === 'admin') l.push({ to: ROUTES.admin, icon: '◉', label: 'Administration', id: 'admin' });
  return l;
}

/** Sidebar + top navbar + content frame used by every signed-in page. */
export default function Layout({ active, title, subtitle, children }) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const role = user?.role || 'patient';
  const extra = staffLinks(role);
  const avatar = user?.photo_url || avatarUrl(user?.name);
  const link = (l) => (
    <Link key={l.id} to={l.to} className={`sidebar-link ${active === l.id ? 'active' : ''}`}>
      <span className="icon">{l.icon}</span>
      {l.label}
    </Link>
  );

  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🏥</div>
          <div>
            <div className="sidebar-logo-name">MediQueue</div>
            <div className="sidebar-logo-sub">Hospital System</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Patient Services</div>
          {PATIENT_LINKS.map(link)}
          {extra.length > 0 && (
            <>
              <div className="sidebar-section-label" style={{ marginTop: 8 }}>Staff Access</div>
              {extra.map(link)}
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <img src={avatar} className="sidebar-user-avatar" alt="avatar" referrerPolicy="no-referrer" />
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div className="sidebar-user-name">{user?.name || 'User'}</div>
              <div className="sidebar-user-email">{ROLE_LABELS[role] || role}</div>
            </div>
          </div>
          <button className="sidebar-signout" onClick={signOut}>
            <span style={{ fontSize: 12 }}>→</span> Sign Out
          </button>
        </div>
      </aside>

      <nav className="navbar">
        <button className="hamburger" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          <span /><span /><span />
        </button>
        <div className="navbar-left">
          <div>
            <div className="navbar-title">{title}</div>
            {subtitle ? <div className="navbar-subtitle">{subtitle}</div> : null}
          </div>
        </div>
        <div className="navbar-right">
          <img src={avatar} className="navbar-avatar" alt="avatar" referrerPolicy="no-referrer" />
          <span className="navbar-user-name">{user?.name || 'User'}</span>
          <button className="btn btn-surface btn-sm" onClick={signOut}>Sign Out</button>
        </div>
      </nav>

      <div className="app-layout">
        <div className="main-content">{children}</div>
      </div>
    </>
  );
}
