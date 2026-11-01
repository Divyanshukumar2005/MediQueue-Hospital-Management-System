import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anon && !url.includes('YOUR-PROJECT'));

// Placeholder URL keeps the app from crashing on import so <SetupNotice/> can explain what's missing.
export const supabase = createClient(
  isConfigured ? url : 'https://placeholder.supabase.co',
  isConfigured ? anon : 'placeholder-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

// A second, throw-away client used ONLY by the admin panel to create staff accounts:
// supabase.auth.signUp() on the main client would sign the admin out and log in as the new user.
export function createEphemeralClient() {
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'mq-staff-create' },
  });
}
