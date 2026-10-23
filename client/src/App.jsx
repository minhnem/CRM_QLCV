import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, OnboardingGuard } from './components/auth/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { WorkspaceOnboarding } from './pages/WorkspaceOnboarding';
import { Dashboard } from './pages/Dashboard';
import { KanbanBoard } from './pages/KanbanBoard';
import { Projects } from './pages/Projects';
import { CompanyStructure } from './pages/CompanyStructure';
import { Team } from './pages/Team';
import { Settings } from './pages/Settings';
import { ChannelsChat } from './pages/ChannelsChat';
import { JoinInvitePage } from './pages/JoinInvitePage';
import { Contracts } from './pages/Contracts';
import { CalendarPage } from './pages/CalendarPage';
import { PermissionsMatrix } from './pages/PermissionsMatrix';
import { Reports } from './pages/Reports';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export function App() {
  return (
    <ErrorBoundary>
      <ConfigProvider
        locale={viVN}
        theme={{
          token: {
            colorPrimary: '#2563eb',
            colorSuccess: '#10b981',
            colorWarning: '#f59e0b',
            colorError: '#ef4444',
            colorInfo: '#2563eb',
            borderRadius: 8,
            fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
          },
        }}
      >
        <AntdApp>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/join-invite" element={<JoinInvitePage />} />

                {/* Workspace Setup & Selection (Protected by login) */}
                <Route
                  path="/workspace/onboarding"
                  element={
                    <OnboardingGuard>
                      <WorkspaceOnboarding />
                    </OnboardingGuard>
                  }
                />

                {/* Protected Routes (Requires active Workspace) */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<MainLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="departments" element={<CompanyStructure />} />
                    <Route path="tasks" element={<KanbanBoard />} />
                    <Route path="projects" element={<Projects />} />
                    <Route path="contracts" element={<Contracts />} />
                    <Route path="calendar" element={<CalendarPage />} />
                    <Route path="channels" element={<ChannelsChat />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="team" element={<Team />} />
                    <Route path="permissions" element={<PermissionsMatrix />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </AntdApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
