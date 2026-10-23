import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Tag,
  Avatar,
  Modal,
  Form,
  Input,
  Select,
  Dropdown,
  Drawer,
  Table,
  Badge,
  Progress,
  Tooltip,
  Empty,
  Spin,
  message,
  Popconfirm,
  Tabs,
} from 'antd';
import {
  ApartmentOutlined,
  PlusOutlined,
  BankFilled,
  UserOutlined,
  TeamOutlined,
  EllipsisOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FolderOpenOutlined,
  UnorderedListOutlined,
  NodeIndexOutlined,
  HolderOutlined,
  DownOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { departmentApi, userApi, taskApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { useOutletContext } from 'react-router-dom';
import { getSocket } from '../services/socket';

const { TextArea } = Input;

export const CompanyStructure = () => {
  const [treeData, setTreeData] = useState([]);
  const [flatDepartments, setFlatDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'table'

  // Modal create/edit department
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [parentDeptForNew, setParentDeptForNew] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Drawer Department Details & Tasks
  const [selectedDept, setSelectedDept] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [deptTasks, setDeptTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const { user, currentWorkspace } = useAuth();
  const { can } = usePermission();
  const { openCreateTask } = useOutletContext();

  const isAdminOrOwner =
    user?.role === 'admin' ||
    currentWorkspace?.owner === user?._id ||
    currentWorkspace?.members?.some(
      (m) => (m.user?._id || m.user) === user?._id && ['owner', 'admin'].includes(m.role)
    );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [treeRes, flatRes, userRes] = await Promise.all([
        departmentApi.getTree().catch(() => ({ data: { success: false, tree: [] } })),
        departmentApi.getAll().catch(() => ({ data: { success: false, departments: [] } })),
        userApi.getAll().catch(() => ({ data: { success: false, users: [] } })),
      ]);

      if (treeRes.data?.success) setTreeData(treeRes.data.tree || []);
      if (flatRes.data?.success) setFlatDepartments(flatRes.data.departments || []);
      if (userRes.data?.success) setUsers(userRes.data.users || []);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
      message.error('Không thể tải danh sách phòng ban');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Lắng nghe cập nhật phòng ban real-time
    const socket = getSocket();
    const handleDeptChanged = () => {
      fetchData();
    };

    socket.on('department:changed', handleDeptChanged);
    return () => {
      socket.off('department:changed', handleDeptChanged);
    };
  }, []);

  const openCreateModal = (parent = null) => {
    setEditingDept(null);
    setParentDeptForNew(parent);
    form.resetFields();
    form.setFieldsValue({
      parent: parent ? parent._id : undefined,
      color: '#2563eb',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (dept) => {
    setEditingDept(dept);
    form.resetFields();
    form.setFieldsValue({
      name: dept.name,
      code: dept.code,
      description: dept.description,
      parent: dept.parent?._id || dept.parent || undefined,
      head: dept.head?._id || dept.head || undefined,
      members: dept.members?.map((m) => m._id || m) || [],
      color: dept.color || '#2563eb',
    });
    setIsModalOpen(true);
  };

  const handleSaveDepartment = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        name: values.name,
        code: values.code ? values.code.toUpperCase() : undefined,
        description: values.description,
        parent: values.parent || null,
        head: values.head || null,
        members: values.members || [],
        color: values.color || '#2563eb',
      };

      if (editingDept) {
        await departmentApi.update(editingDept._id, payload);
        message.success('Cập nhật phòng ban thành công!');
      } else {
        await departmentApi.create(payload);
        message.success('Tạo phòng ban mới thành công!');
      }

      setIsModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDepartment = async (deptId) => {
    try {
      await departmentApi.delete(deptId);
      message.success('Đã xóa phòng ban thành công');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể xóa phòng ban');
    }
  };

  const openDepartmentTasksDrawer = async (dept) => {
    setSelectedDept(dept);
    setIsDrawerOpen(true);
    setLoadingTasks(true);
    try {
      const res = await departmentApi.getTasks(dept._id);
      if (res.data.success) {
        setDeptTasks(res.data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to load dept tasks:', err);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Helper render menu actions for card
  const getDeptActionMenu = (dept) => {
    const items = [
      {
        key: 'view_tasks',
        icon: <CheckCircleOutlined />,
        label: 'Xem tác vụ & nhân sự',
        onClick: () => openDepartmentTasksDrawer(dept),
      },
    ];

    if (isAdminOrOwner || can('departments', 'create')) {
      items.push({
        key: 'add_child',
        icon: <PlusOutlined />,
        label: 'Thêm phòng ban con',
        onClick: () => openCreateModal(dept),
      });
    }

    if (isAdminOrOwner || can('departments', 'edit')) {
      items.push({
        key: 'edit',
        icon: <EditOutlined />,
        label: 'Chỉnh sửa phòng ban',
        onClick: () => openEditModal(dept),
      });
    }

    if (isAdminOrOwner || can('departments', 'delete')) {
      items.push(
        {
          type: 'divider',
        },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: 'Xóa phòng ban',
          danger: true,
          onClick: () => {
            Modal.confirm({
              title: 'Xóa phòng ban',
              content: `Bạn có chắc chắn muốn xóa "${dept.name}"? Các phòng ban con sẽ được chuyển lên cấp trên.`,
              okText: 'Xóa',
              okType: 'danger',
              cancelText: 'Hủy',
              onOk: () => handleDeleteDepartment(dept._id),
            });
          },
        }
      );
    }

    return items;
  };

  // Bitrix24 Department Card Renderer
  const renderDepartmentCard = (dept, isRoot = false) => {
    const memberCount = dept.members?.length || 0;
    const childrenCount = dept.children?.length || 0;
    const headName = dept.head?.name || 'Chưa thiết lập';

    const userIdStr = (user?._id || user?.id)?.toString();
    const isMyDepartment =
      (dept.head?._id || dept.head)?.toString() === userIdStr ||
      dept.members?.some((m) => (m?._id || m)?.toString() === userIdStr) ||
      (user?.departmentId && user.departmentId.toString() === dept._id.toString());

    return (
      <div
        key={dept._id}
        className={`relative bg-white rounded-2xl shadow-sm border transition-all duration-200 select-none ${
          isMyDepartment
            ? 'w-80 border-blue-400 ring-4 ring-blue-400/20 shadow-md'
            : isRoot
            ? 'w-80 border-blue-300 ring-4 ring-blue-400/20 shadow-md'
            : 'w-72 border-slate-200 hover:shadow-md hover:border-slate-300'
        }`}
      >
        {/* Top Floating Pill: "PHÒNG BAN CỦA BẠN" */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span
            className={`px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm whitespace-nowrap ${
              isMyDepartment
                ? 'bg-blue-600 ring-2 ring-white'
                : isRoot
                ? 'bg-emerald-600'
                : 'bg-slate-500'
            }`}
          >
            {isMyDepartment
              ? 'PHÒNG BAN CỦA BẠN'
              : isRoot
              ? 'CÔNG TY TRỤ SỞ'
              : 'PHÒNG BAN TRỰC THUỘC'}
          </span>
        </div>

        {/* Card Body */}
        <div className="p-4 pt-5">
          {/* Header row: Icon + Name + Menu */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              {isRoot ? (
                <BankFilled className="text-emerald-500 text-lg shrink-0" />
              ) : (
                <HolderOutlined className="text-slate-400 shrink-0 cursor-grab" />
              )}
              <h3 className="font-extrabold text-sm text-slate-800 truncate m-0">
                {dept.name}
              </h3>
            </div>

            <Dropdown menu={{ items: getDeptActionMenu(dept) }} trigger={['click']} placement="bottomRight">
              <Button
                type="text"
                size="small"
                icon={<EllipsisOutlined />}
                className="text-slate-400 hover:text-slate-700"
              />
            </Dropdown>
          </div>

          {/* Head of Department / Manager */}
          <div
            onClick={() => openDepartmentTasksDrawer(dept)}
            className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors cursor-pointer"
          >
            <Avatar size={34} style={{ backgroundColor: dept.color || '#2563eb' }}>
              {dept.head?.name ? dept.head.name[0].toUpperCase() : <UserOutlined />}
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800 truncate">
                  {headName}
                </span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] font-semibold rounded bg-slate-200/80 text-slate-600">
                  <TeamOutlined className="text-[9px]" /> {memberCount}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {dept.head ? 'Trưởng phòng' : 'Chức vụ chưa được quy định'}
              </div>
            </div>
          </div>

          {/* Members count */}
          <div className="mt-3">
            <div className="text-[11px] font-medium text-slate-400 mb-1">Nhân viên</div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/70">
              {memberCount} nhân viên
            </span>
          </div>
        </div>

        {/* Footer: Children count & Expand toggle */}
        <div
          onClick={() => openDepartmentTasksDrawer(dept)}
          className={`py-2 px-3 text-center text-xs font-semibold rounded-b-2xl border-t cursor-pointer transition-colors ${
            isRoot
              ? 'bg-lime-50 text-lime-700 border-lime-200 hover:bg-lime-100'
              : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
          }`}
        >
          {childrenCount > 0 ? (
            <span className="flex items-center justify-center gap-1">
              {childrenCount} phòng ban <DownOutlined className="text-[10px]" />
            </span>
          ) : (
            'không có tiểu ban nào'
          )}
        </div>
      </div>
    );
  };

  // Render Org Chart Tree Structure
  const renderTree = () => {
    if (treeData.length === 0) {
      return (
        <Card className="py-16 text-center max-w-lg mx-auto rounded-2xl shadow-xs border-slate-200">
          {isAdminOrOwner ? (
            <>
              <Empty description="Chưa có cơ cấu phòng ban nào được thiết lập" />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                className="mt-4 font-semibold"
                onClick={() => openCreateModal()}
              >
                Tạo phòng ban gốc đầu tiên
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mx-auto border border-blue-100 shadow-sm">
                🏢
              </div>
              <h3 className="font-extrabold text-slate-800 text-base">
                Bạn chưa được thêm vào Phòng ban nào
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Tài khoản của bạn hiện chưa được phân công vào bất kỳ Phòng ban nào trong cơ cấu công ty. Bạn sẽ thấy phòng ban của mình ngay khi được Quản trị viên chỉ định.
              </p>
              <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                <span>💡 Vui lòng liên hệ Quản trị viên (Admin) để được thêm vào phòng ban làm việc.</span>
              </div>
            </div>
          )}
        </Card>
      );
    }

    return (
      <div className="overflow-x-auto py-10 px-4 min-h-[600px] flex justify-center">
        <div className="flex flex-col items-center">
          {treeData.map((rootNode) => (
            <div key={rootNode._id} className="flex flex-col items-center">
              {/* Root Card (e.g. Công Ty A) */}
              {renderDepartmentCard(rootNode, !rootNode.parent)}

              {/* Connector from Root */}
              {isAdminOrOwner && <div className="w-0.5 h-7 bg-slate-300 my-0" />}

              {/* Plus Button to add child under root */}
              {isAdminOrOwner && (
                <Tooltip title="Thêm phòng ban trực thuộc">
                  <button
                    type="button"
                    onClick={() => openCreateModal(rootNode)}
                    className="w-7 h-7 rounded-full bg-white border border-cyan-400 text-cyan-500 hover:bg-cyan-50 hover:scale-110 flex items-center justify-center shadow-sm cursor-pointer transition-all z-10"
                  >
                    <PlusOutlined className="text-xs" />
                  </button>
                </Tooltip>
              )}

              {/* Children Branches */}
              {rootNode.children && rootNode.children.length > 0 && (
                <div className="flex flex-col items-center w-full">
                  {/* Stem downwards */}
                  <div className="w-0.5 h-7 bg-slate-300" />

                  {/* Horizontal Bar connecting children */}
                  <div className="relative flex justify-center items-start gap-8 pt-6">
                    {/* Horizontal line across children */}
                    {rootNode.children.length > 1 && (
                      <div
                        className="absolute top-0 h-0.5 bg-slate-300"
                        style={{
                          left: `calc(50% - ${(rootNode.children.length - 1) * 160}px)`,
                          right: `calc(50% - ${(rootNode.children.length - 1) * 160}px)`,
                        }}
                      />
                    )}

                    {/* Child Departments */}
                    {rootNode.children.map((childNode) => (
                      <div key={childNode._id} className="flex flex-col items-center relative">
                        {/* Vertical line connecting from horizontal bar to child card */}
                        <div className="w-0.5 h-6 bg-slate-300 -mt-6 mb-0" />

                        {renderDepartmentCard(childNode, false)}

                        {/* Nested Subchildren if any */}
                        {childNode.children && childNode.children.length > 0 && (
                          <div className="flex flex-col items-center mt-4">
                            <div className="w-0.5 h-4 bg-slate-300" />
                            <div className="flex gap-4">
                              {childNode.children.map((subChild) =>
                                renderDepartmentCard(subChild, false)
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Table Columns for Flat List View
  const tableColumns = [
    {
      title: 'Phòng ban',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="flex items-center gap-3">
          <Avatar style={{ backgroundColor: record.color || '#2563eb' }}>
            {record.code ? record.code.slice(0, 3) : 'PB'}
          </Avatar>
          <div>
            <div className="font-bold text-slate-800 text-sm">{record.name}</div>
            <div className="text-xs text-slate-400">Mã: {record.code}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Cấp trên (Parent)',
      dataIndex: 'parent',
      key: 'parent',
      render: (parent) =>
        parent ? (
          <Tag color="blue">{parent.name}</Tag>
        ) : (
          <Tag color="cyan">Trụ sở / Root</Tag>
        ),
    },
    {
      title: 'Người phụ trách',
      dataIndex: 'head',
      key: 'head',
      render: (head) =>
        head ? (
          <div className="flex items-center gap-2 text-xs">
            <Avatar size={22} style={{ backgroundColor: '#2563eb' }}>
              {head.name[0]}
            </Avatar>
            <span className="font-medium text-slate-700">{head.name}</span>
          </div>
        ) : (
          <span className="text-slate-400 text-xs">Chưa thiết lập</span>
        ),
    },
    {
      title: 'Nhân viên',
      dataIndex: 'members',
      key: 'members',
      render: (members) => (
        <span className="text-xs font-semibold text-slate-700">
          {members?.length || 0} người
        </span>
      ),
    },
    {
      title: 'Tác vụ / Công việc',
      key: 'stats',
      render: (_, record) => {
        const total = record.stats?.totalTasks || 0;
        const completed = record.stats?.completedTasks || 0;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        return (
          <div className="w-36">
            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
              <span>{completed}/{total} xong</span>
              <span className="font-bold">{progress}%</span>
            </div>
            <Progress percent={progress} size="small" showInfo={false} />
          </div>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <div className="flex items-center gap-1">
          <Tooltip title="Xem chi tiết & công việc">
            <Button
              type="text"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => openDepartmentTasksDrawer(record)}
            />
          </Tooltip>
          {(isAdminOrOwner || can('departments', 'edit')) && (
            <Tooltip title="Sửa phòng ban">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEditModal(record)}
              />
            </Tooltip>
          )}
          {(isAdminOrOwner || can('departments', 'delete')) && (
            <Popconfirm
              title="Xóa phòng ban"
              description="Bạn có chắc chắn muốn xóa phòng ban này?"
              onConfirm={() => handleDeleteDepartment(record._id)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ApartmentOutlined className="text-blue-600" />
            Cơ Cấu Tổ Chức & Phòng Ban
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Thiết lập phòng ban theo từng cấp, người phụ trách, quản lý nhân viên và phân công tác vụ
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            <Button
              size="small"
              type={viewMode === 'tree' ? 'primary' : 'text'}
              icon={<NodeIndexOutlined />}
              onClick={() => setViewMode('tree')}
            >
              Sơ đồ cây (Org Chart)
            </Button>
            <Button
              size="small"
              type={viewMode === 'table' ? 'primary' : 'text'}
              icon={<UnorderedListOutlined />}
              onClick={() => setViewMode('table')}
            >
              Danh sách
            </Button>
          </div>

          {(isAdminOrOwner || can('departments', 'create')) && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openCreateModal()}
            >
              Thêm phòng ban
            </Button>
          )}
        </div>
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spin size="large" tip="Đang tải sơ đồ cơ cấu tổ chức..." />
        </div>
      ) : viewMode === 'tree' ? (
        <Card className="shadow-sm border-slate-200 bg-slate-50/50">
          {renderTree()}
        </Card>
      ) : (
        <Card styles={{ body: { padding: 0 } }} className="overflow-hidden shadow-sm">
          <Table
            columns={tableColumns}
            dataSource={flatDepartments}
            rowKey="_id"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}

      {/* Modal Tạo / Sửa Phòng Ban */}
      <Modal
        title={
          <div className="text-lg font-bold">
            {editingDept ? 'Chỉnh Sửa Phòng Ban' : 'Thêm Phòng Ban Mới'}
          </div>
        }
        open={isModalOpen}
        onOk={handleSaveDepartment}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={submitting}
        okText={editingDept ? 'Lưu thay đổi' : 'Tạo phòng ban'}
        cancelText="Hủy"
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            label="Tên phòng ban"
            name="name"
            rules={[{ required: true, message: 'Vui lòng nhập tên phòng ban' }]}
          >
            <Input placeholder="VD: Team Web, Team Media, Phòng Kinh Doanh..." autoFocus />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Mã viết tắt (Code)" name="code">
              <Input placeholder="VD: WEB, MEDIA, OPS" />
            </Form.Item>

            <Form.Item label="Màu nhận diện" name="color" initialValue="#2563eb">
              <Input type="color" className="h-9 cursor-pointer" />
            </Form.Item>
          </div>

          <Form.Item
            label="Phòng ban cấp trên (Parent Department)"
            name="parent"
            tooltip="Chọn phòng ban cha để tạo nhánh phân cấp. Để trống nếu là phòng ban gốc (Trụ sở chính)."
          >
            <Select placeholder="-- Không có (Phòng ban gốc) --" allowClear>
              {flatDepartments
                .filter((d) => !editingDept || d._id !== editingDept._id)
                .map((d) => (
                  <Select.Option key={d._id} value={d._id}>
                    🏢 {d.name} {d.parent ? `(Trực thuộc ${d.parent.name})` : '(Gốc)'}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Người phụ trách / Trưởng phòng"
            name="head"
            tooltip="Người chịu trách nhiệm theo dõi và quản lý công việc của phòng ban"
          >
            <Select placeholder="-- Chọn người phụ trách --" allowClear>
              {users.map((u) => (
                <Select.Option key={u._id} value={u._id}>
                  {u.name} ({u.email}) - {u.role}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Nhân viên thuộc phòng ban"
            name="members"
            tooltip="Chọn các thành viên thuộc phòng ban này"
          >
            <Select
              mode="multiple"
              placeholder="Chọn nhân viên"
              allowClear
              optionFilterProp="children"
            >
              {users.map((u) => (
                <Select.Option key={u._id} value={u._id}>
                  {u.name} ({u.department || 'Nhân viên'})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Mô tả chức năng nhiệm vụ" name="description">
            <TextArea rows={2} placeholder="Nhiệm vụ, phạm vi hoạt động của phòng ban..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer Chi Tiết Phòng Ban & Quản Lý Tác Vụ */}
      <Drawer
        title={
          selectedDept ? (
            <div className="flex items-center gap-3">
              <Avatar style={{ backgroundColor: selectedDept.color || '#2563eb' }}>
                {selectedDept.name[0]}
              </Avatar>
              <div>
                <div className="font-extrabold text-base text-slate-900 leading-tight">
                  {selectedDept.name}
                </div>
                <div className="text-xs text-slate-400">
                  Mã: {selectedDept.code} • Phụ trách: {selectedDept.head?.name || 'Chưa thiết lập'}
                </div>
              </div>
            </div>
          ) : (
            'Chi tiết phòng ban'
          )
        }
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        width={680}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              openCreateTask();
            }}
          >
            Giao việc cho phòng ban
          </Button>
        }
      >
        {selectedDept && (
          <Tabs
            defaultActiveKey="tasks"
            items={[
              {
                key: 'tasks',
                label: `Công việc (${deptTasks.length})`,
                children: (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                      <div>
                        <div className="text-xs text-slate-500 font-medium">Tổng tác vụ đang theo dõi</div>
                        <div className="text-xl font-bold text-slate-800">{deptTasks.length} công việc</div>
                      </div>
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => openCreateTask()}
                      >
                        Tạo tác vụ mới
                      </Button>
                    </div>

                    {loadingTasks ? (
                      <div className="py-12 text-center">
                        <Spin tip="Đang tải danh sách công việc..." />
                      </div>
                    ) : deptTasks.length === 0 ? (
                      <Empty description="Phòng ban này chưa có công việc nào" />
                    ) : (
                      <div className="space-y-2.5">
                        {deptTasks.map((task) => (
                          <div
                            key={task._id}
                            className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow flex items-start justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Tag color={task.project?.color || 'blue'} className="text-[10px] font-bold">
                                  {task.project?.code || 'PRJ'} • {task.project?.name}
                                </Tag>
                                <Tag
                                  color={
                                    task.status === 'done'
                                      ? 'success'
                                      : task.status === 'in_progress'
                                      ? 'processing'
                                      : task.status === 'review'
                                      ? 'warning'
                                      : 'default'
                                  }
                                >
                                  {task.status === 'done'
                                    ? 'Đã xong'
                                    : task.status === 'in_progress'
                                    ? 'Đang làm'
                                    : task.status === 'review'
                                    ? 'Chờ duyệt'
                                    : 'Cần làm'}
                                </Tag>
                              </div>
                              <div className="font-bold text-sm text-slate-900">{task.title}</div>
                              {task.description && (
                                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{task.description}</p>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <div className="flex items-center gap-1.5 justify-end">
                                <Avatar size={20} style={{ backgroundColor: '#2563eb', fontSize: '10px' }}>
                                  {task.assignee?.name ? task.assignee.name[0].toUpperCase() : '?'}
                                </Avatar>
                                <span className="text-xs text-slate-600 font-medium">
                                  {task.assignee?.name || 'Chưa giao'}
                                </span>
                              </div>
                              {task.dueDate && (
                                <div className="text-[11px] text-slate-400 mt-1">
                                  Hạn: {new Date(task.dueDate).toLocaleDateString('vi-VN')}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'members',
                label: `Nhân sự (${selectedDept.members?.length || 0})`,
                children: (
                  <div className="space-y-3">
                    <div className="text-xs text-slate-500 mb-2">
                      Danh sách nhân viên thuộc phòng ban <strong>{selectedDept.name}</strong>:
                    </div>

                    {selectedDept.members?.length === 0 ? (
                      <Empty description="Chưa có nhân viên nào trong phòng ban" />
                    ) : (
                      <div className="divide-y divide-slate-100 bg-white rounded-xl border border-slate-200">
                        {selectedDept.members?.map((m) => {
                          const isHead = selectedDept.head?._id === m._id || selectedDept.head === m._id;
                          return (
                            <div key={m._id} className="p-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar style={{ backgroundColor: '#2563eb' }}>
                                  {m.name ? m.name[0].toUpperCase() : 'U'}
                                </Avatar>
                                <div>
                                  <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                    {m.name}
                                    {isHead && <Tag color="warning" className="text-[10px]">Trưởng phòng</Tag>}
                                  </div>
                                  <div className="text-[11px] text-slate-400">{m.email}</div>
                                </div>
                              </div>
                              <Tag color="processing">{m.role}</Tag>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Drawer>
    </div>
  );
};
