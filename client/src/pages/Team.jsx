import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Tag, Avatar, Card, Badge, Button, Select, message, Tooltip } from 'antd';
import {
  UserOutlined,
  SearchOutlined,
  PhoneOutlined,
  BankOutlined,
  SafetyCertificateOutlined,
  CrownOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { userApi, roleApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';

export const Team = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { can, isAdmin } = usePermission();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [userRes, roleRes] = await Promise.all([
        userApi.getAll({ search }).catch(() => ({ data: { success: false, users: [] } })),
        roleApi.getAll().catch(() => ({ data: { success: false, roles: [] } })),
      ]);

      if (userRes.data?.success) {
        setUsers(userRes.data.users);
      }
      if (roleRes.data?.success) {
        setRoles(roleRes.data.roles || []);
      }
    } catch (err) {
      console.error('Failed to load team data:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (targetUser, newRoleCode) => {
    setUpdatingUserId(targetUser._id);
    try {
      const selectedRoleDoc = roles.find((r) => r.code === newRoleCode);
      const res = await userApi.updateRole(targetUser._id, {
        role: newRoleCode,
        roleRef: selectedRoleDoc?._id || null,
      });

      if (res.data?.success) {
        message.success(`Đã cập nhật vai trò của ${targetUser.name} thành '${selectedRoleDoc?.name || newRoleCode}'!`);
        setUsers((prev) =>
          prev.map((u) => (u._id === targetUser._id ? { ...u, role: newRoleCode } : u))
        );
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể đổi vai trò');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const getRoleBadge = (roleCode) => {
    const roleDoc = roles.find((r) => r.code === roleCode);
    if (roleDoc) {
      return (
        <Tag
          style={{
            borderColor: roleDoc.color,
            color: roleDoc.color,
            backgroundColor: `${roleDoc.color}15`,
            fontWeight: 600,
          }}
        >
          {roleDoc.name}
        </Tag>
      );
    }

    switch (roleCode) {
      case 'admin':
        return <Tag color="error">Quản trị viên (Admin)</Tag>;
      case 'manager':
        return <Tag color="warning">Trưởng dự án (Manager)</Tag>;
      default:
        return <Tag color="processing">Thành viên (Member)</Tag>;
    }
  };

  const canEditRole = isAdmin || can('team', 'assign');

  const columns = [
    {
      title: 'Thành viên',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="flex items-center gap-3">
          <Avatar style={{ backgroundColor: '#2563eb', fontWeight: 'bold' }}>
            {record.name ? record.name[0].toUpperCase() : 'U'}
          </Avatar>
          <div>
            <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <span>{record.name}</span>
              {record._id === currentUser?._id && (
                <Tag color="cyan" className="text-[10px] m-0 px-1 py-0">Bạn</Tag>
              )}
            </div>
            <div className="text-xs text-slate-400">{record.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Phòng ban',
      dataIndex: 'department',
      key: 'department',
      render: (dept, record) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700">
          <BankOutlined className="text-slate-400" />
          <span>{record.departmentId?.name || dept || 'Chung'}</span>
        </div>
      ),
    },
    {
      title: 'Vai trò (Role / Chức vụ)',
      dataIndex: 'role',
      key: 'role',
      render: (role, record) => {
        // Nếu user có quyền đổi vai trò và không tự đổi vai trò chính mình (để an toàn)
        if (canEditRole && record._id !== currentUser?._id) {
          return (
            <Select
              size="small"
              value={role || 'member'}
              loading={updatingUserId === record._id}
              onChange={(newRole) => handleRoleChange(record, newRole)}
              className="w-48"
              options={
                roles.length > 0
                  ? roles.map((r) => ({
                      value: r.code,
                      label: (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: r.color }}
                          />
                          <span>{r.name}</span>
                        </div>
                      ),
                    }))
                  : [
                      { value: 'admin', label: 'Quản trị viên (Admin)' },
                      { value: 'manager', label: 'Quản lý (Manager)' },
                      { value: 'member', label: 'Nhân viên (Member)' },
                    ]
              }
            />
          );
        }

        return getRoleBadge(role);
      },
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone) => (
        <div className="text-xs text-slate-500">
          {phone ? (
            <span className="flex items-center gap-1.5">
              <PhoneOutlined className="text-slate-400" />
              {phone}
            </span>
          ) : (
            '—'
          )}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active) => (
        <Badge
          status={active ? 'success' : 'error'}
          text={<span className="text-xs font-medium">{active ? 'Hoạt động' : 'Tạm khóa'}</span>}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Đội Ngũ Nhân Sự</span>
            <Tag color="blue" className="text-xs font-mono font-bold">
              {users.length} thành viên
            </Tag>
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Danh sách nhân sự, phân bổ phòng ban và phân quyền chức vụ (RBAC)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            icon={<SafetyCertificateOutlined className="text-blue-600" />}
            onClick={() => navigate('/permissions')}
            className="font-semibold shadow-2xs hover:border-blue-400"
          >
            Ma trận phân quyền
          </Button>

          <div className="w-64">
            <Input
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm theo tên hoặc email..."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Antd Table Card */}
      <Card styles={{ body: { padding: 0 } }} className="overflow-hidden shadow-sm border-slate-200/90">
        <Table
          columns={columns}
          dataSource={users}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (total) => `Tổng cộng ${total} nhân sự` }}
        />
      </Card>
    </div>
  );
};
