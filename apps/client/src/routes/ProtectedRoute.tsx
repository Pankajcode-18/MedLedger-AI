import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { UserRole } from '../types/index.js';

/** Maps every user role to the workspace (URL prefix) that belongs to it. */
export const dashboardPathForRole = (role?: UserRole | string | null): string => {
  switch (role) {
    case 'doctor':
      return '/doctor/dashboard';
    case 'hospital':
    case 'hospital-admin':
      return '/hospital/dashboard';
    case 'lab':
      return '/lab/dashboard';
    case 'insurance':
      return '/insurance/dashboard';
    case 'admin':
    case 'system-admin':
      return '/admin/dashboard';
    case 'patient':
    default:
      return '/patient/dashboard';
  }
};

const ADMIN_ROLES: string[] = ['admin', 'system-admin'];

interface ProtectedRouteProps {
  /** Roles allowed to open this workspace. System admins are always allowed. */
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

/**
 * Guards a dashboard workspace:
 *  - not signed in      -> /login (remembers where the user was going)
 *  - signed in, wrong role -> that user's own dashboard
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Verifying your session…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const role = user.role;
  if (!ADMIN_ROLES.includes(role) && !allowedRoles.includes(role)) {
    return <Navigate to={dashboardPathForRole(role)} replace />;
  }

  return <>{children}</>;
};
