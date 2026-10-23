import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProtectedRoute = () => {
  const { isAuthenticated, loading, currentWorkspace, loadingWorkspaces } = useAuth();

  if (loading || loadingWorkspaces) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          color: '#64748b',
          fontSize: '14px',
          fontWeight: 500,
        }}
      >
        Đang khởi tạo phiên làm việc...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Nếu người dùng chưa có Không gian làm việc nào hoạt động -> Chuyển sang màn hình Onboarding
  if (!currentWorkspace) {
    return <Navigate to="/workspace/onboarding" replace />;
  }

  return <Outlet />;
};

// Guard riêng cho trang Onboarding: Chỉ cần đăng nhập
export const OnboardingGuard = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          color: '#64748b',
          fontSize: '14px',
          fontWeight: 500,
        }}
      >
        Đang kiểm tra thông tin...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
