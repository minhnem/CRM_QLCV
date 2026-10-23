import React from 'react';
import { Layout, Input, Button, Badge, Avatar, Tag, Dropdown } from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  BellOutlined,
  ThunderboltOutlined,
  UserOutlined,
  LogoutOutlined,
  TeamOutlined,
  KeyOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { NotificationDropdown } from '../notification/NotificationDropdown';

const { Header } = Layout;

export const Navbar = ({ onOpenCreateTask, onOpenWorkspaceInvite }) => {
  const { user, currentWorkspace, logout } = useAuth();
  const navigate = useNavigate();

  const userMenuItems = [
    {
      key: 'workspace-invite',
      icon: <KeyOutlined className="text-blue-600" />,
      label: 'Mã mời & Thành viên',
      onClick: onOpenWorkspaceInvite,
    },
    {
      key: 'workspace-switch',
      icon: <SwapOutlined />,
      label: 'Đổi Không gian làm việc',
      onClick: () => navigate('/workspace/onboarding'),
    },
    {
      type: 'divider',
    },
    {
      key: 'settings',
      icon: <UserOutlined />,
      label: 'Hồ sơ cá nhân',
      onClick: () => navigate('/settings'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  return (
    <Header
      style={{
        backgroundColor: '#ffffff',
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #e2e8f0',
        lineHeight: 'normal',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Left: Search Bar & Workspace Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: 320 }}>
          <Input
            prefix={<SearchOutlined className="text-slate-400 mr-1" />}
            placeholder="Tìm việc, dự án, thành viên... (Ctrl + K)"
            allowClear
            className="rounded-lg bg-slate-50 border-slate-200 hover:bg-white focus:bg-white transition-all text-xs"
          />
        </div>

        {/* Current Workspace Quick Pill */}
        {currentWorkspace && (
          <Button
            type="default"
            icon={<TeamOutlined className="text-blue-600" />}
            onClick={onOpenWorkspaceInvite}
            className="flex items-center gap-1.5 font-semibold text-xs border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-white rounded-lg shadow-2xs"
          >
            <span className="max-w-[130px] truncate text-slate-700">{currentWorkspace.name}</span>
            <Tag color="cyan" className="font-mono font-bold text-[10px] m-0">
              {currentWorkspace.code}
            </Tag>
            {currentWorkspace.pendingCount > 0 && (
              <Badge count={currentWorkspace.pendingCount} size="small" />
            )}
          </Button>
        )}
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Create Task Button */}
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onOpenCreateTask}
          className="font-semibold shadow-sm text-xs h-9"
        >
          Tạo công việc
        </Button>

        {/* Workspace Invite Quick Button */}
        <Button
          type="dashed"
          icon={<KeyOutlined className="text-blue-600" />}
          onClick={onOpenWorkspaceInvite}
          className="font-semibold text-xs text-slate-700 border-slate-300 hover:border-blue-400 h-9"
        >
          Mời thành viên
        </Button>

        {/* Notification Bell Dropdown */}
        <NotificationDropdown />

        {/* User Dropdown */}
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              paddingLeft: '12px',
              borderLeft: '1px solid #e2e8f0',
              cursor: 'pointer',
            }}
          >
            <Avatar style={{ backgroundColor: '#2563eb' }} size="small">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </Avatar>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#334155',
                maxWidth: '120px',
              }}
              className="truncate"
            >
              {user?.name || 'User'}
            </span>
          </div>
        </Dropdown>
      </div>
    </Header>
  );
};
