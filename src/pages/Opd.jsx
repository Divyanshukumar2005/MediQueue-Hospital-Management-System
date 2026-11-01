import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { ROUTES } from '../lib/routes';
import { fmtDate } from '../lib/utils';
import { createOpdCard, getOpdCard, updateOpdCard } from '../services/api';
import useMediaQuery from '../hooks/useMediaQuery';

const BLOODS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const EMPTY = { age: '', gender: '', blood_group: '', phone: '', address: '' };

function CardForm({ f, set, prefix }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Age</label>
          <input className="form-control" type="number" id={`${prefix}Age`} placeholder="25" min="0" max="120" value={f.age} onChange={(e) => set({ ...f, age: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Gender</label>
          <select className="form-control" value={f.gender} onChange={(e) => set({ ...f, gender: e.target.value })}>
            <option value="">Select…</option>
            <option>Male</option><option>Female</option><option>Other</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Blood Group</label>
        <select className="form-control" value={f.blood_group} onChange={(e) => set({ ...f, blood_group: e.target.value })}>
          <option value="">Select…</option>
          {BLOODS.map((b) => <option key={b}>{b}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Phone</label>
        <input className="form-control" type="tel" placeholder="+91 98765 43210" value={f.phone} onChange={(e) => set({ ...f, phone: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">Address</label>
        <textarea className="form-control" rows={3} placeholder="Full address…" value={f.address} onChange={(e) => set({ ...f, address: e.target.value })} />
      </div>
    </>
  );
}

export default function Opd() {
  const { user } = useAuth();
  const { toast, showLoading, hideLoading } = useUI();
  const mobile = useMediaQuery('(max-width: 767px)');
  const [card, setCard] = useState(undefined); // undefined = loading, null = none
  const [create, setCreate] = useState(EMPTY);
  const [edit, setEdit] = useState(EMPTY);
  const [editOpen, setEditOpen] = useState(false);
  const [editErr, setEditErr] = useState('');
  const [dateQ, setDateQ] = useState('');
  const [docQ, setDocQ] = useState('');

  const load = useCallback(async () => {
    try {
      setCard(await getOpdCard(user.id));
    } catch (e) {
      toast('Error', e.message, 'error');
      setCard((c) => (c === undefined ? null : c));
    }
  }, [user.id, toast]);
  useEffect(() => { load(); }, [load]);

  async function doCreate() {
    showLoading('Creating your OPD card…');
    try {
      const c = await createOpdCard({ user_id: user.id, ...create });
      hideLoading();
      toast('OPD Card Created!', `Card No: ${c.card_number}`, 'success');
      await load();
    } catch (e) {
      hideLoading();
      toast('Error', e.message, 'error');
    }
  }

  function openEdit() {
    setEdit({ age: card.age ?? '', gender: card.gender || '', blood_group: card.blood_group || '', phone: card.phone || '', address: card.address || '' });
    setEditErr('');
    setEditOpen(true);
  }
  async function saveEdit() {
    setEditErr('');
    try {
      await updateOpdCard(card.id, edit);
      toast('Updated!', 'OPD card details saved.', 'success');
      setEditOpen(false);
      await load();
    } catch (e) {
      setEditErr(e.message);
    }
  }

  let visits = card?.visits || [];
  if (dateQ) visits = visits.filter((v) => v.visit_date && v.visit_date.startsWith(dateQ));
  const dq = docQ.toLowerCase().trim();
  if (dq) visits = visits.filter((v) => (v.doctor_name || '').toLowerCase().includes(dq));

  return (
    <Layout active="opd" title="OPD Card" subtitle="Your digital health record">
      {editOpen && (
        <div style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--c-bg)', borderRadius: 'var(--r-lg)', padding: 28, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <button onClick={() => setEditOpen(false)} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', color: 'var(--c-ink-3)' }}>✕</button>
            <h4 style={{ marginBottom: 16 }}>✏️ Edit OPD Card</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <CardForm f={edit} set={setEdit} prefix="edit" />
              {editErr && <div style={{ padding: '8px 12px', background: 'var(--red-100)', borderRadius: 'var(--r-md)', fontSize: '.82rem', color: '#b91c1c' }}>{editErr}</div>}
              <button className="btn btn-primary btn-full" onClick={saveEdit}>💾 Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header slide-up">
        <div className="breadcrumb"><Link to={ROUTES.dashboard}>Home</Link> › OPD Card</div>
        <h1>📋 Digital OPD Card</h1>
        <p>Your permanent digital health record card.</p>
      </div>

      {card === null && (
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 24 }}>
          <div className="card card-xl">
            <h3 style={{ marginBottom: 6 }}>Create Your OPD Card</h3>
            <p style={{ marginBottom: 20, fontSize: '.85rem' }}>Fill in your basic health information to create a digital OPD card.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <CardForm f={create} set={setCreate} prefix="inp" />
              <button className="btn btn-primary btn-lg btn-full" onClick={doCreate}>📋 Create OPD Card</button>
            </div>
          </div>
          <div className="card" style={{ background: 'linear-gradient(135deg,var(--c-primary),var(--c-primary))', color: '#fff', height: 'fit-content' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <h3 style={{ color: '#fff', marginBottom: 8 }}>Why create an OPD Card?</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
              {[['🔒', 'Secure digital health record'], ['📜', 'Complete visit history in one place'], ['💊', 'Prescription & diagnosis archive'], ['🚀', 'Faster check-ins on future visits']].map(([i, t]) => (
                <div key={t} style={{ display: 'flex', gap: 10, fontSize: '.85rem', opacity: 0.9 }}><span>{i}</span>{t}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {card && (
        <div>
          <div style={{ background: 'linear-gradient(135deg,var(--c-primary-dk),var(--c-primary-mid))', borderRadius: 'var(--radius-xl)', padding: 28, color: '#fff', marginBottom: 24, maxWidth: 600, boxShadow: 'var(--shadow-xl)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.07)' }} />
            <div style={{ position: 'absolute', bottom: -60, left: -20, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: '.75rem', opacity: 0.7, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600 }}>Digital OPD Card</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 2 }}>{card.user?.name || user.name}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={openEdit} style={{ background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: '.78rem', cursor: 'pointer', fontWeight: 600 }}>✏️ Edit</button>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '.72rem', opacity: 0.6 }}>Card No.</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem' }}>{card.card_number}</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
                {[['Blood Group', card.blood_group || '—'], ['Age', card.age || '—'], ['Gender', card.gender || '—'], ['Issued', fmtDate(card.created_at)]].map(([l, v], i) => (
                  <div key={l}>
                    <div style={{ fontSize: '.7rem', opacity: 0.6, marginBottom: 2 }}>{l}</div>
                    <div style={{ fontWeight: 700, ...(i === 3 ? { fontSize: '.8rem' } : {}) }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <div className="table-header">
              <h3>🕑 Visit History</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="date" className="form-control" style={{ width: 'auto', fontSize: '.82rem', padding: '5px 10px' }} value={dateQ} onChange={(e) => setDateQ(e.target.value)} />
                <input type="text" className="form-control" style={{ width: 160, fontSize: '.82rem', padding: '5px 10px' }} value={docQ} onChange={(e) => setDocQ(e.target.value)} placeholder="🔍 Doctor name…" />
                <span className="badge badge-blue">{visits.length} visit{visits.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            {!visits.length ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h4>No visits recorded yet</h4>
                <p>Your visit history will appear here after your first consultation</p>
              </div>
            ) : (
              <table>
                <thead><tr><th>Date</th><th>Symptoms</th><th>Diagnosis</th><th>Prescription</th><th>Doctor</th><th>Follow-up</th></tr></thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id}>
                      <td style={{ color: 'var(--c-ink-4)', fontSize: '.82rem' }}>{fmtDate(v.visit_date)}</td>
                      <td style={{ fontSize: '.88rem', maxWidth: 200 }}>{v.symptoms}</td>
                      <td style={{ fontSize: '.88rem', maxWidth: 200, color: 'var(--c-primary-dk)' }}>{v.diagnosis || '—'}</td>
                      <td style={{ fontSize: '.82rem', maxWidth: 200 }}>{v.prescription || '—'}</td>
                      <td style={{ fontSize: '.82rem', color: 'var(--c-ink-4)' }}>{v.doctor_name || '—'}</td>
                      <td style={{ fontSize: '.82rem', color: 'var(--c-primary)' }}>{fmtDate(v.follow_up_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
