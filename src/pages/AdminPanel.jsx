import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useDepartments } from '../context/DepartmentsContext';
import useQueueStatus from '../hooks/useQueueStatus';
import { avatarUrl } from '../lib/utils';
import {
  addDepartment, createStaff, deleteDoctor, deleteUser, getAllDoctors, getAllUsers,
  setUserRole, updateDepartment, updateDoctor, updateUser,
} from '../services/api';
import './AdminPanel.css';

const ROLE_COLORS = { patient: 'badge-blue', doctor: 'badge-green', admin: 'badge-red', medicine_staff: 'badge-purple' };
const ROLE_LABELS = { patient: 'Patient', doctor: 'Doctor', admin: 'Admin', medicine_staff: 'Pharmacy' };
const GROUPS = [
  { role: 'patient', icon: '🧑‍💼', title: 'Patients', ph: '🔍 Search by name or email…' },
  { role: 'doctor', icon: '⚕️', title: 'Doctors', ph: '🔍 Search doctors…' },
  { role: 'medicine_staff', icon: '🏪', title: 'Pharmacy Staff', ph: '🔍 Search pharmacy staff…' },
  { role: 'admin', icon: '🛠️', title: 'Administrators', ph: '🔍 Search admins…' },
];

function Modal({ title, onClose, children }) {
  return (
    <div className="admin-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal-box">
        <button className="admin-modal-close" onClick={onClose}>✕</button>
        <h4 style={{ marginBottom: 16 }}>{title}</h4>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

function UserTable({ users, me, onEdit, onToggle, onRole, onDelete }) {
  if (!users.length) return <div style={{ padding: 18, textAlign: 'center', color: 'var(--c-ink-4)', fontSize: '.83rem' }}>No users found</div>;
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th className="col-name">Name</th><th className="col-email">Email</th><th className="col-role">Role</th>
          <th className="col-auth">Auth</th><th className="col-status">Status</th><th className="col-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id}>
            <td className="col-name">
              <div className="cell-name"><img src={u.photo_url || avatarUrl(u.name, 64)} alt="" /><span title={u.name}>{u.name}</span></div>
            </td>
            <td className="col-email"><span className="cell-email" title={u.email}>{u.email}</span></td>
            <td className="col-role"><span className={`badge ${ROLE_COLORS[u.role] || 'badge-gray'}`}>{ROLE_LABELS[u.role] || u.role}</span></td>
            <td className="col-auth"><span className={`badge ${u.auth_provider === 'google' ? 'badge-blue' : 'badge-gray'}`}>{u.auth_provider === 'google' ? 'Google' : 'Email'}</span></td>
            <td className="col-status"><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
            <td className="col-actions">
              {u.id !== me ? (
                <div className="cell-actions">
                  {['doctor', 'medicine_staff'].includes(u.role) && <button className="btn btn-outline btn-sm" onClick={() => onEdit(u)}>✏️ Edit</button>}
                  <button className="btn btn-outline btn-sm" onClick={() => onToggle(u)}>{u.is_active ? 'Deactivate' : 'Activate'}</button>
                  <select className="form-control" value="" onChange={(e) => onRole(u, e.target.value)}>
                    <option value="">Change role…</option>
                    <option value="patient">Patient</option><option value="doctor">Doctor</option>
                    <option value="medicine_staff">Pharmacy</option><option value="admin">Admin</option>
                  </select>
                  <button className="btn btn-outline btn-sm" style={{ color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => onDelete(u)}>🗑️ Delete</button>
                </div>
              ) : (
                <span style={{ fontSize: '.78rem', color: 'var(--c-ink-4)' }}>You</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DeptCard({ d, onSaved }) {
  const { toast } = useUI();
  const [max, setMax] = useState(d.max_tokens_per_day);
  const [avg, setAvg] = useState(d.avg_minutes_per_patient);
  const [msg, setMsg] = useState({ t: '', ok: true });
  async function save(nextMax, nextAvg) {
    const m = parseInt(nextMax, 10), a = parseInt(nextAvg, 10);
    if (!m || !a || m < 1 || a < 1) return setMsg({ t: '⚠️ Invalid', ok: false });
    try {
      await updateDepartment(d.name, { max_tokens_per_day: m, avg_minutes_per_patient: a });
      setMsg({ t: '✅ Saved!', ok: true });
      onSaved();
      setTimeout(() => setMsg({ t: '', ok: true }), 2000);
    } catch (e) {
      setMsg({ t: `❌ ${e.message}`, ok: false });
      toast('Error', e.message, 'error');
    }
  }
  return (
    <div className="dept-setting-card" style={{ borderTopColor: d.color || '#6b7280' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>{d.icon || '🏥'}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
          <div style={{ fontSize: '.7rem', color: 'var(--c-ink-4)' }}>{d.description || d.name}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '.72rem' }}>Max Tokens / Day</label>
          <input className="form-control" type="number" min="1" max="500" value={max} style={{ fontSize: '.84rem', padding: '5px 8px' }}
            onChange={(e) => setMax(e.target.value)} onBlur={() => save(max, avg)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '.72rem' }}>Avg. Min / Patient</label>
          <input className="form-control" type="number" min="1" max="120" value={avg} style={{ fontSize: '.84rem', padding: '5px 8px' }}
            onChange={(e) => setAvg(e.target.value)} onBlur={() => save(max, avg)} />
        </div>
        <div style={{ fontSize: '.72rem', minHeight: 14, color: msg.ok ? '#15803d' : '#b91c1c' }}>{msg.t}</div>
      </div>
    </div>
  );
}

const emptyStaff = { name: '', email: '', role: 'doctor', phone: '', password: '', department: '', specialization: '', room_number: '' };

export default function AdminPanel() {
  const { user } = useAuth();
  const { toast, showLoading, hideLoading } = useUI();
  const { departments, reload: reloadDepts } = useDepartments();
  const { queues } = useQueueStatus({ pollMs: 20000 });

  const [users, setUsers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [open, setOpen] = useState({});
  const [search, setSearch] = useState({});
  const [form, setForm] = useState(emptyStaff);
  const [formErr, setFormErr] = useState('');
  const [formWarn, setFormWarn] = useState('');
  const [editDoc, setEditDoc] = useState(null);
  const [editStaff, setEditStaff] = useState(null);
  const [newDept, setNewDept] = useState(null);
  const [modalErr, setModalErr] = useState('');

  const loadUsers = useCallback(async () => {
    try { setUsers(await getAllUsers()); } catch (e) { toast('Error', e.message, 'error'); }
  }, [toast]);
  const loadDoctors = useCallback(async () => {
    try { setDoctors(await getAllDoctors()); } catch (e) { toast('Error loading doctors', e.message, 'error'); }
  }, [toast]);
  useEffect(() => { loadUsers(); loadDoctors(); }, [loadUsers, loadDoctors]);

  const deptNames = useMemo(() => departments.map((d) => d.name), [departments]);
  const count = (r) => users.filter((u) => u.role === r).length;
  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const staffDept = form.department || deptNames[0] || '';

  async function toggleActive(u) {
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      toast('Updated', u.is_active ? 'Account deactivated.' : 'Account activated.', 'success');
      loadUsers();
    } catch (e) { toast('Error', e.message, 'error'); }
  }
  async function changeRole(u, role) {
    if (!role || role === u.role) return;
    if (!window.confirm(`Change ${u.name}'s role to "${role}"?`)) return;
    try {
      await setUserRole(u.id, role);
      toast('Role updated', `Role changed to ${role}.`, 'success');
      loadUsers();
    } catch (e) { toast('Error', e.message, 'error'); }
  }
  async function removeUser(u) {
    if (!window.confirm(`Permanently delete ${u.name} (${u.email})?\n\nTheir tokens, appointments and OPD data will be deleted too. This cannot be undone.`)) return;
    try {
      await deleteUser(u.id);
      toast('User deleted', `${u.name} removed.`, 'success');
      loadUsers(); loadDoctors();
    } catch (e) { toast('Error', e.message, 'error'); }
  }

  async function submitStaff() {
    setFormErr(''); setFormWarn('');
    const { name, email, role, phone, password, specialization, room_number } = form;
    if (!name.trim() || !email.trim() || !password) return setFormErr('Name, email and password are required.');
    if (password.length < 6) return setFormErr('Password must be at least 6 characters.');
    showLoading('Creating account…');
    try {
      const res = await createStaff({
        name: name.trim(), email: email.trim(), password, role, phone: phone.trim(),
        department: role === 'doctor' ? staffDept : undefined,
        specialization: role === 'doctor' ? specialization : undefined,
        room_number: role === 'doctor' ? room_number : undefined,
      });
      hideLoading();
      toast('Account created!', `${ROLE_LABELS[role]} account for ${name}`, 'success');
      if (res?.needsConfirmation) setFormWarn('Supabase "Confirm email" is ON — this user must click the confirmation email before logging in. Turn it off in Supabase → Authentication → Providers → Email to avoid this.');
      setForm((f) => ({ ...emptyStaff, role: f.role }));
      loadUsers(); loadDoctors();
    } catch (e) { hideLoading(); setFormErr(e.message); }
  }

  function scrollToForm(role) {
    if (role) setForm((f) => ({ ...f, role }));
    document.getElementById('createStaffCard')?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => document.getElementById('sName')?.focus(), 400);
  }

  function openEditStaff(u) {
    const doc = doctors.find((d) => d.user_id === u.id) || doctors.find((d) => d.name === u.name);
    setModalErr('');
    setEditStaff({
      user: u, doc, name: u.name, phone: u.phone || '',
      department: doc?.department || deptNames[0] || '', specialization: doc?.specialization || '',
      room_number: doc?.room_number || '', available_days: doc?.available_days || 'Mon,Tue,Wed,Thu,Fri',
    });
  }
  async function saveEditStaff() {
    const s = editStaff;
    if (!s.name.trim()) return setModalErr('Name is required.');
    try {
      await updateUser(s.user.id, { name: s.name.trim(), phone: s.phone.trim() || null });
      if (s.user.role === 'doctor' && s.doc) {
        await updateDoctor(s.doc.id, { name: s.name.trim(), department: s.department, specialization: s.specialization.trim(), room_number: s.room_number.trim(), available_days: s.available_days.trim() });
      }
      toast('Updated!', `${s.name}'s details saved.`, 'success');
      setEditStaff(null); loadUsers(); loadDoctors();
    } catch (e) { setModalErr(e.message); }
  }

  function openEditDoctor(d) { setModalErr(''); setEditDoc({ ...d, specialization: d.specialization || '', room_number: d.room_number || '', available_days: d.available_days || 'Mon,Tue,Wed,Thu,Fri' }); }
  async function saveEditDoctor() {
    const d = editDoc;
    if (!d.name.trim()) return setModalErr('Name is required.');
    try {
      await updateDoctor(d.id, { name: d.name.trim(), department: d.department, specialization: d.specialization.trim(), room_number: d.room_number.trim(), available_days: d.available_days.trim(), is_active: d.is_active });
      toast('Doctor updated', `${d.name}'s details saved.`, 'success');
      setEditDoc(null); loadDoctors();
    } catch (e) { setModalErr(e.message); }
  }
  async function removeDoctor(d) {
    if (!window.confirm(`Remove ${d.name}? This cannot be undone.`)) return;
    try {
      await deleteDoctor(d.id);
      toast('Doctor removed', `${d.name} removed.`, 'success');
      loadDoctors();
    } catch (e) { toast('Error', e.message, 'error'); }
  }

  async function saveNewDept() {
    const n = newDept;
    if (!n.name.trim()) return setModalErr('Department name required.');
    if (!parseInt(n.max, 10) || !parseInt(n.avg, 10)) return setModalErr('Max tokens and avg time required.');
    try {
      await addDepartment({ name: n.name, max_tokens_per_day: n.max, avg_minutes_per_patient: n.avg, room_number: n.room, floor: n.floor, icon: n.icon });
      toast('Department added', `${n.name} added.`, 'success');
      setNewDept(null); reloadDepts();
    } catch (e) { setModalErr(e.message); }
  }

  return (
    <Layout active="admin" title="Administrator Panel" subtitle="User & access management">
      <div className="admin-page">
        <div className="page-header slide-up">
          <h1>🛠️ Administrator Panel</h1>
          <p>Manage staff accounts, roles, departments and system access.</p>
        </div>

        <div className="stats-grid stagger admin-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 28 }}>
          {[['stat-icon-blue', '👥', users.length, 'Total Users'], ['stat-icon-green', '🧑‍⚕️', count('doctor'), 'Doctors'], ['stat-icon-purple', '🏪', count('medicine_staff'), 'Pharmacy Staff'], ['stat-icon-yellow', '🏥', count('patient'), 'Patients']].map(([c, i, v, l]) => (
            <div className="stat-card" key={l}>
              <div className={`stat-icon ${c}`}>{i}</div>
              <div className="stat-value">{users.length ? v : '—'}</div>
              <div className="stat-label">{l}</div>
            </div>
          ))}
        </div>

        <div className="table-wrapper" style={{ marginBottom: 24 }}>
          <div className="table-header">
            <h3>📊 Today's Hospital Overview</h3>
            <span className="live-badge"><span className="live-dot" />Live</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-overview" style={{ width: '100%' }}>
              <thead><tr><th>Department</th><th>Now Serving</th><th>Waiting</th><th>Completed</th><th>Total Today</th><th>Capacity</th></tr></thead>
              <tbody>
                {queues.map((q) => (
                  <tr key={q.department}>
                    <td style={{ fontWeight: 600 }}>{q.icon} {q.department}</td>
                    <td>{q.current_token ? `#${q.current_token}` : '—'}</td>
                    <td>{q.waiting_count}</td>
                    <td>{q.completed_count}</td>
                    <td>{q.total_today}</td>
                    <td>{q.total_today}/{q.max_tokens_per_day}</td>
                  </tr>
                ))}
                {!queues.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--c-ink-4)' }}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            <div className="table-wrapper">
              <div className="table-header">
                <h3>All System Users</h3>
                <button className="btn btn-primary btn-sm" onClick={() => scrollToForm()}>+ Create Staff</button>
              </div>
              {GROUPS.map((g) => {
                const list = users.filter((u) => u.role === g.role);
                const q = (search[g.role] || '').toLowerCase();
                const shown = q ? list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : list;
                return (
                  <div className="user-group" key={g.role}>
                    <div className={`user-group-head${open[g.role] ? ' open' : ''}`} onClick={() => setOpen((o) => ({ ...o, [g.role]: !o[g.role] }))}>
                      <div className="gh-left"><span>{g.icon}</span><span className="gh-title">{g.title}</span><span className="gh-count">{list.length}</span></div>
                      <span className="gh-arrow">▼</span>
                    </div>
                    {open[g.role] && (
                      <div>
                        <div className="ug-search"><input type="text" placeholder={g.ph} value={search[g.role] || ''} onChange={(e) => setSearch((s) => ({ ...s, [g.role]: e.target.value }))} /></div>
                        <UserTable users={shown} me={user.id} onEdit={openEditStaff} onToggle={toggleActive} onRole={changeRole} onDelete={removeUser} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="table-wrapper">
              <div className="table-header">
                <h3>👨‍⚕️ Doctor Management</h3>
                <button className="btn btn-primary btn-sm" onClick={() => scrollToForm('doctor')}>+ Add Doctor</button>
              </div>
              {!doctors.length ? (
                <div className="empty-state" style={{ padding: 24 }}><div className="empty-icon">👨‍⚕️</div><h4>No doctors added yet</h4></div>
              ) : doctors.map((d) => (
                <div className="doctor-row" key={d.id}>
                  <img src={d.photo_url || avatarUrl(d.name, 64)} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                    <div style={{ fontSize: '.74rem', color: 'var(--c-ink-3)' }}>{d.specialization || d.department} · {d.room_number || '—'}</div>
                  </div>
                  <span className={`badge badge-${d.is_active ? 'green' : 'red'}`} style={{ flexShrink: 0 }}>{d.is_active ? 'Active' : 'Inactive'}</span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEditDoctor(d)}>✏️ Edit</button>
                    <button className="btn btn-outline btn-sm" style={{ color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => removeDoctor(d)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card card-xl" id="createStaffCard">
              <h4 style={{ marginBottom: 4 }}>➕ Create Staff Account</h4>
              <p style={{ fontSize: '.82rem', marginBottom: 16 }}>Only admin can create doctor and pharmacy staff accounts.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Full Name"><input className="form-control" id="sName" placeholder="Dr. Anjali Sharma" value={form.name} onChange={setF('name')} /></Field>
                <Field label="Email Address"><input className="form-control" type="email" placeholder="doctor@hospital.com" value={form.email} onChange={setF('email')} /></Field>
                <Field label="Role">
                  <select className="form-control" value={form.role} onChange={setF('role')}>
                    <option value="doctor">Doctor</option><option value="medicine_staff">Pharmacy Staff</option><option value="admin">Administrator</option>
                  </select>
                </Field>
                {form.role === 'doctor' && (
                  <>
                    <Field label="Department">
                      <select className="form-control" value={staffDept} onChange={setF('department')}>
                        {deptNames.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </Field>
                    <Field label="Specialization"><input className="form-control" placeholder="e.g. General Physician" value={form.specialization} onChange={setF('specialization')} /></Field>
                    <Field label="Room Number"><input className="form-control" placeholder="e.g. OPD-101" value={form.room_number} onChange={setF('room_number')} /></Field>
                  </>
                )}
                <Field label="Phone (optional)"><input className="form-control" placeholder="+91 98765 43210" value={form.phone} onChange={setF('phone')} /></Field>
                <Field label="Temporary Password"><input className="form-control" type="text" placeholder="Set a temporary password" value={form.password} onChange={setF('password')} /></Field>
                {formErr && <div className="admin-err">{formErr}</div>}
                {formWarn && <div className="admin-warn">{formWarn}</div>}
                <button className="btn btn-primary btn-full" onClick={submitStaff}>Create Account</button>
              </div>
            </div>

            <div className="card" style={{ background: 'linear-gradient(135deg,var(--c-primary),var(--c-primary))', color: '#fff' }}>
              <h4 style={{ color: '#fff', marginBottom: 12 }}>🔐 Access Control</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '.83rem', opacity: 0.9 }}>
                <div>🧑‍💼 <b>Patient</b> — Self-registered via public form</div>
                <div>⚕️ <b>Doctor</b> — Created by admin only</div>
                <div>🏪 <b>Pharmacy</b> — Created by admin only</div>
                <div>🛠️ <b>Admin</b> — Full system access</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>⚙️ Department Capacity Settings</h3>
              <p style={{ fontSize: '.82rem', color: 'var(--c-ink-3)', marginTop: 2 }}>Set max daily tokens and average consultation time per department.</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { setModalErr(''); setNewDept({ name: '', max: 60, avg: 10, room: '', floor: 'Ground', icon: '🏥' }); }}>+ Add Department</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
            {departments.map((d) => <DeptCard key={`${d.name}-${d.max_tokens_per_day}-${d.avg_minutes_per_patient}`} d={d} onSaved={reloadDepts} />)}
          </div>
        </div>

        {editDoc && (
          <Modal title="✏️ Edit Doctor" onClose={() => setEditDoc(null)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Full Name"><input className="form-control" value={editDoc.name} onChange={(e) => setEditDoc({ ...editDoc, name: e.target.value })} /></Field>
              <Field label="Department">
                <select className="form-control" value={editDoc.department} onChange={(e) => setEditDoc({ ...editDoc, department: e.target.value })}>
                  {deptNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Specialization"><input className="form-control" value={editDoc.specialization} onChange={(e) => setEditDoc({ ...editDoc, specialization: e.target.value })} /></Field>
              <Field label="Room Number"><input className="form-control" value={editDoc.room_number} onChange={(e) => setEditDoc({ ...editDoc, room_number: e.target.value })} /></Field>
              <Field label="Available Days"><input className="form-control" placeholder="Mon,Tue,Wed,Thu,Fri" value={editDoc.available_days} onChange={(e) => setEditDoc({ ...editDoc, available_days: e.target.value })} /></Field>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '.84rem' }}>
                <input type="checkbox" checked={editDoc.is_active} onChange={(e) => setEditDoc({ ...editDoc, is_active: e.target.checked })} /> Active (bookable)
              </label>
              {modalErr && <div className="admin-err">{modalErr}</div>}
              <button className="btn btn-primary btn-full" onClick={saveEditDoctor}>💾 Save Changes</button>
            </div>
          </Modal>
        )}

        {editStaff && (
          <Modal title="✏️ Edit Staff Member" onClose={() => setEditStaff(null)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Full Name"><input className="form-control" value={editStaff.name} onChange={(e) => setEditStaff({ ...editStaff, name: e.target.value })} /></Field>
              <Field label="Phone"><input className="form-control" placeholder="+91 98765 43210" value={editStaff.phone} onChange={(e) => setEditStaff({ ...editStaff, phone: e.target.value })} /></Field>
              {editStaff.user.role === 'doctor' && editStaff.doc && (
                <>
                  <Field label="Department">
                    <select className="form-control" value={editStaff.department} onChange={(e) => setEditStaff({ ...editStaff, department: e.target.value })}>
                      {deptNames.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </Field>
                  <Field label="Specialization"><input className="form-control" value={editStaff.specialization} onChange={(e) => setEditStaff({ ...editStaff, specialization: e.target.value })} /></Field>
                  <Field label="Room Number"><input className="form-control" value={editStaff.room_number} onChange={(e) => setEditStaff({ ...editStaff, room_number: e.target.value })} /></Field>
                  <Field label="Available Days"><input className="form-control" value={editStaff.available_days} onChange={(e) => setEditStaff({ ...editStaff, available_days: e.target.value })} /></Field>
                </>
              )}
              {modalErr && <div className="admin-err">{modalErr}</div>}
              <button className="btn btn-primary btn-full" onClick={saveEditStaff}>💾 Save Changes</button>
            </div>
          </Modal>
        )}

        {newDept && (
          <Modal title="🏥 Add New Department" onClose={() => setNewDept(null)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Department Name"><input className="form-control" placeholder="e.g. Neurology" value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Icon (emoji)"><input className="form-control" value={newDept.icon} onChange={(e) => setNewDept({ ...newDept, icon: e.target.value })} /></Field>
                <Field label="Room"><input className="form-control" placeholder="OPD-120" value={newDept.room} onChange={(e) => setNewDept({ ...newDept, room: e.target.value })} /></Field>
              </div>
              <Field label="Floor"><input className="form-control" value={newDept.floor} onChange={(e) => setNewDept({ ...newDept, floor: e.target.value })} /></Field>
              <Field label="Max Tokens / Day"><input className="form-control" type="number" value={newDept.max} onChange={(e) => setNewDept({ ...newDept, max: e.target.value })} /></Field>
              <Field label="Avg. Min / Patient"><input className="form-control" type="number" value={newDept.avg} onChange={(e) => setNewDept({ ...newDept, avg: e.target.value })} /></Field>
              {modalErr && <div className="admin-err">{modalErr}</div>}
              <button className="btn btn-primary btn-full" onClick={saveNewDept}>➕ Add Department</button>
            </div>
          </Modal>
        )}
      </div>
    </Layout>
  );
}
