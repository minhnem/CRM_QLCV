import React, { useState, useEffect, useCallback } from 'react';
import {
  Dropdown,
  Badge,
  Button,
  Avatar,
  Tag,
  Spin,
  Empty,
  notification as antdNotification,
  Tooltip,
} from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../../services/api';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';

/**
 * Âm thanh báo nhẹ khi có thông báo mới (Web Audio API không cần load file mp3 bên ngoài)
 */
const playNotificationSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch (e) {
    // AudioContext might be blocked until user interaction
  }
};

/**
 * Format thời gian thân thiện (VD: Vừa xong, 5 phút trước, Hôm qua...)
 */
const formatRelativeTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

export const NotificationDropdown = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Tải danh sách thông báo
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await notificationApi.getAll();
      if (res.data.success) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Lỗi tải thông báo:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?._id) {
      fetchNotifications();
    }
  }, [user?._id, fetchNotifications]);

  // Lắng nghe Socket.IO sự kiện thông báo mới
  useEffect(() => {
    const socket = getSocket();

    const handleNewNotification = (newNotif) => {
      // Âm thanh
      playNotificationSound();

      // Cập nhật state
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Hiển thị Ant Design Toast Notification ở góc màn hình
      antdNotification.open({
        message: (
          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <span className="text-blue-600">🔔</span>
            <span>{newNotif.title}</span>
          </div>
        ),
        description: (
          <div className="mt-1">
            <p className="text-xs text-slate-600 leading-relaxed m-0">{newNotif.message}</p>
            {newNotif.link && (
              <div className="mt-2 text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1">
                <span>Nhấn để xem chi tiết</span>
                <span>&rarr;</span>
              </div>
            )}
          </div>
        ),
        placement: 'topRight',
        duration: 6,
        className: 'rounded-xl shadow-lg border border-slate-200',
        onClick: () => {
          handleItemClick(newNotif);
        },
      });
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [navigate]);

  // Đánh dấu 1 thông báo là đã đọc
  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await notificationApi.markAsRead(id);
      if (res.data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Lỗi đánh dấu đã đọc:', err);
    }
  };

  // Đánh dấu tất cả là đã đọc
  const handleMarkAllAsRead = async () => {
    try {
      const res = await notificationApi.markAllAsRead();
      if (res.data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Lỗi đánh dấu tất cả đã đọc:', err);
    }
  };

  // Xóa thông báo
  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await notificationApi.delete(id);
      if (res.data.success) {
        setNotifications((prev) => prev.filter((n) => n._id !== id));
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Lỗi xóa thông báo:', err);
    }
  };

  // Xử lý khi nhấn vào thông báo
  const handleItemClick = (notif) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif._id);
    }
    setIsOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  // Priority badge config
  const priorityBadge = (priority) => {
    switch (priority) {
      case 'urgent':
        return <Tag color="error" className="m-0 text-[10px] font-bold">Khẩn cấp</Tag>;
      case 'high':
        return <Tag color="warning" className="m-0 text-[10px] font-bold">Cao</Tag>;
      case 'medium':
        return <Tag color="processing" className="m-0 text-[10px] font-semibold">Trung bình</Tag>;
      case 'low':
        return <Tag color="default" className="m-0 text-[10px]">Thấp</Tag>;
      default:
        return null;
    }
  };

  // Dropdown Menu Content
  const menuContent = (
    <div className="w-[380px] sm:w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-slate-900">Thông báo</span>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-600 text-white">
              {unreadCount} mới
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            type="link"
            size="small"
            icon={<CheckOutlined />}
            onClick={handleMarkAllAsRead}
            className="text-xs font-semibold text-blue-600 p-0 hover:text-blue-700"
          >
            Đánh dấu đã đọc tất cả
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
        {loading && notifications.length === 0 ? (
          <div className="py-12 text-center">
            <Spin tip="Đang tải thông báo..." />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center px-4">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span className="text-slate-400 text-xs">
                  Hiện bạn không có thông báo nào
                </span>
              }
            />
          </div>
        ) : (
          notifications.map((notif) => {
            const isUnread = !notif.isRead;
            return (
              <div
                key={notif._id}
                onClick={() => handleItemClick(notif)}
                className={`p-3.5 transition-all cursor-pointer flex items-start gap-3 relative group ${
                  isUnread
                    ? 'bg-blue-50/60 hover:bg-blue-50/90'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                {/* Avatar / Sender */}
                <Avatar
                  size={36}
                  src={notif.sender?.avatar}
                  style={{
                    backgroundColor: isUnread ? '#2563eb' : '#94a3b8',
                    flexShrink: 0,
                    fontWeight: 'bold',
                  }}
                >
                  {notif.sender?.name ? notif.sender.name[0].toUpperCase() : 'CRM'}
                </Avatar>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span
                      className={`text-xs ${
                        isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                      }`}
                    >
                      {notif.title}
                    </span>
                    {notif.task?.priority && priorityBadge(notif.task.priority)}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mb-2 line-clamp-2">
                    {notif.message}
                  </p>

                  {/* Metadata Row */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                    {notif.project && (
                      <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                        <ProjectOutlined className="text-slate-400" />
                        <span className="max-w-[120px] truncate">{notif.project.name}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <ClockCircleOutlined />
                      <span>{formatRelativeTime(notif.createdAt)}</span>
                    </span>
                  </div>
                </div>

                {/* Actions on right */}
                <div className="absolute right-3 top-3.5 flex flex-col items-end gap-2">
                  {/* Unread indicator dot */}
                  {isUnread && (
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100 shrink-0" />
                  )}

                  {/* Delete button (hidden until hover) */}
                  <Tooltip title="Xóa thông báo">
                    <Button
                      type="text"
                      size="small"
                      shape="circle"
                      icon={<DeleteOutlined className="text-slate-400 hover:text-rose-500 text-xs" />}
                      onClick={(e) => handleDelete(notif._id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center p-0"
                    />
                  </Tooltip>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-center">
        <Button
          type="link"
          size="small"
          onClick={() => {
            setIsOpen(false);
            navigate('/tasks');
          }}
          className="text-xs font-semibold text-slate-600 hover:text-blue-600 p-0"
        >
          Xem danh sách công việc của tôi &rarr;
        </Button>
      </div>
    </div>
  );

  return (
    <Dropdown
      open={isOpen}
      onOpenChange={(open) => setIsOpen(open)}
      dropdownRender={() => menuContent}
      trigger={['click']}
      placement="bottomRight"
      arrow={{ pointAtCenter: true }}
    >
      <Badge count={unreadCount} overflowCount={99} offset={[-2, 2]}>
        <Button
          type="text"
          shape="circle"
          icon={<BellOutlined style={{ fontSize: '18px' }} />}
          className="hover:bg-slate-100 text-slate-700 transition-colors"
          title="Thông báo"
        />
      </Badge>
    </Dropdown>
  );
};

export default NotificationDropdown;
