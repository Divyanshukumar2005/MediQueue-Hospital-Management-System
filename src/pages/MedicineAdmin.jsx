import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { MedStatusBadge } from '../components/Badges';
import { useUI } from '../context/UIContext';
import { fmtTime } from '../lib/utils';
import useMediaQuery from '../hooks/useMediaQuery';
import { addMedicine, getMedicineRequests, getMedicines, setMedicineStock, subscribeToTable, updateMedicineRequest } from '../services/api';

const ACTIONS = {
  pending: [{ label: '🔄 Start Preparing', status: 'preparing', cls: 'btn-warning' }, { label: '❌ Cannot Dispense', status: 'dispensed', cls: 'btn-danger' }],
  preparing: [{ label: '✅ Mark as Ready', status: 'ready', cls: 'btn-success' }],
  ready: [{ label: '📦 Dispensed', status: 'dispensed', cls: 'btn-primary' }],
  dispensed: [],
};

function StockRow({ m, onSet }) {
  const [val, setVal] = useState(String(m.stock));
  useEffect(() => setVal(String(m.stock)), [m.stock]);
  const color = m.stock > 50 ? 'var(--green-500)' : m.stock > 10 ? 'var(--yellow-500)' : 'var(--red-500)';
  const btn = { padding: '2px 8px', minWidth: 26 };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--c-surface2)', gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '.84rem', fontWeight: 600 }}>{m.name}</div>
        <div style={{ fontSize: '.74rem', color: 'var(--c-ink-4)' }}>{m.category || ''} · {m.unit}{m.stock <= 10 ? ' · low stock' : ''}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="btn btn-surface btn-sm" style={btn} onClick={() => onSet(m, m.stock - 10)} disabled={m.stock <= 0}>−</button>
        <input className="form-control" type="number" min="0" value={val} style={{ width: 64, padding: '3px 6px', fontSize: '.8rem', fontFamily: 'var(--mono)', fontWeight: 700, color }} onChange={(e) => setVal(e.target.value)} onBlur={() => String(m.stock) !== val && onSet(m, val)} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
        <button className="btn btn-surface btn-sm" style={btn} onClick={() => onSet(m, m.stock + 10)}>+</button>
        <span className={m.is_available ? 'badge badge-green' : 'badge badge-red'}>{m.is_available ? 'In' : 'Out'}</span>
      </div>
    </div>
  );
}

export default function MedicineAdmin() {
  const { toast, showLoading, hideLoading } = useUI();
  const mobile = useMediaQuery('(max-width: 767px)');
  const [filter, setFilter] = useState('');
  const [all, setAll] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [meds, setMeds] = useState(null);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', stock: '', unit: 'tablet' });

  const loadRequests = useCallback(async () => {
    try {
      setAll((await getMedicineRequests()) || []);
    } catch (e) {
      toast('Error', e.message, 'error');
    } finally {
      setLoaded(true);
    }
  }, [toast]);
  const loadStock = useCallback(async () => {
    try { setMeds(await getMedicines()); } catch { setMeds(false); }
  }, []);

  useEffect(() => {
    loadRequests();
    loadStock();
    const off = subscribeToTable({ table: 'medicine_requests' }, loadRequests);
    const poll = setInterval(loadRequests, 15000);
    return () => { off(); clearInterval(poll); };
  }, [loadRequests, loadStock]);

  const count = (s) => all.filter((r) => r.status === s).length;
  const reqs = filter ? all.filter((r) => r.status === filter) : all;

  async function updateStatus(id, status) {
    showLoading('Updating…');
    try {
      await updateMedicineRequest(id, status, notes);
      hideLoading();
      setSelected(null);
      toast(`Status: ${status}`, status === 'ready' ? 'Patient will be notified' : '', 'success');
      loadRequests();
    } catch (e) {
      hideLoading();
      toast('Error', e.message, 'error');
    }
  }

  async function setStock(m, value) {
    try {
      await setMedicineStock(m.id, value);
      loadStock();
    } catch (e) {
      toast('Error', e.message, 'error');
      loadStock();
    }
  }

  async function add() {
    if (!form.name.trim()) return toast('Name required', '', 'warning');
    try {
      await addMedicine(form);
      toast('Medicine added!', '', 'success');
      setAddOpen(false);
      setForm({ name: '', category: '', stock: '', unit: 'tablet' });
      loadStock();
    } catch (e) {
      toast('Error', e.message, 'error');
    }
  }

  const openReq = (r) => { setSelected(r); setNotes(r.admin_notes || ''); };

  return (
    <Layout active="medadmin" title="Medicine Store" subtitle="Prescription management & stock">
      <div className="page-header slide-up">
        <h1>🏪 Medicine Store Panel</h1>
        <p>Manage prescriptions, stock, and notify patients when medicine is ready</p>
      </div>

      <div className="stats-grid stagger" style={{ gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)' }}>
        <div className="stat-card"><div className="stat-icon stat-icon-yellow">⏳</div><div className="stat-value">{loaded ? count('pending') : '—'}</div><div className="stat-label">Pending</div></div>
        <div className="stat-card"><div className="stat-icon stat-icon-blue">🔄</div><div className="stat-value">{loaded ? count('preparing') : '—'}</div><div className="stat-label">Preparing</div></div>
        <div className="stat-card"><div className="stat-icon stat-icon-green">✅</div><div className="stat-value">{loaded ? count('ready') : '—'}</div><div className="stat-label">Ready</div></div>
        <div className="stat-card"><div className="stat-icon stat-icon-purple">📦</div><div className="stat-value">{loaded ? count('dispensed') : '—'}</div><div className="stat-label">Dispensed Today</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 360px', gap: 24 }}>
        <div>
          <div className="table-wrapper">
            <div className="table-header">
              <h3>💊 Prescription Requests</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="form-control" style={{ width: 'auto', padding: '6px 10px', fontSize: '.8rem' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="preparing">Preparing</option>
                  <option value="ready">Ready</option>
                  <option value="dispensed">Dispensed</option>
                </select>
                <span className="live-badge"><span className="live-dot" />Live</span>
              </div>
            </div>
            {!loaded ? (
              <div className="empty-state"><div className="spinner spinner-blue" /><p>Loading…</p></div>
            ) : !reqs.length ? (
              <div className="empty-state"><div className="empty-icon">💊</div><h4>No requests</h4><p>Prescriptions from doctors will appear here</p></div>
            ) : (
              <table>
                <thead><tr><th>Time</th><th>Patient</th><th>Prescription</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {reqs.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontSize: '.8rem', color: 'var(--c-ink-4)' }}>{fmtTime(r.created_at)}</td>
                      <td style={{ fontWeight: 600, fontSize: '.85rem' }}>{r.user?.name || '—'}</td>
                      <td style={{ maxWidth: 180 }}>
                        <div style={{ fontSize: '.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{r.prescription_text || '—'}</div>
                        <div style={{ fontSize: '.74rem', color: 'var(--c-ink-4)' }}>Dr: {r.visit?.doctor_name || '—'}</div>
                      </td>
                      <td><MedStatusBadge status={r.status} /></td>
                      <td><button className="btn btn-outline btn-sm" onClick={() => openReq(r)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4>📋 Medicine Stock</h4>
              <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>+ Add</button>
            </div>
            {meds === null ? (
              <div className="spinner spinner-blue" style={{ display: 'block', margin: '20px auto' }} />
            ) : meds === false ? (
              <p style={{ fontSize: '.82rem', color: 'var(--c-ink-4)', padding: 12 }}>Could not load medicines</p>
            ) : meds.map((m) => <StockRow key={m.id} m={m} onSet={setStock} />)}
          </div>

          {addOpen && (
            <div className="card">
              <h4 style={{ marginBottom: 14 }}>➕ Add Medicine</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="form-group"><label className="form-label">Name</label><input className="form-control" placeholder="Paracetamol 500mg" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Category</label><input className="form-control" placeholder="Analgesic" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group"><label className="form-label">Stock</label><input className="form-control" type="number" placeholder="100" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Unit</label>
                    <select className="form-control" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}><option>tablet</option><option>capsule</option><option>syrup</option><option>injection</option></select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-full" onClick={add}>Save</button>
                  <button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>💊 Prescription Details</h3>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--c-primary-lt)', borderRadius: 'var(--r-md)', padding: 14, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: '.95rem', marginBottom: 4 }}>{selected.user?.name || '—'}</div>
                <div style={{ fontSize: '.82rem', color: 'var(--c-ink-3)' }}>{selected.user?.email || ''}</div>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Prescription</label>
                <div style={{ padding: 12, background: 'var(--c-surface2)', borderRadius: 'var(--r-md)', fontSize: '.88rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{selected.prescription_text || '—'}</div>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Diagnosis</label>
                <div style={{ fontSize: '.88rem', color: 'var(--c-ink-2)' }}>{selected.visit?.diagnosis || '—'}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Admin Notes (optional)</label>
                <textarea className="form-control" rows={2} placeholder="e.g. Metformin out of stock — gave alternative" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>
              {(ACTIONS[selected.status] || []).map((b) => (
                <button key={b.status} className={`btn ${b.cls}`} onClick={() => updateStatus(selected.id, b.status)}>{b.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
