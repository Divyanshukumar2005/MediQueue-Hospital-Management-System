# 🏥 MediQueue — React + Supabase (Vercel-ready)

Hospital OPD queue & token system. Patients book a department/doctor, get a QR token, and track the live queue; doctors call/scan tokens and write prescriptions; pharmacy prepares medicines; admin manages everything.

**Stack:** React 18 (Vite) · React Router · Supabase (Postgres + Auth + Realtime + RLS) · Vercel. 100% free tier.

## 1. Supabase setup (5 min)
1. Create a project at https://supabase.com.
2. **SQL Editor** → paste all of `supabase/schema.sql` → Run. (Safe to re-run.)
3. **Authentication → Providers → Email** → turn **Confirm email OFF** (needed so the admin can create staff accounts instantly).
4. *(Optional)* **Providers → Google** → add your Google OAuth client id/secret. **Authentication → URL Configuration** → add your Vercel URL to *Site URL* and *Redirect URLs* (also `http://localhost:5173`).
5. Sign up in the app once with your own email, then make yourself admin in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
6. Copy **Project URL** and **anon public key** (Settings → API).

## 2. Run locally
```bash
cp .env.example .env     # fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## 3. Deploy on Vercel
1. Push this folder to GitHub → Vercel → *Import Project* (Framework: Vite).
2. Add env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Deploy. `vercel.json` already handles SPA routing.

## What changed vs. the original
- **Frontend:** vanilla HTML/JS → React (13 pages, same design/CSS, lazy-loaded routes).
- **Backend:** Node/Express/MySQL on Render → Supabase. No server to keep awake.
- **Security:** original routes were unauthenticated; now every table has Row Level Security, roles enforced in the DB, profile role/active columns protected, signup can never create an admin.
- **Race-safe booking:** token numbers & capacity checks run in SQL functions with advisory locks (no duplicate tokens under load).
- **Timezone:** hospital day fixed to Asia/Kolkata in DB and UI (no UTC/IST date mismatch).
- **Realtime:** queue board, token page and pharmacy update live (polling fallback).

## New features
Password-reset email · Google sign-in · soft-cancel tokens · live admin overview table · add/edit departments (icon, room, floor) · delete user · doctor active toggle · QR print · setup-notice if env vars are missing · error boundary.

## Roles
`patient` (self signup) · `doctor`, `medicine_staff`, `admin` (created by admin).
Demo doctors/departments/medicines are seeded by `schema.sql`.
