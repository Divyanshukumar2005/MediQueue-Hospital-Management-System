import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { MedStatusBadge } from '../components/Badges';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { ROUTES } from '../lib/routes';
import { getMedicines, getMyMedicineRequests, subscribeToTable } from '../services/api';

export default function Medicines() {
  const { user } = useAuth();
  const { toast } = useUI();
  const [meds, setMeds] = useState(null);
  const [active, setActive] = useState(null);
  const [q, setQ] = useState('');

  const loadRequest = useCallback(async () => {
    try {
      const reqs = await getMyMedicineRequests();
      setActive(reqs.find((r) => ['pending', 'preparing', 'ready'].includes(r.status)) || null);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    getMedicines().then(setMeds).catch((e) => { toast('Error', e.message, 'error'); setMeds([]); });
    loadRequest();
    return subscribeToTable({ table: 'medicine_requests', filter: `user_id=eq.${user.id}` }, loadRequest);
  }, [user.id, toast, loadRequest]);

  const ql = q.toLowerCase();
  const list = (meds || []).filter((m) => !ql || m.name.toLowerCase().includes(ql) || m.category?.toLowerCase().includes(ql));
  const avail = list.filter((m) => m.is_available);
  const outOf = list.filter((m) => !m.is_available);
  const ready = active?.status === 'ready';

  return (
    <Layout active="medicines" title="Medicines" subtitle="Hospital pharmacy stock">
      <div className="page-header slide-up">
        <div className="breadcrumb"><Link to={ROUTES.dashboard}>Home</Link> › Medicines</div>
        <h1>💊 Medicine Availability</h1>
        <p>Check which medicines are available at the hospital pharmacy before your visit.</p>
      </div>

      {active && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ background: ready ? 'linear-gradient(135deg,rgba(34,197,94,.15),rgba(34,197,94,.08))' : 'linear-gradient(135deg,var(--c-primary-lt),rgba(239,246,255,.8))', border: `1.5px solid ${ready ? 'rgba(34,197,94,.3)' : 'var(--c-primary-lt)'}`, borderRadius: 'var(--r-lg)', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{ready ? '✅ Medicine Ready for Pickup!' : '💊 Your Prescription Status'}</div>
              <div style={{ fontSize: '.82rem', color: 'var(--c-ink-3)', marginTop: 4 }}>{ready ? 'Please collect from Medicine Store — Room G-05' : 'Your prescription is being processed at the medicine store'}</div>
            </div>
            <MedStatusBadge status={active.status} />
          </div>
        </div>
      )}

      <div className="table-wrapper slide-up">
        <div className="table-header">
          <h3>Pharmacy Stock</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-control" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 180, padding: '7px 12px', fontSize: '.84rem' }} />
          </div>
        </div>
        {meds === null ? (
          <div className="empty-state"><div className="spinner spinner-blue" /><p>Loading…</p></div>
        ) : (
          <div>
            <div style={{ padding: '16px 20px', background: 'var(--green-100)', borderBottom: '1px solid var(--c-surface2)' }}>
              <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#15803d' }}>✅ Available ({avail.length})</span>
            </div>
            {avail.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--c-surface2)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '.88rem' }}>{m.name}</div>
                  <div style={{ fontSize: '.76rem', color: 'var(--c-ink-4)' }}>{m.category || ''} · {m.unit}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '.78rem', color: m.stock > 50 ? 'var(--green-500)' : 'var(--yellow-500)' }}>Stock: {m.stock}</span>
                  <span className="badge badge-green"><span className="dot dot-green" />Available</span>
                </div>
              </div>
            ))}
            {outOf.length > 0 && (
              <>
                <div style={{ padding: '16px 20px', background: 'var(--red-100)', borderBottom: '1px solid var(--c-surface2)', borderTop: '1px solid var(--c-surface2)' }}>
                  <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#b91c1c' }}>❌ Out of Stock ({outOf.length})</span>
                </div>
                {outOf.map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--c-surface2)', opacity: 0.7 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '.88rem', color: 'var(--c-ink-3)' }}>{m.name}</div>
                      <div style={{ fontSize: '.76rem', color: 'var(--c-ink-4)' }}>{m.category || ''} · {m.unit}</div>
                    </div>
                    <span className="badge badge-red">Out of Stock</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
