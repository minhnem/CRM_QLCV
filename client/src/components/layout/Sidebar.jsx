import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Badge, Avatar, Tag, Button, Tooltip, Dropdown, message } from 'antd';
import {
  DashboardOutlined,
  CheckSquareOutlined,
  ProjectOutlined,
  TeamOutlined,
  SettingOutlined,
  LogoutOutlined,
  AppstoreOutlined,
  ThunderboltFilled,
  ApartmentOutlined,
  CommentOutlined,
  DownOutlined,
  CopyOutlined,
  KeyOutlined,
  SwapOutlined,
  CheckOutlined,
  PlusCircleOutlined,
  AuditOutlined,
  CalendarOutlined,
  SafetyCertificateOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { getSocket } from '../../services/socket';

export const Sidebar = ({ onOpenWorkspaceInvite }) => {
  const {
    user,
    logout,
    currentWorkspace,
    workspaces,
    switchWorkspace,
  } = useAuth();
  const { can } = usePermission();
  const navigate = useNavigate();
  const location = useLocation();
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    setSocketConnected(socket.connected);

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const copyCode = (e) => {
    e.stopPropagation();
    if (currentWorkspace?.code) {
      navigator.clipboard.writeText(currentWorkspace.code);
      message.success(`Đã sao chép mã ${currentWorkspace.code}!`);
    }
  };

  const handleSwitch = async (wsId) => {
    if (wsId === currentWorkspace?._id) return;
    try {
      await switchWorkspace(wsId);
    } catch (err) {
      console.error(err);
    }
  };

  const allMenuItems = [
    {
      key: '/',
      icon: <DashboardOutlined style={{ fontSize: '17px' }} />,
      label: 'Tổng quan (Dashboard)',
      show: true,
    },
    {
      key: '/departments',
      icon: <ApartmentOutlined style={{ fontSize: '17px' }} />,
      label: 'Cơ cấu phòng ban',
      show: can('departments', 'view'),
    },
    {
      key: '/tasks',
      icon: <CheckSquareOutlined style={{ fontSize: '17px' }} />,
      label: 'Công việc (Kanban)',
      show: can('tasks', 'view'),
    },
    {
      key: '/projects',
      icon: <ProjectOutlined style={{ fontSize: '17px' }} />,
      label: 'Quản lý dự án',
      show: can('projects', 'view'),
    },
    {
      key: '/contracts',
      icon: <AuditOutlined style={{ fontSize: '17px' }} />,
      label: 'Hợp đồng & Deals',
      show: can('contracts', 'view'),
    },
    {
      key: '/calendar',
      icon: <CalendarOutlined style={{ fontSize: '17px' }} />,
      label: 'Lịch biểu (Calendar)',
      show: can('tasks', 'view') || can('contracts', 'view') || can('projects', 'view'),
    },
    {
      key: '/channels',
      icon: <CommentOutlined style={{ fontSize: '17px' }} />,
      label: (
        <div className="flex items-center justify-between">
          <span>Kênh chat nội bộ</span>
          <Badge status="success" />
        </div>
      ),
      show: true,
    },
    {
      key: '/reports',
      icon: <BarChartOutlined style={{ fontSize: '17px' }} />,
      label: 'Báo cáo & Thống kê',
      show: true,
    },
    {
      key: '/team',
      icon: <TeamOutlined style={{ fontSize: '17px' }} />,
      label: 'Đội ngũ nhân sự',
      show: can('team', 'view'),
    },
    {
      key: '/permissions',
      icon: <SafetyCertificateOutlined style={{ fontSize: '17px' }} />,
      label: 'Ma trận phân quyền',
      show: user?.role === 'admin' || can('team', 'assign'),
    },
    {
      key: '/settings',
      icon: <SettingOutlined style={{ fontSize: '17px' }} />,
      label: 'Cấu hình hệ thống',
      show: false, // Tạm thời ẩn theo yêu cầu người dùng
    },
  ];

  const menuItems = allMenuItems.filter((item) => item.show !== false);

  // Workspace Switcher Dropdown Items
  const workspaceDropdownItems = [
    {
      key: 'header-ws',
      type: 'group',
      label: 'Không gian của bạn',
      children: workspaces
        .filter((w) => !w.isPending)
        .map((w) => {
          const isSelected = w._id === currentWorkspace?._id;
          return {
            key: w._id,
            label: (
              <div
                className="flex items-center justify-between py-1 gap-2"
                onClick={() => handleSwitch(w._id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar
                    size="small"
                    className="bg-blue-600 font-bold shrink-0"
                  >
                    {w.name[0]?.toUpperCase()}
                  </Avatar>
                  <span className={`truncate text-xs ${isSelected ? 'font-bold text-blue-600' : 'text-slate-700'}`}>
                    {w.name}
                  </span>
                </div>
                {isSelected && <CheckOutlined className="text-blue-600 shrink-0 text-xs" />}
              </div>
            ),
          };
        }),
    },
    {
      type: 'divider',
    },
    {
      key: 'invite-modal',
      icon: <KeyOutlined className="text-blue-600" />,
      label: (
        <div className="flex items-center justify-between">
          <span>Mã mời & Thành viên</span>
          {currentWorkspace?.pendingCount > 0 && (
            <Badge count={currentWorkspace.pendingCount} size="small" />
          )}
        </div>
      ),
      onClick: onOpenWorkspaceInvite,
    },
    {
      key: 'manage-ws',
      icon: <SwapOutlined />,
      label: 'Đổi / Tạo không gian mới',
      onClick: () => navigate('/workspace/onboarding'),
    },
  ];

  const getRoleTag = (role) => {
    switch (role) {
      case 'admin':
        return <Tag color="error">Admin</Tag>;
      case 'manager':
        return <Tag color="warning">Quản lý</Tag>;
      default:
        return <Tag color="processing">Thành viên</Tag>;
    }
  };

  const currentKey = location.pathname === '/' ? '/' : `/${location.pathname.split('/')[1]}`;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        userSelect: 'none',
        backgroundColor: '#ffffff',
      }}
    >
      <div>
        {/* Workspace Switcher Header */}
        <div className="p-3 border-b border-slate-100">
          <Dropdown menu={{ items: workspaceDropdownItems }} trigger={['click']} placement="bottomLeft">
            <div className="p-2 rounded-xl border border-slate-200/90 hover:border-blue-300 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-sm shadow-sm shrink-0">
                    {currentWorkspace?.name ? currentWorkspace.name[0]?.toUpperCase() : 'W'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-xs text-slate-800 truncate leading-tight">
                      {currentWorkspace?.name || 'CRM • QLCV'}
                    </div>
                    <div className="text-[10px] text-blue-600 font-mono font-bold mt-0.5 flex items-center gap-1">
                      <span>{currentWorkspace?.code || 'WS-CODE'}</span>
                      <Tooltip title="Sao chép mã mời">
                        <CopyOutlined onClick={copyCode} className="text-slate-400 hover:text-blue-600 text-[10px]" />
                      </Tooltip>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {currentWorkspace?.pendingCount > 0 && (
                    <Badge count={currentWorkspace.pendingCount} size="small" />
                  )}
                  <DownOutlined className="text-[10px] text-slate-400" />
                </div>
              </div>
            </div>
          </Dropdown>
        </div>

        {/* Real-time Socket Indicator */}
        <div className="px-4 py-1.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <Badge status={socketConnected ? 'success' : 'warning'} />
            <span className="font-medium text-slate-500">
              {socketConnected ? 'WebSocket Online' : 'Kết nối lại...'}
            </span>
          </div>
          <ThunderboltFilled className={socketConnected ? 'text-emerald-500' : 'text-amber-500'} />
        </div>

        {/* Navigation Menu */}
        <div className="p-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2">
            Menu Chính
          </div>
          <Menu
            mode="inline"
            selectedKeys={[currentKey]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ borderRight: 0, fontWeight: 500 }}
          />
        </div>
      </div>

      {/* User Footer Card */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar style={{ backgroundColor: '#2563eb', fontWeight: 'bold' }}>
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </Avatar>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">
                {user?.name || 'User'}
              </div>
              <div className="mt-0.5">{getRoleTag(user?.role)}</div>
            </div>
          </div>

          <Tooltip title="Đăng xuất">
            <Button
              type="text"
              danger
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              className="hover:bg-red-50"
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
