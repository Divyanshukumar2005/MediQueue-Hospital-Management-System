// ─────────────────────────────────────────────────────────────────────────────
//  MediQueue data layer — replaces script.js `apiCall()` + the Express controllers.
//  Every function throws an Error with a human-readable message on failure, so
//  pages can simply:  try { await api.x() } catch (e) { toast('Error', e.message, 'error') }
// ─────────────────────────────────────────────────────────────────────────────
import { supabase, createEphemeralClient } from '../lib/supabase';
import { istToday } from '../lib/utils';

// ── error handling ──────────────────────────────────────────────────────────
function friendly(error) {
  const msg = error?.message || String(error || 'Something went wrong.');
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'Network error. Please check your internet connection.';
  if (/jwt expired|invalid jwt/i.test(msg)) return 'Your session expired. Please sign in again.';
  if (error?.code === '42501' || /row-level security|permission denied/i.test(msg)) return 'You do not have permission to do that.';
  if (error?.code === '23505') return 'That record already exists.';
  return msg;
}

async function run(query) {
  const { data, error } = await query;
  if (error) {
    const err = new Error(friendly(error));
    err.code = error.code;
    throw err;
  }
  return data;
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  const id = data?.session?.user?.id;
  if (!id) throw new Error('Please sign in first.');
  return id;
}

// ── Departments ─────────────────────────────────────────────────────────────
export const getDepartments = () => run(supabase.from('departments').select('*').order('sort_order').order('name'));

export async function addDepartment({ name, icon, room_number, floor, description, max_tokens_per_day, avg_minutes_per_patient }) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Department name required.');
  return run(
    supabase
      .from('departments')
      .insert({
        name: clean,
        label: clean,
        icon: icon || '🏥',
        room_number: room_number || null,
        floor: floor || 'Ground',
        description: description || null,
        max_tokens_per_day: Number(max_tokens_per_day) || 60,
        avg_minutes_per_patient: Number(avg_minutes_per_patient) || 10,
        sort_order: 100,
      })
      .select()
      .single()
  );
}

export const updateDepartment = (name, patch) =>
  run(supabase.from('departments').update(patch).eq('name', name).select().single());

// ── Appointments ────────────────────────────────────────────────────────────
/** Doctors of a department + how many tokens each has left on `date`. */
export const getDoctors = (department, date) =>
  run(supabase.rpc('get_doctors', { p_department: department || null, p_date: date || istToday() }));

/** { max_tokens, booked_count, available, avg_minutes_per_patient } */
export const getDeptSlots = (department, date) =>
  run(supabase.rpc('get_dept_slots', { p_dept: department, p_date: date || istToday() }));

export const bookAppointment = ({ doctor_id, department, appt_date, notes }) =>
  run(supabase.rpc('book_appointment', { p_doctor_id: doctor_id || null, p_department: department, p_appt_date: appt_date, p_notes: notes || null }));

/** Creates the queue token for an appointment. Returns the token (with doctor_name). */
export const generateToken = (appointmentId) => run(supabase.rpc('generate_token', { p_appointment_id: appointmentId }));

export const getMyAppointments = async () => {
  const uid = await currentUserId();
  return run(
    supabase
      .from('appointments')
      .select('*, doctor:doctors(id,name,specialization,room_number)')
      .eq('user_id', uid)
      .order('appt_date', { ascending: false })
  );
};

export const cancelAppointment = (id) => run(supabase.rpc('cancel_appointment', { p_id: id }));

// ── Tokens & queue ──────────────────────────────────────────────────────────
/** My last 20 tokens, newest first. Each has `doctor_name` (from the doctor join). */
export const getMyTokens = async () => {
  const uid = await currentUserId();
  const rows = await run(
    supabase
      .from('tokens')
      .select('*, doctor:doctors(id,name,specialization,room_number)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(20)
  );
  return rows.map((t) => ({ ...t, doctor_name: t.doctor?.name || null }));
};

export const cancelToken = (id) => run(supabase.rpc('cancel_token', { p_id: id }));

/**
 * Live board data for every department (public — works without login):
 * [{ department, label, icon, room_number, current_token, next_token, waiting_count,
 *    completed_count, total_today, max_tokens_per_day, avg_minutes_per_patient }]
 */
export const getQueueStatus = () => run(supabase.rpc('get_queue_status'));

/** Waiting tokens of a department for today (doctor panel), each with `user`. */
export const getWaitingTokens = (department) =>
  run(
    supabase
      .from('tokens')
      .select('*, user:profiles(id,name,email,photo_url)')
      .eq('department', department)
      .eq('status', 'waiting')
      .eq('appt_date', istToday())
      .order('token_number', { ascending: true })
  );

/** Calls the next waiting token. Resolves to the token (with `user`) or null if the queue is empty. */
export const callNextToken = (department) => run(supabase.rpc('call_next_token', { p_department: department }));

export class ScanError extends Error {
  constructor(res) {
    super(res.message || 'Token not found.');
    this.name = 'ScanError';
    this.errorType = res.errorType; // NOT_FOUND | AMBIGUOUS | WRONG_DEPARTMENT | EXPIRED | FUTURE
    this.token = res.token || null;
  }
}

/**
 * Look up a token by QR identifier (token_uid), token number (today) or DB id.
 * Resolves to { token, opdCard, isNewPatient } where
 *   token   = { …token columns, user:{id,name,email,phone,photo_url}, doctor_name }
 *   opdCard = { …card columns, visits:[last 5] } | null
 * Rejects with ScanError (errorType + message) for invalid / expired / wrong-department tokens.
 */
export async function scanToken(identifier, department) {
  const res = await run(supabase.rpc('scan_token', { p_identifier: String(identifier), p_department: department || null }));
  if (!res?.ok) throw new ScanError(res || {});
  return { token: res.token, opdCard: res.opdCard, isNewPatient: res.isNewPatient };
}

// ── OPD cards & visits ──────────────────────────────────────────────────────
function sortVisits(card) {
  if (card?.visits) {
    card.visits = [...card.visits].sort((a, b) => (b.visit_date || '').localeCompare(a.visit_date || '') || b.id - a.id);
  }
  return card;
}

/** OPD card (+ all visits, newest first, + `user`) for a patient, or null when none exists yet. */
export async function getOpdCard(userId) {
  const uid = userId || (await currentUserId());
  const card = await run(
    supabase.from('opd_cards').select('*, user:profiles(id,name,email,photo_url), visits:opd_visits(*)').eq('user_id', uid).maybeSingle()
  );
  return sortVisits(card);
}

export const createOpdCard = ({ user_id, age, gender, blood_group, phone, address }) =>
  run(
    supabase.rpc('create_opd_card', {
      p_user_id: user_id,
      p_blood_group: blood_group || null,
      p_age: age ? Number(age) : null,
      p_gender: gender || null,
      p_phone: phone || null,
      p_address: address || null,
    })
  );

export const updateOpdCard = (id, { age, gender, blood_group, phone, address }) =>
  run(
    supabase
      .from('opd_cards')
      .update({ age: age ? Number(age) : null, gender: gender || null, blood_group: blood_group || null, phone: phone || null, address: address || null })
      .eq('id', id)
      .select()
      .single()
  );

/**
 * Doctor saves a consultation. One atomic call: creates the OPD card if the patient has none,
 * stores the visit, completes the token and (optionally) queues the prescription for the pharmacy.
 */
export const recordVisit = ({ user_id, token_id, symptoms, diagnosis, prescription, doctor_name, follow_up_date, send_to_medicine }) =>
  run(
    supabase.rpc('record_visit', {
      p_user_id: user_id,
      p_token_id: token_id || null,
      p_symptoms: symptoms,
      p_diagnosis: diagnosis || null,
      p_prescription: prescription || null,
      p_doctor_name: doctor_name || null,
      p_follow_up: follow_up_date || null,
      p_send_to_medicine: !!send_to_medicine,
    })
  );

// ── Medicines & prescriptions ───────────────────────────────────────────────
export const getMedicines = () => run(supabase.from('medicines').select('*').order('name'));

export const addMedicine = ({ name, category, stock, unit, description }) =>
  run(
    supabase
      .from('medicines')
      .insert({ name: String(name || '').trim(), category: category || null, stock: Math.max(0, parseInt(stock, 10) || 0), unit: unit || 'tablet', description: description || null })
      .select()
      .single()
  );

export const setMedicineStock = (id, stock) =>
  run(supabase.from('medicines').update({ stock: Math.max(0, parseInt(stock, 10) || 0) }).eq('id', id).select().single());

/** Prescription requests (newest first) with `user` {id,name,email} and `visit` {id,symptoms,diagnosis,prescription,doctor_name}. */
export const getMedicineRequests = (status) => {
  let q = supabase
    .from('medicine_requests')
    .select('*, user:profiles(id,name,email), visit:opd_visits(id,symptoms,diagnosis,prescription,doctor_name)')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  return run(q);
};

export const updateMedicineRequest = (id, status, admin_notes) =>
  run(supabase.rpc('update_medicine_request', { p_id: id, p_status: status, p_notes: admin_notes || null }));

export const getMyMedicineRequests = async () => {
  const uid = await currentUserId();
  return run(supabase.from('medicine_requests').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(5));
};

// ── Doctor self-service ─────────────────────────────────────────────────────
/** The doctors-table row linked to this login (by user_id), or null. */
export const getMyDoctorProfile = async () => {
  const uid = await currentUserId();
  return run(supabase.from('doctors').select('*').eq('user_id', uid).maybeSingle());
};

export const updateMyDoctorProfile = ({ specialization, room_number, available_days }) =>
  run(supabase.rpc('update_my_doctor_profile', { p_specialization: specialization, p_room_number: room_number, p_available_days: available_days }));

// ── Admin ───────────────────────────────────────────────────────────────────
export const getAllUsers = () => run(supabase.from('profiles').select('*').order('created_at', { ascending: false }));

/** patch may contain: name, phone, is_active  (role changes go through setUserRole) */
export const updateUser = (id, patch) => run(supabase.from('profiles').update(patch).eq('id', id).select().single());

export const setUserRole = (id, role) => run(supabase.rpc('admin_set_role', { p_user_id: id, p_role: role }));

export const deleteUser = (id) => run(supabase.rpc('admin_delete_user', { p_user_id: id }));

export const getAllDoctors = () => run(supabase.from('doctors').select('*').order('name'));

export const updateDoctor = (id, patch) => run(supabase.from('doctors').update(patch).eq('id', id).select().single());

export const deleteDoctor = (id) => run(supabase.from('doctors').delete().eq('id', id));

/**
 * Create a doctor / pharmacy / admin login. The account is created with signUp() on a throw-away
 * client (so the admin stays signed in), then promoted by the admin-only SQL function.
 * Resolves to { id, needsConfirmation } — needsConfirmation is true when the Supabase project still
 * has "Confirm email" switched on (the new user must click the email link before first login).
 */
export async function createStaff({ name, email, password, role, phone, department, specialization, room_number }) {
  const temp = createEphemeralClient();
  const { data, error } = await temp.auth.signUp({ email, password, options: { data: { name, phone: phone || '' } } });
  if (error) throw new Error(friendly(error));
  if (!data.user || (data.user.identities && data.user.identities.length === 0)) {
    throw new Error('An account with this email already exists.');
  }
  await run(
    supabase.rpc('admin_finalize_staff', {
      p_user_id: data.user.id,
      p_role: role,
      p_name: name,
      p_phone: phone || null,
      p_department: department || null,
      p_specialization: specialization || null,
      p_room_number: room_number || null,
    })
  );
  return { id: data.user.id, needsConfirmation: !data.session };
}

// ── Realtime ────────────────────────────────────────────────────────────────
let channelSeq = 0;

/**
 * Subscribe to postgres changes. Returns an unsubscribe function.
 *   subscribeToTable({ table: 'medicine_requests', filter: `user_id=eq.${uid}` }, () => reload())
 * RLS applies: you only receive rows you are allowed to SELECT.
 */
export function subscribeToTable({ table, filter }, onChange) {
  const channel = supabase
    .channel(`mq-${table}-${++channelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, (payload) => onChange(payload))
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Fires whenever any department's queue changes (public signal table). */
export const subscribeToQueue = (onChange) => subscribeToTable({ table: 'queue_state' }, onChange);
