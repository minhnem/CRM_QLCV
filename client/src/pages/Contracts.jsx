import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Input,
  Select,
  Tag,
  Avatar,
  Badge,
  Progress,
  Table,
  Empty,
  Spin,
  Tooltip,
  Popconfirm,
  message,
  Segmented,
  Row,
  Col,
  Space,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  DollarOutlined,
  BankOutlined,
  ProjectOutlined,
  ApartmentOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  RightOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
  ExclamationCircleOutlined,
  HolderOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { contractApi, projectApi, departmentApi, userApi } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { ContractModal, STAGES_CONFIG } from '../components/contracts/ContractModal';
import { ContractDetailDrawer } from '../components/contracts/ContractDetailDrawer';

export const Contracts = () => {
  const { currentWorkspace } = useAuth();
  const { can, canViewValue } = usePermission();

  // State dữ liệu
  const [contracts, setContracts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Bộ lọc
  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [onlyExpiring, setOnlyExpiring] = useState(false);

  // Chế độ xem: 'kanban' | 'table'
  const [viewMode, setViewMode] = useState('kanban');

  // Modal & Drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Drag & Drop State
  const [draggedContract, setDraggedContract] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  // Tải danh sách hợp đồng
  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (selectedStage) params.stage = selectedStage;
      if (selectedProject) params.project = selectedProject;
      if (selectedDepartment) params.department = selectedDepartment;
      if (onlyExpiring) params.expiring = '30';

      const [resContracts, resSummary] = await Promise.all([
        contractApi.getAll(params),
        contractApi.getSummary().catch(() => ({ data: { success: false, summary: null } })),
      ]);

      if (resContracts.data.success) {
        setContracts(resContracts.data.contracts || []);
      }
      if (resSummary.data.success) {
        setSummary(resSummary.data.summary);
      }
    } catch (err) {
      console.error('Error fetching contracts:', err);
      message.error('Không thể tải danh sách hợp đồng');
    } finally {
      setLoading(false);
    }
  }, [search, selectedStage, selectedProject, selectedDepartment, onlyExpiring]);

  // Tải dữ liệu phụ trợ (Projects, Departments, Users)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const canViewProjects = can('projects', 'view');
        const canViewDepts = can('departments', 'view');

        const [resProj, resDept, resUser] = await Promise.all([
          canViewProjects
            ? projectApi.getAll().catch(() => ({ data: { success: false, projects: [] } }))
            : Promise.resolve({ data: { success: true, projects: [] } }),
          canViewDepts
            ? departmentApi.getAll().catch(() => ({ data: { success: false, departments: [] } }))
            : Promise.resolve({ data: { success: true, departments: [] } }),
          userApi.getAll().catch(() => ({ data: { success: false, users: [] } })),
        ]);
        if (resProj.data?.success) setProjects(resProj.data.projects || []);
        if (resDept.data?.success) setDepartments(resDept.data.departments || []);
        if (resUser.data?.success) setUsers(resUser.data.users || []);
      } catch (err) {
        console.error('Error fetching metadata:', err);
      }
    };

    fetchMetadata();
  }, [currentWorkspace]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // Lắng nghe Socket.IO cập nhật real-time
  useEffect(() => {
    const socket = getSocket();

    const handleContractChange = () => {
      fetchContracts();
    };

    socket.on('contract:changed', handleContractChange);
    socket.on('contract:created', handleContractChange);
    socket.on('contract:updated', handleContractChange);
    socket.on('contract:stageChanged', handleContractChange);
    socket.on('contract:deleted', handleContractChange);

    return () => {
      socket.off('contract:changed', handleContractChange);
      socket.off('contract:created', handleContractChange);
      socket.off('contract:updated', handleContractChange);
      socket.off('contract:stageChanged', handleContractChange);
      socket.off('contract:deleted', handleContractChange);
    };
  }, [fetchContracts]);

  // Mở Drawer chi tiết
  const handleOpenDetail = (contract) => {
    setSelectedContractId(contract._id);
    setIsDrawerOpen(true);
  };

  // Mở Modal chỉnh sửa
  const handleOpenEdit = (contract) => {
    setEditingContract(contract);
    setIsModalOpen(true);
  };

  // Chuyển giai đoạn tiếp theo nhanh trong Kanban
  const handleQuickAdvanceStage = async (e, contract) => {
    e.stopPropagation();
    const stagesOrder = [
      'draft',
      'pending_sign',
      'active',
      'settlement',
      'completed',
    ];
    const currentIndex = stagesOrder.indexOf(contract.stage);
    if (currentIndex >= 0 && currentIndex < stagesOrder.length - 1) {
      const nextStage = stagesOrder[currentIndex + 1];
      try {
        await contractApi.updateStage(contract._id, nextStage);
        message.success(
          `Đã chuyển sang: ${STAGES_CONFIG.find((s) => s.key === nextStage)?.label}`
        );
        fetchContracts();
      } catch (err) {
        console.error(err);
        message.error('Không thể chuyển giai đoạn');
      }
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e, contract) => {
    setDraggedContract(contract);
    e.dataTransfer.setData('text/plain', contract._id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, stageKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stageKey) {
      setDragOverStage(stageKey);
    }
  };

  const handleDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverStage(null);
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    setDragOverStage(null);

    const contractId = e.dataTransfer.getData('text/plain') || draggedContract?._id;
    if (!contractId) return;

    const contractToMove = contracts.find((c) => c._id === contractId);
    if (!contractToMove || contractToMove.stage === targetStage) return;

    const targetConfig = STAGES_CONFIG.find((s) => s.key === targetStage);

    // Optimistic UI update
    setContracts((prev) =>
      prev.map((c) => (c._id === contractId ? { ...c, stage: targetStage } : c))
    );

    try {
      await contractApi.updateStage(contractId, targetStage);
      message.success(`Đã chuyển sang: ${targetConfig?.label || targetStage}`);
      const resSum = await contractApi.getSummary();
      if (resSum.data.success) {
        setSummary(resSum.data.summary);
      }
    } catch (err) {
      console.error('Failed to move contract:', err);
      message.error('Không thể cập nhật giai đoạn hợp đồng');
      fetchContracts();
    } finally {
      setDraggedContract(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedContract(null);
    setDragOverStage(null);
  };

  // Xóa hợp đồng
  const handleDelete = async (id) => {
    try {
      await contractApi.delete(id);
      message.success('Đã xóa hợp đồng');
      fetchContracts();
    } catch (err) {
      console.error(err);
      message.error('Không thể xóa hợp đồng');
    }
  };

  // Phân loại hợp đồng theo từng giai đoạn cho Kanban
  const contractsByStage = React.useMemo(() => {
    const map = {};
    STAGES_CONFIG.forEach((s) => {
      map[s.key] = [];
    });
    contracts.forEach((c) => {
      if (map[c.stage]) {
        map[c.stage].push(c);
      } else {
        map['draft'].push(c);
      }
    });
    return map;
  }, [contracts]);

  // Tìm hợp đồng đang chọn cho Drawer
  const activeContractForDrawer = React.useMemo(() => {
    return contracts.find((c) => c._id === selectedContractId) || null;
  }, [contracts, selectedContractId]);

  // Cột cho Table View
  const tableColumns = [
    {
      title: 'Mã HĐ',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (text, record) => (
        <span
          className="font-mono font-bold text-blue-600 hover:underline cursor-pointer"
          onClick={() => handleOpenDetail(record)}
        >
          {text}
        </span>
      ),
    },
    {
      title: 'Hợp Đồng & Khách Hàng',
      key: 'title',
      render: (_, record) => {
        const projList = Array.isArray(record.projects) && record.projects.length > 0
          ? record.projects
          : (record.project ? [record.project] : []);
        const deptList = Array.isArray(record.departments) && record.departments.length > 0
          ? record.departments
          : (record.department ? [record.department] : []);

        return (
          <div>
            <div
              className="font-bold text-slate-800 text-sm hover:text-blue-600 cursor-pointer"
              onClick={() => handleOpenDetail(record)}
            >
              {record.title}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span className="font-medium text-slate-700">
                <BankOutlined /> {record.partner?.name}
              </span>
              {record.partner?.taxCode && (
                <span className="text-slate-400">MST: {record.partner.taxCode}</span>
              )}
            </div>
            {(projList.length > 0 || deptList.length > 0) && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {projList.map((p) => (
                  <Tag key={p._id || p} color="geekblue" className="text-2xs px-1.5 py-0 flex items-center gap-1">
                    <ProjectOutlined style={{ color: p.color }} /> {p.name}
                  </Tag>
                ))}
                {deptList.map((d) => (
                  <Tag key={d._id || d} color="purple" className="text-2xs px-1.5 py-0 flex items-center gap-1">
                    <ApartmentOutlined style={{ color: d.color }} /> {d.name}
                  </Tag>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Loại Hợp Đồng',
      dataIndex: 'contractType',
      key: 'contractType',
      width: 160,
      render: (type) => (
        <Tag color="cyan" className="font-medium">
          {type || 'Hợp đồng'}
        </Tag>
      ),
    },
    {
      title: 'Giá Trị & Thực Thu',
      key: 'value',
      width: 180,
      render: (_, record) => {
        if (!canViewValue('contracts') || record.valueMasked) {
          return (
            <Tooltip title="Giá trị được bảo mật theo phân quyền của bạn">
              <span className="font-mono text-slate-400 font-semibold">****** VNĐ</span>
            </Tooltip>
          );
        }
        const total = Number(record.totalValue) || 0;
        const paid = Number(record.paidAmount) || 0;
        const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
        return (
          <div>
            <div className="font-black text-slate-800 text-sm">
              {total.toLocaleString('vi-VN')} VNĐ
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Progress
                percent={pct}
                size="small"
                status={pct >= 100 ? 'success' : 'normal'}
                className="mb-0 flex-1"
              />
            </div>
            <div className="text-2xs text-slate-400 mt-0.5">
              Đã thu: {paid.toLocaleString('vi-VN')} VNĐ
            </div>
          </div>
        );
      },
    },
    {
      title: 'Giai Đoạn',
      dataIndex: 'stage',
      key: 'stage',
      width: 170,
      render: (stage) => {
        const conf = STAGES_CONFIG.find((s) => s.key === stage) || STAGES_CONFIG[0];
        return (
          <Tag
            style={{
              color: conf.color,
              backgroundColor: conf.bg,
              borderColor: conf.border,
            }}
            className="font-medium px-2 py-0.5"
          >
            {conf.label}
          </Tag>
        );
      },
    },
    {
      title: 'Thời Hạn',
      key: 'dates',
      width: 140,
      render: (_, record) => {
        const end = record.endDate ? dayjs(record.endDate) : null;
        const isExpiring =
          end && end.diff(dayjs(), 'day') <= 30 && end.diff(dayjs(), 'day') >= 0;
        const isExpired = end && end.isBefore(dayjs());
        return (
          <div className="text-xs">
            {record.signDate && (
              <div className="text-slate-400">
                Ký: {dayjs(record.signDate).format('DD/MM/YYYY')}
              </div>
            )}
            <div
              className={`font-medium ${
                isExpired
                  ? 'text-red-600 font-bold'
                  : isExpiring
                  ? 'text-amber-600 font-bold'
                  : 'text-slate-700'
              }`}
            >
              Hết hạn: {end ? end.format('DD/MM/YYYY') : '—'}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Phụ Trách',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      width: 140,
      render: (user) =>
        user ? (
          <div className="flex items-center gap-1.5">
            <Avatar size="small" style={{ backgroundColor: '#2563eb' }}>
              {user.name?.[0]?.toUpperCase()}
            </Avatar>
            <span className="text-xs text-slate-700 truncate max-w-[90px]">
              {user.name}
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      title: 'Thao Tác',
      key: 'actions',
      width: 110,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleOpenDetail(record)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Xóa hợp đồng?"
            onConfirm={() => handleDelete(record._id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-0">
              Quản Lý Hợp Đồng (CRM Deals)
            </h1>
            <Badge
              count={contracts.length}
              overflowCount={999}
              style={{ backgroundColor: '#2563eb' }}
            />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-0">
            Theo dõi đường ống đàm phán hợp đồng, tiến độ dòng tiền và hạn mức thanh toán chuẩn Bitrix24
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              {
                value: 'kanban',
                icon: <AppstoreOutlined />,
                label: 'Kanban Pipeline',
              },
              {
                value: 'table',
                icon: <UnorderedListOutlined />,
                label: 'Danh Sách',
              },
            ]}
            className="p-1 bg-slate-100 font-medium"
          />

          {can('contracts', 'create') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingContract(null);
                setIsModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 font-semibold shadow-sm"
            >
              Tạo Hợp Đồng
            </Button>
          )}
        </div>
      </div>

      {/* KPI Overview Cards (Top Summary) */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-2xs border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Tổng Doanh Thu Hợp Đồng
                </div>
                <div className="text-xl font-black text-slate-800 mt-1">
                  {summary?.valueMasked || !canViewValue('contracts') ? (
                    <Tooltip title="Giá trị được bảo mật theo phân quyền của bạn">
                      <span className="font-mono text-slate-400">****** VNĐ</span>
                    </Tooltip>
                  ) : (
                    <>
                      {(summary?.totalValue || 0).toLocaleString('vi-VN')}{' '}
                      <span className="text-xs font-normal text-slate-500">VNĐ</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-blue-600 font-medium mt-1">
                  {summary?.totalContracts || 0} hợp đồng trên hệ thống
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
                <DollarOutlined />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-2xs border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Thực Thu (Đã Thanh Toán)
                </div>
                <div className="text-xl font-black text-emerald-600 mt-1">
                  {summary?.valueMasked || !canViewValue('contracts') ? (
                    <Tooltip title="Giá trị được bảo mật theo phân quyền của bạn">
                      <span className="font-mono text-slate-400">****** VNĐ</span>
                    </Tooltip>
                  ) : (
                    <>
                      {(summary?.totalPaid || 0).toLocaleString('vi-VN')}{' '}
                      <span className="text-xs font-normal text-slate-500">VNĐ</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-emerald-700 font-medium mt-1">
                  {summary?.totalValue > 0 && !summary?.valueMasked
                    ? `Đạt ${Math.round(((summary?.totalPaid || 0) / summary?.totalValue) * 100)}% kế hoạch`
                    : 'Theo dõi theo tiến độ'}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                <CheckCircleOutlined />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-2xs border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Công Nợ Còn Phải Thu
                </div>
                <div className="text-xl font-black text-amber-600 mt-1">
                  {summary?.valueMasked || !canViewValue('contracts') ? (
                    <Tooltip title="Giá trị được bảo mật theo phân quyền của bạn">
                      <span className="font-mono text-slate-400">****** VNĐ</span>
                    </Tooltip>
                  ) : (
                    <>
                      {(summary?.totalRemaining || 0).toLocaleString('vi-VN')}{' '}
                      <span className="text-xs font-normal text-slate-500">VNĐ</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  Cần theo dõi thu hồi nợ
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shrink-0">
                <ClockCircleOutlined />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            className={`shadow-2xs border-slate-200 hover:shadow-md transition-shadow cursor-pointer ${
              onlyExpiring ? 'border-red-400 bg-red-50/20' : ''
            }`}
            onClick={() => setOnlyExpiring(!onlyExpiring)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Sắp Hết Hạn (30 ngày)
                </div>
                <div className="text-xl font-black text-red-600 mt-1">
                  {summary?.expiringSoonCount || 0}{' '}
                  <span className="text-xs font-normal text-slate-500">hợp đồng</span>
                </div>
                <div className="text-xs text-red-500 font-medium mt-1">
                  {onlyExpiring ? 'Đang lọc danh sách này' : 'Bấm để lọc xem nhanh'}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-xl shrink-0">
                <ExclamationCircleOutlined />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Filter Bar */}
      <Card size="small" className="border-slate-200 shadow-2xs">
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={8} lg={8}>
            <Input
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm theo Mã HĐ, Tên HĐ, Khách hàng, MST..."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Col>

          {can('projects', 'view') && (
            <Col xs={12} sm={5} lg={4}>
              <Select
                className="w-full"
                placeholder="Tất cả dự án"
                allowClear
                value={selectedProject}
                onChange={setSelectedProject}
              >
                {projects.map((p) => (
                  <Select.Option key={p._id} value={p._id}>
                    {p.name}
                  </Select.Option>
                ))}
              </Select>
            </Col>
          )}

          {can('departments', 'view') && (
            <Col xs={12} sm={5} lg={4}>
              <Select
                className="w-full"
                placeholder="Tất cả phòng ban"
                allowClear
                value={selectedDepartment}
                onChange={setSelectedDepartment}
              >
                {departments.map((d) => (
                  <Select.Option key={d._id} value={d._id}>
                    {d.name}
                  </Select.Option>
                ))}
              </Select>
            </Col>
          )}

          {viewMode === 'table' && (
            <Col xs={12} sm={4} lg={4}>
              <Select
                className="w-full"
                placeholder="Tất cả giai đoạn"
                allowClear
                value={selectedStage}
                onChange={setSelectedStage}
              >
                {STAGES_CONFIG.map((s) => (
                  <Select.Option key={s.key} value={s.key}>
                    {s.label}
                  </Select.Option>
                ))}
              </Select>
            </Col>
          )}

          <Col xs={12} sm={4} lg={4}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setSearch('');
                setSelectedStage(null);
                setSelectedProject(null);
                setSelectedDepartment(null);
                setOnlyExpiring(false);
                fetchContracts();
              }}
            >
              Làm mới
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Main Content: Kanban or Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spin size="large" tip="Đang tải danh sách hợp đồng..." />
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN PIPELINE VIEW (Chuẩn Bitrix24 Deals) */
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {STAGES_CONFIG.map((stage) => {
            const stageContracts = contractsByStage[stage.key] || [];
            const stageTotalVal = stageContracts.reduce(
              (sum, c) => sum + (Number(c.totalValue) || 0),
              0
            );

            const isColumnOver = dragOverStage === stage.key;

            return (
              <div
                key={stage.key}
                onDragOver={(e) => handleDragOver(e, stage.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.key)}
                className={`w-80 min-w-[320px] max-w-[320px] rounded-2xl p-3 flex flex-col border shadow-2xs transition-all duration-200 ${
                  isColumnOver
                    ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-400/50 scale-[1.01]'
                    : 'bg-slate-100/70 border-slate-200/80'
                }`}
              >
                {/* Stage Header with Total Money & Count */}
                <div
                  className="rounded-xl p-3 mb-3 border shadow-2xs"
                  style={{
                    backgroundColor: stage.bg,
                    borderColor: stage.border,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="font-bold text-sm tracking-tight flex items-center gap-1.5"
                      style={{ color: stage.color }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.label}
                    </span>
                    <Badge
                      count={stageContracts.length}
                      style={{
                        backgroundColor: stage.color,
                        boxShadow: 'none',
                      }}
                    />
                  </div>

                  {/* Stage Total Money Display (Bitrix24 Signature) */}
                  <div className="text-xs font-bold text-slate-700 flex items-center justify-between pt-1 border-t border-slate-200/50">
                    <span className="text-slate-400 font-normal">Tổng giá trị:</span>
                    <span className="text-sm font-black text-slate-800">
                      {stageTotalVal.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-320px)] pr-1">
                  {/* Drop target indicator when dragging over this column */}
                  {isColumnOver && (
                    <div className="py-2.5 px-3 rounded-xl border-2 border-dashed border-blue-400 bg-blue-100/50 text-blue-700 text-xs font-bold text-center animate-pulse">
                      ⬇ Thả vào "{stage.label}"
                    </div>
                  )}

                  {stageContracts.map((c) => {
                    const total = Number(c.totalValue) || 0;
                    const paid = Number(c.paidAmount) || 0;
                    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                    const end = c.endDate ? dayjs(c.endDate) : null;
                    const daysLeft = end ? end.diff(dayjs(), 'day') : null;
                    const isExpiring = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0;
                    const isExpired = daysLeft !== null && daysLeft < 0;
                    const isCardDragged = draggedContract?._id === c._id;

                    return (
                      <div
                        key={c._id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, c)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleOpenDetail(c)}
                        className={`bg-white rounded-xl p-3.5 border shadow-2xs hover:shadow-md hover:border-blue-400 transition-all cursor-grab active:cursor-grabbing group select-none ${
                          isCardDragged
                            ? 'opacity-30 scale-95 border-dashed border-blue-500 shadow-none'
                            : 'border-slate-200/90'
                        }`}
                      >
                        {/* Top: Grip Handle, Code & Type */}
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <HolderOutlined className="text-slate-300 group-hover:text-slate-500 cursor-grab" />
                            <Tag
                              color="blue"
                              className="font-mono font-bold text-xs px-2 py-0.5 rounded-md"
                            >
                              {c.code}
                            </Tag>
                          </div>
                          <span className="text-xs text-slate-400 truncate max-w-[120px]">
                            {c.contractType || 'Hợp đồng'}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2 mb-1.5 group-hover:text-blue-600 transition-colors">
                          {c.title}
                        </h4>

                        {/* Partner Name */}
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-3 truncate">
                          <BankOutlined className="text-slate-400" />
                          <span className="font-medium text-slate-700 truncate">
                            {c.partner?.name}
                          </span>
                        </div>

                        {/* Money Highlights */}
                        {canViewValue('contracts') && !c.valueMasked ? (
                          <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 mb-3">
                            <div className="flex items-baseline justify-between mb-1">
                              <span className="text-2xs uppercase text-slate-400 font-semibold">
                                Giá trị HĐ:
                              </span>
                              <span className="text-sm font-black text-blue-700">
                                {total.toLocaleString('vi-VN')} VNĐ
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Progress
                                percent={pct}
                                size="small"
                                showInfo={false}
                                strokeColor={pct >= 100 ? '#059669' : '#2563eb'}
                                className="mb-0 flex-1"
                              />
                              <span className="text-2xs font-bold text-slate-500">{pct}%</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 mb-3 flex items-center justify-between">
                            <span className="text-2xs uppercase text-slate-400 font-semibold">
                              Giá trị HĐ:
                            </span>
                            <Tooltip title="Giá trị được bảo mật theo phân quyền của bạn">
                              <span className="font-mono text-slate-400 text-xs font-semibold">****** VNĐ</span>
                            </Tooltip>
                          </div>
                        )}

                        {/* Project / Department Badges */}
                        {(() => {
                          const projList = Array.isArray(c.projects) && c.projects.length > 0
                            ? c.projects
                            : (c.project ? [c.project] : []);
                          const deptList = Array.isArray(c.departments) && c.departments.length > 0
                            ? c.departments
                            : (c.department ? [c.department] : []);

                          if (projList.length === 0 && deptList.length === 0) return null;

                          return (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {projList.map((p) => (
                                <Tag
                                  key={p._id || p}
                                  color="geekblue"
                                  className="text-2xs px-1.5 py-0 flex items-center gap-1"
                                >
                                  <ProjectOutlined style={{ color: p.color }} /> {p.name}
                                </Tag>
                              ))}
                              {deptList.map((d) => (
                                <Tag
                                  key={d._id || d}
                                  color="purple"
                                  className="text-2xs px-1.5 py-0 flex items-center gap-1"
                                >
                                  <ApartmentOutlined style={{ color: d.color }} /> {d.name}
                                </Tag>
                              ))}
                            </div>
                          );
                        })()}

                        {/* Footer: Expiry, Assignee & Quick Move Button */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            {c.assignedTo ? (
                              <Tooltip title={`Phụ trách: ${c.assignedTo.name}`}>
                                <Avatar size={22} style={{ backgroundColor: '#2563eb' }}>
                                  {c.assignedTo.name?.[0]?.toUpperCase()}
                                </Avatar>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Chưa phân công">
                                <Avatar size={22} icon={<UserOutlined />} />
                              </Tooltip>
                            )}

                            {end && (
                              <span
                                className={`text-2xs truncate ${
                                  isExpired
                                    ? 'text-red-600 font-bold'
                                    : isExpiring
                                    ? 'text-amber-600 font-bold'
                                    : 'text-slate-400'
                                }`}
                              >
                                {isExpired
                                  ? 'Quá hạn'
                                  : isExpiring
                                  ? `Còn ${daysLeft} ngày`
                                  : end.format('DD/MM/YY')}
                              </span>
                            )}
                          </div>

                          {/* Quick advance stage button */}
                          {stage.key !== 'completed' && stage.key !== 'cancelled' && (
                            <Tooltip title="Chuyển sang giai đoạn tiếp theo">
                              <Button
                                size="small"
                                type="text"
                                icon={<RightOutlined />}
                                onClick={(e) => handleQuickAdvanceStage(e, c)}
                                className="hover:bg-blue-50 hover:text-blue-600 rounded-lg"
                              />
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {stageContracts.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed border-slate-200/80 rounded-xl text-slate-400 text-xs">
                      Không có hợp đồng nào
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <Card className="border-slate-200 shadow-2xs">
          <Table
            columns={tableColumns}
            dataSource={contracts}
            rowKey="_id"
            pagination={{ pageSize: 15, showSizeChanger: true }}
            size="middle"
          />
        </Card>
      )}

      {/* Modal Tạo / Sửa hợp đồng */}
      <ContractModal
        visible={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingContract(null);
        }}
        onSuccess={fetchContracts}
        contract={editingContract}
        projects={projects}
        departments={departments}
        users={users}
      />

      {/* Drawer Xem chi tiết hợp đồng */}
      <ContractDetailDrawer
        visible={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedContractId(null);
        }}
        contract={activeContractForDrawer}
        onEdit={(contract) => {
          setIsDrawerOpen(false);
          handleOpenEdit(contract);
        }}
        onRefresh={fetchContracts}
      />
    </div>
  );
};
