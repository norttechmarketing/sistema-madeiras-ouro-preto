
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { User } from '../types';

interface ProtectedRouteProps {
  user: User | null;
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'sales')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ user, children, allowedRoles }) => {
  const location = useLocation();

  const isDev = (() => {
    try {
      // @ts-ignore
      return import.meta.env?.DEV;
    } catch { return false; }
  })();

  if (isDev) {
    console.log("[GUARD]", {
      hasUser: !!user,
      path: location.pathname,
      role: user?.role || 'none',
      restrictedTo: allowedRoles || 'public'
    });
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If role is missing but user exists, we allow basic access (sales role default)
  const currentRole = user.role || 'sales';

  if (allowedRoles && !allowedRoles.includes(currentRole as any)) {
    console.warn(`[GUARD] Access denied for ${currentRole} at ${location.pathname}. Allowed: ${allowedRoles}`);
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
