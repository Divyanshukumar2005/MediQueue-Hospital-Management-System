import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute, { FullPageSpinner } from './components/ProtectedRoute';
import SetupNotice from './components/SetupNotice';
import { isConfigured } from './lib/supabase';
import { ROUTES } from './lib/routes';

const Login = lazy(() => import('./pages/Login'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Appointment = lazy(() => import('./pages/Appointment'));
const Token = lazy(() => import('./pages/Token'));
const Opd = lazy(() => import('./pages/Opd'));
const History = lazy(() => import('./pages/History'));
const Medicines = lazy(() => import('./pages/Medicines'));
const QueueDisplay = lazy(() => import('./pages/QueueDisplay'));
const DoctorPanel = lazy(() => import('./pages/DoctorPanel'));
const EntryScan = lazy(() => import('./pages/EntryScan'));
const MedicineAdmin = lazy(() => import('./pages/MedicineAdmin'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

const ALL = ['patient', 'doctor', 'admin', 'medicine_staff'];

export default function App() {
  if (!isConfigured) return <SetupNotice />;
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path={ROUTES.login} element={<Login />} />
        <Route path={ROUTES.resetPassword} element={<ResetPassword />} />
        <Route path={ROUTES.queue} element={<QueueDisplay />} />

        <Route path={ROUTES.dashboard} element={<ProtectedRoute roles={['patient']}><Dashboard /></ProtectedRoute>} />
        <Route path={ROUTES.appointment} element={<ProtectedRoute roles={['patient']}><Appointment /></ProtectedRoute>} />
        <Route path={ROUTES.token} element={<ProtectedRoute roles={['patient', 'doctor', 'admin']}><Token /></ProtectedRoute>} />
        <Route path={ROUTES.opd} element={<ProtectedRoute roles={['patient']}><Opd /></ProtectedRoute>} />
        <Route path={ROUTES.history} element={<ProtectedRoute roles={['patient']}><History /></ProtectedRoute>} />
        <Route path={ROUTES.medicines} element={<ProtectedRoute roles={ALL}><Medicines /></ProtectedRoute>} />

        <Route path={ROUTES.doctor} element={<ProtectedRoute roles={['doctor', 'admin']}><DoctorPanel /></ProtectedRoute>} />
        <Route path={ROUTES.entry} element={<ProtectedRoute roles={['doctor', 'admin']}><EntryScan /></ProtectedRoute>} />
        <Route path={ROUTES.medicineAdmin} element={<ProtectedRoute roles={['medicine_staff', 'admin']}><MedicineAdmin /></ProtectedRoute>} />
        <Route path={ROUTES.admin} element={<ProtectedRoute roles={['admin']}><AdminPanel /></ProtectedRoute>} />

        <Route path="/admin-panel" element={<Navigate to={ROUTES.admin} replace />} />
        <Route path="*" element={<Navigate to={ROUTES.login} replace />} />
      </Routes>
    </Suspense>
  );
}
