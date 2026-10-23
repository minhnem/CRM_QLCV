import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Progress,
  Tag,
  Avatar,
  Badge,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Popconfirm,
  Empty,
  message,
  Spin,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  ProjectOutlined,
  TeamOutlined,
  DeleteOutlined,
  EditOutlined,
  ApartmentOutlined,
  CheckSquareOutlined,
  CrownOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  DollarOutlined,
  ReloadOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { projectApi, departmentApi, userApi, contractApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';

const { TextArea } = Input;

export const Projects = () => {
  const { user } = useAuth();
  const { can, canViewValue } = usePermission();
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // Bộ lọc tìm kiếm & hợp đồng
  const [search, setSearch] = useState('');
  const [selectedContract, setSelectedContract] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  // Watch selected departments to filter member options
  const selectedDeptIds = Form.useWatch('departments', form) || [];

  const projectSelectableUsers = React.useMemo(() => {
    if (selectedDeptIds && selectedDeptIds.length > 0) {
      const allowedUserIds = new Set();
      selectedDeptIds.forEach((deptId) => {
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
  }, [selectedDeptIds, departments, users]);

  useEffect(() => {
    if (selectedDeptIds && selectedDeptIds.length > 0) {
      const currentMembers = form.getFieldValue('members') || [];
      const validMembers = currentMembers.filter((mId) =>
        projectSelectableUsers.some((u) => u._id.toString() === mId.toString())
      );
      if (validMembers.length !== currentMembers.length) {
        form.setFieldsValue({ members: validMembers });
      }
    }
  }, [selectedDeptIds, projectSelectableUsers, form]);

  const navigate = useNavigate();
  const { openCreateTask } = useOutletContext();

  const fetchInitialData = async () => {
    try {
      const canViewContracts = can('contracts', 'view');
      const canViewDepts = can('departments', 'view');

      const [projRes, deptRes, userRes, contractRes] = await Promise.all([
        projectApi.getAll().catch((err) => ({ data: { success: false, projects: [] } })),
        canViewDepts
          ? departmentApi.getAll().catch(() => ({ data: { success: false, departments: [] } }))
          : Promise.resolve({ data: { success: true, departments: [] } }),
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
      console.error('Failed to load project data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Lọc danh sách dự án tức thì theo Từ khóa, Hợp đồng, Trạng thái, Phòng ban
  const filteredProjects = React.useMemo(() => {
    return projects.filter((p) => {
      // 1. Tìm kiếm theo tên, mã, mô tả, PM, hoặc tên hợp đồng
      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(term);
        const matchCode = (p.code || '').toLowerCase().includes(term);
        const matchDesc = (p.description || '').toLowerCase().includes(term);
        const matchPM = (p.manager?.name || p.owner?.name || '').toLowerCase().includes(term);
        const matchSupervisor = (p.supervisor?.name || '').toLowerCase().includes(term);
        const matchContract = (p.contracts || []).some(
          (c) =>
            (c.code || '').toLowerCase().includes(term) ||
            (c.title || '').toLowerCase().includes(term) ||
            (c.partner?.name || c.partnerName || '').toLowerCase().includes(term)
        );

        if (!matchName && !matchCode && !matchDesc && !matchPM && !matchSupervisor && !matchContract) {
          return false;
        }
      }

      // 2. Lọc theo hợp đồng
      if (selectedContract && selectedContract !== 'all') {
        if (selectedContract === 'none') {
          // Dự án nội bộ / Chưa gán hợp đồng
          if (p.contracts && p.contracts.length > 0) return false;
        } else {
          const linkedContracts = (p.contracts || []).map((c) => (c._id || c).toString());
          if (!linkedContracts.includes(selectedContract.toString())) return false;
        }
      }

      // 3. Lọc theo trạng thái
      if (selectedStatus && selectedStatus !== 'all') {
        if (p.status !== selectedStatus) return false;
      }

      // 4. Lọc theo phòng ban
      if (selectedDepartment && selectedDepartment !== 'all') {
        const deptIds = (p.departments || []).map((d) => (d._id || d).toString());
        if (!deptIds.includes(selectedDepartment.toString())) return false;
      }

      return true;
    });
  }, [projects, search, selectedContract, selectedStatus, selectedDepartment]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedContract('all');
    setSelectedStatus('all');
    setSelectedDepartment('all');
  };

  const handleOpenCreate = () => {
    setEditingProject(null);
    form.resetFields();
    form.setFieldsValue({
      color: '#2563eb',
      status: 'active',
      budget: 0,
      manager: user?._id,
      supervisor: undefined,
      contracts: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingProject(p);
    form.setFieldsValue({
      name: p.name,
      code: p.code,
      status: p.status || 'active',
      description: p.description,
      budget: p.budget || 0,
      color: p.color || '#2563eb',
      manager: (p.manager && (p.manager._id || p.manager)) || (p.owner && (p.owner._id || p.owner)),
      supervisor: p.supervisor && (p.supervisor._id || p.supervisor),
      departments: (p.departments || []).map((d) => d._id || d),
      members: (p.members || []).map((m) => m._id || m),
      contracts: (p.contracts || []).map((c) => c._id || c),
    });
    setIsModalOpen(true);
  };

  const handleSaveProject = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

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

      if (editingProject) {
        const res = await projectApi.update(editingProject._id, payload);
        if (res.data.success) {
          message.success('Cập nhật thông tin dự án thành công!');
          setIsModalOpen(false);
          setEditingProject(null);
          form.resetFields();
          fetchInitialData();
        }
      } else {
        const res = await projectApi.create(payload);
        if (res.data.success) {
          message.success('Khởi tạo dự án mới thành công!');
          setIsModalOpen(false);
          form.resetFields();
          fetchInitialData();
        }
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Không thể lưu dự án.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await projectApi.delete(id);
      message.success('Đã xóa dự án thành công');
      fetchInitialData();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể xóa dự án.');
    }
  };

  const getStatusTag = (status) => {
    switch (status) {
      case 'active':
        return <Tag color="success">Đang triển khai</Tag>;
      case 'planning':
        return <Tag color="processing">Lên kế hoạch</Tag>;
      case 'on_hold':
        return <Tag color="warning">Tạm dừng</Tag>;
      case 'completed':
        return <Tag color="purple">Đã hoàn tất</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-0">
              Quản Lý Dự Án
            </h1>
            <Badge
              count={filteredProjects.length}
              overflowCount={999}
              style={{ backgroundColor: '#2563eb' }}
            />
          </div>
          <p className="text-slate-500 text-sm mt-1 mb-0">
            Thiết lập dự án riêng, gán các phòng ban/thành viên liên quan và theo dõi phân công công việc
          </p>
        </div>

        {can('projects', 'create') && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-700 font-semibold shadow-sm"
          >
            Tạo dự án mới
          </Button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <Card size="small" className="border-slate-200 shadow-2xs">
        <Row gutter={[12, 12]} align="middle">
          {/* Ô Tìm Kiếm */}
          <Col xs={24} sm={12} lg={8}>
            <Input
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm theo tên dự án, mã dự án, mô tả, PM..."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </Col>

          {/* Lọc Theo Hợp Đồng (chỉ hiện khi có quyền xem hợp đồng) */}
          {can('contracts', 'view') && (
            <Col xs={12} sm={6} lg={5}>
              <Select
                className="w-full"
                placeholder="Lọc theo hợp đồng"
                value={selectedContract}
                onChange={setSelectedContract}
                showSearch
                optionFilterProp="children"
              >
                <Select.Option value="all">
                  <span className="font-medium text-slate-700">Tất cả hợp đồng</span>
                </Select.Option>
                <Select.Option value="none">
                  <span className="text-slate-500 italic">Dự án nội bộ / Chưa gán HĐ</span>
                </Select.Option>
                {contracts.map((c) => (
                  <Select.Option key={c._id} value={c._id}>
                    <div className="flex items-center gap-1.5 truncate">
                      <DollarOutlined className="text-blue-600 shrink-0" />
                      <span className="font-semibold text-blue-700">[{c.code}]</span>
                      <span className="truncate">{c.title}</span>
                      {(c.partner?.name || c.partnerName) && (
                        <span className="text-xs text-slate-400">({c.partner?.name || c.partnerName})</span>
                      )}
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Col>
          )}

          {/* Lọc Theo Trạng Thái */}
          <Col xs={12} sm={6} lg={4}>
            <Select
              className="w-full"
              placeholder="Trạng thái"
              value={selectedStatus}
              onChange={setSelectedStatus}
            >
              <Select.Option value="all">Tất cả trạng thái</Select.Option>
              <Select.Option value="active">🟢 Đang triển khai</Select.Option>
              <Select.Option value="planning">🔵 Lên kế hoạch</Select.Option>
              <Select.Option value="on_hold">🟡 Tạm dừng</Select.Option>
              <Select.Option value="completed">🟣 Đã hoàn tất</Select.Option>
            </Select>
          </Col>

          {/* Lọc Theo Phòng Ban */}
          {can('departments', 'view') && (
            <Col xs={12} sm={6} lg={4}>
              <Select
                className="w-full"
                placeholder="Phòng ban"
                value={selectedDepartment}
                onChange={setSelectedDepartment}
                showSearch
                optionFilterProp="children"
              >
                <Select.Option value="all">Tất cả phòng ban</Select.Option>
                {departments.map((d) => (
                  <Select.Option key={d._id} value={d._id}>
                    <div className="flex items-center gap-1.5">
                      <ApartmentOutlined style={{ color: d.color || '#2563eb' }} />
                      <span>{d.name}</span>
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Col>
          )}

          {/* Nút Làm Mới */}
          <Col xs={12} sm={6} lg={3}>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleResetFilters}
              className="w-full"
            >
              Làm mới
            </Button>
          </Col>
        </Row>

        {/* Thanh trạng thái bộ lọc nếu đang áp dụng lọc */}
        {(search || selectedContract !== 'all' || selectedStatus !== 'all' || selectedDepartment !== 'all') && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <FilterOutlined className="text-blue-600" />
              Đang hiển thị <b>{filteredProjects.length}</b> / <b>{projects.length}</b> dự án phù hợp
            </span>
            <Button type="link" size="small" onClick={handleResetFilters} className="p-0 text-blue-600 text-xs">
              Bỏ lọc tất cả
            </Button>
          </div>
        )}
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spin size="large" tip="Đang tải danh sách dự án..." />
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="py-12 text-center border-slate-200">
          <Empty
            description={
              projects.length === 0
                ? 'Chưa có dự án nào được tạo'
                : 'Không tìm thấy dự án nào phù hợp với bộ lọc'
            }
          >
            {projects.length > 0 && (
              <Button type="primary" onClick={handleResetFilters} className="mt-2">
                Xóa bộ lọc để xem tất cả
              </Button>
            )}
          </Empty>
        </Card>
      ) : (
        <Row gutter={[20, 20]}>
          {filteredProjects.map((p) => {
            const progress = p.stats?.progress || 0;
            return (
              <Col xs={24} md={12} lg={8} key={p._id}>
                <Card
                  className="h-full hover:shadow-md transition-shadow flex flex-col justify-between"
                  styles={{
                    body: {
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      justifyContent: 'space-between',
                    },
                  }}
                >
                  <div>
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0"
                          style={{ backgroundColor: p.color || '#2563eb' }}
                        >
                          {p.code ? p.code.slice(0, 3) : 'PRJ'}
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-slate-900 leading-snug">
                            {p.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1">
                            <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                              {p.code}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="inline-flex items-center gap-1 text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                              <CrownOutlined className="text-amber-500" />
                              PM: {p.manager?.name || p.owner?.name || 'Chưa gán'}
                            </span>
                            {p.supervisor && (
                              <span className="inline-flex items-center gap-1 text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                                <SafetyCertificateOutlined className="text-purple-500" />
                                Giám sát: {p.supervisor.name}
                              </span>
                            )}
                            {p.budget > 0 && canViewValue('projects') && (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                <DollarOutlined className="text-emerald-500" />
                                {p.budget.toLocaleString('vi-VN')} đ
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons on card header */}
                      <div className="flex items-center gap-1">
                        {can('projects', 'edit') && (
                          <Tooltip title="Chỉnh sửa thông tin dự án">
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => handleOpenEdit(p)}
                              className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            />
                          </Tooltip>
                        )}

                        {can('projects', 'delete') && (
                          <Popconfirm
                            title="Xóa dự án"
                            description="Bạn có chắc muốn xóa dự án này cùng các công việc của nó?"
                            onConfirm={() => handleDelete(p._id)}
                            okText="Xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                          >
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                            />
                          </Popconfirm>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {p.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                        {p.description}
                      </p>
                    )}

                    {/* Participating Departments */}
                    {p.departments && p.departments.length > 0 && (
                      <div className="mb-3">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <ApartmentOutlined /> Phòng ban liên quan:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {p.departments.map((dept) => (
                            <Tag key={dept._id} color={dept.color || 'blue'} className="text-[11px] font-medium m-0">
                              {dept.name}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Linked Contracts (chỉ hiển thị nếu có quyền xem hợp đồng) */}
                    {can('contracts', 'view') && p.contracts && p.contracts.length > 0 && (
                      <div className="mb-3 w-full max-w-full">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>Hợp đồng liên kết ({p.contracts.length}):</span>
                        </div>
                        <div className="space-y-1 w-full max-w-full max-h-32 overflow-y-auto pr-1">
                          {p.contracts.map((c) => {
                            const partnerStr = c.partnerName || c.partner?.name || '';
                            const fullLabel = `[${c.code}] ${c.title}${partnerStr ? ` (${partnerStr})` : ''}`;

                            return (
                              <Tooltip key={c._id} title={fullLabel} placement="topLeft">
                                <div
                                  className="w-full max-w-full bg-blue-50/70 hover:bg-blue-100/90 border border-blue-200 text-slate-700 text-[11px] font-medium py-1 px-2 rounded-md cursor-pointer transition-colors block overflow-hidden"
                                  onClick={() => navigate('/contracts')}
                                >
                                  <div className="truncate w-full leading-tight">
                                    <span className="font-bold text-blue-700 mr-1">[{c.code}]</span>
                                    <span className="text-slate-800 font-medium">{c.title}</span>
                                    {partnerStr && (
                                      <span className="text-slate-500 font-normal ml-1">
                                        ({partnerStr})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Progress */}
                    <div className="space-y-1.5 my-3">
                      <div className="flex justify-between text-xs font-semibold text-slate-600">
                        <span>Tiến độ công việc</span>
                        <span className="font-bold text-slate-800">{progress}%</span>
                      </div>
                      <Progress
                        percent={progress}
                        strokeColor={p.color || '#2563eb'}
                        showInfo={false}
                      />
                      <div className="text-[11px] text-slate-400">
                        Đã xong {p.stats?.completedTasks || 0} / {p.stats?.totalTasks || 0} công việc
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Status, Members & Quick Actions */}
                  <div className="pt-3 border-t border-slate-100 mt-auto space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>{getStatusTag(p.status)}</div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <TeamOutlined />
                        <span>{p.members?.length || 1} nhân sự</span>
                      </div>
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="small"
                        icon={<CheckSquareOutlined />}
                        className="flex-1 text-xs font-medium"
                        onClick={() => navigate(`/tasks?project=${p._id}`)}
                      >
                        Kanban việc
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        icon={<PlusOutlined />}
                        className="flex-1 text-xs"
                        onClick={() => openCreateTask({ projectId: p._id })}
                      >
                        Thêm tác vụ
                      </Button>
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Modal Tạo & Sửa Dự Án */}
      <Modal
        title={
          <div className="text-lg font-bold">
            {editingProject ? 'Chỉnh Sửa Thông Tin Dự Án' : 'Khởi Tạo Dự Án Mới'}
          </div>
        }
        open={isModalOpen}
        onOk={handleSaveProject}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingProject(null);
        }}
        confirmLoading={saving}
        okText={editingProject ? 'Lưu thay đổi' : 'Tạo dự án'}
        cancelText="Hủy"
        width={760}
        centered
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4" initialValues={{ color: '#2563eb', status: 'active' }}>
          <Form.Item
            label="Tên dự án"
            name="name"
            rules={[{ required: true, message: 'Vui lòng nhập tên dự án' }]}
          >
            <Input placeholder="VD: Triển khai CRM, Chiến dịch Marketing Q4..." autoFocus />
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
                  allowClear
                  optionFilterProp="filterText"
                  optionLabelProp="label"
                >
                  {users.map((u) => (
                    <Select.Option
                      key={u._id}
                      value={u._id}
                      label={`👑 ${u.name}`}
                      filterText={`${u.name} ${u.email}`}
                    >
                      <div className="flex items-center justify-between py-0.5">
                        <span className="font-medium text-slate-800">👑 {u.name}</span>
                        <span className="text-xs text-slate-400">{u.email}</span>
                      </div>
                    </Select.Option>
                  ))}
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
                tooltip="Người theo dõi, giám sát chất lượng, thẩm định và đôn đốc tiến độ (Ban Giám Đốc, QA/QC...)"
              >
                <Select
                  placeholder="Chọn Người giám sát (nếu có)"
                  showSearch
                  allowClear
                  optionFilterProp="filterText"
                  optionLabelProp="label"
                >
                  {users.map((u) => (
                    <Select.Option
                      key={u._id}
                      value={u._id}
                      label={`🛡️ ${u.name}`}
                      filterText={`${u.name} ${u.email}`}
                    >
                      <div className="flex items-center justify-between py-0.5">
                        <span className="font-medium text-slate-800">🛡️ {u.name}</span>
                        <span className="text-xs text-slate-400">{u.email}</span>
                      </div>
                    </Select.Option>
                  ))}
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
              selectedDeptIds.length > 0
                ? 'Chỉ hiển thị nhân viên thuộc các phòng ban đã chọn ở trên'
                : 'Chọn các thành viên tham gia'
            }
          >
            <Select
              mode="multiple"
              placeholder={
                selectedDeptIds.length > 0
                  ? 'Chọn nhân viên từ các phòng ban trên'
                  : 'Chọn thành viên'
              }
              allowClear
              showSearch
              optionFilterProp="filterText"
              optionLabelProp="label"
            >
              {projectSelectableUsers.map((u) => (
                <Select.Option
                  key={u._id}
                  value={u._id}
                  label={u.name}
                  filterText={`${u.name} ${u.email}`}
                >
                  <div className="flex items-center justify-between py-0.5">
                    <span className="font-medium text-slate-800">{u.name}</span>
                    <span className="text-xs text-slate-400">{u.email}</span>
                  </div>
                </Select.Option>
              ))}
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
