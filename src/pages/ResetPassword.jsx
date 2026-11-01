import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { ROUTES } from '../lib/routes';

/** Landing page of the "Reset password" e-mail link (Supabase signs the user in from the URL). */
export default function ResetPassword() {
  const { session, updatePassword, signOut } = useAuth();
  const { toast } = useUI();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (pw.length < 6) return setError('Password must be at least 6 characters long.');
    if (pw !== confirm) return setError('Passwords do not match. Please try again.');
    setBusy(true);
    try {
      await updatePassword(pw);
      toast('Password updated', 'Please sign in with your new password.', 'success');
      await signOut();
      nav(ROUTES.login);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-right" style={{ width: '100%' }}>
        <div className="login-card">
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
            <h3 style={{ marginBottom: 4 }}>Choose a new password</h3>
            {session === undefined ? <p>Checking your link…</p> : null}
          </div>
          {session === null ? (
            <>
              <div className="form-error">This reset link is invalid or has expired. Please request a new one.</div>
              <Link to={ROUTES.login} className="btn btn-primary btn-lg btn-full" style={{ marginTop: 14 }}>Back to Sign In</Link>
            </>
          ) : session ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">New password</label>
                <input className="form-control" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Minimum 6 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm password</label>
                <input className="form-control" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Re-enter your password" />
              </div>
              {error ? <div className="form-error">{error}</div> : null}
              <button className="btn btn-primary btn-lg btn-full" onClick={submit} disabled={busy}>
                {busy ? <><span className="spinner" /> Saving…</> : 'Update Password'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
