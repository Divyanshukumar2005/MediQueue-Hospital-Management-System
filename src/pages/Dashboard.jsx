import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { ApptStatusBadge } from '../components/Badges';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useDepartments } from '../context/DepartmentsContext';
import useQueueStatus from '../hooks/useQueueStatus';
import { cancelAppointment, getMyAppointments, getMyMedicineRequests, getMyTokens, getOpdCard, subscribeToTable } from '../services/api';
import { ROUTES } from '../lib/routes';
import { fmtDate, fmtLongDate, greeting, istToday } from '../lib/utils';

const medLabels = { pending: '⏳ Pending', preparing: '🔄 Preparing', ready: '✅ Ready!', dispensed: '✅ Done' };
const statBtn = { cursor: 'pointer' };
const miniBox = { textAlign: 'center', padding: 8, background: 'rgba(255,255,255,.7)', borderRadius: 'var(--r-md)' };
const qaIcon = (bg, color) => ({ width: 44, height: 44, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, fontFamily: 'var(--font-mono)', fontWeight: 600, color });

function Spin({ text }) {
  return (
    <div className="empty-state">
      <div className="spinner spinner-blue" />
      <p>{text}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useUI();
  const { byName } = useDepartments();
  const { queues } = useQueueStatus();
  const [appts, setAppts] = useState(null);
  const [apptError, setApptError] = useState('');
  const [tokens, setTokens] = useState([]);
  const [meds, setMeds] = useState([]);
  const [visits, setVisits] = useState(0);
  const [cancelTarget, setCancelTarget] = useState(null);
  const today = istToday();

  const load = useCallback(async () => {
    try {
      setAppts(await getMyAppointments());
      setApptError('');
    } catch (e) {
      setApptError(e.message);
    }
    getMyTokens().then(setTokens).catch(() => {});
    getMyMedicineRequests().then(setMeds).catch(() => {});
    getOpdCard(user.id).then((c) => setVisits(c?.visits?.length || 0)).catch(() => setVisits(0));
  }, [user.id]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 60000); // fallback — realtime below normally keeps this fresh
    const u1 = subscribeToTable({ table: 'medicine_requests', filter: `user_id=eq.${user.id}` }, load);
    const u2 = subscribeToTable({ table: 'tokens', filter: `user_id=eq.${user.id}` }, load);
    return () => {
      clearInterval(poll);
      u1();
      u2();
    };
  }, [load, user.id]);

  const upcoming = useMemo(
    () => (appts || []).filter((a) => ['pending', 'confirmed'].includes(a.status) && a.appt_date >= today),
    [appts, today]
  );
  const myToken = tokens.find((t) => t.appt_date === today && ['waiting', 'called'].includes(t.status)) || null;
  const nextAppt = [...upcoming].sort((a, b) => a.appt_date.localeCompare(b.appt_date))[0];
  const todayReq = meds.find((r) => new Date(r.created_at).toDateString() === new Date().toDateString());
  const readyReq = meds.find((r) => r.status === 'ready');

  async function confirmCancel() {
    const id = cancelTarget.id;
    setCancelTarget(null);
    try {
      await cancelAppointment(id);
      toast('Appointment Cancelled', 'Your appointment has been cancelled.', 'info');
      load();
    } catch (e) {
      toast('Error', e.message, 'error');
    }
  }

  return (
    <Layout active="dashboard" title="Dashboard" subtitle={fmtLongDate(today)}>
      <div className="page-header slide-up">
        <h1>{greeting()}, {(user.name || '').split(' ')[0]}</h1>
        <p>Here is your health summary for today.</p>
      </div>

      <div className="stats-grid stagger">
        <Link to={ROUTES.appointment} className="stat-card" style={statBtn}>
          <div className="stat-icon stat-icon-blue">📅</div>
          <div className="stat-value">{appts ? upcoming.length : '—'}</div>
          <div className="stat-label">Upcoming Appointments</div>
        </Link>
        <Link to={ROUTES.token} className="stat-card" style={statBtn}>
          <div className="stat-icon stat-icon-green">🎟️</div>
          <div className="stat-value" style={{ fontSize: '.88rem' }}>{appts ? (nextAppt ? fmtDate(nextAppt.appt_date) : 'No Token') : '—'}</div>
          <div className="stat-label">Today's Token</div>
        </Link>
        <Link to={ROUTES.opd} className="stat-card" style={statBtn}>
          <div className="stat-icon stat-icon-purple">📋</div>
          <div className="stat-value">{visits}</div>
          <div className="stat-label">Total OPD Visits</div>
        </Link>
        <Link to={ROUTES.medicines} className="stat-card" style={statBtn}>
          <div className="stat-icon stat-icon-yellow">💊</div>
          <div className="stat-value" style={{ fontSize: '.88rem' }}>{todayReq ? medLabels[todayReq.status] || todayReq.status : 'No request'}</div>
          <div className="stat-label">Medicine Status</div>
        </Link>
      </div>

      {readyReq && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(34,197,94,.15),rgba(34,197,94,.08))', border: '1.5px solid rgba(34,197,94,.4)', borderRadius: 'var(--r-lg)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 32 }}>💊</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#15803d' }}>Your medicine is ready for pickup!</div>
              <div style={{ fontSize: '.83rem', color: 'var(--c-ink-2)', marginTop: 2 }}>Please collect your prescription from the Medicine Store — Room G-05.</div>
            </div>
            <Link to={ROUTES.medicines} className="btn btn-success btn-sm">View Details</Link>
          </div>
        </div>
      )}

      <div className="card card-xl slide-up" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Quick Actions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
          {[
            [ROUTES.appointment, 'var(--c-primary-lt)', 'var(--c-primary)', '📅', 'Book Appointment', 'Select date and doctor'],
            [ROUTES.token, 'var(--green-100)', 'var(--c-ok)', '📱', 'My Token', 'View QR code'],
            [ROUTES.opd, 'var(--purple-100)', '#7c3aed', '📋', 'OPD Card', 'Health record'],
            [ROUTES.medicines, 'var(--teal-100)', 'var(--c-warn)', '💊', 'Medicine Stock', 'Check availability'],
            [ROUTES.history, 'var(--yellow-100)', 'var(--c-ink-3)', '🕑', 'Visit History', 'Past records'],
          ].map(([to, bg, color, icon, title, sub]) => (
            <Link key={to} to={to} className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
              <div style={qaIcon(bg, color)}>{icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--c-ink)' }}>{title}</div>
                <div style={{ fontSize: '.74rem', color: 'var(--c-ink-4)' }}>{sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="table-wrapper slide-up" style={{ marginBottom: 24 }}>
        <div className="table-header">
          <h3>Upcoming Appointments</h3>
          <Link to={ROUTES.appointment} className="btn btn-primary btn-sm">Book New</Link>
        </div>
        {apptError ? (
          <div className="empty-state"><p>{apptError}</p></div>
        ) : appts === null ? (
          <Spin text="Loading appointments…" />
        ) : !upcoming.length ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <h4>No upcoming appointments</h4>
            <p>Book an appointment to receive a queue token for your visit.</p>
            <Link to={ROUTES.appointment} className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>Book Appointment</Link>
          </div>
        ) : (
          <table>
            <thead><tr><th>Date</th><th>Department</th><th>Doctor</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {upcoming.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600, fontSize: '.88rem' }}>{fmtDate(a.appt_date)}</td>
                  <td>{byName[a.department]?.icon || ''} {a.department}</td>
                  <td style={{ fontSize: '.85rem' }}>{a.doctor?.name || 'Any Available Doctor'}</td>
                  <td><ApptStatusBadge status={a.status} /></td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {a.token_id ? (
                      <Link to={`${ROUTES.token}?id=${a.token_id}`} className="btn btn-outline btn-sm">View Token</Link>
                    ) : a.appt_date === today ? (
                      <Link to={ROUTES.appointment} className="btn btn-primary btn-sm">Get Token</Link>
                    ) : (
                      <span style={{ fontSize: '.78rem', color: 'var(--c-ink-4)' }}>Token on visit day</span>
                    )}
                    <button className="btn btn-sm" style={{ color: '#dc2626', border: '1px solid #fca5a5', background: 'transparent' }} onClick={() => setCancelTarget(a)}>🗑️ Cancel</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="table-wrapper slide-up" style={{ marginBottom: 24 }}>
        <div className="table-header">
          <h3>Live Queue Status</h3>
          <span className="live-badge"><span className="live-dot" />Live</span>
        </div>
        {!queues.length ? (
          <Spin text="Loading queue data…" />
        ) : (
          queues.map((q) => {
            const pct = q.total_today > 0 ? Math.round((q.completed_count / q.total_today) * 100) : 0;
            const mine = myToken && myToken.department === q.department;
            return (
              <div key={q.department} style={{ padding: '16px 24px', borderBottom: '1px solid var(--c-surface2)', ...(mine ? { background: 'var(--c-primary-lt)' } : {}) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{q.icon || '🏥'}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '.92rem' }}>{q.department} {mine && <span className="badge badge-blue" style={{ fontSize: '.7rem' }}>Your Dept</span>}</div>
                      <div style={{ fontSize: '.75rem', color: 'var(--c-ink-4)' }}>Room {q.room_number || '—'}</div>
                    </div>
                  </div>
                  <span className="badge badge-green"><span className="dot dot-green" />Open</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
                  {[
                    [q.current_token || '—', 'Now Serving', 'var(--c-primary-dk)'],
                    [q.waiting_count, 'Waiting', 'var(--yellow-500)'],
                    [q.completed_count, 'Completed', 'var(--green-500)'],
                    [q.total_today, 'Total Today', 'var(--c-ink-2)'],
                  ].map(([v, l, c]) => (
                    <div key={l} style={miniBox}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: '1.4rem', fontWeight: 800, color: c }}>{v}</div>
                      <div style={{ fontSize: '.7rem', color: 'var(--c-ink-4)' }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.74rem', color: 'var(--c-ink-4)', marginBottom: 4 }}>
                    <span>Daily Progress</span><span>{pct}%</span>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                </div>
                {mine && (
                  <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--c-primary-lt)', borderRadius: 'var(--r-md)', fontSize: '.8rem', color: 'var(--c-primary-dk)', fontWeight: 500 }}>
                    Your token #{myToken.token_number} — {q.current_token ? `${Math.max(0, myToken.token_number - q.current_token)} patients ahead` : 'Not yet called'}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {cancelTarget && (
        <div style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--c-bg)', borderRadius: 'var(--r-lg)', padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
              <h3 style={{ marginBottom: 8, color: '#dc2626' }}>Cancel Appointment?</h3>
              <p style={{ fontSize: '.88rem', color: 'var(--c-ink-2)' }}>Cancel your {cancelTarget.department} appointment on {fmtDate(cancelTarget.appt_date)}? This cannot be undone.</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-outline btn-full" onClick={() => setCancelTarget(null)}>← Go Back</button>
              <button className="btn btn-full" style={{ background: '#dc2626', color: '#fff', border: 'none' }} onClick={confirmCancel}>Yes, Cancel It</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
