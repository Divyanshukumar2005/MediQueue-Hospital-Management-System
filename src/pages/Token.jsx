import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import Layout from '../components/Layout';
import { MedStatusBadge, StatusBadge } from '../components/Badges';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useDepartments } from '../context/DepartmentsContext';
import useQueueStatus from '../hooks/useQueueStatus';
import { ROUTES } from '../lib/routes';
import { fmtDate, fmtDateTime, istToday } from '../lib/utils';
import { cancelToken, getMyMedicineRequests, getMyTokens, subscribeToTable } from '../services/api';

const ACTIVE = ['waiting', 'called'];
const infoBox = { background: 'var(--c-primary-lt)', borderRadius: 'var(--r-md)', padding: 14, textAlign: 'center' };

function Info({ label, value, style }) {
  return (
    <div className="token-info-item">
      <div className="label">{label}</div>
      <div className="value" style={style}>{value}</div>
    </div>
  );
}

function LocBox({ icon, label, value }) {
  return (
    <div style={infoBox}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: '.78rem', color: 'var(--c-ink-4)' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '.88rem' }}>{value}</div>
    </div>
  );
}

function fmtClock(ms) {
  const d = new Date(ms);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function Token() {
  const { user } = useAuth();
  const { toast } = useUI();
  const { getDept } = useDepartments();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const urlId = params.get('id');

  const [token, setToken] = useState(undefined); // undefined = loading, null = none
  const [qr, setQr] = useState('');
  const [medReq, setMedReq] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const calledToast = useRef(false);
  const { queues, lastUpdated, refresh } = useQueueStatus({ pollMs: 30000 });

  const load = useCallback(async () => {
    try {
      const tokens = await getMyTokens();
      const today = istToday();
      let t = null;
      if (urlId) t = tokens.find((x) => String(x.id) === urlId) || null;
      if (!t) {
        let stored = null;
        try {
          stored = localStorage.getItem('hq_lastTokenId');
        } catch {
          /* ignore */
        }
        if (stored && !urlId) {
          const f = tokens.find((x) => String(x.id) === stored);
          if (f && f.appt_date === today) t = f;
        }
      }
      if (!t) t = tokens.find((x) => ACTIVE.includes(x.status) && x.appt_date === today) || null;
      if (t) {
        try {
          localStorage.setItem('hq_lastTokenId', String(t.id));
        } catch {
          /* ignore */
        }
      }
      setToken(t);
    } catch {
      setToken((prev) => (prev === undefined ? null : prev));
    }
  }, [urlId]);

  const loadMed = useCallback(async () => {
    try {
      const reqs = await getMyMedicineRequests();
      const today = istToday();
      setMedReq(reqs.find((r) => (r.created_at || '').slice(0, 10) >= today || new Date(r.created_at).toDateString() === new Date().toDateString()) || null);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    load();
    loadMed();
  }, [load, loadMed]);

  // realtime: my own token row + my medicine requests
  useEffect(() => {
    if (!user?.id) return undefined;
    const a = subscribeToTable({ table: 'tokens', filter: `user_id=eq.${user.id}` }, () => {
      load();
      refresh();
    });
    const b = subscribeToTable({ table: 'medicine_requests', filter: `user_id=eq.${user.id}` }, loadMed);
    return () => {
      a();
      b();
    };
  }, [user?.id, load, loadMed, refresh]);

  // QR
  useEffect(() => {
    if (!token) return;
    let off = false;
    QRCode.toDataURL(token.token_uid || String(token.id), {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: '#1e40af', light: '#ffffff' },
    })
      .then((u) => !off && setQr(u))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [token?.token_uid, token?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = useMemo(() => (token ? queues.find((x) => x.department === token.department) : null), [queues, token]);
  const dept = token ? getDept(token.department) : null;
  const active = token && ACTIVE.includes(token.status);
  const isToday = token && token.appt_date === istToday();

  // live numbers
  const avgMin = q?.avg_minutes_per_patient || 10;
  let ahead = token?.tokens_ahead ?? 0;
  if (active && isToday && q) {
    ahead = q.current_token != null ? Math.max(0, token.token_number - q.current_token - 1) : token.tokens_ahead || 0;
  }
  const waitText = !active ? '—' : ahead > 0 ? `~${ahead * avgMin} min` : '🔔 Your turn soon!';
  const callTime = !active ? '—' : ahead > 0 ? fmtClock(Date.now() + ahead * avgMin * 60000) : 'Head out now!';
  const nowServing = !q ? '—' : q.current_token ? `#${q.current_token}` : 'Not started';

  // "your turn" toast
  useEffect(() => {
    if (token?.status === 'called' && !calledToast.current) {
      calledToast.current = true;
      toast('🔔 Your Turn!', `Token #${token.token_number} — please proceed to ${token.room_number || 'the room'}`, 'success');
    }
  }, [token?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function doCancel() {
    if (!token) return;
    if (!window.confirm(`Cancel token #${token.token_number} (${token.department})?\n\nYou will lose your queue position. This cannot be undone.`)) return;
    setCancelling(true);
    try {
      await cancelToken(token.id);
      toast('Token Cancelled', `Token #${token.token_number} has been cancelled.`, 'info');
      setTimeout(() => nav(ROUTES.appointment), 1400);
    } catch (e) {
      setCancelling(false);
      toast('Error', e.message, 'error');
    }
  }

  async function manualRefresh() {
    await Promise.all([refresh(), load()]);
    toast('Refreshed', 'Queue status updated.', 'info');
  }

  const pct = { waiting: 25, called: 75, completed: 100, cancelled: 0 }[token?.status] ?? 25;
  const steps = token
    ? [
        { label: 'Token Generated', done: true, icon: '✅' },
        { label: 'In Queue', done: ['waiting', 'called', 'completed'].includes(token.status), icon: '⏳' },
        { label: 'Your Turn Called', done: ['called', 'completed'].includes(token.status), icon: '📢' },
        { label: 'Consultation Done', done: token.status === 'completed', icon: '🏁' },
      ]
    : [];

  return (
    <Layout active="token" title="My Token" subtitle="QR Code & Queue Status">
      <div className="page-header slide-up">
        <div className="breadcrumb"><Link to={ROUTES.dashboard}>Home</Link> › My Token</div>
        <h1>📱 My Queue Token</h1>
        <p>Show this QR code at the department counter. Live status updates automatically.</p>
      </div>

      {token === undefined && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner spinner-blue" style={{ width: 40, height: 40, borderWidth: 4, margin: '0 auto 16px' }} />
            <p>Loading your token…</p>
          </div>
        </div>
      )}

      {token === null && (
        <div className="card card-xl" style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎟️</div>
          <h2 style={{ color: 'var(--c-ink-2)', marginBottom: 8 }}>No Active Token</h2>
          <p style={{ marginBottom: 24 }}>You don't have an active token today. Book an appointment to get one.</p>
          <Link to={ROUTES.appointment} className="btn btn-primary btn-lg">📅 Book Appointment</Link>
        </div>
      )}

      {token && (
        <div className="token-layout" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'start' }}>
          <style>{`@media (max-width:768px){.token-layout{grid-template-columns:1fr !important}}`}</style>

          <div className="qr-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--c-ink-4)' }}>Your Token</div>
                <div className="qr-token-number">#{token.token_number}</div>
              </div>
              <StatusBadge status={token.status} />
            </div>

            <div className="qr-image-wrap">
              {qr ? <img src={qr} alt={`QR for token ${token.token_number}`} width={200} height={200} /> : <div className="spinner spinner-blue" />}
            </div>

            <div className="token-info-grid">
              <Info label="Department" value={token.department || '—'} />
              <Info label="Room" value={token.room_number || '—'} />
              <Info label="Est. Wait" value={waitText} />
              <Info label="Tokens Ahead" value={active ? ahead : '—'} />
              <Info label="Doctor" value={token.doctor_name || 'Any Available'} />
              <Info label="Appointment Date" value={fmtDate(token.appt_date)} />
              <Info label="Now Serving" value={isToday ? nowServing : '—'} style={{ fontWeight: 800, color: 'var(--c-primary-dk)' }} />
              <Info label="Issued" value={fmtDateTime(token.created_at)} style={{ fontSize: '.8rem' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => window.print()}>🖨️ Print</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={manualRefresh}>🔄 Refresh</button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: '.72rem', color: 'var(--c-ink-4)' }}>
              {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : '—'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <h4 style={{ marginBottom: 14 }}>📍 Location Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <LocBox icon="🏥" label="Building" value="OPD Block A" />
                <LocBox icon="🚪" label="Room" value={token.room_number || dept?.room_number || '—'} />
                <LocBox icon="🏢" label="Floor" value={dept?.floor || 'Ground'} />
                <LocBox icon="⏰" label="Est. Call Time" value={callTime} />
              </div>
              <div style={{ marginTop: 14, padding: 14, background: 'linear-gradient(135deg,rgba(37,99,235,.08),rgba(99,102,241,.06))', borderRadius: 'var(--r-md)', border: '1px solid var(--c-primary-lt)' }}>
                <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--c-ink-2)', marginBottom: 8 }}>🚖 Need a ride to hospital?</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href="https://ola.com" target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Ola Cab</a>
                  <a href="https://uber.com" target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Uber</a>
                  <a href="https://www.rapido.bike" target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Rapido</a>
                </div>
                <p style={{ fontSize: '.74rem', color: 'var(--c-ink-4)', marginTop: 6 }}>Book in advance based on your estimated wait time</p>
              </div>
            </div>

            <div className="whatsapp-box">
              <div className="whatsapp-icon">💬</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--c-ink)' }}>
                  WhatsApp Notifications <span className="whatsapp-coming-soon">Coming Soon</span>
                </div>
                <p style={{ fontSize: '.78rem', color: 'var(--c-ink-3)', marginTop: 2 }}>
                  Get notified on WhatsApp when your token is about to be called. We'll alert you 5 minutes before so you don't have to wait at the counter.
                </p>
              </div>
            </div>

            <div className="card">
              <h4 style={{ marginBottom: 6 }}>📊 Queue Progress</h4>
              <p style={{ fontSize: '.82rem', marginBottom: 14 }}>Your position in today's queue</p>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem', color: 'var(--c-ink-3)', marginBottom: 6 }}>
                  <span>Progress</span>
                  <span>{pct}%</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
              </div>
              {steps.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, background: s.done ? 'var(--green-100)' : 'var(--c-surface2)', opacity: s.done ? 1 : 0.5 }}>
                    {s.done ? s.icon : '○'}
                  </div>
                  <span style={{ fontSize: '.84rem', fontWeight: s.done ? 600 : 400, color: s.done ? 'var(--c-ink)' : 'var(--c-ink-4)' }}>{s.label}</span>
                </div>
              ))}
            </div>

            {medReq && (
              <div className="card">
                <h4 style={{ marginBottom: 12 }}>💊 Medicine Status</h4>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, background: 'var(--c-surface2)', borderRadius: 'var(--r-md)' }}>
                  <div>
                    <div style={{ fontSize: '.85rem', fontWeight: 600 }}>Today's prescription sent to medicine store</div>
                    <div style={{ fontSize: '.78rem', color: 'var(--c-ink-3)', marginTop: 2 }}>{(medReq.prescription_text || '').substring(0, 60)}…</div>
                  </div>
                  <MedStatusBadge status={medReq.status} />
                </div>
                {medReq.status === 'ready' && (
                  <div style={{ marginTop: 10, padding: 10, background: 'var(--green-100)', borderRadius: 'var(--r-md)', fontSize: '.84rem', fontWeight: 600, color: '#15803d', textAlign: 'center' }}>
                    ✅ Medicine ready! Please collect from Medicine Store (Room G-05)
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {active && (
                <button className="btn btn-danger btn-sm" onClick={doCancel} disabled={cancelling}>🗑️ Cancel Token</button>
              )}
              <Link to={ROUTES.appointment} className="btn btn-outline btn-sm">← New Appointment</Link>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
