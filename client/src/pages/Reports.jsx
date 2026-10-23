import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Table,
  Tag,
  Avatar,
  Progress,
  Select,
  DatePicker,
  Input,
  Button,
  Statistic,
  Spin,
  Empty,
  Tooltip,
  Drawer,
  Badge,
} from 'antd';
import {
  BarChartOutlined,
  PieChartOutlined,
  FilterOutlined,
  UserOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  ProjectOutlined,
  ApartmentOutlined,
  SearchOutlined,
  ReloadOutlined,
  CrownOutlined,
  ArrowRightOutlined,
  FireOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { dashboardApi, departmentApi, projectApi, taskApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { getSocket } from '../services/socket';

const { RangePicker } = DatePicker;

export const Reports = () => {
  const { user, currentWorkspace } = useAuth();
  const { can } = usePermission();
  const navigate = useNavigate();

  // Filters State
  const [timeRange, setTimeRange] = useState('all');
  const [customDates, setCustomDates] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedProject, setSelectedProject] = useState('all');
  const [searchEmployee, setSearchEmployee] = useState('');

  // Data State
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [statsData, setStatsData] = useState(null);

  // Drawer detail for clicked employee
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeTasks, setEmployeeTasks] = useState([]);
  const [loadingEmployeeTasks, setLoadingEmployeeTasks] = useState(false);

  // Fetch filter metadata
  const fetchMetadata = async () => {
    try {
      const [deptRes, projRes] = await Promise.all([
        departmentApi.getAll().catch(() => ({ data: { success: false, departments: [] } })),
        projectApi.getAll().catch(() => ({ data: { success: false, projects: [] } })),
      ]);
      if (deptRes.data?.success) setDepartments(deptRes.data.departments || []);
      if (projRes.data?.success) setProjects(projRes.data.projects || []);
    } catch (err) {
      console.error('Lỗi tải metadata bộ lọc:', err);
    }
  };

  // Fetch Employee Stats
  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        timeRange,
        department: selectedDepartment,
        project: selectedProject,
      };

      if (timeRange === 'custom' && customDates && customDates.length === 2) {
        params.startDate = customDates[0].toISOString();
        params.endDate = customDates[1].toISOString();
      }

      const res = await dashboardApi.getEmployeeStats(params);
      if (res.data?.success) {
        setStatsData(res.data.data);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu thống kê nhân viên:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange, customDates, selectedDepartment, selectedProject]);

  useEffect(() => {
    fetchMetadata();
  }, [currentWorkspace?._id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Real-time listener
  useEffect(() => {
    const socket = getSocket();
    const handleTaskChange = () => fetchStats();

    socket.on('task:changed', handleTaskChange);
    window.addEventListener('taskCreated', handleTaskChange);
    window.addEventListener('taskUpdated', handleTaskChange);

    return () => {
      socket.off('task:changed', handleTaskChange);
      window.removeEventListener('taskCreated', handleTaskChange);
      window.removeEventListener('taskUpdated', handleTaskChange);
    };
  }, [fetchStats]);

  // Fetch employee task details when clicking an employee
  const handleOpenEmployeeDetail = async (record) => {
    setSelectedEmployee(record);
    try {
      setLoadingEmployeeTasks(true);
      const res = await taskApi.getAll({ assignee: record.user._id });
      if (res.data?.success) {
        setEmployeeTasks(res.data.tasks || []);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách công việc của nhân viên:', err);
    } finally {
      setLoadingEmployeeTasks(false);
    }
  };

  const summary = statsData?.summary || {
    total: 0,
    todo: 0,
    inProgress: 0,
    review: 0,
    done: 0,
    overdue: 0,
    changesRequested: 0,
    overallCompletionRate: 0,
    totalEmployees: 0,
    activeEmployeesWithTasks: 0,
  };

  const statusDistribution = statsData?.statusDistribution || [];
  const rawEmployeeStats = statsData?.employeeStats || [];

  // Filter employees by search keyword
  const filteredEmployeeStats = useMemo(() => {
    if (!searchEmployee.trim()) return rawEmployeeStats;
    const q = searchEmployee.toLowerCase().trim();
    return rawEmployeeStats.filter(
      (item) =>
        item.user.name.toLowerCase().includes(q) ||
        item.user.email.toLowerCase().includes(q) ||
        item.departmentName.toLowerCase().includes(q)
    );
  }, [rawEmployeeStats, searchEmployee]);

  // Top 8 employees for Bar Chart
  const topEmployeesForBarChart = useMemo(() => {
    return filteredEmployeeStats
      .filter((e) => e.total > 0)
      .slice(0, 8);
  }, [filteredEmployeeStats]);

  const maxTasksInChart = useMemo(() => {
    if (topEmployeesForBarChart.length === 0) return 10;
    return Math.max(...topEmployeesForBarChart.map((e) => e.total), 1);
  }, [topEmployeesForBarChart]);

  // Table columns
  const columns = [
    {
      title: 'Nhân viên',
      dataIndex: 'user',
      key: 'user',
      width: 240,
      render: (u, record) => (
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => handleOpenEmployeeDetail(record)}
        >
          <Avatar
            size={40}
            src={u.avatar}
            style={{ backgroundColor: '#2563eb', fontWeight: 'bold', flexShrink: 0 }}
          >
            {u.name ? u.name[0].toUpperCase() : 'U'}
          </Avatar>
          <div className="min-w-0">
            <div className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors truncate">
              {u.name}
            </div>
            <div className="text-xs text-slate-400 truncate">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Phòng ban',
      dataIndex: 'departmentName',
      key: 'departmentName',
      width: 170,
      render: (deptName) => (
        <Tag color="cyan" className="font-medium text-xs m-0">
          🏢 {deptName}
        </Tag>
      ),
    },
    {
      title: 'Tổng việc',
      dataIndex: 'total',
      key: 'total',
      width: 110,
      sorter: (a, b) => a.total - b.total,
      render: (total) => (
        <span className="font-extrabold text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
          {total}
        </span>
      ),
    },
    {
      title: 'Trạng thái chi tiết',
      key: 'statusBreakdown',
      width: 280,
      render: (_, r) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Tooltip title="Cần làm (To Do)">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
              📋 {r.todo}
            </span>
          </Tooltip>
          <Tooltip title="Đang làm (In Progress)">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              ⚙️ {r.inProgress}
            </span>
          </Tooltip>
          <Tooltip title="Chờ duyệt (Review)">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
              ⏳ {r.review}
            </span>
          </Tooltip>
          <Tooltip title="Hoàn thành (Done)">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
              ✅ {r.done}
            </span>
          </Tooltip>
        </div>
      ),
    },
    {
      title: 'Tiến độ hoàn thành',
      dataIndex: 'completionRate',
      key: 'completionRate',
      width: 180,
      sorter: (a, b) => a.completionRate - b.completionRate,
      render: (rate) => (
        <div className="w-full">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-slate-700">{rate}%</span>
            {rate === 100 && <Tag color="success" className="m-0 text-[10px]">Xuất sắc</Tag>}
          </div>
          <Progress
            percent={rate}
            showInfo={false}
            strokeColor={
              rate >= 80
                ? '#10b981'
                : rate >= 50
                ? '#2563eb'
                : rate > 0
                ? '#f59e0b'
                : '#cbd5e1'
            }
            size="small"
          />
        </div>
      ),
    },
    {
      title: 'Quá hạn',
      dataIndex: 'overdue',
      key: 'overdue',
      width: 120,
      sorter: (a, b) => a.overdue - b.overdue,
      render: (count) =>
        count > 0 ? (
          <Tag color="error" className="font-bold text-xs">
            🔴 {count} trễ
          </Tag>
        ) : (
          <span className="text-xs text-slate-400">0</span>
        ),
    },
    {
      title: 'Yêu cầu sửa',
      dataIndex: 'changesRequested',
      key: 'changesRequested',
      width: 130,
      sorter: (a, b) => a.changesRequested - b.changesRequested,
      render: (count) =>
        count > 0 ? (
          <Tag color="warning" className="font-bold text-xs">
            ⚠️ {count} lần
          </Tag>
        ) : (
          <span className="text-xs text-slate-400">0</span>
        ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 110,
      render: (_, r) => (
        <Button
          size="small"
          type="link"
          onClick={() => handleOpenEmployeeDetail(r)}
          className="p-0 text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          Xem việc &rarr;
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* HEADER SECTION                                                */}
      {/* ============================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChartOutlined className="text-blue-600" />
            Báo Cáo & Thống Kê Hiệu Suất Nhân Viên
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Theo dõi khối lượng công việc, tỷ lệ hoàn thành, trễ hạn và chất lượng nghiệm thu
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchStats}
            loading={loading}
            className="font-medium"
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            iconPosition="end"
            onClick={() => navigate('/tasks')}
            className="font-medium"
          >
            Mở Kanban Board
          </Button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* FILTER BAR                                                     */}
      {/* ============================================================== */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
              <FilterOutlined className="text-blue-600" /> Bộ lọc:
            </span>

            {/* TimeRange Filter */}
            <Select
              value={timeRange}
              onChange={(val) => {
                setTimeRange(val);
                if (val !== 'custom') setCustomDates(null);
              }}
              style={{ width: 150 }}
              placeholder="Thời gian"
            >
              <Select.Option value="all">Tất cả thời gian</Select.Option>
              <Select.Option value="today">Hôm nay</Select.Option>
              <Select.Option value="this_week">Tuần này</Select.Option>
              <Select.Option value="this_month">Tháng này</Select.Option>
              <Select.Option value="this_quarter">Quý này</Select.Option>
              <Select.Option value="custom">Tùy chọn ngày...</Select.Option>
            </Select>

            {/* Custom Date Range Picker */}
            {timeRange === 'custom' && (
              <RangePicker
                format="DD/MM/YYYY"
                onChange={(dates) => setCustomDates(dates)}
                placeholder={['Từ ngày', 'Đến ngày']}
                style={{ width: 240 }}
              />
            )}

            {/* Department Filter */}
            <Select
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              style={{ width: 180 }}
              placeholder="Chọn phòng ban"
              showSearch
              optionFilterProp="children"
            >
              <Select.Option value="all">Tất cả phòng ban</Select.Option>
              {departments.map((d) => (
                <Select.Option key={d._id} value={d._id}>
                  🏢 {d.name}
                </Select.Option>
              ))}
            </Select>

            {/* Project Filter */}
            <Select
              value={selectedProject}
              onChange={setSelectedProject}
              style={{ width: 190 }}
              placeholder="Chọn dự án"
              showSearch
              optionFilterProp="children"
            >
              <Select.Option value="all">Tất cả dự án</Select.Option>
              {projects.map((p) => (
                <Select.Option key={p._id} value={p._id}>
                  [{p.code || 'PRJ'}] {p.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          {/* Quick Employee Search Input */}
          <div className="w-full sm:w-64">
            <Input
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm nhân viên theo tên..."
              value={searchEmployee}
              onChange={(e) => setSearchEmployee(e.target.value)}
              allowClear
            />
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TOP KPI STATS SUMMARY CARDS                                    */}
      {/* ============================================================== */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-md transition-shadow rounded-2xl border-slate-200">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0 font-bold">
                📋
              </div>
              <div className="min-w-0">
                <Statistic title="Tổng việc được giao" value={summary.total} />
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                  Đang làm: <strong className="text-blue-600 font-bold">{summary.inProgress}</strong> việc
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-md transition-shadow rounded-2xl border-slate-200">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0 font-bold">
                ✅
              </div>
              <div className="min-w-0">
                <Statistic
                  title="Tỷ lệ hoàn thành"
                  value={summary.overallCompletionRate}
                  suffix="%"
                />
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                  Đã xong: <strong className="text-emerald-600 font-bold">{summary.done}</strong> / {summary.total}
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-md transition-shadow rounded-2xl border-slate-200">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl shrink-0 font-bold">
                🔴
              </div>
              <div className="min-w-0">
                <Statistic
                  title="Công việc quá hạn"
                  value={summary.overdue}
                  valueStyle={{ color: summary.overdue > 0 ? '#ef4444' : '#1e293b' }}
                />
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {summary.overdue > 0 ? 'Cần đôn đốc xử lý gấp' : 'Không có việc trễ hạn'}
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="hover:shadow-md transition-shadow rounded-2xl border-slate-200">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shrink-0 font-bold">
                ⏳
              </div>
              <div className="min-w-0">
                <Statistic title="Đang chờ duyệt" value={summary.review} />
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                  Bị yêu cầu sửa lại: <strong className="text-rose-600 font-bold">{summary.changesRequested}</strong> lần
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ============================================================== */}
      {/* CHARTS ROW: BAR CHART & PIE / DONUT CHART                      */}
      {/* ============================================================== */}
      <Row gutter={[20, 20]}>
        {/* LEFT: BAR CHART (So sánh năng suất các nhân viên) */}
        <Col xs={24} lg={15}>
          <Card
            title={
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <BarChartOutlined className="text-blue-600" />
                  So Sánh Năng Suất Nhân Viên (Top thành viên)
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  Đơn vị: Số lượng công việc
                </span>
              </div>
            }
            className="rounded-2xl border-slate-200 shadow-2xs h-full"
          >
            {topEmployeesForBarChart.length === 0 ? (
              <div className="py-16 text-center">
                <Empty description="Chưa có dữ liệu công việc trong kỳ lọc" />
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {topEmployeesForBarChart.map((emp) => {
                  const donePercent = emp.total > 0 ? (emp.done / emp.total) * 100 : 0;
                  const inProgPercent = emp.total > 0 ? (emp.inProgress / emp.total) * 100 : 0;
                  const reviewPercent = emp.total > 0 ? (emp.review / emp.total) * 100 : 0;
                  const todoPercent = emp.total > 0 ? (emp.todo / emp.total) * 100 : 0;
                  const barWidthPercent = Math.max((emp.total / maxTasksInChart) * 100, 8);

                  return (
                    <div key={emp.user._id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate max-w-[65%]">
                          <Avatar size={20} src={emp.user.avatar} style={{ backgroundColor: '#2563eb' }}>
                            {emp.user.name[0]}
                          </Avatar>
                          <span className="font-bold text-slate-800 truncate">{emp.user.name}</span>
                          <span className="text-[11px] text-slate-400 truncate">({emp.departmentName})</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-extrabold text-slate-900">{emp.total} việc</span>
                          <span className="text-slate-400">({emp.completionRate}% xong)</span>
                          {emp.overdue > 0 && (
                            <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              {emp.overdue} trễ
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stacked Bar with color segments */}
                      <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden flex shadow-inner">
                        <div
                          style={{ width: `${barWidthPercent}%` }}
                          className="h-full flex rounded-full overflow-hidden"
                        >
                          {emp.done > 0 && (
                            <Tooltip title={`Hoàn thành: ${emp.done}`}>
                              <div
                                style={{ width: `${donePercent}%` }}
                                className="bg-emerald-500 hover:opacity-85 transition-opacity"
                              />
                            </Tooltip>
                          )}
                          {emp.inProgress > 0 && (
                            <Tooltip title={`Đang làm: ${emp.inProgress}`}>
                              <div
                                style={{ width: `${inProgPercent}%` }}
                                className="bg-blue-600 hover:opacity-85 transition-opacity"
                              />
                            </Tooltip>
                          )}
                          {emp.review > 0 && (
                            <Tooltip title={`Chờ duyệt: ${emp.review}`}>
                              <div
                                style={{ width: `${reviewPercent}%` }}
                                className="bg-amber-400 hover:opacity-85 transition-opacity"
                              />
                            </Tooltip>
                          )}
                          {emp.todo > 0 && (
                            <Tooltip title={`Cần làm: ${emp.todo}`}>
                              <div
                                style={{ width: `${todoPercent}%` }}
                                className="bg-slate-400 hover:opacity-85 transition-opacity"
                              />
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-100 flex-wrap text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                    <span>Hoàn thành (Done)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-blue-600" />
                    <span>Đang làm (In Progress)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-amber-400" />
                    <span>Chờ duyệt (Review)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-slate-400" />
                    <span>Cần làm (To Do)</span>
                  </span>
                </div>
              </div>
            )}
          </Card>
        </Col>

        {/* RIGHT: DONUT / PIE CHART (Tỷ lệ phân bổ trạng thái công việc) */}
        <Col xs={24} lg={9}>
          <Card
            title={
              <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <PieChartOutlined className="text-blue-600" />
                Tỷ Lệ Trạng Thái Công Việc
              </span>
            }
            className="rounded-2xl border-slate-200 shadow-2xs h-full"
          >
            {summary.total === 0 ? (
              <div className="py-16 text-center">
                <Empty description="Không có công việc nào" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-2">
                {/* SVG Donut Chart */}
                <div className="relative w-48 h-48 my-2">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {(() => {
                      let accumulatedPercent = 0;
                      return statusDistribution.map((item) => {
                        const strokeDasharray = `${item.percent} ${100 - item.percent}`;
                        const strokeDashoffset = -accumulatedPercent;
                        accumulatedPercent += item.percent;

                        return (
                          <circle
                            key={item.status}
                            cx="50"
                            cy="50"
                            r="38"
                            fill="transparent"
                            stroke={item.color}
                            strokeWidth="15"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-500 hover:opacity-85"
                          />
                        );
                      });
                    })()}
                  </svg>

                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-black text-slate-900 leading-none">
                      {summary.total}
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold mt-1">
                      Tổng số việc
                    </span>
                  </div>
                </div>

                {/* Status Legend Breakdown */}
                <div className="w-full space-y-2 mt-4 pt-3 border-t border-slate-100">
                  {statusDistribution.map((item) => (
                    <div
                      key={item.status}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-slate-700 font-medium">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2 font-bold">
                        <span className="text-slate-900">{item.count} việc</span>
                        <span className="text-slate-400 text-[11px] w-10 text-right">
                          {item.percent}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ============================================================== */}
      {/* DETAILED DATA TABLE                                            */}
      {/* ============================================================== */}
      <Card
        title={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-base text-slate-900">
                Bảng Thống Kê Chi Tiết Từng Nhân Viên
              </span>
              <span className="text-xs text-slate-500 font-normal ml-2">
                (Hiển thị {filteredEmployeeStats.length} nhân sự)
              </span>
            </div>
            <div className="text-xs text-slate-400">
              Nhấp vào tên nhân viên để xem danh sách công việc chi tiết
            </div>
          </div>
        }
        className="rounded-2xl border-slate-200 shadow-2xs overflow-hidden"
      >
        <Table
          columns={columns}
          dataSource={filteredEmployeeStats}
          rowKey={(r) => r.user._id}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* ============================================================== */}
      {/* DRAWER: CHI TIẾT CÔNG VIỆC CỦA NHÂN VIÊN ĐƯỢC CHỌN             */}
      {/* ============================================================== */}
      <Drawer
        title={
          selectedEmployee ? (
            <div className="flex items-center gap-3">
              <Avatar size={36} src={selectedEmployee.user.avatar} style={{ backgroundColor: '#2563eb' }}>
                {selectedEmployee.user.name[0]}
              </Avatar>
              <div>
                <div className="font-bold text-base text-slate-900 leading-tight">
                  {selectedEmployee.user.name}
                </div>
                <div className="text-xs text-slate-400 font-normal">
                  🏢 {selectedEmployee.departmentName} • {selectedEmployee.user.email}
                </div>
              </div>
            </div>
          ) : (
            'Chi tiết công việc'
          )
        }
        placement="right"
        width={560}
        onClose={() => setSelectedEmployee(null)}
        open={!!selectedEmployee}
      >
        {selectedEmployee && (
          <div className="space-y-5">
            {/* Quick KPI in Drawer */}
            <div className="grid grid-cols-4 gap-2 text-center p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <div className="text-xs text-slate-500">Tổng việc</div>
                <div className="font-black text-slate-800 text-base">{selectedEmployee.total}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Hoàn thành</div>
                <div className="font-black text-emerald-600 text-base">{selectedEmployee.done}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Quá hạn</div>
                <div className="font-black text-rose-600 text-base">{selectedEmployee.overdue}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Yêu cầu sửa</div>
                <div className="font-black text-amber-600 text-base">{selectedEmployee.changesRequested}</div>
              </div>
            </div>

            <div className="font-bold text-sm text-slate-800 flex items-center justify-between">
              <span>Danh sách công việc phụ trách:</span>
              <span className="text-xs text-slate-400 font-normal">
                {employeeTasks.length} công việc
              </span>
            </div>

            {loadingEmployeeTasks ? (
              <div className="py-12 text-center">
                <Spin tip="Đang tải danh sách việc..." />
              </div>
            ) : employeeTasks.length === 0 ? (
              <Empty description="Nhân viên chưa được giao việc nào" />
            ) : (
              <div className="space-y-3">
                {employeeTasks.map((task) => (
                  <div
                    key={task._id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-xs transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-800 line-clamp-1">
                        {task.title}
                      </span>
                      <Tag
                        color={
                          task.status === 'done'
                            ? 'success'
                            : task.status === 'review'
                            ? 'warning'
                            : task.status === 'in_progress'
                            ? 'processing'
                            : 'default'
                        }
                        className="m-0 text-[10px] font-semibold"
                      >
                        {task.status === 'done'
                          ? 'Hoàn thành'
                          : task.status === 'review'
                          ? 'Chờ duyệt'
                          : task.status === 'in_progress'
                          ? 'Đang làm'
                          : 'Cần làm'}
                      </Tag>
                    </div>

                    {task.project?.name && (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <ProjectOutlined className="text-slate-400" />
                        <span>Dự án: <strong>{task.project.name}</strong></span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>
                        Hạn chót:{' '}
                        <strong className="text-slate-700">
                          {task.dueDate ? dayjs(task.dueDate).format('DD/MM/YYYY') : 'Chưa đặt'}
                        </strong>
                      </span>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          const pId = task.project?._id || task.project;
                          if (pId) {
                            navigate(`/tasks?project=${pId}&task=${task._id}`);
                          } else {
                            navigate(`/tasks?task=${task._id}`);
                          }
                        }}
                        className="p-0 text-[11px] font-semibold text-blue-600"
                      >
                        Mở trên Kanban &rarr;
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default Reports;
