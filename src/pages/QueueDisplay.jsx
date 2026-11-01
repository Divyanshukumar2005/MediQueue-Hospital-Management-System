import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useQueueStatus from '../hooks/useQueueStatus';
import { ROUTES, roleHome } from '../lib/routes';
import './QueueDisplay.css';

const pad = (n) => String(n).padStart(3, '0');

const NavIcon = ({ children }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">{children}</svg>
);

export default function QueueDisplay() {
  const { user } = useAuth();
  const { queues, loading, error, lastUpdated } = useQueueStatus({ pollMs: 10000 });
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = '#F5F4F0';
    return () => { document.body.style.background = prev; };
  }, []);

  const shown = queues.filter((q) => filter === 'all' || q.department === filter);

  return (
    <div className="qd-page">
      <div style={{ background: '#fff', borderBottom: '0.5px solid #D3D1C7', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🏥</span>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#2C2C2A' }}>MediQueue</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {user ? (
            <>
              <Link to={roleHome(user.role)} className="nav-btn">
                <NavIcon>
                  <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
                  <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
                  <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
                  <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
                </NavIcon> Patient Dashboard
              </Link>
              {user.role === 'patient' && (
                <Link to={ROUTES.appointment} className="nav-btn">
                  <NavIcon>
                    <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </NavIcon> Book Appointment
                </Link>
              )}
              {['doctor', 'admin'].includes(user.role) && (
                <Link to={ROUTES.doctor} className="nav-btn primary">
                  <NavIcon>
                    <circle cx="8" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </NavIcon> Doctor Panel
                </Link>
              )}
            </>
          ) : (
            <Link to={ROUTES.login} className="nav-btn primary">Login</Link>
          )}
        </div>
      </div>

      <div style={{ padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 style={{ color: '#2C2C2A', fontSize: '1.6rem', fontWeight: 700 }}>Live Token Display</h1>
          <p style={{ color: '#888780', marginTop: 4, fontSize: '.85rem' }}>
            <span className="qd-live"><span className="live-dot" />LIVE</span>{' '}
            {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Updates in real time` : 'Loading queue data…'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
          <button className={`filter-btn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>🏥 All Departments</button>
          {queues.map((q) => (
            <button key={q.department} className={`filter-btn${filter === q.department ? ' active' : ''}`} onClick={() => setFilter(q.department)}>{q.icon} {q.label || q.department}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {loading ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48 }}>
              <div className="qd-spinner" />
              <p style={{ color: '#888780', marginTop: 16, fontSize: '.9rem' }}>Loading queue data…</p>
            </div>
          ) : error && !queues.length ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <p style={{ color: '#888780' }}>Could not load queue data. Server may be offline.</p>
            </div>
          ) : shown.map((q) => {
            const hasActive = q.current_token !== null && q.current_token !== undefined;
            const pct = q.total_today > 0 ? Math.round((q.completed_count / q.total_today) * 100) : 0;
            return (
              <div className="dept-board" key={q.department}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>{q.icon || '🏥'}</span>
                    <div>
                      <div style={{ color: '#2C2C2A', fontWeight: 600, fontSize: '.95rem' }}>{q.department}</div>
                      <div style={{ color: '#888780', fontSize: '.74rem' }}>Room {q.room_number || '—'}</div>
                    </div>
                  </div>
                  <span style={{ background: '#EAF3DE', color: '#27500A', fontSize: '.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 99, border: '0.5px solid #C0DD97' }}>● Open</span>
                </div>

                <div style={{ textAlign: 'center', padding: 18, background: hasActive ? '#E1F5EE' : '#F5F4F0', borderRadius: 12, border: `0.5px solid ${hasActive ? '#5DCAA5' : '#D3D1C7'}`, marginBottom: 14 }}>
                  <div style={{ fontSize: '.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', color: hasActive ? '#0F6E56' : '#B4B2A9', marginBottom: 6 }}>Now Serving</div>
                  <div className={`token-big ${hasActive ? 'pulse' : ''}`} style={{ color: hasActive ? '#0F6E56' : '#C8C6BE' }}>
                    {hasActive ? '#' + pad(q.current_token) : '—'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                  <div className="stat-box" style={{ background: '#FAEEDA', border: '0.5px solid #FAC775' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 700, color: '#633806' }}>{q.waiting_count}</div>
                    <div style={{ fontSize: '.68rem', color: '#854F0B', marginTop: 2 }}>Waiting</div>
                  </div>
                  <div className="stat-box" style={{ background: '#EAF3DE', border: '0.5px solid #C0DD97' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 700, color: '#27500A' }}>{q.completed_count}</div>
                    <div style={{ fontSize: '.68rem', color: '#3B6D11', marginTop: 2 }}>Completed</div>
                  </div>
                  <div className="stat-box" style={{ background: '#E6F1FB', border: '0.5px solid #B5D4F4' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 700, color: '#0C447C' }}>{q.total_today}</div>
                    <div style={{ fontSize: '.68rem', color: '#185FA5', marginTop: 2 }}>Total Today</div>
                  </div>
                </div>

                {q.next_token ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#F5F4F0', borderRadius: 8, border: '0.5px solid #D3D1C7' }}>
                    <span style={{ fontSize: '.77rem', color: '#888780' }}>Next up</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#444441' }}>#{pad(q.next_token)}</span>
                  </div>
                ) : null}

                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.71rem', color: '#B4B2A9', marginBottom: 4 }}>
                    <span>Daily Progress</span><span>{pct}%</span>
                  </div>
                  <div style={{ height: 5, background: '#ECEAE3', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#185FA5,#1D9E75)', borderRadius: 99, transition: 'width .6s' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
