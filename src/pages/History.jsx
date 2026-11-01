import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { StatusBadge } from '../components/Badges';
import { useAuth } from '../context/AuthContext';
import { useDepartments } from '../context/DepartmentsContext';
import { ROUTES } from '../lib/routes';
import { fmtDate, fmtDateTime } from '../lib/utils';
import { getMyTokens, getOpdCard } from '../services/api';

const Spin = () => (
  <div className="empty-state"><div className="spinner spinner-blue" /><p>Loading…</p></div>
);

export default function History() {
  const { user } = useAuth();
  const { byName } = useDepartments();
  const [tokens, setTokens] = useState(null);
  const [tokErr, setTokErr] = useState('');
  const [visits, setVisits] = useState(null); // null loading, false = no card
  const [dateQ, setDateQ] = useState('');
  const [docQ, setDocQ] = useState('');

  useEffect(() => {
    getMyTokens().then(setTokens).catch((e) => { setTokErr(e.message); setTokens([]); });
    getOpdCard(user.id).then((c) => setVisits(c ? c.visits || [] : false)).catch(() => setVisits(false));
  }, [user.id]);

  const dq = dateQ.trim().toLowerCase();
  const oq = docQ.trim().toLowerCase();
  const filtered = Array.isArray(visits)
    ? visits.filter((v) => (!dq || fmtDate(v.visit_date).toLowerCase().includes(dq)) && (!oq || (v.doctor_name || '').toLowerCase().includes(oq)))
    : [];

  return (
    <Layout active="history" title="History" subtitle="Tokens & visits">
      <div className="page-header slide-up">
        <div className="breadcrumb"><Link to={ROUTES.dashboard}>Home</Link> › History</div>
        <h1>🕑 Visit History</h1>
        <p>All your past visits and token history.</p>
      </div>

      <div className="table-wrapper slide-up" style={{ marginBottom: 24 }}>
        <div className="table-header">
          <h3>🎟️ All My Tokens</h3>
          <span className="badge badge-blue">{tokens ? `${tokens.length} tokens` : '—'}</span>
        </div>
        {tokens === null ? <Spin /> : tokErr ? (
          <div className="empty-state"><p>{tokErr}</p></div>
        ) : !tokens.length ? (
          <div className="empty-state"><div className="empty-icon">🎟️</div><h4>No tokens yet</h4><p>Tokens you generate will appear here</p></div>
        ) : (
          <table>
            <thead><tr><th>Token</th><th>Department</th><th>Room</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td><span className="td-mono">#{t.token_number}</span></td>
                  <td>{byName[t.department]?.icon || ''} {t.department}</td>
                  <td>{t.room_number || '—'}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td style={{ fontSize: '.82rem', color: 'var(--c-ink-4)' }}>{fmtDateTime(t.created_at)}</td>
                  <td><Link to={`${ROUTES.token}?id=${t.id}`} className="btn btn-outline btn-sm">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="table-wrapper slide-up">
        <div className="table-header">
          <h3>📋 OPD Visit Records</h3>
          <Link to={ROUTES.opd} className="btn btn-outline btn-sm">View Full OPD Card</Link>
        </div>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--c-surface2)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input type="text" className="form-control" placeholder="🗓️ Search by date (e.g. Apr 2025)" style={{ maxWidth: 220, fontSize: '.85rem' }} value={dateQ} onChange={(e) => setDateQ(e.target.value)} />
          <input type="text" className="form-control" placeholder="👨‍⚕️ Search by doctor name" style={{ maxWidth: 220, fontSize: '.85rem' }} value={docQ} onChange={(e) => setDocQ(e.target.value)} />
          <button className="btn btn-outline btn-sm" onClick={() => { setDateQ(''); setDocQ(''); }}>✕ Clear</button>
        </div>
        {visits === null ? <Spin /> : visits === false ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div><h4>No OPD card found</h4>
            <p><Link to={ROUTES.opd} className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>Create OPD Card</Link></p>
          </div>
        ) : !filtered.length ? (
          <div className="empty-state"><div className="empty-icon">📋</div><h4>No visits found</h4><p>Your OPD visit records will appear here</p></div>
        ) : (
          <table>
            <thead><tr><th>Date</th><th>Symptoms</th><th>Diagnosis</th><th>Prescription</th><th>Doctor</th><th>Follow-up</th></tr></thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontSize: '.82rem', color: 'var(--c-ink-4)' }}>{fmtDate(v.visit_date)}</td>
                  <td style={{ maxWidth: 200, fontSize: '.88rem' }}>{v.symptoms}</td>
                  <td style={{ maxWidth: 200, color: 'var(--c-primary-dk)', fontSize: '.88rem' }}>{v.diagnosis || '—'}</td>
                  <td style={{ maxWidth: 200, fontSize: '.82rem' }}>{v.prescription || '—'}</td>
                  <td style={{ fontSize: '.82rem', color: 'var(--c-ink-4)' }}>{v.doctor_name || '—'}</td>
                  <td style={{ fontSize: '.82rem', color: 'var(--c-primary)' }}>{fmtDate(v.follow_up_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
