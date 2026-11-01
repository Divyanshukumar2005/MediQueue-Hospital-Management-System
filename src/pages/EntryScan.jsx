import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUI } from '../context/UIContext';
import useQrScanner from '../hooks/useQrScanner';
import { ROUTES } from '../lib/routes';
import { parseScanPayload } from '../lib/utils';
import { scanToken } from '../services/api';
import './EntryScan.css';

const pad = (n) => String(n).padStart(3, '0');
const scanSize = { width: 1280, height: 720 };

function Rows({ token, opdCard, text, label, border }) {
  const rows = [
    ['Patient', token.user?.name || '—'],
    ['Department', token.department],
    ['Room', token.room_number || '—'],
    ['Doctor', token.doctor_name || '—'],
  ];
  if (opdCard) {
    if (opdCard.card_number) rows.push(['OPD Card #', opdCard.card_number]);
    if (opdCard.age) rows.push(['Age', `${opdCard.age} yrs`]);
    if (opdCard.gender) rows.push(['Gender', opdCard.gender]);
    if (opdCard.blood_group) rows.push(['Blood Group', opdCard.blood_group]);
    if (opdCard.phone) rows.push(['Phone', opdCard.phone]);
  } else if (token.user?.phone) rows.push(['Phone', token.user.phone]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', marginTop: 14, borderRadius: 10, overflow: 'hidden', border: `0.5px solid ${border}` }}>
      {rows.map((r, i) => (
        <div key={r[0]} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', background: i % 2 === 0 ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.3)' }}>
          <span style={{ color: label, fontSize: '.8rem' }}>{r[0]}</span>
          <span style={{ color: text, fontWeight: 600, fontSize: '.8rem' }}>{r[1]}</span>
        </div>
      ))}
    </div>
  );
}

const ERR_STYLE = {
  EXPIRED: { icon: '📅', title: 'TOKEN EXPIRED', bg: '#FFF7ED', bdr: '#FDBA74', ico: '#FED7AA', txt: '#9A3412', pt: '#C2410C', status: '📅 Token expired — wrong date' },
  FUTURE: { icon: '🗓️', title: 'FUTURE DATE', bg: '#EFF6FF', bdr: '#93C5FD', ico: '#DBEAFE', txt: '#1E3A8A', pt: '#1D4ED8', status: '🗓️ Future token' },
  DEFAULT: { icon: '❌', title: 'ENTRY DENIED', bg: '#FCEBEB', bdr: '#F09595', ico: '#F7C1C1', txt: '#501313', pt: '#791F1F', status: '❌ Token not found' },
};

export default function EntryScan() {
  const { toast } = useUI();
  const [status, setStatus] = useState({ msg: '', type: '' });
  const [manual, setManual] = useState('');
  const [result, setResult] = useState(null); // {kind:'loading'|'ok'|'inactive'|'error', ...}
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = '#F5F4F0';
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  const doVerify = useCallback(async (identifier) => {
    const displayId = identifier.toUpperCase().startsWith('OPD') ? identifier : `#${identifier}`;
    setResult({ kind: 'loading', displayId });
    try {
      const data = await scanToken(identifier, null);
      const { token } = data;
      const valid = ['waiting', 'called'].includes(token.status);
      setResult({ kind: valid ? 'ok' : 'inactive', ...data });
      setStatus(valid ? { msg: `✅ Entry allowed — Token #${token.token_number}`, type: 'success' } : { msg: `⚠️ Token ${token.status}`, type: 'error' });
      setRecent((r) => [{ num: token.token_number, name: token.user?.name || '—', dept: token.department, valid, time: new Date() }, ...r].slice(0, 5));
      setManual('');
    } catch (e) {
      const st = ERR_STYLE[e.errorType] || ERR_STYLE.DEFAULT;
      setResult({ kind: 'error', message: e.message, st });
      setStatus({ msg: st.status, type: 'error' });
    }
  }, []);

  const onDetect = useCallback(
    (raw) => {
      const p = parseScanPayload(raw);
      if (!p) {
        setStatus({ msg: '⚠️ Invalid QR code — not a MediQueue token', type: 'error' });
        return;
      }
      setStatus({ msg: '✅ QR detected! Verifying…', type: 'success' });
      doVerify(p.identifier);
    },
    [doVerify]
  );

  const { videoRef, canvasRef, active, error, start, stop, resetCooldown } = useQrScanner({ onDetect, cooldownMs: 3000, idealSize: scanSize });

  useEffect(() => {
    if (error) setStatus({ msg: `❌ ${error}`, type: 'error' });
  }, [error]);

  async function startCam() {
    setStatus({ msg: 'Requesting camera access…', type: 'active' });
    await start();
  }
  function stopCam() {
    stop();
    setStatus({ msg: '', type: '' });
  }
  useEffect(() => {
    if (active) setStatus({ msg: '📷 Camera active — point at QR code', type: 'active' });
  }, [active]);

  function verifyManual() {
    const v = manual.trim();
    if (!v) return toast('Enter token number', '', 'warning');
    doVerify(v);
  }
  function clearResult() {
    setResult(null);
    resetCooldown();
    if (active) setStatus({ msg: '📷 Ready — point at next QR code', type: 'active' });
  }

  const ok = result?.kind === 'ok';
  const pal = ok
    ? { bg: '#EAF3DE', bdr: '#97C459', ico: '#C0DD97', txt: '#27500A', lab: '#3B6D11', row: 'rgba(39,80,10,.12)', btn: '#C0DD97' }
    : { bg: '#FAEEDA', bdr: '#FAC775', ico: '#FAC775', txt: '#633806', lab: '#854F0B', row: 'rgba(99,56,6,.1)', btn: '#FAC775' };
  const circle = (bg, icon) => (
    <div style={{ width: 56, height: 56, background: bg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 12px' }}>{icon}</div>
  );

  return (
    <div className="entry-page">
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ width: 56, height: 56, background: '#E6F1FB', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 12px', border: '0.5px solid #B5D4F4' }}>🏥</div>
        <h1 style={{ color: '#2C2C2A', fontSize: '1.5rem', fontWeight: 700 }}>MediQueue — Entry Gate</h1>
        <p style={{ color: '#888780', fontSize: '.85rem', marginTop: 4 }}>Scan patient QR code to verify entry</p>
      </div>

      <div className="gate-card">
        <div className="scanner-box">
          <video ref={videoRef} autoPlay playsInline muted />
          <canvas ref={canvasRef} />
          <div className="scan-corner tl" /><div className="scan-corner tr" /><div className="scan-corner bl" /><div className="scan-corner br" />
          {active && <div className="scan-line" />}
          {!active && (
            <div className="scan-placeholder">
              <div className="icon">📷</div>
              <div>Tap <b>Start Camera</b> to scan QR code</div>
              <div style={{ fontSize: '.72rem', color: '#B4B2A9' }}>Works on mobile &amp; desktop</div>
            </div>
          )}
        </div>
        <div className={`scan-status ${status.type}`}>{status.msg}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
          {!active ? (
            <button className="cam-btn start" onClick={startCam}>📷 Start Camera</button>
          ) : (
            <button className="cam-btn stop" onClick={stopCam}>⏹ Stop</button>
          )}
        </div>
        <div className="or-divider">or enter manually</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <input className="form-control manual-input" placeholder="Token number or OPD code…" value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && verifyManual()} />
          <button className="btn btn-primary" onClick={verifyManual}>Verify</button>
        </div>
      </div>

      {result?.kind === 'loading' && (
        <div className="result-card" style={{ background: '#fff' }}>
          <div className="spinner spinner-blue" style={{ margin: '0 auto', display: 'block', width: 32, height: 32, borderWidth: 3 }} />
          <p style={{ color: '#888780', marginTop: 12, fontSize: '.85rem' }}>Verifying {result.displayId}…</p>
        </div>
      )}

      {(ok || result?.kind === 'inactive') && (
        <div className="result-card" style={{ background: pal.bg, border: `0.5px solid ${pal.bdr}` }}>
          {circle(pal.ico, ok ? '✅' : '⚠️')}
          <div style={{ fontSize: '1rem', fontWeight: 700, color: pal.txt, letterSpacing: '.04em' }}>{ok ? 'ENTRY ALLOWED' : `TOKEN ${result.token.status.toUpperCase()}`}</div>
          <div style={{ fontSize: '2.8rem', fontWeight: 800, color: pal.txt, fontFamily: 'monospace', margin: '10px 0' }}>#{pad(result.token.token_number)}</div>
          <Rows token={result.token} opdCard={result.opdCard} text={pal.txt} label={pal.lab} border={pal.row} />
          {ok && result.isNewPatient && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#E6F1FB', borderRadius: 8, fontSize: '.78rem', color: '#185FA5', textAlign: 'center', border: '0.5px solid #B5D4F4' }}>🆕 New patient — OPD card will be created</div>
          )}
          <button className="result-btn" style={{ borderColor: pal.btn, color: pal.lab }} onClick={clearResult}>{ok ? '✕ Clear & Scan Next' : '✕ Clear'}</button>
        </div>
      )}

      {result?.kind === 'error' && (
        <div className="result-card" style={{ background: result.st.bg, border: `0.5px solid ${result.st.bdr}` }}>
          {circle(result.st.ico, result.st.icon)}
          <div style={{ fontSize: '1rem', fontWeight: 700, color: result.st.txt, letterSpacing: '.04em' }}>{result.st.title}</div>
          <p style={{ color: result.st.pt, fontSize: '.85rem', marginTop: 8 }}>{result.message}</p>
          <button className="result-btn" style={{ borderColor: result.st.bdr, color: result.st.txt }} onClick={clearResult}>✕ Clear</button>
        </div>
      )}

      <div style={{ marginTop: 24, width: '100%', maxWidth: 440 }}>
        <div style={{ color: '#B4B2A9', fontSize: '.74rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Recent Verifications</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recent.map((r, i) => (
            <div key={i} className="recent-item" style={{ borderLeft: `3px solid ${r.valid ? '#639922' : '#EF9F27'}` }}>
              <div>
                <div style={{ color: '#2C2C2A', fontSize: '.83rem', fontWeight: 600 }}>#{pad(r.num)} — {r.name}</div>
                <div style={{ color: '#888780', fontSize: '.74rem' }}>{r.dept} · {r.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <span style={{ fontSize: 18 }}>{r.valid ? '✅' : '⚠️'}</span>
            </div>
          ))}
        </div>
      </div>

      <Link to={ROUTES.dashboard} className="back-link">← Back to Dashboard</Link>
    </div>
  );
}
