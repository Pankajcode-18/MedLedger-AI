import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout.js';
import { DashboardLayout } from '../layouts/DashboardLayout.js';
import { ProtectedRoute } from './ProtectedRoute.js';
import { UserRole } from '../types/index.js';

// Public pages (small — loaded eagerly so the landing page renders instantly)
import { HomePage } from '../pages/HomePage.js';
import { NotFoundPage } from '../pages/NotFoundPage.js';

// Everything else is code-split: each page is downloaded only when first visited.
const AboutPage = lazy(() => import('../pages/AboutPage.js').then((m) => ({ default: m.AboutPage })));
const LoginGatewayPage = lazy(() =>
  import('../pages/LoginGatewayPage.js').then((m) => ({ default: m.LoginGatewayPage }))
);
const RegisterPatientPage = lazy(() =>
  import('../pages/RegisterPatientPage.js').then((m) => ({ default: m.RegisterPatientPage }))
);
const RegisterDoctorPage = lazy(() =>
  import('../pages/RegisterDoctorPage.js').then((m) => ({ default: m.RegisterDoctorPage }))
);
const ForgotPasswordPage = lazy(() =>
  import('../pages/ForgotPasswordPage.js').then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import('../pages/ResetPasswordPage.js').then((m) => ({ default: m.ResetPasswordPage }))
);
const PatientDashboardPage = lazy(() =>
  import('../features/patient/PatientDashboardPage.js').then((m) => ({ default: m.PatientDashboardPage }))
);
const DoctorDashboardPage = lazy(() =>
  import('../features/doctor/DoctorDashboardPage.js').then((m) => ({ default: m.DoctorDashboardPage }))
);
const HospitalDashboardPage = lazy(() =>
  import('../features/hospital/HospitalDashboardPage.js').then((m) => ({ default: m.HospitalDashboardPage }))
);
const LabDashboardPage = lazy(() =>
  import('../features/laboratory/LabDashboardPage.js').then((m) => ({ default: m.LabDashboardPage }))
);
const InsuranceDashboardPage = lazy(() =>
  import('../features/insurance/InsuranceDashboardPage.js').then((m) => ({ default: m.InsuranceDashboardPage }))
);
const AdminDashboardPage = lazy(() =>
  import('../features/admin/AdminDashboardPage.js').then((m) => ({ default: m.AdminDashboardPage }))
);

const PageLoader: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

/** A signed-in, role-checked workspace wrapped in the dashboard shell. */
const Workspace: React.FC<{ roles: UserRole[]; children: React.ReactNode }> = ({ roles, children }) => (
  <ProtectedRoute allowedRoles={roles}>
    <DashboardLayout>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </DashboardLayout>
  </ProtectedRoute>
);

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public Pages with Standard Header/Footer */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<LoginGatewayPage />} />
        <Route path="/register/patient" element={<RegisterPatientPage />} />
        <Route path="/register/doctor" element={<RegisterDoctorPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Legacy Route Aliases for 100% Backward Compatibility */}
        <Route path="/Login" element={<Navigate to="/login" replace />} />
        <Route path="/RegisterPatient" element={<Navigate to="/register/patient" replace />} />
        <Route path="/RegisterDoctor" element={<Navigate to="/register/doctor" replace />} />
        <Route path="/LoginPatient" element={<Navigate to="/patient/dashboard" replace />} />
        <Route path="/LoginDoctor" element={<Navigate to="/doctor/dashboard" replace />} />
        <Route path="/LoginHospitalAdmin" element={<Navigate to="/hospital/dashboard" replace />} />
        <Route path="/PatientDashboard" element={<Navigate to="/patient/dashboard" replace />} />
        <Route path="/DoctorDashboard" element={<Navigate to="/doctor/dashboard" replace />} />
        <Route path="/HospitalAdminDashboard" element={<Navigate to="/hospital/dashboard" replace />} />
        <Route path="/HospitalDashboard" element={<Navigate to="/hospital/dashboard" replace />} />
        <Route path="/LabDashboard" element={<Navigate to="/lab/dashboard" replace />} />
        <Route path="/InsuranceDashboard" element={<Navigate to="/insurance/dashboard" replace />} />
        <Route path="/AdminDashboard" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>

      {/* Patient Workspace */}
      <Route
        path="/patient/*"
        element={
          <Workspace roles={['patient']}>
            <PatientDashboardPage />
          </Workspace>
        }
      />

      {/* Doctor Workspace */}
      <Route
        path="/doctor/*"
        element={
          <Workspace roles={['doctor']}>
            <DoctorDashboardPage />
          </Workspace>
        }
      />

      {/* Hospital Workspace */}
      <Route
        path="/hospital/*"
        element={
          <Workspace roles={['hospital', 'hospital-admin']}>
            <HospitalDashboardPage />
          </Workspace>
        }
      />

      {/* Lab Workspace */}
      <Route
        path="/lab/*"
        element={
          <Workspace roles={['lab']}>
            <LabDashboardPage />
          </Workspace>
        }
      />

      {/* Insurance Workspace */}
      <Route
        path="/insurance/*"
        element={
          <Workspace roles={['insurance']}>
            <InsuranceDashboardPage />
          </Workspace>
        }
      />

      {/* Master Admin Workspace */}
      <Route
        path="/admin/*"
        element={
          <Workspace roles={['admin', 'system-admin']}>
            <AdminDashboardPage />
          </Workspace>
        }
      />

      {/* 404 Fallback */}
      <Route
        path="*"
        element={
          <AppLayout>
            <NotFoundPage />
          </AppLayout>
        }
      />
    </Routes>
    </Suspense>
  );
};
