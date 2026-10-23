import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Progress,
  Tag,
  Button,
  Avatar,
  Empty,
  Spin,
  Tooltip,
  Badge,
  Alert,
  Tabs,
} from 'antd';
import {
  ProjectOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
  PlusOutlined,
  FieldTimeOutlined,
  HistoryOutlined,
  AlertOutlined,
  AuditOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  RightOutlined,
  ThunderboltFilled,
  FireOutlined,
  SyncOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { dashboardApi } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';

// Helper định dạng tiền tệ VNĐ
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '0 ₫';
  if (amount >= 1e9) return (amount / 1e9).toFixed(2) + ' Tỷ ₫';
  if (amount >= 1e6) return (amount / 1e6).toFixed(1) + ' Tr ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// Helper lời chào theo thời gian
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Chào buổi sáng';
  if (hour >= 12 && hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
};

export const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { user, currentWorkspace } = useAuth();
  const { can, canViewValue } = usePermission();
  const navigate = useNavigate();
  const { openCreateTask } = useOutletContext() || {};

  // Phân biệt quyền: Chỉ Admin mới có quyền xem số liệu toàn hệ thống & Hợp đồng
  const isAdmin = user?.role === 'admin';

  const fetchDashboard = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await dashboardApi.getOverview();
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();

    const socket = getSocket();
    if (socket) {
      const handleLiveUpdate = () => fetchDashboard();
      socket.on('task:changed', handleLiveUpdate);
      socket.on('contract:changed', handleLiveUpdate);
      window.addEventListener('taskCreated', handleLiveUpdate);

      return () => {
        socket.off('task:changed', handleLiveUpdate);
        socket.off('contract:changed', handleLiveUpdate);
        window.removeEventListener('taskCreated', handleLiveUpdate);
      };
    }
  }, [currentWorkspace?._id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 space-y-3">
        <Spin size="large" />
        <span className="text-slate-400 text-sm font-medium">Đang tải dữ liệu Trung tâm điều hành...</span>
      </div>
    );
  }

  const {
    projects = { total: 0, active: 0, topList: [] },
    tasks = {
      total: 0,
      todo: 0,
      inProgress: 0,
      review: 0,
      done: 0,
      overdue: 0,
      urgent: 0,
      completionRate: 0,
      priorityDistribution: { urgent: 0, high: 0, medium: 0, low: 0 },
    },
    contracts = {
      total: 0,
      active: 0,
      totalValue: 0,
      paidAmount: 0,
      remainingAmount: 0,
      collectionRate: 0,
      expiringSoon: [],
    },
    personal = {
      stats: { total: 0, done: 0, inProgress: 0, review: 0, overdue: 0, projectsCount: 0, urgent: 0, todo: 0, completionRate: 0 },
      assignedTasks: [],
      reviewTasks: [],
      upcomingTasks: [],
      priorityDistribution: { urgent: 0, high: 0, medium: 0, low: 0 },
    },
    users = { total: 0 },
    recentActivities = [],
    upcomingTasks = [],
  } = data || {};

  const myStats = personal.stats || {
    total: 0,
    done: 0,
    inProgress: 0,
    review: 0,
    overdue: 0,
    projectsCount: 0,
    urgent: 0,
    todo: 0,
    completionRate: 0,
  };

  // Ưu tiên hiển thị cơ cấu độ ưu tiên: Nhân viên xem việc của mình, Admin xem toàn hệ thống
  const priorityDist = !isAdmin && personal.priorityDistribution
    ? personal.priorityDistribution
    : tasks.priorityDistribution || { urgent: 0, high: 0, medium: 0, low: 0 };

  const pendingPriorityTotal = (priorityDist.urgent || 0) + (priorityDist.high || 0) + (priorityDist.medium || 0) + (priorityDist.low || 0);

  // Danh sách hạn chót sắp tới: Nhân viên xem việc của mình, Admin xem toàn hệ thống
  const activeUpcomingTasks = !isAdmin && personal.upcomingTasks && personal.upcomingTasks.length > 0
    ? personal.upcomingTasks
    : upcomingTasks;

  // Tab items cho khối "Tiêu điểm cá nhân"
  const personalTabItems = [
    {
      key: 'assigned',
      label: (
        <div className="flex items-center gap-2">
          <span>Được giao cho tôi</span>
          {personal.assignedTasks?.length > 0 && (
            <Badge count={personal.assignedTasks.length} style={{ backgroundColor: '#2563eb' }} />
          )}
        </div>
      ),
      children: (
        <div className="space-y-2.5">
          {(!personal.assignedTasks || personal.assignedTasks.length === 0) ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Bạn không có công việc nào đang chờ thực hiện 🎉"
            />
          ) : (
            personal.assignedTasks.map((t) => {
              const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
              return (
                <div
                  key={t._id}
                  onClick={() => navigate(`/tasks?project=${t.project?._id || ''}&task=${t._id}`)}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-slate-200/80 hover:border-blue-300 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                        {t.title}
                      </span>
                      {t.priority === 'urgent' && <Tag color="error">Khẩn cấp</Tag>}
                      {t.priority === 'high' && <Tag color="warning">Cao</Tag>}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                      <span>Dự án: <strong className="text-slate-600">{t.project?.name || 'Chung'}</strong></span>
                      {t.dueDate && (
                        <span className={isOverdue ? 'text-red-500 font-semibold' : 'text-slate-500'}>
                          • Hạn: {new Date(t.dueDate).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                    </div>
                  </div>
                  <Tag color={t.status === 'in_progress' ? 'processing' : t.status === 'review' ? 'warning' : 'default'}>
                    {t.status === 'in_progress' ? 'Đang làm' : t.status === 'review' ? 'Chờ duyệt' : 'Cần làm'}
                  </Tag>
                </div>
              );
            })
          )}
        </div>
      ),
    },
    {
      key: 'review',
      label: (
        <div className="flex items-center gap-2">
          <span>Chờ tôi phê duyệt</span>
          {personal.reviewTasks?.length > 0 && (
            <Badge count={personal.reviewTasks.length} style={{ backgroundColor: '#f59e0b' }} />
          )}
        </div>
      ),
      children: (
        <div className="space-y-2.5">
          {(!personal.reviewTasks || personal.reviewTasks.length === 0) ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Không có công việc nào đang chờ bạn kiểm duyệt"
            />
          ) : (
            personal.reviewTasks.map((t) => (
              <div
                key={t._id}
                onClick={() => navigate(`/tasks?project=${t.project?._id || ''}&task=${t._id}`)}
                className="p-3 rounded-xl bg-amber-50/40 hover:bg-amber-50 border border-amber-200/80 hover:border-amber-400 transition-all cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs text-slate-800 truncate group-hover:text-amber-700">
                    {t.title}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                    <Avatar size={18} className="bg-amber-500 font-bold">
                      {t.assignee?.name ? t.assignee.name[0].toUpperCase() : 'N'}
                    </Avatar>
                    <span>Người nộp: <strong>{t.assignee?.name || 'Nhân viên'}</strong></span>
                    <span>• Dự án: {t.project?.name || 'Chung'}</span>
                  </div>
                </div>
                <Button size="small" type="primary" className="bg-amber-500 hover:bg-amber-600 border-none text-xs">
                  Duyệt việc
                </Button>
              </div>
            ))
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Banner Chào Mừng Thông Minh & Cá Nhân Hóa */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-blue-300 border border-white/10">
              <ThunderboltFilled className="text-amber-400" />
              <span>{currentWorkspace?.name || 'Không gian làm việc'} • {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight m-0">
              {getGreeting()}, {user?.name || 'Thành viên'}! 👋
            </h1>

            {/* Dòng tóm tắt trạng thái: Phân tách rõ ràng giữa Admin và Nhân viên */}
            <p className="text-slate-300 text-xs md:text-sm max-w-2xl leading-relaxed m-0">
              {isAdmin ? (
                // Dành cho Quản trị viên (Admin)
                <>
                  Hệ thống đang vận hành <strong>{projects.active}</strong> dự án đang chạy với <strong>{tasks.total}</strong> công việc toàn công ty.
                  {tasks.overdue > 0 ? (
                    <span className="text-amber-300 font-semibold ml-1">
                      Có {tasks.overdue} công việc đã quá hạn cần được xử lý!
                    </span>
                  ) : (
                    <span className="text-emerald-300 font-semibold ml-1">
                      Tiến độ toàn hệ thống đang được duy trì ổn định.
                    </span>
                  )}
                </>
              ) : (
                // Dành cho Nhân viên (Cá nhân hóa 100%)
                <>
                  Bạn đang tham gia <strong>{myStats.projectsCount || 0}</strong> dự án và được phân công <strong>{myStats.total || 0}</strong> công việc ({myStats.inProgress || 0} việc đang làm).
                  {myStats.overdue > 0 ? (
                    <span className="text-rose-300 font-semibold ml-1">
                      🚨 Có {myStats.overdue} công việc của bạn đã quá hạn cần được xử lý gấp!
                    </span>
                  ) : (
                    <span className="text-emerald-300 font-semibold ml-1">
                      ✨ Bạn không có công việc nào bị quá hạn. Chúc bạn một ngày làm việc hiệu quả!
                    </span>
                  )}
                </>
              )}
            </p>
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              type="primary"
              size="middle"
              icon={<PlusOutlined />}
              onClick={openCreateTask}
              className="font-bold shadow-md bg-blue-600 hover:bg-blue-500 border-none"
            >
              Tạo việc mới
            </Button>
            <Button
              size="middle"
              icon={<CheckSquareOutlined />}
              onClick={() => navigate('/tasks')}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md font-semibold"
            >
              {isAdmin ? 'Mở Kanban' : 'Việc của tôi'}
            </Button>

            {/* Chỉ Admin mới thấy nút chuyển sang Hợp đồng */}
            {isAdmin && (
              <Button
                size="middle"
                icon={<AuditOutlined />}
                onClick={() => navigate('/contracts')}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md font-semibold"
              >
                Hợp đồng & Deals
              </Button>
            )}

            {!isAdmin && (
              <Button
                size="middle"
                icon={<CalendarOutlined />}
                onClick={() => navigate('/calendar')}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md font-semibold"
              >
                Lịch biểu
              </Button>
            )}

            <Tooltip title="Làm mới số liệu">
              <Button
                size="middle"
                icon={<SyncOutlined spin={refreshing} />}
                onClick={() => fetchDashboard(true)}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              />
            </Tooltip>
          </div>
        </div>

        {/* Decorative Background Blob */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 2. Cảnh Báo Khẩn Cấp (Cá nhân hóa theo quyền) */}
      {isAdmin ? (
        // Banner Cảnh báo cho Admin: Công việc quá hạn toàn cty & Hợp đồng sắp hết hạn
        (tasks.overdue > 0 || (contracts.expiringSoon && contracts.expiringSoon.length > 0)) && (
          <Alert
            type="warning"
            showIcon
            icon={<AlertOutlined className="text-lg text-amber-600" />}
            className="rounded-xl border border-amber-300 bg-amber-50/90 shadow-2xs"
            message={
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <strong>Tiêu điểm toàn công ty:</strong>{' '}
                  {tasks.overdue > 0 && (
                    <span>
                      Hiện có <Tag color="error" className="font-bold mx-1">{tasks.overdue} việc trễ hạn</Tag>
                    </span>
                  )}
                  {contracts.expiringSoon?.length > 0 && (
                    <span>
                      và <Tag color="warning" className="font-bold mx-1">{contracts.expiringSoon.length} hợp đồng</Tag> sắp hết hạn trong 30 ngày tới.
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {tasks.overdue > 0 && (
                    <Button size="small" type="link" onClick={() => navigate('/tasks')} className="p-0 font-bold text-blue-600">
                      Xem việc quá hạn ➔
                    </Button>
                  )}
                  {contracts.expiringSoon?.length > 0 && (
                    <Button size="small" type="link" onClick={() => navigate('/contracts')} className="p-0 font-bold text-amber-700">
                      Xem hợp đồng ➔
                    </Button>
                  )}
                </div>
              </div>
            }
          />
        )
      ) : (
        // Banner Cảnh báo cho Nhân viên: Chỉ cảnh báo việc quá hạn của CHÍNH MÌNH
        myStats.overdue > 0 && (
          <Alert
            type="error"
            showIcon
            icon={<AlertOutlined className="text-lg text-rose-600" />}
            className="rounded-xl border border-rose-300 bg-rose-50/90 shadow-2xs"
            message={
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <strong>Lưu ý tiến độ cá nhân:</strong>{' '}
                  <span>
                    Bạn đang có <Tag color="error" className="font-bold mx-1">{myStats.overdue} công việc</Tag> được giao đã quá hạn chót hoàn thành!
                  </span>
                </div>
                <Button size="small" type="link" onClick={() => navigate('/tasks')} className="p-0 font-bold text-rose-700">
                  Xem công việc của tôi ➔
                </Button>
              </div>
            }
          />
        )
      )}

      {/* 3. Bộ 4 Thẻ KPI: Phân chia hoàn toàn giữa Admin và Nhân Viên */}
      <Row gutter={[16, 16]}>
        {isAdmin ? (
          // ================= GIAO DIỆN ADMIN =================
          <>
            {/* Card 1: Tiến độ công việc toàn cty */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                className="hover:shadow-md transition-all border-slate-200/90 cursor-pointer h-full"
                onClick={() => navigate('/tasks')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tiến độ công việc</span>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                    <CheckCircleOutlined />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-black text-slate-800">
                    {tasks.completionRate}%
                  </div>
                  <div className="mt-2 mb-1">
                    <Progress percent={tasks.completionRate} strokeColor="#10b981" showInfo={false} size="small" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span>Đã xong: <strong className="text-emerald-600">{tasks.done}</strong>/{tasks.total}</span>
                    <span>Đang làm: <strong className="text-blue-600">{tasks.inProgress}</strong></span>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Card 2: Quá hạn & Khẩn cấp toàn cty */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                className="hover:shadow-md transition-all border-slate-200/90 cursor-pointer h-full"
                onClick={() => navigate('/tasks')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cảnh báo rủi ro</span>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${tasks.overdue > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
                    <AlertOutlined />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <span>{tasks.overdue}</span>
                    <span className="text-xs font-semibold text-red-500">việc quá hạn</span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 text-[11px]">
                    <Tag color={tasks.urgent > 0 ? 'error' : 'default'} className="m-0 font-bold">
                      {tasks.urgent} Khẩn cấp
                    </Tag>
                    <Tag color="warning" className="m-0 font-medium">
                      {tasks.review} Chờ duyệt
                    </Tag>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">
                    Tổng còn lại: <strong className="text-slate-700">{tasks.total - tasks.done} việc</strong>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Card 3: Dự án toàn cty */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                className="hover:shadow-md transition-all border-slate-200/90 cursor-pointer h-full"
                onClick={() => navigate('/projects')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quản lý dự án</span>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
                    <ProjectOutlined />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <span>{projects.active}</span>
                    <span className="text-xs font-normal text-slate-400">/ {projects.total} tổng dự án</span>
                  </div>
                  <div className="mt-2.5 text-xs text-blue-600 font-semibold flex items-center gap-1">
                    <span>Xem danh sách dự án</span>
                    <RightOutlined className="text-[10px]" />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">
                    Nhân sự hoạt động: <strong className="text-slate-700">{users.total} thành viên</strong>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Card 4: Hợp đồng & Deals (Chỉ Admin mới có) */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                className="hover:shadow-md transition-all border-slate-200/90 cursor-pointer h-full"
                onClick={() => navigate('/contracts')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hợp đồng & Deals</span>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
                    <AuditOutlined />
                  </div>
                </div>
                <div className="mt-2">
                  {canViewValue('contracts') ? (
                    <>
                      <div className="text-2xl font-black text-slate-800 truncate" title={formatCurrency(contracts.totalValue)}>
                        {formatCurrency(contracts.totalValue)}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Đã thu: <strong className="text-emerald-600">{contracts.collectionRate}%</strong></span>
                        <span>Còn lại: <strong className="text-amber-600">{formatCurrency(contracts.remainingAmount)}</strong></span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-black text-slate-800">
                        {contracts.active} <span className="text-xs font-normal text-slate-400">Hợp đồng đang chạy</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Tổng số: <strong>{contracts.total}</strong> hợp đồng
                      </div>
                    </>
                  )}
                  <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                    <span>Đang thực hiện: <strong>{contracts.active}</strong></span>
                    {contracts.expiringSoon?.length > 0 && (
                      <Tag color="warning" className="m-0 text-[10px] px-1 font-bold">
                        {contracts.expiringSoon.length} sắp hết hạn
                      </Tag>
                    )}
                  </div>
                </div>
              </Card>
            </Col>
          </>
        ) : (
          // ================= GIAO DIỆN NHÂN VIÊN (CÁ NHÂN HÓA 100%) =================
          <>
            {/* Card 1: Hiệu suất cá nhân */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                className="hover:shadow-md transition-all border-slate-200/90 cursor-pointer h-full"
                onClick={() => navigate('/tasks')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hiệu suất của tôi</span>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                    <CheckCircleOutlined />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-black text-slate-800">
                    {myStats.completionRate}%
                  </div>
                  <div className="mt-2 mb-1">
                    <Progress percent={myStats.completionRate} strokeColor="#10b981" showInfo={false} size="small" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span>Đã xong: <strong className="text-emerald-600">{myStats.done}</strong>/{myStats.total} việc</span>
                    <span>Đang làm: <strong className="text-blue-600">{myStats.inProgress}</strong></span>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Card 2: Cảnh báo việc của tôi */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                className="hover:shadow-md transition-all border-slate-200/90 cursor-pointer h-full"
                onClick={() => navigate('/tasks')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cảnh báo của tôi</span>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${myStats.overdue > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
                    <AlertOutlined />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <span>{myStats.overdue}</span>
                    <span className={`text-xs font-semibold ${myStats.overdue > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                      việc quá hạn
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 text-[11px]">
                    <Tag color={myStats.urgent > 0 ? 'error' : 'default'} className="m-0 font-bold">
                      {myStats.urgent} Khẩn cấp
                    </Tag>
                    <Tag color="warning" className="m-0 font-medium">
                      {myStats.review} Chờ duyệt
                    </Tag>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">
                    Tổng việc đang gánh: <strong className="text-slate-700">{myStats.inProgress + myStats.todo} việc</strong>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Card 3: Dự án nhân viên được tham gia */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                className="hover:shadow-md transition-all border-slate-200/90 cursor-pointer h-full"
                onClick={() => navigate('/projects')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dự án tham gia</span>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
                    <ProjectOutlined />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <span>{myStats.projectsCount}</span>
                    <span className="text-xs font-normal text-slate-400">dự án phân công</span>
                  </div>
                  <div className="mt-2.5 text-xs text-blue-600 font-semibold flex items-center gap-1">
                    <span>Xem các dự án của tôi</span>
                    <RightOutlined className="text-[10px]" />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">
                    Vai trò: <strong className="text-slate-700">Thành viên triển khai</strong>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Card 4: Nhiệm vụ cần làm (Thay thế hoàn toàn thẻ hợp đồng) */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                className="hover:shadow-md transition-all border-slate-200/90 cursor-pointer h-full"
                onClick={() => navigate('/tasks')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nhiệm vụ cần làm</span>
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg">
                    <ClockCircleOutlined />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <span>{myStats.todo}</span>
                    <span className="text-xs font-normal text-slate-400">việc chưa bắt đầu</span>
                  </div>
                  <div className="mt-2.5 text-xs text-purple-600 font-semibold flex items-center gap-1">
                    <span>Mở bảng việc cá nhân</span>
                    <RightOutlined className="text-[10px]" />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">
                    Đang làm: <strong className="text-blue-600">{myStats.inProgress} việc</strong>
                  </div>
                </div>
              </Card>
            </Col>
          </>
        )}
      </Row>

      {/* 4. Khối Nội Dung Chính (2 Cột 14 / 10) */}
      <Row gutter={[20, 20]}>
        {/* CỘT TRÁI (14): Tiêu điểm cá nhân & Tiến độ Dự án */}
        <Col xs={24} lg={14} className="space-y-6">
          {/* Card: Tiêu điểm của tôi */}
          <Card
            className="border-slate-200/90 shadow-sm"
            title={
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <CheckSquareOutlined className="text-blue-600" />
                  <span>Tiêu điểm công việc của tôi</span>
                </div>
                <Button size="small" type="link" onClick={() => navigate('/tasks')} className="p-0 text-xs">
                  Xem tất cả việc ➔
                </Button>
              </div>
            }
          >
            <Tabs defaultActiveKey="assigned" items={personalTabItems} />
          </Card>

          {/* Card: Tiến độ các Dự án trọng điểm */}
          <Card
            className="border-slate-200/90 shadow-sm"
            title={
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <ProjectOutlined className="text-indigo-600" />
                  <span>{isAdmin ? 'Tiến độ Dự án Đang Chạy' : 'Tiến độ Dự án Tôi Tham Gia'}</span>
                </div>
                <Button size="small" type="link" onClick={() => navigate('/projects')} className="p-0 text-xs">
                  Quản lý dự án ➔
                </Button>
              </div>
            }
          >
            {(!projects.topList || projects.topList.length === 0) ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dự án nào đang hoạt động" />
            ) : (
              <div className="space-y-4">
                {projects.topList.map((prj) => {
                  const percent = prj.taskStats?.percent || 0;
                  const totalTasks = prj.taskStats?.total || 0;
                  const doneTasks = prj.taskStats?.done || 0;

                  return (
                    <div
                      key={prj._id}
                      onClick={() => navigate(`/tasks?project=${prj._id}`)}
                      className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: prj.color || '#2563eb' }}
                          />
                          <div className="font-bold text-xs text-slate-800 truncate">
                            {prj.name}
                          </div>
                          <Tag color="blue" className="text-[10px] font-mono font-bold">
                            {prj.code || 'PRJ'}
                          </Tag>
                        </div>

                        <div className="text-xs font-black text-slate-700">
                          {percent}%
                        </div>
                      </div>

                      <Progress
                        percent={percent}
                        strokeColor={percent >= 80 ? '#10b981' : percent >= 40 ? '#2563eb' : '#f59e0b'}
                        showInfo={false}
                        size="small"
                      />

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Đã xong: <strong className="text-slate-600">{doneTasks}/{totalTasks}</strong> công việc</span>
                        <div className="flex items-center gap-1">
                          <span>Quản lý: </span>
                          <strong className="text-slate-700">{prj.manager?.name || 'Chưa gán'}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        {/* CỘT PHẢI (10): Phân bổ Độ ưu tiên, Hạn chót & Hoạt động Live */}
        <Col xs={24} lg={10} className="space-y-6">
          {/* Card: Phân bổ Độ ưu tiên */}
          <Card
            className="border-slate-200/90 shadow-sm"
            title={
              <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <FireOutlined className="text-amber-500" />
                <span>{isAdmin ? 'Phân bổ Độ ưu tiên (Toàn công ty)' : 'Phân bổ Độ ưu tiên (Việc của tôi)'}</span>
              </div>
            }
          >
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-red-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> Khẩn cấp (Urgent)
                  </span>
                  <span className="font-bold text-slate-700">{priorityDist.urgent || 0} việc</span>
                </div>
                <Progress
                  percent={pendingPriorityTotal > 0 ? Math.round(((priorityDist.urgent || 0) / pendingPriorityTotal) * 100) : 0}
                  strokeColor="#ef4444"
                  size="small"
                  showInfo={false}
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-amber-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Ưu tiên cao (High)
                  </span>
                  <span className="font-bold text-slate-700">{priorityDist.high || 0} việc</span>
                </div>
                <Progress
                  percent={pendingPriorityTotal > 0 ? Math.round(((priorityDist.high || 0) / pendingPriorityTotal) * 100) : 0}
                  strokeColor="#f59e0b"
                  size="small"
                  showInfo={false}
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-blue-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" /> Trung bình (Medium)
                  </span>
                  <span className="font-bold text-slate-700">{priorityDist.medium || 0} việc</span>
                </div>
                <Progress
                  percent={pendingPriorityTotal > 0 ? Math.round(((priorityDist.medium || 0) / pendingPriorityTotal) * 100) : 0}
                  strokeColor="#3b82f6"
                  size="small"
                  showInfo={false}
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400" /> Thấp (Low)
                  </span>
                  <span className="font-bold text-slate-700">{priorityDist.low || 0} việc</span>
                </div>
                <Progress
                  percent={pendingPriorityTotal > 0 ? Math.round(((priorityDist.low || 0) / pendingPriorityTotal) * 100) : 0}
                  strokeColor="#94a3b8"
                  size="small"
                  showInfo={false}
                />
              </div>
            </div>
          </Card>

          {/* Card: Hạn chót sắp tới */}
          <Card
            className="border-slate-200/90 shadow-sm"
            title={
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <FieldTimeOutlined className="text-amber-500" />
                  <span>{isAdmin ? 'Hạn chót sắp tới (Toàn công ty)' : 'Hạn chót sắp tới của tôi'}</span>
                </div>
                <Button size="small" type="link" onClick={() => navigate('/calendar')} className="p-0 text-xs">
                  Mở Lịch biểu ➔
                </Button>
              </div>
            }
          >
            {(!activeUpcomingTasks || activeUpcomingTasks.length === 0) ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có hạn chót nào trong tuần tới" />
            ) : (
              <div className="space-y-2.5">
                {activeUpcomingTasks.map((t) => (
                  <div
                    key={t._id}
                    onClick={() => navigate(`/tasks?project=${t.project?._id || ''}&task=${t._id}`)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-all cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-800 truncate">
                        {t.title}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Dự án: <span className="text-slate-600">{t.project?.name || 'Chung'}</span>
                      </div>
                    </div>
                    <Tag color="warning" className="shrink-0 text-xs font-semibold m-0">
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : 'Hôm nay'}
                    </Tag>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Card: Hoạt động hệ thống (Live Activity Log) */}
          <Card
            className="border-slate-200/90 shadow-sm"
            title={
              <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <HistoryOutlined className="text-purple-600" />
                <span>Nhật ký hoạt động (Live)</span>
              </div>
            }
          >
            {(!recentActivities || recentActivities.length === 0) ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có hoạt động mới" />
            ) : (
              <div className="space-y-3">
                {recentActivities.map((act) => (
                  <div key={act._id} className="flex items-start gap-2.5 pb-2.5 border-b border-slate-100 last:border-none">
                    <Avatar size={24} style={{ backgroundColor: '#8b5cf6', fontWeight: 'bold' }} className="shrink-0 text-[10px]">
                      {act.user?.name ? act.user.name[0].toUpperCase() : 'U'}
                    </Avatar>
                    <div className="min-w-0 text-xs">
                      <div>
                        <strong className="text-slate-800">{act.user?.name || 'Hệ thống'}</strong>{' '}
                        <span className="text-slate-500">
                          {act.action === 'CREATED_TASK' && 'vừa tạo công việc:'}
                          {act.action === 'MOVED_TASK' && 'vừa chuyển trạng thái việc:'}
                          {act.action === 'UPDATED_TASK' && 'vừa sửa việc:'}
                          {act.action === 'CREATED_PROJECT' && 'vừa tạo dự án:'}
                          {act.action === 'CREATED_CONTRACT' && 'vừa tạo hợp đồng:'}
                        </span>{' '}
                        <span className="text-blue-600 font-medium truncate inline-block max-w-[160px] align-bottom">
                          {act.details?.title || act.details?.projectName || act.details?.code || ''}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(act.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {new Date(act.createdAt).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
