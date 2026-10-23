import React, { useState, useEffect } from 'react';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Select,
  Button,
  Tag,
  Avatar,
  Popconfirm,
  Empty,
  Tooltip,
  message,
  Badge,
  Progress,
  Spin,
  Modal,
  Form,
  Input,
  InputNumber,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  LeftOutlined,
  RightOutlined,
  HolderOutlined,
  CalendarOutlined,
  FilterOutlined,
  EditOutlined,
  ProjectOutlined,
  ArrowLeftOutlined,
  ApartmentOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  DollarOutlined,
  AppstoreOutlined,
  DownOutlined,
  CommentOutlined,
  CrownOutlined,
  SafetyCertificateOutlined,
  VideoCameraOutlined,
  LinkOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { taskApi, projectApi, departmentApi, userApi, contractApi } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';

const { TextArea } = Input;

export const KanbanBoard = () => {
  const { user, currentWorkspace } = useAuth();
  const { can, canViewValue } = usePermission();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { openCreateTask, openEditTask } = useOutletContext() || {};

  const projectQuery = searchParams.get('project');

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [selectedContract, setSelectedContract] = useState('all');
  const [selectedProject, setSelectedProject] = useState(projectQuery || 'all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [workflowFilter, setWorkflowFilter] = useState('all'); // 'all' | 'my_tasks' | 'need_review' | 'changes_requested'
  const [loading, setLoading] = useState(true);
  const [isMetadataLoading, setIsMetadataLoading] = useState(true);

  // Edit Project Modal state inside Kanban
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editForm] = Form.useForm();
  const [savingProject, setSavingProject] = useState(false);

  // Watch departments in edit modal to filter members
  const editSelectedDeptIds = Form.useWatch('departments', editForm) || [];

  const editProjectSelectableUsers = React.useMemo(() => {
    if (editSelectedDeptIds && editSelectedDeptIds.length > 0) {
      const allowedUserIds = new Set();
      editSelectedDeptIds.forEach((deptId) => {
        const d = departments.find((item) => item._id === deptId);
        if (d) {
          (d.members || []).forEach((m) => allowedUserIds.add((m._id || m).toString()));
          if (d.head) allowedUserIds.add((d.head._id || d.head).toString());
        }
        users.forEach((u) => {
          const uDeptId = (u.departmentId && (u.departmentId._id || u.departmentId))?.toString();
          if (uDeptId === deptId.toString() || (d && u.department === d.name)) {
            allowedUserIds.add(u._id.toString());
          }
        });
      });
      return users.filter((u) => allowedUserIds.has(u._id.toString()));
    }
    return users;
  }, [editSelectedDeptIds, departments, users]);

  useEffect(() => {
    if (editSelectedDeptIds && editSelectedDeptIds.length > 0) {
      const currentMembers = editForm.getFieldValue('members') || [];
      const validMembers = currentMembers.filter((mId) =>
        editProjectSelectableUsers.some((u) => u._id.toString() === mId.toString())
      );
      if (validMembers.length !== currentMembers.length) {
        editForm.setFieldsValue({ members: validMembers });
      }
    }
  }, [editSelectedDeptIds, editProjectSelectableUsers, editForm]);

  // Drag and drop states
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Sync selectedProject from URL query
  useEffect(() => {
    if (projectQuery) {
      setSelectedProject(projectQuery);
    } else {
      setSelectedProject('all');
    }
  }, [projectQuery]);

  const handleProjectChange = (val) => {
    setSelectedProject(val);
    if (val === 'all') {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('project');
      setSearchParams(newParams);
    } else {
      setSearchParams({ project: val });
    }
  };

  const fetchTasks = async () => {
    try {
      const params = {};
      if (selectedProject !== 'all') params.project = selectedProject;
      if (selectedDepartment !== 'all') params.department = selectedDepartment;
      if (selectedPriority !== 'all') params.priority = selectedPriority;

      const res = await taskApi.getAll(params);
      if (res.data.success) {
        setTasks(res.data.tasks);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      setIsMetadataLoading(true);
      const canViewContracts = can('contracts', 'view');

      const [projRes, deptRes, userRes, contractRes] = await Promise.all([
        projectApi.getAll().catch(() => ({ data: { success: false, projects: [] } })),
        departmentApi.getAll().catch(() => ({ data: { success: false, departments: [] } })),
        userApi.getAll().catch(() => ({ data: { success: false, users: [] } })),
        canViewContracts
          ? contractApi.getAll().catch(() => ({ data: { success: false, contracts: [] } }))
          : Promise.resolve({ data: { success: true, contracts: [] } }),
      ]);
      if (projRes.data?.success) setProjects(projRes.data.projects || []);
      if (deptRes.data?.success) setDepartments(deptRes.data.departments || []);
      if (userRes.data?.success) setUsers(userRes.data.users || []);
      if (contractRes.data?.success) setContracts(contractRes.data.contracts || []);
    } catch (err) {
      console.error('Failed to fetch filter metadata:', err);
    } finally {
      setIsMetadataLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [currentWorkspace?._id]);

  useEffect(() => {
    fetchTasks();
  }, [selectedProject, selectedDepartment, selectedPriority]);

  // Real-time synchronization
  useEffect(() => {
    const socket = getSocket();

    const handleTaskChanged = () => fetchTasks();
    socket.on('task:changed', handleTaskChanged);
    window.addEventListener('taskCreated', handleTaskChanged);
    window.addEventListener('taskUpdated', handleTaskChanged);

    return () => {
      socket.off('task:changed', handleTaskChanged);
      window.removeEventListener('taskCreated', handleTaskChanged);
      window.removeEventListener('taskUpdated', handleTaskChanged);
    };
  }, [selectedProject, selectedPriority]);

  // Active Project object (if in dedicated project kanban view)
  const currentProject = projects.find((p) => p._id === selectedProject);

  // Danh sách dự án hiển thị theo bộ lọc hợp đồng
  const displayedProjects = React.useMemo(() => {
    if (selectedContract === 'all') return projects;
    if (selectedContract === 'none') {
      return projects.filter((p) => !p.contracts || p.contracts.length === 0);
    }
    return projects.filter((p) =>
      (p.contracts || []).some((c) => (c._id || c).toString() === selectedContract.toString())
    );
  }, [projects, selectedContract]);

  // Handlers for Editing Project
  const handleOpenEditProject = (proj) => {
    setEditingProject(proj);
    editForm.setFieldsValue({
      name: proj.name,
      code: proj.code,
      status: proj.status || 'active',
      description: proj.description,
      budget: proj.budget || 0,
      color: proj.color || '#2563eb',
      manager: (proj.manager && (proj.manager._id || proj.manager)) || (proj.owner && (proj.owner._id || proj.owner)),
      supervisor: proj.supervisor && (proj.supervisor._id || proj.supervisor),
      departments: (proj.departments || []).map((d) => d._id || d),
      members: (proj.members || []).map((m) => m._id || m),
      contracts: (proj.contracts || []).map((c) => c._id || c),
    });
    setIsEditModalOpen(true);
  };

  const handleSaveProject = async () => {
    try {
      const values = await editForm.validateFields();
      setSavingProject(true);

      const payload = {
        name: values.name,
        code: values.code ? values.code.toUpperCase() : undefined,
        description: values.description,
        status: values.status || 'active',
        budget: canViewValue('projects') ? (values.budget || 0) : (editingProject?.budget ?? 0),
        color: values.color || '#2563eb',
        manager: values.manager,
        supervisor: values.supervisor || null,
        departments: values.departments || [],
        members: values.members || [],
        contracts: values.contracts || [],
      };

      const res = await projectApi.update(editingProject._id, payload);
      if (res.data.success) {
        message.success('Cập nhật thông tin dự án thành công!');
        setIsEditModalOpen(false);
        setEditingProject(null);
        editForm.resetFields();
        fetchMetadata();
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Không thể lưu dự án.');
    } finally {
      setSavingProject(false);
    }
  };

  const columns = [
    {
      id: 'todo',
      label: 'Cần làm (To Do)',
      color: '#64748b',
      bgClass: 'bg-slate-100/80',
      badgeStatus: 'default',
      borderClass: 'border-slate-400',
    },
    {
      id: 'in_progress',
      label: 'Đang làm (In Progress)',
      color: '#2563eb',
      bgClass: 'bg-blue-50/80',
      badgeStatus: 'processing',
      borderClass: 'border-blue-500',
    },
    {
      id: 'review',
      label: 'Chờ duyệt (Review)',
      color: '#f59e0b',
      bgClass: 'bg-amber-50/80',
      badgeStatus: 'warning',
      borderClass: 'border-amber-500',
    },
    {
      id: 'done',
      label: 'Hoàn thành (Done)',
      color: '#10b981',
      bgClass: 'bg-emerald-50/80',
      badgeStatus: 'success',
      borderClass: 'border-emerald-500',
    },
  ];

  // Drag & Drop handlers
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.setData('text/plain', task._id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverColumn(null);
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    const taskId = e.dataTransfer.getData('text/plain') || draggedTask?._id;
    if (!taskId) return;

    const taskToMove = tasks.find((t) => t._id === taskId);
    if (!taskToMove || taskToMove.status === targetStatus) return;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: targetStatus } : t))
    );

    try {
      await taskApi.updateStatus(taskId, targetStatus);
      message.success('Đã cập nhật trạng thái công việc!');
    } catch (err) {
      console.error('Failed to update task status:', err);
      fetchTasks();
    } finally {
      setDraggedTask(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  // Button move fallback
  const moveTask = async (task, direction) => {
    const statusOrder = ['todo', 'in_progress', 'review', 'done'];
    const currentIndex = statusOrder.indexOf(task.status);
    let targetIndex = currentIndex;

    if (direction === 'prev' && currentIndex > 0) targetIndex--;
    if (direction === 'next' && currentIndex < statusOrder.length - 1) targetIndex++;

    if (targetIndex !== currentIndex) {
      const newStatus = statusOrder[targetIndex];
      setTasks((prev) =>
        prev.map((t) => (t._id === task._id ? { ...t, status: newStatus } : t))
      );

      try {
        await taskApi.updateStatus(task._id, newStatus);
      } catch (err) {
        fetchTasks();
      }
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await taskApi.delete(taskId);
      message.success('Đã xóa công việc');
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
    } catch (err) {
      message.error('Không thể xóa công việc');
    }
  };

  const getPriorityTag = (priority) => {
    switch (priority) {
      case 'urgent':
        return <Tag color="error">Khẩn cấp</Tag>;
      case 'high':
        return <Tag color="warning">Ưu tiên cao</Tag>;
      case 'low':
        return <Tag>Thấp</Tag>;
      default:
        return <Tag color="processing">Bình thường</Tag>;
    }
  };

  const getProjectStatusTag = (status) => {
    switch (status) {
      case 'active':
        return <Tag color="success">🟢 Đang triển khai</Tag>;
      case 'planning':
        return <Tag color="processing">🔵 Lên kế hoạch</Tag>;
      case 'on_hold':
        return <Tag color="warning">🟡 Tạm dừng</Tag>;
      case 'completed':
        return <Tag color="purple">🟣 Đã hoàn tất</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN');
  };

  // Stats computed from loaded tasks
  const totalTasksCount = tasks.length;
  const doneTasksCount = tasks.filter((t) => t.status === 'done').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const reviewCount = tasks.filter((t) => t.status === 'review').length;
  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const progressPercent = totalTasksCount > 0 ? Math.round((doneTasksCount / totalTasksCount) * 100) : 0;

  const currentUserId = (user?._id || user?.id)?.toString();
  const isBoss = ['admin', 'director'].includes(user?.role);

  // Workflow filter counts
  const myTasksCount = tasks.filter((t) => {
    const aId = (t.assignee?._id || t.assignee)?.toString();
    return aId === currentUserId;
  }).length;

  const needReviewCount = tasks.filter((t) => {
    if (t.status !== 'review') return false;
    if (isBoss) return true;
    const revId = (t.reviewer?._id || t.reviewer)?.toString();
    if (revId && revId === currentUserId) return true;
    const pmId = (t.project?.manager?._id || t.project?.manager)?.toString();
    if (pmId && pmId === currentUserId) return true;
    return false;
  }).length;

  const changesRequestedCount = tasks.filter(
    (t) => t.reviewFeedback?.action === 'changes_requested'
  ).length;

  // Filtered tasks by workflow tab
  const displayedTasks = React.useMemo(() => {
    if (workflowFilter === 'my_tasks') {
      return tasks.filter((t) => {
        const aId = (t.assignee?._id || t.assignee)?.toString();
        return aId === currentUserId;
      });
    }
    if (workflowFilter === 'need_review') {
      return tasks.filter((t) => {
        if (t.status !== 'review') return false;
        if (isBoss) return true;
        const revId = (t.reviewer?._id || t.reviewer)?.toString();
        if (revId && revId === currentUserId) return true;
        const pmId = (t.project?.manager?._id || t.project?.manager)?.toString();
        if (pmId && pmId === currentUserId) return true;
        return false;
      });
    }
    if (workflowFilter === 'changes_requested') {
      return tasks.filter((t) => t.reviewFeedback?.action === 'changes_requested');
    }
    return tasks;
  }, [tasks, workflowFilter, currentUserId, isBoss]);

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* SCENARIO A: DEDICATED PROJECT KANBAN HEADER BANNER            */}
      {/* ============================================================== */}
      {selectedProject !== 'all' ? (
        isMetadataLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
            <Spin tip="Đang tải dữ liệu dự án..." />
          </div>
        ) : currentProject ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
            {/* Top colored accent bar */}
            <div
              className="h-2 w-full"
              style={{ backgroundColor: currentProject.color || '#2563eb' }}
            />

            <div className="p-5 md:p-6 space-y-4">
              {/* Top row: Back to all + Project switcher + Action buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => handleProjectChange('all')}
                    className="font-medium text-slate-600 hover:text-blue-600"
                  >
                    Tất cả công việc
                  </Button>

                  {/* Quick project switcher */}
                  <Select
                    value={selectedProject}
                    onChange={handleProjectChange}
                    style={{ width: 220 }}
                    placeholder="Chuyển dự án khác"
                  >
                    {projects.map((p) => (
                      <Select.Option key={p._id} value={p._id}>
                        [{p.code || 'PRJ'}] {p.name}
                      </Select.Option>
                    ))}
                  </Select>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {can('projects', 'edit') && (
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => handleOpenEditProject(currentProject)}
                      className="font-medium"
                    >
                      Sửa thông tin dự án
                    </Button>
                  )}

                  <Button
                    icon={<CommentOutlined />}
                    onClick={() => navigate(`/channels?type=project&id=${currentProject._id}`)}
                    className="font-medium text-emerald-600 border-emerald-300 hover:text-emerald-700 hover:border-emerald-400 bg-emerald-50/50"
                  >
                    Kênh chat dự án
                  </Button>

                  <Button
                    icon={<CalendarOutlined />}
                    onClick={() => navigate(`/calendar?mode=tasks&project=${currentProject._id}`)}
                    className="font-medium text-blue-600 border-blue-300 hover:text-blue-700 hover:border-blue-400 bg-blue-50/50"
                  >
                    Lịch biểu
                  </Button>

                  {can('tasks', 'create') && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => openCreateTask({ projectId: currentProject._id })}
                      className="font-medium"
                    >
                      Thêm việc vào dự án này
                    </Button>
                  )}
                </div>
              </div>

              {/* Main project header info */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-2">
                <div className="flex items-start gap-4">
                  {/* Project Color & Code Avatar */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-extrabold text-base shadow-sm shrink-0 tracking-wider"
                    style={{ backgroundColor: currentProject.color || '#2563eb' }}
                  >
                    {currentProject.code ? currentProject.code.slice(0, 4) : 'PRJ'}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                        {currentProject.name}
                      </h1>
                      {getProjectStatusTag(currentProject.status)}
                    </div>

                    {currentProject.description && (
                      <p className="text-slate-500 text-sm mt-1 max-w-3xl leading-relaxed">
                        {currentProject.description}
                      </p>
                    )}

                    {/* Metadata Chips: PM, Supervisor, Departments, Members, Budget */}
                    <div className="flex flex-wrap items-center gap-2.5 mt-3 text-xs text-slate-600">
                      {/* PM / Manager */}
                      <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 text-blue-900">
                        <CrownOutlined className="text-amber-500" />
                        <span className="font-semibold text-slate-700">Quản lý (PM):</span>
                        <span className="font-bold text-blue-800">
                          {currentProject.manager?.name || currentProject.owner?.name || 'Chưa gán'}
                        </span>
                      </div>

                      {/* Supervisor */}
                      {currentProject.supervisor && (
                        <div className="flex items-center gap-1.5 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 text-purple-900">
                          <SafetyCertificateOutlined className="text-purple-600" />
                          <span className="font-semibold text-slate-700">Giám sát:</span>
                          <span className="font-bold text-purple-800">
                            {currentProject.supervisor.name}
                          </span>
                        </div>
                      )}

                      {/* Departments */}
                      {currentProject.departments && currentProject.departments.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                          <ApartmentOutlined className="text-slate-400" />
                          <span className="font-semibold text-slate-700">Phòng ban:</span>
                          <div className="flex flex-wrap gap-1">
                            {currentProject.departments.map((dept) => {
                              const deptId = dept?._id || dept;
                              const deptName = dept?.name || 'Phòng ban';
                              const deptColor = dept?.color || 'blue';
                              return (
                                <Tag
                                  key={deptId}
                                  color={deptColor}
                                  className="m-0 text-[11px] font-medium"
                                >
                                  {deptName}
                                </Tag>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Members */}
                      <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                        <TeamOutlined className="text-slate-400" />
                        <span className="font-semibold text-slate-700">Nhân sự:</span>
                        <span>{currentProject.members?.length || 1} thành viên</span>
                      </div>

                      {/* Budget */}
                      {currentProject.budget > 0 && canViewValue('projects') && (
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                          <DollarOutlined className="text-emerald-500" />
                          <span className="font-semibold text-slate-700">Ngân sách:</span>
                          <span className="font-bold text-emerald-600">
                            {currentProject.budget.toLocaleString('vi-VN')} đ
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Summary Box */}
                <div className="lg:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">Tiến độ dự án</span>
                    <span className="font-bold text-slate-900 text-sm">{progressPercent}%</span>
                  </div>
                  <Progress
                    percent={progressPercent}
                    strokeColor={currentProject.color || '#2563eb'}
                    showInfo={false}
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Cần làm: <b>{todoCount}</b></span>
                    <span>Đang làm: <b>{inProgressCount}</b></span>
                    <span>Xong: <b>{doneTasksCount}/{totalTasksCount}</b></span>
                  </div>
                </div>
              </div>

              {/* Quick sub-filter inside project Kanban (Department & Priority) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <FilterOutlined /> Bộ lọc:
                  </span>

                  <Select
                    value={selectedDepartment}
                    onChange={setSelectedDepartment}
                    size="small"
                    style={{ width: 160 }}
                    placeholder="Lọc phòng ban"
                  >
                    <Select.Option value="all">Tất cả phòng ban</Select.Option>
                    {departments.map((d) => (
                      <Select.Option key={d._id} value={d._id}>
                        🏢 {d.name}
                      </Select.Option>
                    ))}
                  </Select>

                  <Select
                    value={selectedPriority}
                    onChange={setSelectedPriority}
                    size="small"
                    style={{ width: 130 }}
                    placeholder="Mức ưu tiên"
                  >
                    <Select.Option value="all">Mọi ưu tiên</Select.Option>
                    <Select.Option value="urgent">Khẩn cấp</Select.Option>
                    <Select.Option value="high">Ưu tiên cao</Select.Option>
                    <Select.Option value="medium">Bình thường</Select.Option>
                    <Select.Option value="low">Thấp</Select.Option>
                  </Select>
                </div>

                <div className="text-xs text-slate-400 font-medium">
                  Đang hiển thị <b>{tasks.length}</b> công việc của dự án này
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-900 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-bold text-base">Không tìm thấy thông tin dự án</div>
              <div className="text-xs text-amber-700 mt-0.5">
                Dự án này có thể đã bị xóa hoặc bạn chưa được phân quyền truy cập.
              </div>
            </div>
            <Button
              type="primary"
              onClick={() => handleProjectChange('all')}
              className="bg-amber-600 hover:bg-amber-700 font-medium"
            >
              Quay về tất cả dự án
            </Button>
          </div>
        )
      ) : (
        /* ============================================================== */
        /* SCENARIO B: OVERVIEW KANBAN HEADER (ALL PROJECTS)              */
        /* ============================================================== */
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <AppstoreOutlined className="text-blue-600" />
                Bảng Công Việc Tổng Thể (Kanban)
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Kéo thả các thẻ công việc giữa các cột để cập nhật trạng thái thời gian thực
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Contract Filter */}
              {can('contracts', 'view') && (
                <Select
                  value={selectedContract}
                  onChange={(val) => {
                    setSelectedContract(val);
                    setSelectedProject('all');
                  }}
                  style={{ width: 190 }}
                  placeholder="Lọc theo hợp đồng"
                  showSearch
                  optionFilterProp="children"
                >
                  <Select.Option value="all">Tất cả hợp đồng</Select.Option>
                  <Select.Option value="none">Dự án nội bộ / Chưa gán HĐ</Select.Option>
                  {contracts.map((c) => (
                    <Select.Option key={c._id} value={c._id}>
                      <div className="flex items-center gap-1.5 truncate">
                        <DollarOutlined className="text-blue-600" />
                        <span className="font-semibold text-blue-700">[{c.code}]</span>
                        <span className="truncate">{c.title}</span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              )}

              {/* Project Filter */}
              {can('projects', 'view') && (
                <Select
                  value={selectedProject}
                  onChange={handleProjectChange}
                  style={{ width: 180 }}
                  placeholder="Lọc theo dự án"
                >
                  <Select.Option value="all">Tất cả dự án</Select.Option>
                  {displayedProjects.map((p) => (
                    <Select.Option key={p._id} value={p._id}>
                      [{p.code || 'PRJ'}] {p.name}
                    </Select.Option>
                  ))}
                </Select>
              )}

              {/* Department Filter */}
              {can('departments', 'view') && (
                <Select
                  value={selectedDepartment}
                  onChange={setSelectedDepartment}
                  style={{ width: 170 }}
                  placeholder="Lọc theo phòng ban"
                >
                  <Select.Option value="all">Tất cả phòng ban</Select.Option>
                  {departments.map((d) => (
                    <Select.Option key={d._id} value={d._id}>
                      🏢 {d.name}
                    </Select.Option>
                  ))}
                </Select>
              )}

              {/* Priority Filter */}
              <Select
                value={selectedPriority}
                onChange={setSelectedPriority}
                style={{ width: 130 }}
                placeholder="Lọc theo ưu tiên"
              >
                <Select.Option value="all">Mọi ưu tiên</Select.Option>
                <Select.Option value="urgent">Khẩn cấp</Select.Option>
                <Select.Option value="high">Ưu tiên cao</Select.Option>
                <Select.Option value="medium">Bình thường</Select.Option>
                <Select.Option value="low">Thấp</Select.Option>
              </Select>

              <Button
                icon={<CalendarOutlined />}
                onClick={() =>
                  navigate(
                    `/calendar?mode=tasks${selectedProject !== 'all' ? `&project=${selectedProject}` : ''
                    }`
                  )
                }
                className="font-medium"
              >
                Lịch biểu
              </Button>

              {can('tasks', 'create') && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateTask({})}>
                  Thêm việc
                </Button>
              )}
            </div>
          </div>

          {/* Quick jump project dropdown */}
          {can('projects', 'view') && projects.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 shrink-0">
                <ProjectOutlined className="text-blue-600" />
                Kanban riêng từng dự án:
              </span>

              <Select
                value={selectedProject === 'all' ? undefined : selectedProject}
                onChange={(val) => handleProjectChange(val || 'all')}
                placeholder="-- Chọn dự án để xem Kanban riêng --"
                style={{ minWidth: 320 }}
                allowClear
                onClear={() => handleProjectChange('all')}
                suffixIcon={<DownOutlined className="text-xs text-slate-400" />}
              >
                {projects.map((p) => (
                  <Select.Option key={p._id} value={p._id}>
                    <div className="flex items-center justify-between gap-3 py-0.5">
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: p.color || '#2563eb' }}
                        />
                        <span className="font-bold text-slate-800">
                          [{p.code || 'PRJ'}]
                        </span>
                        <span className="truncate text-slate-700">{p.name}</span>
                      </div>
                      {p.status && (
                        <Tag
                          className="m-0 text-[10px] shrink-0"
                          color={
                            p.status === 'active'
                              ? 'success'
                              : p.status === 'planning'
                                ? 'processing'
                                : p.status === 'completed'
                                  ? 'purple'
                                  : 'warning'
                          }
                        >
                          {p.status === 'active'
                            ? 'Đang chạy'
                            : p.status === 'planning'
                              ? 'Lên kế hoạch'
                              : p.status === 'completed'
                                ? 'Hoàn tất'
                                : 'Tạm dừng'}
                        </Tag>
                      )}
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* WORKFLOW QUICK FILTER BAR                                      */}
      {/* ============================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
            <FilterOutlined /> Lọc nhanh:
          </span>
          <Button
            size="small"
            type={workflowFilter === 'all' ? 'primary' : 'default'}
            onClick={() => setWorkflowFilter('all')}
            className="font-medium rounded-lg text-xs"
          >
            Tất cả ({totalTasksCount})
          </Button>
          <Button
            size="small"
            type={workflowFilter === 'my_tasks' ? 'primary' : 'default'}
            onClick={() => setWorkflowFilter('my_tasks')}
            className="font-medium rounded-lg text-xs"
          >
            👤 Việc của tôi ({myTasksCount})
          </Button>
          <Button
            size="small"
            type={workflowFilter === 'need_review' ? 'primary' : 'default'}
            onClick={() => setWorkflowFilter('need_review')}
            className={`font-medium rounded-lg text-xs ${
              workflowFilter === 'need_review'
                ? 'bg-amber-500 hover:bg-amber-600 border-amber-500 text-white'
                : needReviewCount > 0
                ? 'border-amber-400 text-amber-700 bg-amber-50 font-semibold'
                : ''
            }`}
          >
            ⏳ Cần tôi duyệt ({needReviewCount})
          </Button>
          <Button
            size="small"
            type={workflowFilter === 'changes_requested' ? 'primary' : 'default'}
            onClick={() => setWorkflowFilter('changes_requested')}
            className={`font-medium rounded-lg text-xs ${
              workflowFilter === 'changes_requested'
                ? 'bg-rose-500 hover:bg-rose-600 border-rose-500 text-white'
                : changesRequestedCount > 0
                ? 'border-rose-400 text-rose-700 bg-rose-50 font-semibold'
                : ''
            }`}
          >
            ⚠️ Cần sửa lại ({changesRequestedCount})
          </Button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Đang hiển thị <b>{displayedTasks.length}</b> / {totalTasksCount} công việc
        </div>
      </div>

      {/* ============================================================== */}
      {/* KANBAN 4 COLUMNS GRID                                          */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start min-h-[70vh]">
        {columns.map((col, colIdx) => {
          const colTasks = displayedTasks.filter((t) => t.status === col.id);
          const isOver = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              className={`rounded-2xl border transition-all duration-200 flex flex-col min-h-[500px] max-h-[calc(100vh-190px)] ${
                isOver
                  ? `border-2 ${col.borderClass} ${col.bgClass} shadow-lg ring-2 ring-blue-400/20`
                  : 'border-slate-200 bg-slate-50/80 shadow-sm'
              }`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column Header */}
              <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-white/70 backdrop-blur rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <Badge status={col.badgeStatus} />
                  <span className="font-bold text-sm text-slate-800">{col.label}</span>
                </div>
                <Tag className="rounded-full px-2.5 font-bold border-none bg-slate-100 text-slate-600">
                  {colTasks.length}
                </Tag>
              </div>

              {/* Tasks List */}
              <div className="p-3 flex-1 overflow-y-auto space-y-3">
                {colTasks.length === 0 ? (
                  <div
                    className={`py-8 text-center text-xs rounded-xl border border-dashed transition-colors ${
                      isOver
                        ? `${col.borderClass} bg-white text-blue-600 font-semibold`
                        : 'border-slate-300 text-slate-400'
                    }`}
                  >
                    {isOver ? '👇 Thả công việc vào đây' : 'Chưa có công việc'}
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const isDragging = draggedTask?._id === task._id;

                    return (
                      <div
                        key={task._id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                        onDoubleClick={() => openEditTask?.(task)}
                        className={`p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing select-none group/card ${
                          isDragging ? 'opacity-40 scale-95 border-dashed border-blue-400' : ''
                        }`}
                      >
                        {/* Top: Project Tag & Grip & Edit / Delete */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <HolderOutlined className="text-slate-400 hover:text-slate-600" />
                            {/* Only show project tag if we are in 'all' projects view */}
                            {selectedProject === 'all' && (
                              <Tag
                                color={task.project?.color || 'blue'}
                                className="m-0 text-[11px] font-bold uppercase truncate"
                              >
                                {task.project?.code || 'PRJ'} • {task.project?.name || 'Chung'}
                              </Tag>
                            )}
                            {task.department && (
                              <Tag color="cyan" className="m-0 text-[10px] font-medium">
                                🏢 {task.department.name}
                              </Tag>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <Tooltip title="Chỉnh sửa công việc">
                              <Button
                                type="text"
                                size="small"
                                icon={<EditOutlined style={{ fontSize: '13px' }} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditTask?.(task);
                                }}
                                className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                              />
                            </Tooltip>

                            <Popconfirm
                              title="Xóa công việc"
                              description="Bạn có chắc chắn muốn xóa công việc này?"
                              onConfirm={() => deleteTask(task._id)}
                              okText="Xóa"
                              cancelText="Hủy"
                              okButtonProps={{ danger: true }}
                            >
                              <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined style={{ fontSize: '13px' }} />}
                                className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                              />
                            </Popconfirm>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div
                          onClick={() => openEditTask?.(task)}
                          title="Nhấp để xem chi tiết / duyệt"
                          className="font-bold text-sm text-slate-900 leading-snug mb-1 hover:text-blue-600 cursor-pointer transition-colors"
                        >
                          {task.title}
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2.5">
                            {task.description}
                          </p>
                        )}

                        {/* NÚT XEM SẢN PHẨM / LINK DRIVE NẾU CÓ */}
                        {task.submission?.url && (
                          <div className="mb-2.5">
                            <a
                              href={task.submission.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border border-blue-200 transition-colors shadow-2xs max-w-full"
                            >
                              <VideoCameraOutlined className="text-blue-600 shrink-0" />
                              <span className="truncate">🎬 Xem sản phẩm nộp</span>
                              <LinkOutlined className="text-[10px] shrink-0" />
                            </a>
                            {task.submission?.note && (
                              <div
                                className="text-[11px] text-slate-500 italic mt-0.5 truncate"
                                title={task.submission.note}
                              >
                                "{task.submission.note}"
                              </div>
                            )}
                          </div>
                        )}

                        {/* Badges: Priority + Dates + Reviewer & Review Status */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-3">
                          {getPriorityTag(task.priority)}

                          {task.startDate && task.dueDate ? (
                            <Tag
                              icon={<CalendarOutlined />}
                              className="text-[10px] m-0 bg-slate-50 border-slate-200 text-slate-700"
                              title={`Bắt đầu: ${formatDate(task.startDate)} - Hạn: ${formatDate(task.dueDate)}`}
                            >
                              {formatDate(task.startDate)} → {formatDate(task.dueDate)}
                            </Tag>
                          ) : task.startDate ? (
                            <Tag
                              icon={<CalendarOutlined />}
                              className="text-[10px] m-0 bg-emerald-50 border-emerald-200 text-emerald-700"
                              title={`Ngày bắt đầu: ${formatDate(task.startDate)}`}
                            >
                              Bắt đầu: {formatDate(task.startDate)}
                            </Tag>
                          ) : task.dueDate ? (
                            <Tag
                              icon={<CalendarOutlined />}
                              className="text-[10px] m-0 bg-amber-50 border-amber-200 text-amber-700"
                              title={`Hạn chót: ${formatDate(task.dueDate)}`}
                            >
                              Hạn: {formatDate(task.dueDate)}
                            </Tag>
                          ) : null}

                          {/* Review status tags */}
                          {task.status === 'review' && (
                            <Tag color="warning" className="m-0 text-[10px] font-semibold border-amber-300 bg-amber-50 text-amber-800">
                              ⏳ Chờ duyệt{task.reviewer?.name ? `: ${task.reviewer.name}` : ''}
                            </Tag>
                          )}

                          {task.reviewFeedback?.action === 'changes_requested' && (
                            <Tooltip title={`Yêu cầu sửa: ${task.reviewFeedback.comment || ''}`}>
                              <Tag color="error" className="m-0 text-[10px] font-semibold border-rose-300 bg-rose-50 text-rose-700">
                                ⚠️ Cần sửa lại
                              </Tag>
                            </Tooltip>
                          )}
                        </div>

                        {/* Card Footer: Assignee & Left/Right Buttons */}
                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <Avatar size={22} style={{ backgroundColor: '#2563eb', fontSize: '10px' }}>
                              {task.assignee?.name ? task.assignee.name[0].toUpperCase() : '?'}
                            </Avatar>
                            <span className="text-xs text-slate-600 font-medium truncate max-w-[100px]">
                              {task.assignee?.name || 'Chưa giao'}
                            </span>
                          </div>

                          {/* Quick Shift Buttons */}
                          <div className="flex items-center gap-1">
                            <Tooltip title="Chuyển về trước">
                              <Button
                                size="small"
                                shape="circle"
                                disabled={colIdx === 0}
                                icon={<LeftOutlined style={{ fontSize: '10px' }} />}
                                onClick={() => moveTask(task, 'prev')}
                              />
                            </Tooltip>
                            <Tooltip title="Chuyển sang sau">
                              <Button
                                size="small"
                                shape="circle"
                                disabled={colIdx === columns.length - 1}
                                icon={<RightOutlined style={{ fontSize: '10px' }} />}
                                onClick={() => moveTask(task, 'next')}
                              />
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Drop placeholder */}
                {isOver && colTasks.length > 0 && (
                  <div
                    className={`p-3 text-center text-xs font-semibold rounded-xl border-2 border-dashed ${col.borderClass} bg-white/90 text-blue-600 animate-pulse`}
                  >
                    Thả thẻ vào đây...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* MODAL CHỈNH SỬA THÔNG TIN DỰ ÁN TRỰC TIẾP TRÊN KANBAN          */}
      {/* ============================================================== */}
      <Modal
        title={<div className="text-lg font-bold">Chỉnh Sửa Thông Tin Dự Án</div>}
        open={isEditModalOpen}
        onOk={handleSaveProject}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingProject(null);
        }}
        confirmLoading={savingProject}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        width={760}
        centered
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" className="mt-4">
          <Form.Item
            label="Tên dự án"
            name="name"
            rules={[{ required: true, message: 'Vui lòng nhập tên dự án' }]}
          >
            <Input placeholder="Tên dự án" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Mã viết tắt (Code)" name="code">
                <Input placeholder="VD: CRM24, MKT" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Màu nhận diện" name="color">
                <Input type="color" className="h-9 cursor-pointer" />
              </Form.Item>
            </Col>
          </Row>

          {/* Trạng thái dự án & Ngân sách dự kiến trên 1 hàng */}
          <Row gutter={16}>
            <Col span={canViewValue('projects') ? 12 : 24}>
              <Form.Item label="Trạng thái dự án" name="status">
                <Select placeholder="Chọn trạng thái">
                  <Select.Option value="active">🟢 Đang triển khai (Active)</Select.Option>
                  <Select.Option value="planning">🔵 Lên kế hoạch (Planning)</Select.Option>
                  <Select.Option value="on_hold">🟡 Tạm dừng (On Hold)</Select.Option>
                  <Select.Option value="completed">🟣 Đã hoàn tất (Completed)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            {canViewValue('projects') && (
              <Col span={12}>
                <Form.Item label="Ngân sách dự kiến (VND)" name="budget">
                  <InputNumber
                    className="w-full"
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                    placeholder="100,000,000"
                  />
                </Form.Item>
              </Col>
            )}
          </Row>

          {/* Quản lý dự án & Người giám sát */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label={
                  <span className="flex items-center gap-1 font-semibold text-slate-800">
                    <CrownOutlined className="text-amber-500" />
                    Quản lý dự án (PM)
                  </span>
                }
                name="manager"
                tooltip="Người chịu trách nhiệm chính điều phối tiến độ và phân công công việc"
                rules={[{ required: true, message: 'Vui lòng chọn Quản lý dự án' }]}
              >
                <Select
                  placeholder="Chọn Quản lý dự án"
                  showSearch
                  optionFilterProp="children"
                >
                  {users.map((u) => {
                    const dept = u.departmentId?.name || (typeof u.department === 'string' ? u.department : '') || 'Nhân sự';
                    return (
                      <Select.Option key={u._id} value={u._id}>
                        👑 {u.name} ({dept})
                      </Select.Option>
                    );
                  })}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label={
                  <span className="flex items-center gap-1 font-semibold text-slate-800">
                    <SafetyCertificateOutlined className="text-purple-500" />
                    Người giám sát (Supervisor)
                  </span>
                }
                name="supervisor"
                tooltip="Người theo dõi, giám sát chất lượng, thẩm định và đôn đốc tiến độ"
              >
                <Select
                  placeholder="Chọn Người giám sát (nếu có)"
                  showSearch
                  allowClear
                  optionFilterProp="children"
                >
                  {users.map((u) => {
                    const dept = u.departmentId?.name || (typeof u.department === 'string' ? u.department : '') || 'Nhân sự';
                    return (
                      <Select.Option key={u._id} value={u._id}>
                        🛡️ {u.name} ({dept})
                      </Select.Option>
                    );
                  })}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* Hợp đồng triển khai liên kết */}
          {can('contracts', 'view') && (
            <Form.Item
              label="Hợp đồng triển khai liên kết"
              name="contracts"
              tooltip="Chọn các hợp đồng mà dự án này đang triển khai (có thể chọn nhiều hợp đồng)"
            >
              <Select
                mode="multiple"
                placeholder="Chọn hợp đồng liên kết (Không bắt buộc)"
                allowClear
                showSearch
                optionFilterProp="children"
                maxTagCount="responsive"
              >
                {contracts.map((c) => (
                  <Select.Option key={c._id} value={c._id}>
                    <div className="flex items-center gap-2">
                      <DollarOutlined className="text-blue-600" />
                      <span className="font-semibold text-blue-700">[{c.code}]</span>
                      <span className="truncate">{c.title}</span>
                      {(c.partner?.name || c.partnerName) && (
                        <span className="text-xs text-slate-400">({c.partner?.name || c.partnerName})</span>
                      )}
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {/* Phân công phòng ban liên quan */}
          <Form.Item
            label="Phòng ban tham gia dự án"
            name="departments"
            tooltip="Chọn các phòng ban phối hợp thực hiện dự án này"
          >
            <Select
              mode="multiple"
              placeholder="Chọn phòng ban liên quan (VD: Team Web, Team Media)"
              allowClear
            >
              {departments.map((d) => (
                <Select.Option key={d._id} value={d._id}>
                  🏢 {d.name} {d.parent ? `(${d.parent.name})` : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* Thành viên tham gia */}
          <Form.Item
            label="Thành viên tham gia dự án"
            name="members"
            tooltip={
              editSelectedDeptIds.length > 0
                ? 'Chỉ hiển thị nhân viên thuộc các phòng ban đã chọn ở trên'
                : 'Chọn các thành viên tham gia'
            }
          >
            <Select
              mode="multiple"
              placeholder={
                editSelectedDeptIds.length > 0
                  ? 'Chọn nhân viên từ các phòng ban trên'
                  : 'Chọn thành viên'
              }
              allowClear
              optionFilterProp="children"
            >
              {editProjectSelectableUsers.map((u) => {
                const deptName =
                  u.departmentId?.name ||
                  (typeof u.department === 'string' ? u.department : '') ||
                  'Nhân viên';
                return (
                  <Select.Option key={u._id} value={u._id}>
                    {u.name} ({deptName})
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>

          <Form.Item label="Mô tả dự án" name="description">
            <TextArea rows={3} placeholder="Mục tiêu, phạm vi dự án..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
