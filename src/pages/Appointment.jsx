import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useDepartments } from '../context/DepartmentsContext';
import useMediaQuery from '../hooks/useMediaQuery';
import { ROUTES } from '../lib/routes';
import { fmtDate, fmtLongDate, getBookingWindow, isDoctorAvailableOn } from '../lib/utils';
import { bookAppointment, generateToken, getDeptSlots, getDoctors } from '../services/api';

const stepBase = { flex: 1, textAlign: 'center', padding: 12, fontSize: '.85rem', fontWeight: 600 };

function stepStyle(i, n) {
  const radius = i === 1 ? { borderRadius: 'var(--r-md) 0 0 var(--r-md)' } : i === 3 ? { borderRadius: '0 var(--r-md) var(--r-md) 0' } : {};
  if (i === n) return { ...stepBase, ...radius, background: 'linear-gradient(135deg,var(--c-primary),var(--c-primary-mid))', color: '#fff' };
  if (i < n) return { ...stepBase, ...radius, background: 'var(--green-100)', color: '#15803d' };
  return { ...stepBase, ...radius, background: 'var(--c-surface2)', color: 'var(--c-ink-3)' };
}

const row = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--c-surface2)' };

export default function Appointment() {
  const { user } = useAuth();
  const { toast, showLoading, hideLoading } = useUI();
  const { departments, getDept } = useDepartments();
  const nav = useNavigate();
  const mobile = useMediaQuery('(max-width: 768px)');

  const win = useMemo(() => getBookingWindow(), []);
  const [step, setStep] = useState(1);
  const [dept, setDept] = useState(null);
  const [date, setDate] = useState(win.minStr);
  const [doctorId, setDoctorId] = useState(null);
  const [doctorName, setDoctorName] = useState(null);
  const [anyDoctor, setAnyDoctor] = useState(false);
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState(null);
  const [doctors, setDoctors] = useState(null);
  const [booking, setBooking] = useState(false);

  const dateError = !date
    ? 'Please select a date.'
    : date < win.minStr
      ? win.closedForToday && date === win.today
        ? '⚠️ Booking for today has closed (past 12:00 PM). Please select tomorrow or a later date.'
        : '⚠️ Selected date is in the past.'
      : date > win.maxStr
        ? `⚠️ You can only book up to 1 month in advance (latest: ${fmtDate(win.maxStr)}).`
        : '';

  useEffect(() => {
    if (!dept || !date || dateError) {
      setSlots(null);
      return;
    }
    let off = false;
    getDeptSlots(dept, date).then((s) => !off && setSlots(s)).catch(() => !off && setSlots(null));
    return () => {
      off = true;
    };
  }, [dept, date, dateError]);

  const soldOut = slots && slots.available <= 0;
  const canNext = dept && !dateError && !soldOut;

  async function goStep2() {
    if (!dept) return toast('Select a department', '', 'warning');
    if (dateError) return toast(dateError, '', 'warning');
    setStep(2);
    setDoctors(null);
    try {
      setDoctors(await getDoctors(dept, date));
    } catch (e) {
      setDoctors([]);
      toast('Error loading doctors', e.message, 'error');
    }
  }

  function pickDoctor(d) {
    if (!isDoctorAvailableOn(d, date) || d.is_full) return;
    setDoctorId(d.id);
    setDoctorName(d.name);
    setAnyDoctor(false);
    setTimeout(() => setStep(3), 300);
  }
  function pickAny() {
    setDoctorId(null);
    setDoctorName('Any Available Doctor');
    setAnyDoctor(true);
    setTimeout(() => setStep(3), 300);
  }

  async function confirm() {
    if (dateError) return toast('Cannot book', dateError, 'error');
    setBooking(true);
    try {
      const appt = await bookAppointment({ doctor_id: doctorId, department: dept, appt_date: date, notes: notes || null });
      showLoading('Generating your token…');
      const tok = await generateToken(appt.id);
      hideLoading();
      toast('Appointment booked!', `Token #${tok.token_number} generated`, 'success');
      setTimeout(() => nav(`${ROUTES.token}?id=${tok.id}`), 900);
    } catch (e) {
      hideLoading();
      setBooking(false);
      if (/full/i.test(e.message)) toast('Department Full', e.message, 'error');
      else toast('Error', e.message, 'error');
    }
  }

  const d = getDept(dept);
  const slotBox = (() => {
    if (!slots) return null;
    const a = slots.available;
    if (a <= 0) return { bg: 'var(--red-100,#fee2e2)', fg: '#b91c1c', t: `❌ No slots available for ${dept} on this date (${slots.booked_count}/${slots.max_tokens} booked). Please choose another date.` };
    if (a <= 5) return { bg: '#fef3c7', fg: '#92400e', t: `⚠️ Only ${a} slot${a === 1 ? '' : 's'} left for ${dept} on this date.` };
    return { bg: 'var(--green-100,#dcfce7)', fg: '#15803d', t: `✅ ${a} slot${a === 1 ? '' : 's'} available for ${dept} on this date.` };
  })();

  return (
    <Layout active="appointment" title="Book Appointment" subtitle="Select department, date & doctor">
      <div className="page-header slide-up">
        <div className="breadcrumb"><Link to={ROUTES.dashboard}>Home</Link> › Appointment</div>
        <h1>📅 Book Appointment</h1>
        <p>Select department, date &amp; doctor. You'll get a token number — no fixed time needed.</p>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 28 }} className="slide-up">
        <div style={stepStyle(1, step)}>1 · Select Dept &amp; Date</div>
        <div style={stepStyle(2, step)}>2 · Choose Doctor</div>
        <div style={stepStyle(3, step)}>3 · Confirm &amp; Token</div>
      </div>

      {step === 1 && (
        <div className="slide-up" style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 24 }}>
          <div className="card card-xl">
            <h3 style={{ marginBottom: 16 }}>Select Department</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {departments.map((x) => (
                <div key={x.name} className={`doctor-card${dept === x.name ? ' selected' : ''}`} onClick={() => setDept(x.name)} style={{ padding: 16 }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{x.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: '.82rem' }}>{x.name}</div>
                  <div style={{ fontSize: '.72rem', color: dept === x.name ? 'inherit' : 'var(--c-ink-4)' }}>{x.room_number}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <h3 style={{ marginBottom: 14 }}>📆 Select Date</h3>
              <div className="form-group">
                <label className="form-label">Appointment Date</label>
                <input className="form-control" type="date" value={date} min={win.minStr} max={win.maxStr} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div style={{ marginTop: 10, padding: 10, background: 'var(--c-primary-lt)', borderRadius: 'var(--r-md)', fontSize: '.78rem', color: 'var(--c-primary-dk)' }}>
                📌 Tokens open at <b>12:00 AM</b> for the next day onwards. Last booking for any date is <b>12:00 PM (noon)</b> of that date. You can book up to <b>1 month</b> in advance.
              </div>
              {date && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 'var(--r-md)', background: dateError ? 'var(--red-100,#fee2e2)' : 'var(--c-primary-lt)' }}>
                  <div style={{ fontSize: '.82rem', fontWeight: 500, color: dateError ? '#b91c1c' : 'var(--c-primary-dk)' }}>{dateError || `📅 ${fmtLongDate(date)}`}</div>
                </div>
              )}
              {slotBox && !dateError && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 'var(--r-md)', fontSize: '.82rem', fontWeight: 500, background: slotBox.bg, color: slotBox.fg }}>{slotBox.t}</div>
              )}
            </div>
            <div className="card" style={{ background: 'linear-gradient(135deg,var(--c-primary-lt),rgba(239,246,255,.6))' }}>
              <h4 style={{ marginBottom: 10, color: 'var(--c-primary-dk)' }}>ℹ️ How tokens work</h4>
              <p style={{ fontSize: '.82rem', color: 'var(--c-primary-dk)', lineHeight: 1.6 }}>
                You book for a <b>date</b>, not a fixed time. On the day, you get a token number. Check your estimated wait time on the token page and come to hospital accordingly.
              </p>
            </div>
            <button className="btn btn-primary btn-lg btn-full" onClick={goStep2} disabled={!canNext}>Next: Choose Doctor →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card card-xl slide-up">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3>👨‍⚕️ Select Doctor</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>← Back</button>
          </div>
          {slots && slots.available <= 5 && (
            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 'var(--r-md)', fontSize: '.82rem', fontWeight: 500, background: slots.available <= 0 ? 'var(--red-100,#fee2e2)' : '#fef3c7', color: slots.available <= 0 ? '#b91c1c' : '#92400e' }}>
              {slots.available <= 0
                ? `❌ This department is fully booked on this date (${slots.booked_count}/${slots.max_tokens}). Please go back and choose another date.`
                : `⚠️ Only ${slots.available} token${slots.available === 1 ? '' : 's'} left for ${dept} on ${date}.`}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
            {doctors === null && (
              <div className="empty-state" style={{ padding: 30, gridColumn: '1/-1' }}>
                <div className="spinner spinner-blue" />
                <p>Loading doctors…</p>
              </div>
            )}
            {doctors && !doctors.length && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--c-ink-4)', padding: 20 }}>No doctors listed for {dept}</div>
            )}
            {(doctors || []).map((x) => {
              const off = !isDoctorAvailableOn(x, date);
              const blocked = off || x.is_full;
              return (
                <div key={x.id} className={`doctor-card${doctorId === x.id ? ' selected' : ''}`} onClick={() => pickDoctor(x)} style={{ textAlign: 'left', opacity: blocked ? 0.55 : 1, cursor: blocked ? 'not-allowed' : 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--c-primary-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👨‍⚕️</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '.88rem' }}>{x.name}</div>
                      <div style={{ fontSize: '.74rem', color: 'var(--c-ink-4)' }}>{x.specialization || x.department}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '.76rem', color: 'var(--c-ink-3)' }}>🚪 Room: {x.room_number || 'OPD'}</div>
                  <div style={{ fontSize: '.72rem', color: off ? '#b91c1c' : x.is_full ? '#b91c1c' : 'var(--c-ink-4)', marginTop: 4 }}>
                    {off ? `Not available on this day (${x.available_days})` : x.is_full ? 'Fully booked' : `🗓 ${x.available_days || 'Every day'} · ${x.tokens_remaining} left`}
                  </div>
                </div>
              );
            })}
          </div>
          <div onClick={pickAny} style={{ marginTop: 20, padding: 14, background: 'var(--c-surface2)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', border: anyDoctor ? '2px solid var(--c-primary-mid)' : '2px dashed var(--c-border)' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🎲</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '.88rem' }}>Any Available Doctor</div>
              <div style={{ fontSize: '.78rem', color: 'var(--c-ink-4)' }}>System will assign automatically</div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card card-xl slide-up" style={{ maxWidth: 600, margin: '0 auto' }}>
          <h3 style={{ marginBottom: 20 }}>📋 Confirm Appointment</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['Department', `${d?.icon || ''} ${dept}`],
              ['Date', fmtDate(date)],
              ['Doctor', doctorName || 'Any Available'],
            ].map(([k, v]) => (
              <div key={k} style={row}>
                <span style={{ color: 'var(--c-ink-3)', fontSize: '.85rem' }}>{k}</span>
                <span style={{ fontWeight: 600, fontSize: '.85rem' }}>{v}</span>
              </div>
            ))}
            <div style={{ ...row, borderBottom: 'none' }}>
              <span style={{ color: 'var(--c-ink-3)', fontSize: '.85rem' }}>Room</span>
              <span style={{ fontWeight: 600, fontSize: '.85rem' }}>{d?.room_number || 'TBD'}</span>
            </div>
          </div>
          <div style={{ marginTop: 20 }} className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea className="form-control" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any specific concerns or symptoms…" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
            <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={confirm} disabled={booking}>
              {booking ? <><span className="spinner" /> Booking…</> : '✅ Confirm & Book'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
