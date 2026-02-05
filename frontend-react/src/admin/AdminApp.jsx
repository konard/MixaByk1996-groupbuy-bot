/**
 * Admin App Component
 * Main entry point for admin panel routing
 */
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAdminStore } from './store/adminStore';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import ProcurementsPage from './pages/ProcurementsPage';
import PaymentsPage from './pages/PaymentsPage';
import CategoriesPage from './pages/CategoriesPage';
import MessagesPage from './pages/MessagesPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, checkAuth, isLoading } = useAdminStore();
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth().then((isAuth) => {
      if (!isAuth) {
        navigate('/admin-panel/login');
      }
      setChecking(false);
    });
  }, [checkAuth, navigate]);

  if (checking || isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f8fafc'
      }}>
        <div>Загрузка...</div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/admin-panel/login" />;
}

export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="users"
        element={
          <ProtectedRoute>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="procurements"
        element={
          <ProtectedRoute>
            <ProcurementsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="payments"
        element={
          <ProtectedRoute>
            <PaymentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="categories"
        element={
          <ProtectedRoute>
            <CategoriesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="messages"
        element={
          <ProtectedRoute>
            <MessagesPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/admin-panel" />} />
    </Routes>
  );
}
