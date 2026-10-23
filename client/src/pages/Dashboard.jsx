import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Row, Col, Card, Statistic, Progress, Tag, Button, Avatar, Empty, Spin } from 'antd';
import {
  ProjectOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  ArrowRightOutlined,
  PlusOutlined,
  FieldTimeOutlined,
  HistoryOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { dashboardApi } from '../services/api';
import { getSocket } from '../services/socket';

export const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { openCreateTask } = useOutletContext();

  const fetchDashboard = async () => {
    try {
      const res = await dashboardApi.getOverview();
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();

    const socket = getSocket();
    const handleTaskChange = () => fetchDashboard();

    socket.on('task:changed', handleTaskChange);
    window.addEventListener('taskCreated', handleTaskChange);

    return () => {
      socket.off('task:changed', handleTaskChange);
      window.removeEventListener('taskCreated', handleTaskChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spin size="large" tip="Đang tải dữ liệu tổng quan..." />
      </div>
    );
  }

  const { projects, tasks, users, recentActivities, upcomingTasks } = data || {
    projects: { total: 0, active: 0 },
    tasks: { total: 0, todo: 0, inProgress: 0, review: 0, done: 0, completionRate: 0 },
    users: { total: 0 },
    recentActivities: [],
    upcomingTasks: [],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Bảng Tổng Quan Hoạt Động
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Tổng hợp tiến độ công việc, dự án và tương tác của toàn bộ hệ thống
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            icon={<ArrowRightOutlined />}
            iconPosition="end"
            onClick={() => navigate('/tasks')}
          >
            Mở Kanban Board
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateTask}
          >
            Tạo việc mới
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                <ProjectOutlined />
              </div>
              <div>
                <Statistic title="Tổng số dự án" value={projects.total} />
                <div className="text-xs text-slate-400 mt-1">
                  <span className="text-blue-600 font-bold">{projects.active}</span> đang kích hoạt
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
                <CheckCircleOutlined />
              </div>
              <div>
                <Statistic title="Tổng số công việc" value={tasks.total} />
                <div className="text-xs text-slate-400 mt-1">
                  Đã hoàn thành: <span className="text-emerald-600 font-bold">{tasks.completionRate}%</span>
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
                <ClockCircleOutlined />
              </div>
              <div>
                <Statistic title="Đang thực hiện" value={tasks.inProgress} />
                <div className="text-xs text-slate-400 mt-1">
                  <span className="text-amber-600 font-bold">{tasks.review}</span> việc chờ duyệt
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
                <TeamOutlined />
              </div>
              <div>
                <Statistic title="Nhân sự hệ thống" value={users.total} />
                <div className="text-xs text-slate-400 mt-1">
                  Phân quyền RBAC an toàn
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Main Grid: Progress & Activity Log */}
      <Row gutter={[20, 20]}>
        {/* Left Column: Progress & Upcoming */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <div className="font-bold flex items-center gap-2">
                <CheckOutlined className="text-blue-600" />
                Tiến độ công việc theo trạng thái
              </div>
            }
            className="mb-6"
          >
            <div className="mb-6">
              <div className="flex justify-between text-xs font-semibold text-slate-600 mb-2">
                <span>Tỷ lệ hoàn thành tổng thể</span>
                <span className="text-emerald-600 font-bold">{tasks.completionRate}%</span>
              </div>
              <Progress percent={tasks.completionRate} strokeColor="#10b981" />
            </div>

            {/* 4 Status Breakdown Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-100/70 rounded-xl text-center">
                <div className="text-xl font-extrabold text-slate-700">{tasks.todo}</div>
                <div className="text-xs font-medium text-slate-500 mt-1">Cần làm (To Do)</div>
              </div>

              <div className="p-3 bg-blue-50/70 rounded-xl text-center">
                <div className="text-xl font-extrabold text-blue-600">{tasks.inProgress}</div>
                <div className="text-xs font-medium text-slate-500 mt-1">Đang làm</div>
              </div>

              <div className="p-3 bg-amber-50/70 rounded-xl text-center">
                <div className="text-xl font-extrabold text-amber-600">{tasks.review}</div>
                <div className="text-xs font-medium text-slate-500 mt-1">Chờ duyệt</div>
              </div>

              <div className="p-3 bg-emerald-50/70 rounded-xl text-center">
                <div className="text-xl font-extrabold text-emerald-600">{tasks.done}</div>
                <div className="text-xs font-medium text-slate-500 mt-1">Hoàn thành</div>
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <div className="mt-8">
              <div className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
                <FieldTimeOutlined className="text-amber-500" />
                Hạn chót sắp tới
              </div>

              {upcomingTasks.length === 0 ? (
                <Empty description="Không có công việc nào sắp hết hạn" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div className="space-y-2.5">
                  {upcomingTasks.map((t) => (
                    <div
                      key={t._id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-800">{t.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Dự án: <span className="font-medium text-slate-600">{t.project?.name || 'Chung'}</span>
                        </div>
                      </div>
                      <Tag color="warning">
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : 'Hôm nay'}
                      </Tag>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* Right Column: Real-time Activity Log */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <div className="font-bold flex items-center gap-2">
                <HistoryOutlined className="text-purple-600" />
                Nhật ký hoạt động hệ thống (Live)
              </div>
            }
          >
            {recentActivities.length === 0 ? (
              <Empty description="Chưa có hoạt động mới" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div className="space-y-3.5">
                {recentActivities.map((act) => (
                  <div key={act._id} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-none">
                    <Avatar style={{ backgroundColor: '#8b5cf6', flexShrink: 0 }} size="small">
                      {act.user?.name ? act.user.name[0].toUpperCase() : 'U'}
                    </Avatar>
                    <div className="min-w-0 text-xs">
                      <div>
                        <strong className="text-slate-800">{act.user?.name || 'Hệ thống'}</strong>{' '}
                        <span className="text-slate-600">
                          {act.action === 'CREATED_TASK' && 'vừa tạo công việc mới'}
                          {act.action === 'MOVED_TASK' && 'vừa cập nhật trạng thái việc'}
                          {act.action === 'UPDATED_TASK' && 'vừa chỉnh sửa công việc'}
                          {act.action === 'CREATED_PROJECT' && 'vừa khởi tạo dự án'}
                        </span>
                        :{' '}
                        <span className="text-blue-600 font-medium">
                          {act.details?.title || act.details?.projectName || ''}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {new Date(act.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {new Date(act.createdAt).toLocaleDateString('vi-VN')}
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
