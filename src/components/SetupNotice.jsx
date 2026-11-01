export default function SetupNotice() {
  return (
    <div className="setup-notice">
      <div className="card card-xl">
        <h1 style={{ marginBottom: 8 }}>🏥 MediQueue needs a Supabase project</h1>
        <p style={{ marginBottom: 14 }}>The app is running, but the Supabase keys are missing. Create a file named <code>.env</code> (locally) or add these Environment Variables in Vercel:</p>
        <pre>{`VITE_SUPABASE_URL=https://xxxx.supabase.co\nVITE_SUPABASE_ANON_KEY=your-anon-key`}</pre>
        <p style={{ marginTop: 14 }}>Then run <code>supabase/schema.sql</code> in the Supabase SQL editor. Full steps are in README.md.</p>
      </div>
    </div>
  );
}
