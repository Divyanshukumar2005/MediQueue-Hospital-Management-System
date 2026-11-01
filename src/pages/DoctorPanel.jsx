import { useCallback, useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useDepartments } from '../context/DepartmentsContext';
import useQrScanner from '../hooks/useQrScanner';
import { parseScanPayload, fmtDate, avatarUrl } from '../lib/utils';
import { getMyDoctorProfile, updateMyDoctorProfile, scanToken, getWaitingTokens, callNextToken, recordVisit } from '../services/api';
import './DoctorPanel.css';

export default function DoctorPanel() {
  const { user } = useAuth();
  const { toast, showLoading, hideLoading } = useUI();
  const { departments } = useDepartments();

  const [profile, setProfile] = useState(null);
  const [profileMsg, setProfileMsg] = useState('Loading…');
  const [editOpen, setEditOpen] = useState(false);
  const [ep, setEp] = useState({ spec: '', room: '', days: '' });
  const [epError, setEpError] = useState('');

  const [scanInput, setScanInput] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [patient, setPatient] = useState(null);
  const [deptFilter, setDeptFilter] = useState('');
  const [queue, setQueue] = useState(null);
  const [serving, setServing] = useState('—');
  const [calling, setCalling] = useState(false);
  const [form, setForm] = useState({ symptoms: '', diagnosis: '', prescription: '', doctor: '', followup: '' });

  const profileRef = useRef(null);
  profileRef.current = profile;

  const loadProfile = useCallback(async () => {
    try {
      const me = await getMyDoctorProfile();
      setProfile(me);
      if (!me) setProfileMsg('Profile not linked. Contact admin to link your doctor entry.');
    } catch {
      setProfileMsg('Could not load profile.');
    }
  }, []);

  const scanById = useCallback(async (identifier) => {
    setScanBusy(true);
    try {
      const data = await scanToken(identifier, profileRef.current?.department);
      setPatient(data);
      setForm((f) => ({ ...f, doctor: user?.name || '' }));
      toast('Patient loaded', data.token.user?.name || '', 'success');
    } catch (e) {
      toast('Not found', e.message, 'error');
    } finally {
      setScanBusy(false);
    }
  }, [toast, user]);

  const onDetect = useCallback((raw) => {
    const p = parseScanPayload(raw);
    if (!p) return;
    setScanInput(String(p.displayNum || p.identifier));
    scanById(p.identifier);
  }, [scanById]);

  const { videoRef, canvasRef, active, error: camError, start, stop } = useQrScanner({ onDetect, stopOnDetect: true });

  useEffect(() => { if (camError) toast('Camera error', camError, 'error'); }, [camError, toast]);
  useEffect(() => { loadProfile(); }, [loadProfile]);

  const loadQueue = useCallback(async () => {
    if (!deptFilter) { setQueue(null); return; }
    try { setQueue(await getWaitingTokens(deptFilter)); } catch (e) { toast('Error', e.message, 'error'); }
  }, [deptFilter, toast]);
  useEffect(() => {
    loadQueue();
    const t = setInterval(loadQueue, 20000);
    return () => clearInterval(t);
  }, [loadQueue]);

  function openEdit() {
    if (!profile) return toast('No profile linked', 'Contact admin to link your doctor entry', 'warning');
    setEp({ spec: profile.specialization || '', room: profile.room_number || '', days: profile.available_days || 'Mon,Tue,Wed,Thu,Fri' });
    setEpError('');
    setEditOpen(true);
  }
  async function saveProfile() {
    setEpError('');
    try {
      await updateMyDoctorProfile({ specialization: ep.spec.trim(), room_number: ep.room.trim(), available_days: ep.days.trim() });
      setEditOpen(false);
      toast('Profile updated', 'Your details have been saved', 'success');
      loadProfile();
    } catch (e) { setEpError(e.message); }
  }

  function scanManual() {
    const v = scanInput.trim();
    if (!v) return toast('Enter token number', '', 'warning');
    scanById(v);
  }

  function clearPatient() {
    setPatient(null);
    stop();
    setScanInput('');
    setForm((f) => ({ ...f, symptoms: '', diagnosis: '', prescription: '', followup: '' }));
  }

  async function saveVisit(sendToMedicine) {
    if (!patient) return toast('Load a patient first', '', 'warning');
    const symptoms = form.symptoms.trim();
    if (!symptoms) return toast('Symptoms required', '', 'warning');
    const { token } = patient;
    showLoading(sendToMedicine ? 'Saving & sending to medicine…' : 'Saving visit…');
    try {
      await recordVisit({
        user_id: token.user.id, token_id: token.id, symptoms,
        diagnosis: form.diagnosis.trim() || null, prescription: form.prescription.trim() || null,
        doctor_name: form.doctor.trim() || null, follow_up_date: form.followup || null,
        send_to_medicine: sendToMedicine,
      });
      hideLoading();
      toast(sendToMedicine ? 'Visit saved + Sent to medicine!' : 'Visit saved!', `Patient: ${token.user?.name || ''}`, 'success');
      loadQueue();
      clearPatient();
    } catch (e) { hideLoading(); toast('Error', e.message, 'error'); }
  }

  async function callNext() {
    if (!deptFilter) return toast('Select department', '', 'warning');
    setCalling(true);
    try {
      const tok = await callNextToken(deptFilter);
      if (!tok) { toast('Queue Empty', 'No waiting tokens in queue.', 'warning'); return; }
      setServing(`#${tok.token_number}`);
      toast(`Token #${tok.token_number} called`, tok.user?.name || '', 'success');
      loadQueue();
      try {
        const data = await scanToken(tok.token_uid || String(tok.id), deptFilter);
        setPatient(data);
        setForm((f) => ({ ...f, doctor: user?.name || '' }));
        setScanInput(String(tok.token_number));
        toast('Patient auto-loaded', `${tok.user?.name || ''} — Token #${tok.token_number}`, 'info');
      } catch (e) { console.warn('Auto-load patient failed:', e.message); }
    } catch (e) { toast('Error calling next token', e.message, 'error'); }
    finally { setCalling(false); }
  }

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const tok = patient?.token;
  const u = tok?.user || {};
  const opdCard = patient?.opdCard;
  const mismatch = patient && deptFilter && tok.department && tok.department !== deptFilter;
  const deptNames = departments.map((d) => d.name);

  return (
    <Layout active="doctor" title="Doctor Panel" subtitle="Manage queue & record visits">
      <div className="doc-page">
        {editOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'var(--c-bg)', borderRadius: 'var(--r-lg)', padding: 28, width: '100%', maxWidth: 460, position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
              <button onClick={() => setEditOpen(false)} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', color: 'var(--c-ink-3)' }}>✕</button>
              <h4 style={{ marginBottom: 16 }}>✏️ Edit My Profile</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group"><label className="form-label">Specialization</label>
                  <input className="form-control" value={ep.spec} onChange={(e) => setEp({ ...ep, spec: e.target.value })} placeholder="e.g. General Physician" /></div>
                <div className="form-group"><label className="form-label">Room Number</label>
                  <input className="form-control" value={ep.room} onChange={(e) => setEp({ ...ep, room: e.target.value })} placeholder="e.g. OPD-101" /></div>
                <div className="form-group"><label className="form-label">Available Days</label>
                  <input className="form-control" value={ep.days} onChange={(e) => setEp({ ...ep, days: e.target.value })} placeholder="Mon,Tue,Wed,Thu,Fri" /></div>
                {epError && <div style={{ padding: '8px 12px', background: 'var(--red-100)', borderRadius: 'var(--r-md)', fontSize: '.82rem', color: '#b91c1c' }}>{epError}</div>}
                <button className="btn btn-primary btn-full" onClick={saveProfile}>💾 Save Changes</button>
              </div>
            </div>
          </div>
        )}

        <div className="page-header slide-up">
          <h1>⚕️ Doctor Panel</h1>
          <p>Scan patient QR → view history → record visit → send to medicine store</p>
        </div>

        <div className="doc-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h4 style={{ margin: 0 }}>👨‍⚕️ My Profile</h4>
                <button className="btn btn-outline btn-sm" onClick={openEdit}>✏️ Edit</button>
              </div>
              <div style={{ fontSize: '.84rem', color: 'var(--c-ink-2)' }}>
                {profile ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><span style={{ color: 'var(--c-ink-4)', fontSize: '.75rem' }}>Dept</span><br /><b>{profile.department}</b></div>
                    <div><span style={{ color: 'var(--c-ink-4)', fontSize: '.75rem' }}>Room</span><br /><b>{profile.room_number || '—'}</b></div>
                    <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--c-ink-4)', fontSize: '.75rem' }}>Specialization</span><br /><b>{profile.specialization || '—'}</b></div>
                    <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--c-ink-4)', fontSize: '.75rem' }}>Available Days</span><br /><b>{profile.available_days || '—'}</b></div>
                  </div>
                ) : <p style={{ color: 'var(--c-ink-4)', fontSize: '.82rem' }}>{profileMsg}</p>}
              </div>
            </div>

            <div className="card card-xl">
              <h3 style={{ marginBottom: 4 }}>📷 Scan Patient Token</h3>
              <p style={{ fontSize: '.82rem', marginBottom: 14 }}>Use camera or type token number manually</p>
              <div className="scanner-wrap">
                <video ref={videoRef} playsInline muted />
                <canvas ref={canvasRef} />
                <div className="scan-corner tl" /><div className="scan-corner tr" /><div className="scan-corner bl" /><div className="scan-corner br" />
                {active && <div className="scan-line" />}
                {!active && <div className="scan-placeholder"><span style={{ fontSize: 32 }}>📷</span><span>Camera off</span></div>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button className={`btn btn-sm ${active ? 'btn-danger' : 'btn-primary'}`} style={{ flex: 1 }} onClick={active ? stop : start}>
                  {active ? '⏹ Stop Camera' : '▶ Start Camera'}
                </button>
              </div>
              <p style={{ textAlign: 'center', fontSize: '.75rem', color: 'var(--c-ink-4)', marginBottom: 10 }}>— or enter manually —</p>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <input className="form-control" type="number" placeholder="Token number e.g. 5" value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && scanManual()} />
              </div>
              <button className="btn btn-primary btn-full" onClick={scanManual} disabled={scanBusy}>
                {scanBusy ? <><span className="spinner" /> Loading…</> : '🔍 Load Patient'}
              </button>
            </div>

            <div className="table-wrapper">
              <div className="table-header">
                <h3>Today's Queue</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select className="form-control" style={{ width: 'auto', padding: '6px 10px', fontSize: '.8rem' }} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                    <option value="">All Depts</option>
                    {deptNames.map((n) => <option key={n}>{n}</option>)}
                  </select>
                  <span className="live-badge"><span className="live-dot" />Live</span>
                </div>
              </div>
              <div>
                {!deptFilter ? (
                  <div className="empty-state" style={{ padding: 24 }}><div className="empty-icon">🎟️</div><p>Select a department</p></div>
                ) : queue && !queue.length ? (
                  <div className="empty-state" style={{ padding: 24 }}><div className="empty-icon">✅</div><p>No waiting tokens</p></div>
                ) : queue ? (
                  <table>
                    <thead><tr><th>Token</th><th>Patient</th><th>Wait</th><th></th></tr></thead>
                    <tbody>
                      {queue.map((t) => (
                        <tr key={t.id}>
                          <td><span className="td-mono">#{t.token_number}</span></td>
                          <td style={{ fontWeight: 600, fontSize: '.85rem' }}>{t.user?.name || '—'}</td>
                          <td style={{ fontSize: '.82rem', color: 'var(--c-ink-4)' }}>~{t.estimated_time || 0}m</td>
                          <td><button className="btn btn-primary btn-sm" onClick={() => { setScanInput(String(t.token_number)); scanById(t.token_uid || String(t.id)); }}>Load</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>
            </div>

            <div className="calling-panel">
              <div style={{ fontSize: '.75rem', opacity: 0.7, marginBottom: 4 }}>NOW SERVING</div>
              <div className="current-token">{serving}</div>
              <div style={{ fontSize: '.88rem', opacity: 0.8, marginBottom: 20 }}>{deptFilter || 'Select department'}</div>
              <button className="btn btn-full" onClick={callNext} disabled={calling}
                style={{ background: 'rgba(255,255,255,.2)', border: '2px solid rgba(255,255,255,.4)', color: '#fff', fontSize: '.95rem', borderRadius: 'var(--r-md)', padding: 12 }}>
                {calling ? <><span className="spinner" /> Calling…</> : '📢 Call Next Token'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {patient ? (
              <div>
                <div className="card card-xl slide-up">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h3>👤 Patient Details</h3>
                    <button className="btn btn-ghost btn-sm" onClick={clearPatient}>✕ Clear</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: 'var(--c-primary-lt)', borderRadius: 'var(--r-lg)', marginBottom: 16 }}>
                    <img src={u.photo_url || avatarUrl(u.name || 'P')} alt="" referrerPolicy="no-referrer" style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid var(--c-border)' }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{u.name || '—'}</div>
                      <div style={{ fontSize: '.82rem', color: 'var(--c-ink-3)' }}>{u.email || '—'}</div>
                      <div style={{ marginTop: 4 }}>
                        {patient.isNewPatient ? <span className="badge badge-purple">🆕 New Patient</span> : <span className="badge badge-green">✅ Returning</span>}
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--c-primary-dk)' }}>#{tok.token_number}</div>
                      <div style={{ fontSize: '.75rem', color: 'var(--c-ink-4)' }}>{tok.department || '—'}</div>
                    </div>
                  </div>
                  {mismatch && (
                    <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(245,158,11,.12)', border: '1.5px solid rgba(245,158,11,.4)', borderRadius: 'var(--r-md)', fontSize: '.83rem', color: '#92400e' }}>
                      ⚠️ <strong>Department Mismatch:</strong> This token belongs to <strong>{tok.department}</strong> department. Please verify the patient is at the correct counter.
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                    {opdCard ? [['Card No', opdCard.card_number], ['Blood Group', opdCard.blood_group || '—'], ['Age', opdCard.age || '—'], ['Gender', opdCard.gender || '—']].map(([l, v]) => (
                      <div key={l} style={{ background: 'var(--c-surface2)', borderRadius: 'var(--r-md)', padding: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: '.72rem', color: 'var(--c-ink-4)', marginBottom: 2 }}>{l}</div>
                        <div style={{ fontWeight: 700, fontSize: '.85rem' }}>{v}</div>
                      </div>
                    )) : (
                      <div style={{ gridColumn: '1/-1', padding: 10, background: 'var(--purple-100)', borderRadius: 'var(--r-md)', color: '#6d28d9', fontSize: '.82rem', fontWeight: 500 }}>🆕 No OPD card yet — will be created on first visit save</div>
                    )}
                  </div>
                  {opdCard?.visits?.length > 0 && (
                    <div>
                      <h4 style={{ marginBottom: 10, color: 'var(--c-ink-2)' }}>📋 Past Visit History</h4>
                      <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {opdCard.visits.map((v) => (
                          <div key={v.id} style={{ padding: '10px 12px', background: 'rgba(37,99,235,.04)', borderRadius: 'var(--r-md)', borderLeft: '3px solid var(--c-primary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: '.8rem', fontWeight: 600 }}>{fmtDate(v.visit_date)}</span>
                              <span style={{ fontSize: '.75rem', color: 'var(--c-ink-4)' }}>{v.doctor_name || '—'}</span>
                            </div>
                            <div style={{ fontSize: '.8rem', color: 'var(--c-ink-2)' }}><b>S:</b> {v.symptoms || '—'}</div>
                            {v.diagnosis && <div style={{ fontSize: '.8rem', color: 'var(--c-primary-dk)' }}><b>D:</b> {v.diagnosis}</div>}
                            {v.prescription && <div style={{ fontSize: '.78rem', color: 'var(--c-ink-3)' }}><b>Rx:</b> {v.prescription}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="card card-xl slide-up" style={{ marginTop: 16 }}>
                  <h3 style={{ marginBottom: 4 }}>📝 Record Visit</h3>
                  <p style={{ fontSize: '.82rem', marginBottom: 20 }}>Fill details and choose what to do after consultation</p>
                  <div className="visit-form-grid">
                    <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Symptoms *</label>
                      <textarea className="form-control" rows={3} placeholder="Patient's complaints and symptoms…" value={form.symptoms} onChange={setF('symptoms')} /></div>
                    <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Diagnosis</label>
                      <textarea className="form-control" rows={2} placeholder="Doctor's diagnosis…" value={form.diagnosis} onChange={setF('diagnosis')} /></div>
                    <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Prescription</label>
                      <textarea className="form-control" rows={3} placeholder="Medicine name, dosage, duration. E.g: Paracetamol 500mg - 1 tablet twice daily × 5 days" value={form.prescription} onChange={setF('prescription')} /></div>
                    <div className="form-group"><label className="form-label">Doctor Name</label>
                      <input className="form-control" placeholder="Dr. Sharma" value={form.doctor} onChange={setF('doctor')} /></div>
                    <div className="form-group"><label className="form-label">Follow-up Date</label>
                      <input className="form-control" type="date" value={form.followup} onChange={setF('followup')} /></div>
                  </div>
                  <div style={{ marginTop: 24, padding: 16, background: 'var(--c-surface2)', borderRadius: 'var(--r-lg)', border: '1px solid var(--c-border)' }}>
                    <h4 style={{ marginBottom: 12, color: 'var(--c-ink-2)' }}>After Consultation:</h4>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <button className="btn btn-outline" onClick={() => saveVisit(false)}>✅ Close Session</button>
                      <button className="btn btn-success" onClick={() => saveVisit(true)}>💊 Close + Send to Medicine Store</button>
                    </div>
                    <p style={{ fontSize: '.77rem', color: 'var(--c-ink-4)', marginTop: 10 }}>"Send to Medicine Store" will forward the prescription to the medicine admin panel automatically.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="card card-xl" style={{ textAlign: 'center', padding: '60px 24px' }}>
                  <div style={{ fontSize: 56, marginBottom: 16 }}>📷</div>
                  <h3 style={{ color: 'var(--c-ink-2)', marginBottom: 8 }}>No Patient Loaded</h3>
                  <p>Scan QR code or enter token number to load patient details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
