// Central place for every route (the old app linked to *.html files)
export const ROUTES = {
  login: '/',
  resetPassword: '/reset-password',
  dashboard: '/dashboard',
  appointment: '/appointment',
  token: '/token',
  opd: '/opd',
  history: '/history',
  medicines: '/medicines',
  queue: '/queue',
  doctor: '/doctor',
  entry: '/entry-scan',
  medicineAdmin: '/medicine-admin',
  admin: '/admin',
};

export function roleHome(role) {
  return (
    {
      patient: ROUTES.dashboard,
      doctor: ROUTES.doctor,
      medicine_staff: ROUTES.medicineAdmin,
      admin: ROUTES.admin,
    }[role] || ROUTES.dashboard
  );
}
