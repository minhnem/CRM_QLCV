import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Table,
  Select,
  Switch,
  Button,
  Tag,
  Input,
  Modal,
  Form,
  Space,
  Badge,
  Tooltip,
  Popconfirm,
  message,
  Typography,
  Divider,
  Alert,
  Spin,
} from 'antd';
import {
  SafetyCertificateOutlined,
  SaveOutlined,
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  AuditOutlined,
  ProjectOutlined,
  CheckSquareOutlined,
  ApartmentOutlined,
  TeamOutlined,
  SettingOutlined,
  EyeOutlined,
  DollarOutlined,
  UserSwitchOutlined,
  InfoCircleOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import { roleApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';

const { Title, Text, Paragraph } = Typography;

// Định nghĩa cấu hình hiển thị các phân hệ
const MODULE_CONFIGS = [
  {
    key: 'contracts',
    name: 'Hợp đồng & Deals',
    description: 'Quản lý hợp đồng thương mại, tiến độ thanh toán, giá trị deals',
    icon: <AuditOutlined className="text-amber-500 text-lg" />,
    badgeColor: 'gold',
    hasViewValue: true,
    hasAssign: false,
  },
  {
    key: 'projects',
    name: 'Quản lý dự án',
    description: 'Khởi tạo dự án, điều phối ngân sách, phân công thành viên & tiến độ',
    icon: <ProjectOutlined className="text-blue-500 text-lg" />,
    badgeColor: 'blue',
    hasViewValue: true,
    hasAssign: false,
  },
  {
    key: 'tasks',
    name: 'Công việc (Kanban)',
    description: 'Giao việc, kéo thả trạng thái, hạn hoàn thành & trao đổi task',
    icon: <CheckSquareOutlined className="text-emerald-500 text-lg" />,
    badgeColor: 'green',
    hasViewValue: false,
    hasAssign: true, // Phân công việc cho người khác
  },
  {
    key: 'departments',
    name: 'Cơ cấu phòng ban',
    description: 'Sơ đồ cây tổ chức, bổ nhiệm trưởng phòng & liên kết dự án',
    icon: <ApartmentOutlined className="text-purple-500 text-lg" />,
    badgeColor: 'purple',
    hasViewValue: false,
    hasAssign: false,
  },
  {
    key: 'team',
    name: 'Đội ngũ nhân sự',
    description: 'Danh sách nhân viên, gán chức vụ & quản lý phân quyền (RBAC)',
    icon: <TeamOutlined className="text-cyan-500 text-lg" />,
    badgeColor: 'cyan',
    hasViewValue: false,
    hasAssign: true, // Đổi vai trò
  },
  /*
  // Tạm thời ẩn phân hệ Cài đặt hệ thống theo yêu cầu
  {
    key: 'settings',
    name: 'Cài đặt hệ thống',
    description: 'Cấu hình không gian làm việc, kiểm tra MERN stack & thiết lập ma trận',
    icon: <SettingOutlined className="text-rose-500 text-lg" />,
    badgeColor: 'red',
    hasViewValue: false,
    hasAssign: false,
  },
  */
];

const VIEW_SCOPE_OPTIONS = [
  { value: 'all', label: '🌐 Toàn bộ (Tất cả dữ liệu)' },
  { value: 'dept', label: '🏢 Phòng ban (Cùng phòng ban)' },
  { value: 'own', label: '👤 Cá nhân (Chỉ của tôi / được gán)' },
  { value: 'none', label: '🚫 Không có quyền xem' },
];

const EDIT_SCOPE_OPTIONS = [
  { value: 'all', label: '🌐 Toàn bộ (Sửa bất kỳ)' },
  { value: 'dept', label: '🏢 Phòng ban (Trong phòng)' },
  { value: 'own', label: '👤 Cá nhân (Chỉ việc của mình)' },
  { value: 'none', label: '🚫 Không được sửa' },
];

export const PermissionsMatrix = () => {
  const { currentWorkspace, user } = useAuth();
  const { refreshPermissions } = usePermission();

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeRoleKey, setActiveRoleKey] = useState('');
  const [editingPermissions, setEditingPermissions] = useState({});
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Modal tạo vai trò mới
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [creating, setCreating] = useState(false);

  // Tải danh sách roles
  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await roleApi.getAll({ workspaceId: currentWorkspace?._id });
      if (res.data?.success) {
        const roleList = res.data.roles || [];
        setRoles(roleList);

        // Khởi tạo trạng thái permissions chỉnh sửa cho từng role
        const permMap = {};
        roleList.forEach((r) => {
          permMap[r._id] = JSON.parse(JSON.stringify(r.permissions || {}));
        });
        setEditingPermissions(permMap);

        if (!activeRoleKey && roleList.length > 0) {
          // Ưu tiên chọn role đầu tiên (thường là Admin hoặc Manager)
          setActiveRoleKey(roleList[0]._id);
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải ma trận phân quyền:', err);
      message.error('Không thể tải ma trận phân quyền');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?._id, activeRoleKey]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Cập nhật giá trị ô quyền trong ma trận
  const handlePermissionChange = (roleId, moduleKey, field, value) => {
    setEditingPermissions((prev) => {
      const currentRolePerms = prev[roleId] ? { ...prev[roleId] } : {};
      const currentModulePerms = currentRolePerms[moduleKey] ? { ...currentRolePerms[moduleKey] } : {};

      currentModulePerms[field] = value;
      currentRolePerms[moduleKey] = currentModulePerms;

      return {
        ...prev,
        [roleId]: currentRolePerms,
      };
    });
  };

  // Lưu ma trận phân quyền cho vai trò đang chọn
  const handleSaveRole = async (roleId) => {
    const role = roles.find((r) => r._id === roleId);
    if (!role) return;

    setSaving(true);
    try {
      const newPerms = editingPermissions[roleId];
      const res = await roleApi.update(roleId, {
        permissions: newPerms,
      });

      if (res.data?.success) {
        message.success(`Đã lưu ma trận phân quyền cho vai trò '${role.name}'!`);
        refreshPermissions();
        fetchRoles();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Có lỗi khi lưu phân quyền');
    } finally {
      setSaving(false);
    }
  };

  // Khôi phục cấu hình mặc định
  const handleResetDefaults = async () => {
    setResetting(true);
    try {
      const res = await roleApi.resetDefaults();
      if (res.data?.success) {
        message.success('Đã khôi phục ma trận phân quyền về chuẩn ban đầu!');
        refreshPermissions();
        fetchRoles();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi khôi phục mặc định');
    } finally {
      setResetting(false);
    }
  };

  // Tạo vai trò mới
  const handleCreateRole = async (values) => {
    setCreating(true);
    try {
      // Sao chép quyền từ vai trò mẫu nếu có
      let templatePerms = {};
      if (values.templateRoleId) {
        const templateRole = roles.find((r) => r._id === values.templateRoleId);
        if (templateRole) {
          templatePerms = templateRole.permissions;
        }
      }

      const res = await roleApi.create({
        name: values.name,
        code: values.code,
        description: values.description,
        color: values.color || '#2563eb',
        permissions: templatePerms,
      });

      if (res.data?.success) {
        message.success(`Đã tạo vai trò mới '${values.name}'!`);
        setIsModalOpen(false);
        form.resetFields();
        fetchRoles();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi tạo vai trò');
    } finally {
      setCreating(false);
    }
  };

  // Xóa vai trò tùy chỉnh
  const handleDeleteRole = async (roleId) => {
    try {
      const res = await roleApi.delete(roleId);
      if (res.data?.success) {
        message.success(res.data.message);
        fetchRoles();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể xóa vai trò này');
    }
  };

  const currentRole = roles.find((r) => r._id === activeRoleKey);
  const currentPerms = currentRole ? editingPermissions[currentRole._id] || {} : {};

  // Cột cho bảng phân quyền chi tiết của 1 vai trò
  const columns = [
    {
      title: 'Phân hệ & Nghiệp vụ',
      key: 'module',
      width: 280,
      render: (_, record) => (
        <div className="flex items-start gap-3 py-1">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs mt-0.5">
            {record.icon}
          </div>
          <div>
            <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span>{record.name}</span>
              <Tag color={record.badgeColor} className="text-[10px] uppercase font-mono px-1.5 py-0">
                {record.key}
              </Tag>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {record.description}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: (
        <div className="flex items-center gap-1.5">
          <EyeOutlined className="text-blue-600" />
          <span>Quyền Xem (View Scope)</span>
        </div>
      ),
      key: 'view',
      width: 220,
      render: (_, record) => {
        const val = currentPerms[record.key]?.view || 'none';
        const isAdminRole = currentRole?.code === 'admin';
        return (
          <Select
            value={val}
            disabled={isAdminRole}
            className="w-full"
            options={VIEW_SCOPE_OPTIONS}
            onChange={(newVal) =>
              handlePermissionChange(currentRole._id, record.key, 'view', newVal)
            }
          />
        );
      },
    },
    {
      title: 'Tạo mới (Create)',
      key: 'create',
      width: 130,
      align: 'center',
      render: (_, record) => {
        const val = Boolean(currentPerms[record.key]?.create);
        const isAdminRole = currentRole?.code === 'admin';
        return (
          <Switch
            checked={val}
            disabled={isAdminRole}
            checkedChildren="Bật"
            unCheckedChildren="Tắt"
            onChange={(checked) =>
              handlePermissionChange(currentRole._id, record.key, 'create', checked)
            }
          />
        );
      },
    },
    {
      title: 'Chỉnh sửa (Edit Scope)',
      key: 'edit',
      width: 210,
      render: (_, record) => {
        const val = currentPerms[record.key]?.edit || 'none';
        const isAdminRole = currentRole?.code === 'admin';
        return (
          <Select
            value={val}
            disabled={isAdminRole}
            className="w-full"
            options={EDIT_SCOPE_OPTIONS}
            onChange={(newVal) =>
              handlePermissionChange(currentRole._id, record.key, 'edit', newVal)
            }
          />
        );
      },
    },
    {
      title: 'Xóa (Delete)',
      key: 'delete',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const val = Boolean(currentPerms[record.key]?.delete);
        const isAdminRole = currentRole?.code === 'admin';
        return (
          <Switch
            checked={val}
            disabled={isAdminRole}
            checkedChildren="Có"
            unCheckedChildren="Không"
            onChange={(checked) =>
              handlePermissionChange(currentRole._id, record.key, 'delete', checked)
            }
          />
        );
      },
    },
    {
      title: 'Quyền đặc thù',
      key: 'special',
      width: 200,
      render: (_, record) => {
        const isAdminRole = currentRole?.code === 'admin';

        if (record.hasViewValue) {
          const val = currentPerms[record.key]?.viewValue !== false;
          return (
            <div className="flex items-center gap-2">
              <Switch
                size="small"
                checked={val}
                disabled={isAdminRole}
                onChange={(checked) =>
                  handlePermissionChange(currentRole._id, record.key, 'viewValue', checked)
                }
              />
              <span className="text-xs text-slate-600 flex items-center gap-1 font-medium">
                <DollarOutlined className="text-emerald-500" /> Xem giá tiền ($)
              </span>
            </div>
          );
        }

        if (record.hasAssign) {
          const val = Boolean(currentPerms[record.key]?.assign);
          return (
            <div className="flex items-center gap-2">
              <Switch
                size="small"
                checked={val}
                disabled={isAdminRole}
                onChange={(checked) =>
                  handlePermissionChange(currentRole._id, record.key, 'assign', checked)
                }
              />
              <span className="text-xs text-slate-600 flex items-center gap-1 font-medium">
                <UserSwitchOutlined className="text-blue-500" />
                {record.key === 'tasks' ? 'Giao cho người khác' : 'Phân vai trò'}
              </span>
            </div>
          );
        }

        return <span className="text-slate-300 text-xs italic">—</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-lg border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-xl text-blue-400 border border-white/10">
                <SafetyCertificateOutlined />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white m-0">
                Ma Trận Phân Quyền (RBAC Matrix)
              </h1>
            </div>
            <p className="text-slate-300 text-sm max-w-2xl">
              Kiểm soát phân quyền đa tầng theo vai trò chức vụ. Thiết lập trực quan phạm vi xem, tạo, sửa, xóa và bảo mật tài chính cho từng phòng ban.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Popconfirm
              title="Khôi phục phân quyền mặc định?"
              description="Hành động này sẽ thiết lập lại quyền chuẩn cho tất cả các vai trò."
              okText="Đồng ý"
              cancelText="Hủy"
              onConfirm={handleResetDefaults}
            >
              <Button
                icon={<ReloadOutlined />}
                loading={resetting}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                Khôi phục chuẩn
              </Button>
            </Popconfirm>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 font-semibold shadow-md"
            >
              Tạo vai trò mới
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="text-center py-16">
          <Spin size="large" tip="Đang tải ma trận phân quyền..." />
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Tabs Chọn Vai Trò */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
              Chọn vai trò để cấu hình ma trận:
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {roles.map((r) => {
                const isSelected = r._id === activeRoleKey;
                return (
                  <button
                    key={r._id}
                    onClick={() => setActiveRoleKey(r._id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all cursor-pointer text-xs font-semibold ${
                      isSelected
                        ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: r.color || '#2563eb' }}
                    />
                    <span>{r.name}</span>
                    {r.isSystem && (
                      <Tag color="default" className="text-[10px] m-0 px-1 py-0 font-mono">
                        Hệ thống
                      </Tag>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chi Tiết Ma Trận Cho Vai Trò Đang Chọn */}
          {currentRole && (
            <Card
              className="border-slate-200/90 shadow-sm overflow-hidden"
              title={
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: currentRole.color || '#2563eb' }}
                    />
                    <div>
                      <div className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                        <span>{currentRole.name}</span>
                        <Tag color="blue" className="text-xs font-mono font-bold">
                          code: {currentRole.code}
                        </Tag>
                        {currentRole.isSystem && (
                          <Tag color="error" icon={<CrownOutlined />}>
                            Vai trò hệ thống
                          </Tag>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-normal mt-0.5">
                        {currentRole.description || 'Chưa có mô tả chi tiết cho vai trò này.'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {!currentRole.isSystem && (
                      <Popconfirm
                        title="Xóa vai trò tùy chỉnh này?"
                        description="Các thành viên thuộc vai trò này sẽ được chuyển về Nhân viên (Member)."
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleDeleteRole(currentRole._id)}
                      >
                        <Button danger icon={<DeleteOutlined />} size="middle">
                          Xóa vai trò
                        </Button>
                      </Popconfirm>
                    )}

                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={saving}
                      disabled={currentRole.code === 'admin'}
                      onClick={() => handleSaveRole(currentRole._id)}
                      className="font-semibold shadow-xs"
                    >
                      {currentRole.code === 'admin' ? 'Admin Full Quyền' : 'Lưu Thay Đổi Ma Trận'}
                    </Button>
                  </div>
                </div>
              }
              styles={{ body: { padding: 0 } }}
            >
              {currentRole.code === 'admin' && (
                <div className="p-4 bg-amber-50/70 border-b border-amber-200/60 flex items-center gap-3">
                  <InfoCircleOutlined className="text-amber-600 text-lg shrink-0" />
                  <div className="text-xs text-amber-900 leading-relaxed">
                    <strong>Lưu ý bảo mật:</strong> Vai trò <strong>Quản trị viên (Admin)</strong> luôn được hệ thống gán mặc định toàn bộ quyền cao nhất trên tất cả các phân hệ nhằm đảm bảo quyền vận hành và tránh rủi ro tự khóa tài khoản quản trị.
                  </div>
                </div>
              )}

              <Table
                columns={columns}
                dataSource={MODULE_CONFIGS}
                rowKey="key"
                pagination={false}
                bordered
              />
            </Card>
          )}
        </div>
      )}

      {/* Modal Tạo Vai Trò Mới */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-slate-800">
            <PlusOutlined className="text-blue-600" />
            Tạo vai trò tùy chỉnh mới
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateRole} className="mt-4">
          <Form.Item
            label="Tên vai trò"
            name="name"
            rules={[{ required: true, message: 'Vui lòng nhập tên vai trò' }]}
          >
            <Input placeholder="Ví dụ: Kế toán trưởng, Quản trị hợp đồng..." />
          </Form.Item>

          <Form.Item
            label="Mã định danh (Role Code)"
            name="code"
            tooltip="Mã viết liền không dấu, dùng để định danh trong hệ thống"
          >
            <Input placeholder="Ví dụ: chief_accountant, sales_lead..." />
          </Form.Item>

          <Form.Item label="Mô tả chức năng" name="description">
            <Input.TextArea rows={2} placeholder="Nhiệm vụ và quyền hạn cơ bản của vai trò..." />
          </Form.Item>

          <Form.Item label="Màu sắc đại diện" name="color" initialValue="#8b5cf6">
            <Select
              options={[
                { value: '#2563eb', label: '🔵 Xanh dương (Blue)' },
                { value: '#10b981', label: '🟢 Xanh ngọc (Emerald)' },
                { value: '#8b5cf6', label: '🟣 Tím hoàng gia (Purple)' },
                { value: '#f59e0b', label: '🟠 Cam nổi bật (Amber)' },
                { value: '#06b6d4', label: '🩵 Xanh Cyan' },
                { value: '#ec4899', label: '🌸 Hồng cá tính (Pink)' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Sao chép quyền từ vai trò mẫu"
            name="templateRoleId"
            tooltip="Chọn vai trò có sẵn để sao chép ma trận quyền làm cơ sở ban đầu"
          >
            <Select
              placeholder="Chọn vai trò mẫu..."
              allowClear
              options={roles.map((r) => ({
                value: r._id,
                label: `${r.name} (${r.code})`,
              }))}
            />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={creating} className="font-semibold">
              Tạo vai trò
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
