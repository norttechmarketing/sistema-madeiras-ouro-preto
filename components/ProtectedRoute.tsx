
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

  // Helper for safe environment access
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
      role: user?.role,
      allowed: allowedRoles 
    });
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
