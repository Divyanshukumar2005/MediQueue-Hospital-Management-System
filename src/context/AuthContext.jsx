import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

async function fetchProfile(uid) {
  let { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (!data && !error) {
    // brand-new OAuth user: give the signup trigger a moment, then retry once
    await new Promise((r) => setTimeout(r, 600));
    ({ data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle());
  }
  if (error) throw error;
  return data;
}

/**
 * Supabase Auth replaces the old Express JWT login + Firebase Google sign-in.
 * `user` is the row from public.profiles: { id, name, email, phone, photo_url, role, is_active, auth_provider }.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [user, setUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user?.id;
  useEffect(() => {
    let cancelled = false;
    if (session === undefined) return undefined;
    if (!uid) {
      setUser(null);
      return undefined;
    }
    setProfileLoading(true);
    fetchProfile(uid)
      .then(async (p) => {
        if (cancelled) return;
        if (p && p.is_active === false) {
          setAuthNotice('Your account has been deactivated. Contact admin.');
          setUser(null);
          await supabase.auth.signOut();
          return;
        }
        setUser(p);
      })
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setProfileLoading(false));
    return () => {
      cancelled = true;
    };
  }, [uid, session]);

  const refreshProfile = useCallback(async () => {
    if (!uid) return;
    setUser(await fetchProfile(uid));
  }, [uid]);

  const signIn = useCallback(async (email, password) => {
    setAuthNotice('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (/invalid login credentials/i.test(error.message)) throw new Error('Incorrect email or password.');
      if (/email not confirmed/i.test(error.message)) throw new Error('Please confirm your email first (check your inbox).');
      throw new Error(error.message);
    }
  }, []);

  const signUp = useCallback(async ({ name, email, password, phone }) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, phone: phone || '' } } });
    if (error) throw new Error(error.message);
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists.');
    }
    return { needsConfirmation: !data.session };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
    if (error) throw new Error(error.message);
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) throw new Error(error.message);
  }, []);

  const updatePassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user,
      loading: session === undefined || (!!uid && profileLoading && !user),
      authNotice,
      clearAuthNotice: () => setAuthNotice(''),
      signIn,
      signUp,
      signInWithGoogle,
      sendPasswordReset,
      updatePassword,
      signOut,
      refreshProfile,
    }),
    [session, user, uid, profileLoading, authNotice, signIn, signUp, signInWithGoogle, sendPasswordReset, updatePassword, signOut, refreshProfile]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
