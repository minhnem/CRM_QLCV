import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  Button,
  Select,
  Segmented,
  Tag,
  Avatar,
  Tooltip,
  Modal,
  Spin,
  Row,
  Col,
  Space,
  message,
} from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  CalendarOutlined,
  PlusOutlined,
  ProjectOutlined,
  AuditOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  BankOutlined,
  ApartmentOutlined,
  EyeOutlined,
  EditOutlined,
  DownOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { calendarApi, projectApi } from '../services/api';
import { getSocket } from '../services/socket';
import { ContractDetailDrawer } from '../components/contracts/ContractDetailDrawer';
import { usePermission } from '../hooks/usePermission';

dayjs.locale('vi');

// Các ngày trong tuần viết tắt chuẩn tiếng Việt (Thứ 2 đến Chủ Nhật)
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export const CalendarPage = () => {
  const { openCreateTask, openEditTask } = useOutletContext() || {};
  const { can } = usePermission();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const canViewTasks = can('tasks', 'view');
  const canViewContracts = can('contracts', 'view');
  const canViewProjects = can('projects', 'view');

  // Chế độ xem: 'tasks' (Lịch công việc dự án) | 'contracts' (Lịch hiệu lực hợp đồng)
  const [calendarMode, setCalendarMode] = useState(() => {
    const q = searchParams.get('mode');
    if (q === 'contracts' && canViewContracts) return 'contracts';
    if (canViewTasks) return 'tasks';
    if (canViewContracts) return 'contracts';
    return 'tasks';
  });

  // Chế độ phân chia: 'day' (Ngày) | 'week' (Tuần) | 'month' (Tháng) | 'agenda' (Lịch trình)
  // Chuẩn theo thanh bấm [Ngày] [Tuần] [Tháng] [Lịch] của Bitrix24
  const [viewType, setViewType] = useState(
    searchParams.get('view') || 'week'
  );

  // Mốc thời gian đang xem
  const [currentDate, setCurrentDate] = useState(dayjs());

  // Dữ liệu
  const [tasks, setTasks] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(
    searchParams.get('project') || 'all'
  );
  const [loading, setLoading] = useState(true);

  // Modal / Drawer chi tiết
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [isContractDrawerOpen, setIsContractDrawerOpen] = useState(false);

  // Danh sách các chế độ khả dụng theo phân quyền
  const modeOptions = useMemo(() => {
    const list = [];
    if (canViewTasks) {
      list.push({
        value: 'tasks',
        icon: <CheckSquareOutlined />,
        label: <span className="font-semibold px-1">1. Công Việc Dự Án</span>,
      });
    }
    if (canViewContracts) {
      list.push({
        value: 'contracts',
        icon: <AuditOutlined />,
        label: <span className="font-semibold px-1">2. Hiệu Lực Hợp Đồng</span>,
      });
    }
    return list;
  }, [canViewTasks, canViewContracts]);

  // Tải danh sách dự án
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await projectApi.getAll().catch(() => ({ data: { success: false, projects: [] } }));
        if (res.data?.success) {
          setProjects(res.data.projects || []);
        }
      } catch (err) {
        console.error('Lỗi khi tải dự án:', err);
      }
    };
    fetchProjects();
  }, []);

  // Tải dữ liệu sự kiện (Tasks hoặc Contracts)
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        month: currentDate.month() + 1,
        year: currentDate.year(),
      };

      if (calendarMode === 'tasks') {
        if (!canViewTasks) {
          setTasks([]);
          return;
        }
        if (selectedProject && selectedProject !== 'all') {
          params.project = selectedProject;
        }
        const res = await calendarApi.getTasks(params).catch(() => ({ data: { success: false, tasks: [] } }));
        if (res.data?.success) {
          setTasks(res.data.tasks || []);
        }
      } else {
        // Mode contracts
        if (!canViewContracts) {
          setContracts([]);
          return;
        }
        const res = await calendarApi.getContracts(params).catch(() => ({ data: { success: false, contracts: [] } }));
        if (res.data?.success) {
          setContracts(res.data.contracts || []);
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu lịch:', err);
      message.error('Không thể tải dữ liệu lịch');
    } finally {
      setLoading(false);
    }
  }, [currentDate, calendarMode, selectedProject, canViewTasks, canViewContracts]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time synchronization
  useEffect(() => {
    const socket = getSocket();
    const handleSync = () => fetchData();

    socket.on('task:changed', handleSync);
    socket.on('task:created', handleSync);
    socket.on('task:updated', handleSync);
    socket.on('contract:changed', handleSync);
    socket.on('contract:created', handleSync);
    socket.on('contract:updated', handleSync);

    return () => {
      socket.off('task:changed', handleSync);
      socket.off('task:created', handleSync);
      socket.off('task:updated', handleSync);
      socket.off('contract:changed', handleSync);
      socket.off('contract:created', handleSync);
      socket.off('contract:updated', handleSync);
    };
  }, [fetchData]);

  // Điều hướng thời gian linh hoạt tùy theo Ngày / Tuần / Tháng
  const handlePrev = () => {
    if (viewType === 'day') setCurrentDate((prev) => prev.subtract(1, 'day'));
    else if (viewType === 'week') setCurrentDate((prev) => prev.subtract(1, 'week'));
    else setCurrentDate((prev) => prev.subtract(1, 'month'));
  };

  const handleNext = () => {
    if (viewType === 'day') setCurrentDate((prev) => prev.add(1, 'day'));
    else if (viewType === 'week') setCurrentDate((prev) => prev.add(1, 'week'));
    else setCurrentDate((prev) => prev.add(1, 'month'));
  };

  const handleToday = () => setCurrentDate(dayjs());

  // Tính 7 ngày của Tuần hiện tại (Thứ 2 đến Chủ Nhật)
  const currentWeekDays = useMemo(() => {
    const dayOfWeek = currentDate.day();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = currentDate.add(mondayOffset, 'day');
    return [0, 1, 2, 3, 4, 5, 6].map((i) => monday.add(i, 'day'));
  }, [currentDate]);

  // Tính ma trận các ngày hiển thị trong lịch Tháng (7 cột x 6 tuần)
  const calendarDays = useMemo(() => {
    const startOfMonth = currentDate.startOf('month');
    let startDayOfWeek = startOfMonth.day();
    const mondayOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    const startDate = startOfMonth.subtract(mondayOffset, 'day');

    const days = [];
    let cur = startDate;
    for (let i = 0; i < 42; i++) {
      days.push(cur);
      cur = cur.add(1, 'day');
    }
    return days;
  }, [currentDate]);

  // 1. Hàm tính khoảng thời gian (Start - End) của một Task
  const getTaskDateRange = useCallback((t) => {
    let start = null;
    let end = null;

    if (t.startDate) {
      start = dayjs(t.startDate).startOf('day');
    } else if (t.createdAt) {
      start = dayjs(t.createdAt).startOf('day');
    }

    if (t.dueDate) {
      end = dayjs(t.dueDate).startOf('day');
    }

    if (!start && !end) return null;
    if (!start) start = end;
    if (!end) end = start;

    if (start.isAfter(end)) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    // Nếu không có startDate mà createdAt cách dueDate hơn 30 ngày, kẹp lại 14 ngày
    if (!t.startDate && t.createdAt && end.diff(start, 'day') > 30) {
      start = end.subtract(14, 'day');
    }

    const isMultiDay = !start.isSame(end, 'day');
    return { start, end, isMultiDay };
  }, []);

  // 2. Hàm tính khoảng thời gian của một Contract
  const getContractDateRange = useCallback((c) => {
    let start = c.startDate ? dayjs(c.startDate).startOf('day') : null;
    let end = c.endDate ? dayjs(c.endDate).startOf('day') : null;

    if (!start && !end) return null;
    if (!start) start = end;
    if (!end) end = start;

    if (start.isAfter(end)) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    const isMultiDay = !start.isSame(end, 'day');
    return { start, end, isMultiDay };
  }, []);

  // 3. Phân bổ sự kiện cho 1 tuần 7 ngày: Multi-day Spanning Bars & Single Day Tasks
  const computeWeekEvents = useCallback(
    (weekDaysList) => {
      const weekStart = weekDaysList[0].startOf('day');
      const weekEnd = weekDaysList[6].endOf('day');

      const multiDaySpans = [];
      const singleDayItems = {};
      weekDaysList.forEach((d) => {
        singleDayItems[d.format('YYYY-MM-DD')] = [];
      });

      if (calendarMode === 'tasks') {
        tasks.forEach((t) => {
          const range = getTaskDateRange(t);
          if (!range) return;

          const { start, end, isMultiDay } = range;
          const overlaps = !end.isBefore(weekStart) && !start.isAfter(weekEnd);
          if (!overlaps) return;

          if (isMultiDay) {
            const startCol = start.isBefore(weekStart) ? 0 : start.diff(weekStart, 'day');
            const endCol = end.isAfter(weekEnd) ? 6 : end.diff(weekStart, 'day');

            if (startCol <= 6 && endCol >= 0 && endCol >= startCol) {
              multiDaySpans.push({
                item: t,
                type: 'task',
                startCol,
                endCol,
                span: endCol - startCol + 1,
                isStartEdge: !start.isBefore(weekStart),
                isEndEdge: !end.isAfter(weekEnd),
                startDate: start,
                endDate: end,
              });
            }
          } else {
            const dateKey = start.format('YYYY-MM-DD');
            if (singleDayItems[dateKey]) {
              singleDayItems[dateKey].push(t);
            }
          }
        });
      } else {
        // Mode contracts
        contracts.forEach((c) => {
          const range = getContractDateRange(c);
          if (!range) return;

          const { start, end, isMultiDay } = range;
          const overlaps = !end.isBefore(weekStart) && !start.isAfter(weekEnd);
          if (!overlaps) return;

          if (isMultiDay) {
            const startCol = start.isBefore(weekStart) ? 0 : start.diff(weekStart, 'day');
            const endCol = end.isAfter(weekEnd) ? 6 : end.diff(weekStart, 'day');

            if (startCol <= 6 && endCol >= 0 && endCol >= startCol) {
              multiDaySpans.push({
                item: c,
                type: 'contract',
                startCol,
                endCol,
                span: endCol - startCol + 1,
                isStartEdge: !start.isBefore(weekStart),
                isEndEdge: !end.isAfter(weekEnd),
                startDate: start,
                endDate: end,
              });
            }
          } else {
            const dateKey = start.format('YYYY-MM-DD');
            if (singleDayItems[dateKey]) {
              singleDayItems[dateKey].push(c);
            }
          }
        });
      }

      multiDaySpans.sort((a, b) => {
        if (a.startCol !== b.startCol) return a.startCol - b.startCol;
        return b.span - a.span;
      });

      return { multiDaySpans, singleDayItems };
    },
    [calendarMode, tasks, contracts, getTaskDateRange, getContractDateRange]
  );

  // Sự kiện của tuần hiện tại (Week View)
  const currentWeekEvents = useMemo(() => {
    return computeWeekEvents(currentWeekDays);
  }, [computeWeekEvents, currentWeekDays]);

  // Sự kiện của 6 tuần trong tháng (Month View)
  const monthWeeks = useMemo(() => {
    const weeks = [];
    for (let i = 0; i < 42; i += 7) {
      const weekDays = calendarDays.slice(i, i + 7);
      const { multiDaySpans, singleDayItems } = computeWeekEvents(weekDays);
      weeks.push({ weekDays, multiDaySpans, singleDayItems });
    }
    return weeks;
  }, [calendarDays, computeWeekEvents]);

  // Tasks cho chế độ Ngày (Day View)
  const dayViewTasks = useMemo(() => {
    const targetDay = currentDate.startOf('day');
    return tasks.filter((t) => {
      const range = getTaskDateRange(t);
      if (!range) return false;
      return !targetDay.isBefore(range.start) && !targetDay.isAfter(range.end);
    });
  }, [tasks, currentDate, getTaskDateRange]);

  // Phân nhóm Tasks theo ngày (theo dueDate cho Agenda View)
  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const dateKey = t.dueDate ? dayjs(t.dueDate).format('YYYY-MM-DD') : null;
      if (dateKey) {
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(t);
      }
    });
    return map;
  }, [tasks]);

  // Phân nhóm Contracts theo ngày (theo startDate và endDate)
  const contractsByDate = useMemo(() => {
    const map = {};
    contracts.forEach((c) => {
      if (c.startDate) {
        const startKey = dayjs(c.startDate).format('YYYY-MM-DD');
        if (!map[startKey]) map[startKey] = [];
        map[startKey].push({ ...c, timelineType: 'start' });
      }
      if (c.endDate) {
        const endKey = dayjs(c.endDate).format('YYYY-MM-DD');
        if (!map[endKey]) map[endKey] = [];
        map[endKey].push({ ...c, timelineType: 'end' });
      }
    });
    return map;
  }, [contracts]);

  const todayStr = dayjs().format('YYYY-MM-DD');

  // Xử lý click ngày để tạo nhanh Task
  const handleCellClick = (day) => {
    if (calendarMode === 'tasks' && openCreateTask) {
      openCreateTask({ dueDate: day.toDate() });
    }
  };

  // Tiêu đề thời gian hiển thị ở header
  const getHeaderTitle = () => {
    if (viewType === 'day') {
      return currentDate.format('dddd, [ngày] D [tháng] M, YYYY');
    }
    return `Tháng ${currentDate.format('M, YYYY')}`;
  };

  return (
    <div className="space-y-4">
      {/* ============================================================== */}
      {/* 1. TOP HEADER: TITLE & 2-MODE SELECTOR (DỰ ÁN vs HỢP ĐỒNG)    */}
      {/* ============================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight mb-0">
            Lịch Biểu Hệ Thống
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 mb-0">
            {calendarMode === 'tasks'
              ? 'Theo dõi hạn chót công việc của các dự án theo Ngày - Tuần - Tháng'
              : 'Theo dõi vòng đời hiệu lực hợp đồng (Ngày bắt đầu & Ngày kết thúc) hỗ trợ phân quyền'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* LỰA CHỌN 1 & LỰA CHỌN 2 */}
          {((canViewTasks && canViewContracts) || modeOptions.length > 1) && (
            <Segmented
              value={calendarMode}
              onChange={(val) => setCalendarMode(val)}
              options={modeOptions}
              className="p-1 bg-slate-100 font-medium"
            />
          )}

          {/* Nếu ở Lựa chọn 1 (Công việc): Bộ lọc dự án (Tổng tất cả hoặc theo từng dự án) */}
          {calendarMode === 'tasks' ? (
            <div className="flex items-center gap-2">
              {canViewProjects && (
                <Select
                  value={selectedProject}
                  onChange={setSelectedProject}
                  style={{ width: 220 }}
                  placeholder="Chọn dự án"
                  className="font-medium"
                >
                  <Select.Option value="all">
                    <div className="flex items-center gap-1.5 font-bold text-blue-600">
                      <ProjectOutlined /> Tổng Tất Cả Dự Án
                    </div>
                  </Select.Option>
                  {projects.map((p) => (
                    <Select.Option key={p._id} value={p._id}>
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: p.color || '#2563eb' }}
                        />
                        <span>[{p.code || 'PRJ'}] {p.name}</span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              )}

              {can('tasks', 'create') && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => openCreateTask && openCreateTask({})}
                  className="bg-blue-600 hover:bg-blue-700 font-semibold"
                >
                  Thêm Việc
                </Button>
              )}
            </div>
          ) : (
            /* Nếu ở Lựa chọn 2 (Hợp đồng) */
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <Tag color="success">🟢 Bắt đầu hiệu lực</Tag>
                <Tag color="error">🔴 Ngày hết hạn</Tag>
              </div>
              {canViewContracts && (
                <Button
                  type="primary"
                  icon={<AuditOutlined />}
                  onClick={() => navigate('/contracts')}
                  className="bg-blue-600 hover:bg-blue-700 font-semibold"
                >
                  Quản Lý Hợp Đồng
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* ============================================================== */}
      {/* 2. THANH ĐIỀU HƯỚNG VIEW: [Ngày] [Tuần] [Tháng] [Danh sách] & NAV */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
        {/* Cụm Tabs Ant Design Segmented: Ngày - Tuần - Tháng - Danh sách */}
        <div className="flex items-center">
          <Segmented
            value={viewType}
            onChange={(val) => setViewType(val)}
            options={[
              { value: 'day', label: 'Ngày' },
              { value: 'week', label: 'Tuần' },
              { value: 'month', label: 'Tháng' },
              { value: 'agenda', label: 'Danh sách' },
            ]}
            className="font-medium"
          />
        </div>

        {/* Cụm điều hướng: Tiêu đề tháng + Nút [< Hôm nay >] */}
        <div className="flex items-center gap-3">
          <span className="text-base sm:text-lg font-bold text-slate-800 tracking-tight capitalize select-none leading-none">
            {getHeaderTitle()}
          </span>

          <Space.Compact size="middle">
            <Button
              icon={<LeftOutlined className="text-xs text-slate-600" />}
              onClick={handlePrev}
              title="Trước"
            />
            <Button
              onClick={handleToday}
              className="font-semibold text-xs text-slate-700 hover:text-blue-600 px-3"
            >
              Hôm nay
            </Button>
            <Button
              icon={<RightOutlined className="text-xs text-slate-600" />}
              onClick={handleNext}
              title="Sau"
            />
          </Space.Compact>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. NỘI DUNG HIỂN THỊ THEO VIEW TYPE                             */}
      {/* ============================================================== */}
      {loading ? (
        <div className="py-28 flex items-center justify-center bg-white rounded-2xl border border-slate-200">
          <Spin size="large" tip="Đang tải dữ liệu..." />
        </div>
      ) : viewType === 'week' ? (
        /* ============================================================== */
        /* VIEW 1: CHẾ ĐỘ TUẦN (WEEK VIEW) - 7 CỘT DỌC CÓ ĐƯỜNG KẺ RÕ RÀNG*/
        /* ============================================================== */
        <div className="border border-slate-200 shadow-2xs rounded-2xl overflow-hidden bg-white">
          {/* Header 7 cột tuần với đường kẻ dọc ngăn cách rõ ràng */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center">
            {currentWeekDays.map((day, idx) => {
              const dayStr = day.format('YYYY-MM-DD');
              const isToday = dayStr === todayStr;

              return (
                <div
                  key={idx}
                  className={`py-3 px-2 border-r border-slate-200 last:border-r-0 flex flex-col items-center justify-center gap-1 transition-colors ${
                    isToday ? 'bg-blue-50/60' : ''
                  }`}
                >
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      idx === 6 ? 'text-rose-500' : 'text-slate-500'
                    }`}
                  >
                    {WEEKDAYS[idx]}
                  </span>

                  {/* Số ngày: Nếu là Hôm nay thì hiện vòng tròn xanh dương nổi bật */}
                  {isToday ? (
                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                      {day.date()}
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-slate-700">
                      {day.date()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* VÙNG CÔNG VIỆC TRẢI DÀI THEO TIẾN ĐỘ (MULTI-DAY SPANNING BARS) */}
          {currentWeekEvents.multiDaySpans.length > 0 && (
            <div className="border-b border-slate-200 bg-slate-50/50 p-2 space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-3xs font-bold text-slate-500 uppercase tracking-wider">
                  Công việc theo tiến độ dài ngày ({currentWeekEvents.multiDaySpans.length})
                </span>
                <span className="text-3xs text-slate-400">
                  Trải dài từ ngày bắt đầu đến ngày hết hạn
                </span>
              </div>
              <div className="grid grid-cols-7 gap-y-1.5">
                {currentWeekEvents.multiDaySpans.map((spanItem, sIdx) => {
                  const t = spanItem.item;
                  const isContract = spanItem.type === 'contract';

                  if (isContract) {
                    return (
                      <div
                        key={`contract-span-${t._id}-${sIdx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContract(t);
                          setIsContractDrawerOpen(true);
                        }}
                        style={{
                          gridColumnStart: spanItem.startCol + 1,
                          gridColumnEnd: `span ${spanItem.span}`,
                        }}
                        title={`[${t.code}] ${t.title} (${spanItem.startDate.format('DD/MM')} → ${spanItem.endDate.format('DD/MM')})`}
                        className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-all shadow-2xs hover:shadow-xs hover:brightness-95 select-none bg-emerald-100/90 text-emerald-950 border border-emerald-300 ${
                          spanItem.isStartEdge ? 'rounded-l-lg ml-0.5' : 'rounded-l-none border-l-0'
                        } ${
                          spanItem.isEndEdge ? 'rounded-r-lg mr-0.5' : 'rounded-r-none border-r-0'
                        }`}
                      >
                        <span className="shrink-0 text-3xs">📄</span>
                        <span className="truncate flex-1 font-semibold">{t.code} - {t.title}</span>
                      </div>
                    );
                  }

                  // Task span
                  const isDone = t.status === 'done';
                  return (
                    <div
                      key={`task-span-${t._id}-${sIdx}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(t);
                        setIsTaskModalOpen(true);
                      }}
                      style={{
                        gridColumnStart: spanItem.startCol + 1,
                        gridColumnEnd: `span ${spanItem.span}`,
                      }}
                      title={`${t.title} (${spanItem.startDate.format('DD/MM')} → ${spanItem.endDate.format('DD/MM')})`}
                      className={`group/span relative flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-all shadow-2xs hover:shadow-xs hover:brightness-95 select-none ${
                        spanItem.isStartEdge ? 'rounded-l-lg ml-0.5' : 'rounded-l-none border-l-0'
                      } ${
                        spanItem.isEndEdge ? 'rounded-r-lg mr-0.5' : 'rounded-r-none border-r-0'
                      } ${
                        isDone
                          ? 'bg-slate-100 text-slate-500 border border-slate-300 line-through'
                          : t.priority === 'urgent'
                          ? 'bg-rose-100 text-rose-950 border border-rose-300'
                          : 'bg-rose-50 text-rose-900 border border-rose-200'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isDone
                            ? 'bg-slate-400'
                            : t.priority === 'urgent'
                            ? 'bg-rose-600'
                            : 'bg-rose-400'
                        }`}
                      />
                      <span className="truncate flex-1 font-semibold leading-tight">
                        {t.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Thân 7 cột ngày: Công việc chỉ hiển thị bên trong mỗi cột dọc, có đường kẻ dọc rõ ràng */}
          <div className="grid grid-cols-7 divide-x divide-slate-200 min-h-[520px] bg-white">
            {currentWeekDays.map((day, idx) => {
              const dayStr = day.format('YYYY-MM-DD');
              const dayTasks = currentWeekEvents.singleDayItems[dayStr] || [];
              const dayContracts = currentWeekEvents.singleDayItems[dayStr] || [];
              const isToday = dayStr === todayStr;

              return (
                <div
                  key={idx}
                  onClick={() => handleCellClick(day)}
                  className={`p-2.5 flex flex-col justify-between transition-colors cursor-pointer group ${isToday ? 'bg-blue-50/15' : 'hover:bg-slate-50/40'
                    }`}
                >
                  {/* Danh sách công việc của ngày xếp theo chiều dọc */}
                  <div className="space-y-1.5 overflow-y-auto max-h-[500px] pr-0.5 scrollbar-thin">
                    {/* Mode 1: Tasks */}
                    {calendarMode === 'tasks' &&
                      dayTasks.map((t) => {
                        const isDone = t.status === 'done';
                        return (
                          <div
                            key={t._id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTask(t);
                              setIsTaskModalOpen(true);
                            }}
                            title={t.title}
                            className={`group/task relative flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-all shadow-2xs hover:shadow-xs hover:-translate-y-0.5 ${isDone
                                ? 'bg-slate-100/90 text-slate-500 border-slate-200 line-through'
                                : 'bg-rose-50 hover:bg-rose-100/90 text-rose-950 border-rose-200/90'
                              }`}
                          >
                            {/* Chấm tròn trạng thái */}
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${isDone
                                  ? 'bg-slate-400'
                                  : t.status === 'in_progress'
                                    ? 'bg-blue-500'
                                    : t.priority === 'urgent'
                                      ? 'bg-rose-600'
                                      : 'bg-rose-400'
                                }`}
                            />

                            {/* Tiêu đề công việc: Tự động chuyển thành "..." nếu dài, KHÔNG hiển thị giờ phía sau */}
                            <span className="truncate flex-1 font-medium select-none">
                              {t.title}
                            </span>
                          </div>
                        );
                      })}

                    {/* Mode 2: Contracts */}
                    {calendarMode === 'contracts' &&
                      dayContracts.map((c, cIdx) => (
                        <div
                          key={`${c._id}-${cIdx}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContract(c);
                            setIsContractDrawerOpen(true);
                          }}
                          title={`[${c.code}] ${c.title}`}
                          className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold cursor-pointer border transition-all shadow-2xs hover:shadow-xs hover:-translate-y-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                        >
                          <span className="shrink-0 text-2xs">🟢</span>
                          <span className="truncate flex-1 select-none">{c.code}</span>
                        </div>
                      ))}

                    {/* Trạng thái trống hoặc nút thêm nhanh */}
                    {dayTasks.length === 0 && dayContracts.length === 0 ? (
                      <div className="h-32 flex flex-col items-center justify-center text-slate-300 group-hover:text-blue-500 transition-colors">
                        <PlusOutlined className="text-base mb-1" />
                        <span className="text-2xs font-semibold">Thêm việc</span>
                      </div>
                    ) : (
                      calendarMode === 'tasks' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCellClick(day);
                          }}
                          className="w-full py-1.5 text-2xs font-semibold text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 rounded-md border border-dashed border-slate-200 hover:border-blue-300 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100"
                        >
                          <PlusOutlined className="text-3xs" /> Thêm việc
                        </button>
                      )
                    )}
                  </div>

                  {/* Nhãn ngày mờ ở chân cột */}
                  <div className="pt-2 text-right">
                    <span className="text-3xs text-slate-300 font-mono">
                      {day.format('DD/MM')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewType === 'day' ? (
        /* ============================================================== */
        /* VIEW 2: CHẾ ĐỘ NGÀY (DAY VIEW)                                 */
        /* ============================================================== */
        <Card className="border-slate-200 shadow-2xs rounded-2xl p-4 bg-white">
          <div className="mb-4 pb-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                Chi tiết ngày
              </span>
              <h3 className="text-lg font-bold text-slate-800">
                {currentDate.format('dddd, [ngày] D [tháng] M, YYYY')}
              </h3>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openCreateTask && openCreateTask({ dueDate: currentDate.toDate() })}
              className="bg-blue-600"
            >
              Thêm Việc Trong Ngày
            </Button>
          </div>

          {/* Danh sách việc trong ngày (bao gồm các việc theo tiến độ đang diễn ra) */}
          <div className="space-y-3">
            {dayViewTasks.map((t) => (
              <div
                key={t._id}
                onClick={() => {
                  setSelectedTask(t);
                  setIsTaskModalOpen(true);
                }}
                className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100/70 flex items-center justify-between gap-3 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  <div className="overflow-hidden">
                    <h4 className="font-bold text-slate-800 text-sm mb-0 truncate" title={t.title}>
                      {t.title}
                    </h4>
                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                      <span>Dự án: <strong>{t.project?.name || '—'}</strong></span>
                      <span>• Người làm: <strong>{t.assignee?.name || 'Chưa giao'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <Tag color={t.status === 'done' ? 'success' : 'processing'}>
                    {t.status === 'done' ? 'Hoàn thành' : 'Đang xử lý'}
                  </Tag>
                </div>
              </div>
            ))}

            {dayViewTasks.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">
                Không có công việc nào trong ngày này. Bấm "+ Thêm Việc" để lên lịch!
              </div>
            )}
          </div>
        </Card>
      ) : viewType === 'month' ? (
        /* ============================================================== */
        /* VIEW 3: CHẾ ĐỘ THÁNG (MONTH VIEW) - HỖ TRỢ THANH TIẾN ĐỘ DÀI   */
        /* ============================================================== */
        <Card
          className="border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden p-0"
          styles={{ body: { padding: 0 } }}
        >
          {/* Header 7 cột T2 ➔ CN */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/60 text-center">
            {WEEKDAYS.map((dayName, idx) => (
              <div
                key={idx}
                className={`py-2.5 text-xs font-semibold uppercase tracking-wider ${idx === 6 ? 'text-red-500' : 'text-slate-500'
                  }`}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Lưới các tuần trong tháng */}
          <div className="divide-y divide-slate-200 bg-white">
            {monthWeeks.map((week, wIdx) => (
              <div key={wIdx} className="border-b border-slate-200 last:border-b-0 min-h-[110px]">
                {/* 1. Header các ngày trong tuần */}
                <div className="grid grid-cols-7 divide-x divide-slate-100 bg-slate-50/40 text-center py-1">
                  {week.weekDays.map((day, dIdx) => {
                    const isCurrentMonth = day.month() === currentDate.month();
                    const isToday = day.format('YYYY-MM-DD') === todayStr;
                    const isFirstOfMonth = day.date() === 1;

                    return (
                      <div
                        key={dIdx}
                        onClick={() => handleCellClick(day)}
                        className={`px-1.5 flex items-center justify-between cursor-pointer ${
                          isToday ? 'font-bold' : ''
                        }`}
                      >
                        {isFirstOfMonth ? (
                          <span className="text-3xs font-bold text-slate-400 uppercase tracking-tighter">
                            Thg {day.format('M')} 1
                          </span>
                        ) : (
                          <span />
                        )}

                        {isToday ? (
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                            {day.date()}
                          </span>
                        ) : (
                          <span
                            className={`text-xs ${
                              isCurrentMonth ? 'text-slate-700 font-medium' : 'text-slate-300'
                            }`}
                          >
                            {day.date()}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 2. Multi-day Spanning Bars cho tuần này */}
                {week.multiDaySpans.length > 0 && (
                  <div className="grid grid-cols-7 gap-y-1 p-1 bg-slate-50/20">
                    {week.multiDaySpans.map((spanItem, sIdx) => {
                      const t = spanItem.item;
                      const isContract = spanItem.type === 'contract';

                      if (isContract) {
                        return (
                          <div
                            key={`m-contract-${t._id}-${sIdx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedContract(t);
                              setIsContractDrawerOpen(true);
                            }}
                            style={{
                              gridColumnStart: spanItem.startCol + 1,
                              gridColumnEnd: `span ${spanItem.span}`,
                            }}
                            title={`[${t.code}] ${t.title} (${spanItem.startDate.format('DD/MM')} → ${spanItem.endDate.format('DD/MM')})`}
                            className={`flex items-center gap-1 px-2 py-0.5 text-2xs font-semibold cursor-pointer shadow-2xs hover:brightness-95 select-none bg-emerald-100 text-emerald-950 border border-emerald-300 ${
                              spanItem.isStartEdge ? 'rounded-l' : 'rounded-l-none border-l-0'
                            } ${
                              spanItem.isEndEdge ? 'rounded-r' : 'rounded-r-none border-r-0'
                            }`}
                          >
                            <span className="shrink-0 text-3xs">📄</span>
                            <span className="truncate flex-1">{t.code} - {t.title}</span>
                          </div>
                        );
                      }

                      const isDone = t.status === 'done';
                      return (
                        <div
                          key={`m-task-${t._id}-${sIdx}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(t);
                            setIsTaskModalOpen(true);
                          }}
                          style={{
                            gridColumnStart: spanItem.startCol + 1,
                            gridColumnEnd: `span ${spanItem.span}`,
                          }}
                          title={`${t.title} (${spanItem.startDate.format('DD/MM')} → ${spanItem.endDate.format('DD/MM')})`}
                          className={`flex items-center gap-1.5 px-2 py-0.5 text-2xs font-medium cursor-pointer shadow-2xs hover:brightness-95 select-none ${
                            spanItem.isStartEdge ? 'rounded-l' : 'rounded-l-none border-l-0'
                          } ${
                            spanItem.isEndEdge ? 'rounded-r' : 'rounded-r-none border-r-0'
                          } ${
                            isDone
                              ? 'bg-slate-100 text-slate-500 border border-slate-300 line-through'
                              : t.priority === 'urgent'
                              ? 'bg-rose-100 text-rose-950 border border-rose-300'
                              : 'bg-rose-50 text-rose-900 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isDone
                                ? 'bg-slate-400'
                                : t.priority === 'urgent'
                                ? 'bg-rose-600'
                                : 'bg-rose-400'
                            }`}
                          />
                          <span className="truncate flex-1 font-medium">{t.title}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. Single-day tasks cho 7 ngày của tuần này */}
                <div className="grid grid-cols-7 divide-x divide-slate-100 min-h-[50px] p-1">
                  {week.weekDays.map((day, dIdx) => {
                    const dayStr = day.format('YYYY-MM-DD');
                    const singleTasks = week.singleDayItems[dayStr] || [];

                    return (
                      <div
                        key={dIdx}
                        onClick={() => handleCellClick(day)}
                        className="p-1 space-y-1 hover:bg-blue-50/20 cursor-pointer transition-colors"
                      >
                        {singleTasks.map((t) => (
                          <div
                            key={t._id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTask(t);
                              setIsTaskModalOpen(true);
                            }}
                            title={t.title}
                            className="px-1.5 py-0.5 rounded text-3xs truncate font-medium bg-rose-50 text-rose-900 border border-rose-200/80 shadow-2xs hover:scale-[1.01] transition-transform select-none"
                          >
                            {t.title}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        /* ============================================================== */
        /* VIEW 4: CHẾ ĐỘ LỊCH TRÌNH / DANH SÁCH (AGENDA VIEW)            */
        /* ============================================================== */
        <Card className="border-slate-200 shadow-2xs rounded-2xl p-4 bg-white">
          <div className="space-y-4">
            {Object.keys(tasksByDate)
              .sort()
              .map((dateKey) => (
                <div key={dateKey} className="border-b border-slate-100 pb-3 last:border-b-0">
                  <div className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-2">
                    <CalendarOutlined />
                    <span>{dayjs(dateKey).format('dddd, [ngày] DD/MM/YYYY')}</span>
                  </div>
                  <div className="space-y-2 pl-4 border-l-2 border-blue-200">
                    {tasksByDate[dateKey].map((t) => (
                      <div
                        key={t._id}
                        onClick={() => {
                          setSelectedTask(t);
                          setIsTaskModalOpen(true);
                        }}
                        className="p-2.5 bg-slate-50 hover:bg-blue-50/50 rounded-lg border border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <span className="font-semibold text-slate-800 text-sm truncate mr-3 flex-1" title={t.title}>
                          {t.title}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <Tag color="geekblue">{t.project?.name || 'Dự án'}</Tag>
                          <Tag color={t.status === 'done' ? 'success' : 'processing'}>
                            {t.status === 'done' ? 'Hoàn thành' : 'Đang xử lý'}
                          </Tag>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* ============================================================== */}
      {/* MODAL CHI TIẾT CÔNG VIỆC NHANH (TASK QUICK VIEW)              */}
      {/* ============================================================== */}
      <Modal
        open={isTaskModalOpen}
        onCancel={() => {
          setIsTaskModalOpen(false);
          setSelectedTask(null);
        }}
        title={
          <div className="flex items-center gap-2">
            <CheckSquareOutlined className="text-blue-600" />
            <span>Chi Tiết Công Việc</span>
          </div>
        }
        footer={[
          <Button
            key="kanban"
            onClick={() => {
              setIsTaskModalOpen(false);
              navigate(
                selectedTask?.project?._id
                  ? `/tasks?project=${selectedTask.project._id}`
                  : '/tasks'
              );
            }}
          >
            Mở trên Bảng Kanban
          </Button>,
          <Button
            key="edit"
            type="primary"
            onClick={() => {
              setIsTaskModalOpen(false);
              if (openEditTask && selectedTask) {
                openEditTask(selectedTask);
              }
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Chỉnh Sửa
          </Button>,
        ]}
      >
        {selectedTask && (
          <div className="space-y-4 py-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Tag color={selectedTask.status === 'done' ? 'success' : 'processing'}>
                  {selectedTask.status === 'done'
                    ? 'Hoàn thành'
                    : selectedTask.status === 'in_progress'
                      ? 'Đang làm'
                      : selectedTask.status === 'review'
                        ? 'Đang duyệt'
                        : 'Chờ làm'}
                </Tag>
                <Tag
                  color={
                    selectedTask.priority === 'urgent'
                      ? 'error'
                      : selectedTask.priority === 'high'
                        ? 'warning'
                        : 'default'
                  }
                >
                  Ưu tiên {selectedTask.priority}
                </Tag>
              </div>
              <h3 className="text-base font-bold text-slate-800">{selectedTask.title}</h3>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Dự án:</span>
                <span className="font-semibold text-slate-700">
                  {selectedTask.project?.name || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Phòng ban:</span>
                <span className="font-semibold text-slate-700">
                  {selectedTask.department?.name || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Người thực hiện:</span>
                <span className="font-semibold text-slate-700">
                  {selectedTask.assignee?.name || 'Chưa giao'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Hạn hoàn thành (Deadline):</span>
                <span className="font-bold text-red-600">
                  {selectedTask.dueDate
                    ? dayjs(selectedTask.dueDate).format('DD/MM/YYYY HH:mm')
                    : 'Không ghi hạn'}
                </span>
              </div>
            </div>

            {selectedTask.description && (
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase mb-1">Mô tả:</div>
                <div className="text-sm text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 whitespace-pre-line">
                  {selectedTask.description}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ============================================================== */}
      {/* DRAWER CHI TIẾT HỢP ĐỒNG (DRAWER 2 CỘT CHUẨN BITRIX24)         */}
      {/* ============================================================== */}
      <ContractDetailDrawer
        visible={isContractDrawerOpen}
        onClose={() => {
          setIsContractDrawerOpen(false);
          setSelectedContract(null);
        }}
        contract={selectedContract}
        onEdit={() => {
          setIsContractDrawerOpen(false);
          navigate('/contracts');
        }}
        onRefresh={fetchData}
      />
    </div>
  );
};
