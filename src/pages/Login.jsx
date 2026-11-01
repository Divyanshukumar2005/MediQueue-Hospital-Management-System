import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { roleHome } from '../lib/routes';

const GOOGLE_IMG = 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg';
const FEATURES = [
  'Book by date & department — no fixed time',
  'QR code token scanned at entry and counter',
  'Digital OPD record & prescription history',
  'Medicine pickup notification when ready',
];
const eyeBtn = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-ink-4)', fontSize: 15, lineHeight: 1 };
const tabStyle = (on) => ({ flex: 1, padding: 8, border: 'none', borderRadius: 8, fontSize: '.88rem', fontWeight: 600, cursor: 'pointer', transition: 'all .2s', background: on ? 'var(--c-primary)' : 'transparent', color: on ? '#fff' : 'var(--c-ink-3)' });

export default function Login() {
  const { user, loading, authNotice, clearAuthNotice, signIn, signUp, signInWithGoogle, sendPasswordReset } = useAuth();
  const { toast } = useUI();
  const nav = useNavigate();
  const [tab, setTab] = useState('login');
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPw, setShowPw] = useState({});
  const [f, setF] = useState({ lEmail: '', lPassword: '', rName: '', rEmail: '', rPhone: '', rPassword: '', rConfirm: '', fEmail: '' });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const togglePwd = (k) => setShowPw((p) => ({ ...p, [k]: !p[k] }));

  useEffect(() => {
    if (user) nav(roleHome(user.role), { replace: true });
  }, [user, nav]);

  function switchTab(t) {
    setTab(t);
    setError('');
    setSuccess('');
    clearAuthNotice();
  }

  async function doLogin() {
    setError('');
    const email = f.lEmail.trim();
    if (!email || !f.lPassword) return setError('Please enter your email and password.');
    setBusy(true);
    try {
      await signIn(email, f.lPassword);
      toast('Welcome back!', 'Signing you in…', 'success');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function doRegister() {
    setError('');
    const name = f.rName.trim();
    const email = f.rEmail.trim();
    if (!name) return setError('Please enter your full name.');
    if (!email) return setError('Please enter your email address.');
    if (!f.rPassword) return setError('Please choose a password.');
    if (f.rPassword.length < 6) return setError('Password must be at least 6 characters long.');
    if (f.rPassword !== f.rConfirm) return setError('Passwords do not match. Please try again.');
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp({ name, email, password: f.rPassword, phone: f.rPhone.trim() });
      if (needsConfirmation) {
        setSuccess('✅ Account created! Please check your email and click the confirmation link, then sign in.');
        setBusy(false);
      } else {
        toast('Account created!', `Welcome to MediQueue, ${name}`, 'success');
      }
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function doForgot() {
    setError('');
    setSuccess('');
    const email = f.fEmail.trim();
    if (!email) return setError('Please enter your email address.');
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setSuccess('✅ Password reset link sent! Please check your email inbox (and spam folder).');
    } catch (e) {
      let msg = e.message;
      if (/rate limit|too many/i.test(msg)) msg = 'Too many attempts. Please wait a few minutes and try again.';
      if (/invalid/i.test(msg) && /email/i.test(msg)) msg = 'Please enter a valid email address.';
      setError(msg);
    }
    setBusy(false);
  }

  async function doGoogle() {
    setOverlay(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setOverlay(false);
      toast('Sign-in failed', e.message || 'Google sign-in failed.', 'error');
    }
  }

  const GoogleBtn = () => (
    <button className="btn-google" onClick={doGoogle} type="button">
      <img src={GOOGLE_IMG} alt="Google" />
      Continue with Google
    </button>
  );
  const notice = error || authNotice;

  return (
    <>
      <div className="login-page">
        <div className="login-left">
          <div style={{ marginBottom: 'auto', paddingBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
              <div style={{ width: 34, height: 34, background: 'var(--c-primary)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700, color: '#fff', letterSpacing: '-.01em' }}>MediQueue</span>
            </div>
            <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.3, marginBottom: 12, fontFamily: 'var(--font-display)' }}>Skip the queue.<br />Not the care.</h2>
            <p style={{ color: 'rgba(255,255,255,.45)', fontSize: '.88rem', lineHeight: 1.7, marginBottom: 32 }}>Book your OPD slot online, get a numbered token, and arrive exactly when it's your turn.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {FEATURES.map((t) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,.55)', fontSize: '.83rem' }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <p style={{ color: 'rgba(255,255,255,.2)', fontSize: '.72rem', marginTop: 'auto' }}>© 2025 MediQueue. Built for public hospitals.</p>
        </div>

        <div className="login-right">
          <div className="login-card" id="mainCard">
            <h1 style={{ marginBottom: 4 }}>MediQueue</h1>
            <p style={{ marginBottom: 0, fontSize: '.85rem', color: 'var(--c-ink-4)' }}>Smart Hospital Queue Management System</p>

            {tab !== 'forgot' && (
              <div style={{ display: 'flex', background: 'var(--c-surface2)', borderRadius: 'var(--r-md)', padding: 4, margin: '20px 0 24px', gap: 4 }}>
                <button style={tabStyle(tab === 'login')} onClick={() => switchTab('login')}>Sign In</button>
                <button style={tabStyle(tab === 'register')} onClick={() => switchTab('register')}>Create Account</button>
              </div>
            )}

            {tab === 'login' && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input className="form-control" type="email" placeholder="you@example.com" value={f.lEmail} onChange={set('lEmail')} onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-control" type={showPw.l ? 'text' : 'password'} placeholder="Enter your password" style={{ paddingRight: 44 }} value={f.lPassword} onChange={set('lPassword')} onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
                      <button type="button" onClick={() => togglePwd('l')} style={eyeBtn}>👁</button>
                    </div>
                    <div style={{ textAlign: 'right', marginTop: 4 }}>
                      <button onClick={() => switchTab('forgot')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.8rem', color: 'var(--c-primary)', fontWeight: 500 }}>Forgot password?</button>
                    </div>
                  </div>
                  {notice ? <div className="form-error">{notice}</div> : null}
                  <button className="btn btn-primary btn-lg btn-full" onClick={doLogin} disabled={busy}>
                    {busy ? <><span className="spinner" /> Signing in…</> : 'Sign In'}
                  </button>
                </div>
                <div className="divider">or continue with</div>
                <GoogleBtn />
              </div>
            )}

            {tab === 'register' && (
              <div>
                <div style={{ background: 'var(--c-primary-lt)', border: '1px solid var(--c-primary-lt)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 16, fontSize: '.82rem', color: 'var(--c-primary-dk)' }}>
                  ℹ️ Registration is for <strong>patients only</strong>. Staff accounts are created by the hospital administrator.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-control" type="text" placeholder="Enter your full name" value={f.rName} onChange={set('rName')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input className="form-control" type="email" placeholder="you@example.com" value={f.rEmail} onChange={set('rEmail')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number <span style={{ color: 'var(--c-ink-4)', fontWeight: 400 }}>(optional)</span></label>
                    <input className="form-control" type="tel" placeholder="+91 98765 43210" value={f.rPhone} onChange={set('rPhone')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-control" type={showPw.r ? 'text' : 'password'} placeholder="Minimum 6 characters" style={{ paddingRight: 44 }} value={f.rPassword} onChange={set('rPassword')} />
                      <button type="button" onClick={() => togglePwd('r')} style={eyeBtn}>👁</button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm Password</label>
                    <input className="form-control" type="password" placeholder="Re-enter your password" value={f.rConfirm} onChange={set('rConfirm')} onKeyDown={(e) => e.key === 'Enter' && doRegister()} />
                  </div>
                  {error ? <div className="form-error">{error}</div> : null}
                  {success ? <div className="form-success">{success}</div> : null}
                  <button className="btn btn-primary btn-lg btn-full" onClick={doRegister} disabled={busy}>
                    {busy ? <><span className="spinner" /> Creating account…</> : 'Create Account'}
                  </button>
                </div>
                <div className="divider">or sign up with</div>
                <GoogleBtn />
              </div>
            )}

            {tab === 'forgot' && (
              <div>
                <div style={{ textAlign: 'center', margin: '20px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
                  <h3 style={{ marginBottom: 4 }}>Reset Your Password</h3>
                  <p style={{ fontSize: '.85rem', color: 'var(--c-ink-4)' }}>Enter your email address and we'll send you a password reset link.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input className="form-control" type="email" placeholder="you@example.com" value={f.fEmail} onChange={set('fEmail')} onKeyDown={(e) => e.key === 'Enter' && doForgot()} />
                  </div>
                  {error ? <div className="form-error">{error}</div> : null}
                  {success ? <div className="form-success">{success}</div> : null}
                  <button className="btn btn-primary btn-lg btn-full" onClick={doForgot} disabled={busy || !!success}>
                    {busy ? <><span className="spinner" /> Sending…</> : success ? 'Reset Link Sent' : 'Send Reset Link'}
                  </button>
                  <button type="button" onClick={() => switchTab('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-primary)', fontSize: '.88rem', fontWeight: 600, padding: 4 }}>← Back to Sign In</button>
                </div>
              </div>
            )}

            <p style={{ marginTop: 20, fontSize: '.73rem', color: 'var(--c-ink-4)', textAlign: 'center' }}>By continuing you agree to our Terms of Service and Privacy Policy</p>
          </div>
        </div>
      </div>
      {(overlay || (loading && false)) && (
        <div className="loading-overlay">
          <div className="spinner spinner-blue" style={{ width: 40, height: 40, borderWidth: 4 }} />
          <p>Please wait…</p>
        </div>
      )}
    </>
  );
}
