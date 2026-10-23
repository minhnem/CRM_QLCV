import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Form, Input, Button, Tag, Badge, message, Space } from 'antd';
import {
  CloudServerOutlined,
  DatabaseOutlined,
  ApiOutlined,
  GlobalOutlined,
  UserOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { healthApi, authApi } from '../services/api';
import { getSocket } from '../services/socket';

export const Settings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [health, setHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [socketStatus, setSocketStatus] = useState(false);
  const [saving, setSaving] = useState(false);

  const checkHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await healthApi.check();
      setHealth(res.data);
    } catch (err) {
      setHealth({ status: 'error', database: 'disconnected', error: err.message });
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const socket = getSocket();
    setSocketStatus(socket.connected);

    form.setFieldsValue({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      department: user?.department || '',
    });
  }, [user, form]);

  const handleUpdateProfile = async (values) => {
    setSaving(true);
    try {
      const res = await authApi.updateProfile({
        name: values.name,
        phone: values.phone,
        department: values.department,
      });

      if (res.data.success) {
        message.success('Cập nhật hồ sơ cá nhân thành công!');
        localStorage.setItem('crm_user', JSON.stringify(res.data.user));
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Cấu Hình Hệ Thống & Trạng Thái
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Kiểm tra kết nối MERN Stack (MongoDB, Express, React, Node.js, Socket.IO) và thông tin tài khoản
        </p>
      </div>

      {/* RBAC Matrix Quick Banner */}
      <Card className="border-indigo-100 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-slate-50 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl shadow-sm shrink-0">
              <SafetyCertificateOutlined />
            </div>
            <div>
              <div className="font-extrabold text-slate-800 text-base">
                Ma Trận Phân Quyền & Kiểm Soát Truy Cập (RBAC Matrix)
              </div>
              <div className="text-slate-500 text-xs mt-0.5">
                Thiết lập phạm vi quyền xem, tạo, sửa, xóa, bảo mật doanh thu hợp đồng và phân quyền theo phòng ban
              </div>
            </div>
          </div>
          <Button
            type="primary"
            onClick={() => navigate('/permissions')}
            className="font-semibold shadow-xs bg-blue-600 hover:bg-blue-700"
          >
            Quản Lý Ma Trận Phân Quyền →
          </Button>
        </div>
      </Card>

      <Row gutter={[20, 20]}>
        {/* Left: System Health */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CloudServerOutlined className="text-blue-600" />
                  Hạ Tầng Kỹ Thuật (MERN Active)
                </span>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={loadingHealth}
                  onClick={checkHealth}
                >
                  Kiểm tra lại
                </Button>
              </div>
            }
          >
            <div className="space-y-3.5">
              {/* MongoDB */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                    <DatabaseOutlined />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">MongoDB Database</div>
                    <div className="text-[11px] text-slate-400">
                      Mongoose 8.x • Collections: users, projects, tasks, activitylogs
                    </div>
                  </div>
                </div>
                <div>
                  {health?.database === 'connected' ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>Đã kết nối</Tag>
                  ) : (
                    <Tag color="warning" icon={<WarningOutlined />}>Đang kết nối</Tag>
                  )}
                </div>
              </div>

              {/* Express API */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
                    <ApiOutlined />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">Express.js RESTful API</div>
                    <div className="text-[11px] text-slate-400">
                      Cổng: 5000 • JWT Auth & RBAC • Helmet Security
                    </div>
                  </div>
                </div>
                <div>
                  <Tag color="processing">Sẵn sàng (Port 5000)</Tag>
                </div>
              </div>

              {/* Socket.IO */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-lg">
                    <GlobalOutlined />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">Socket.IO WebSocket</div>
                    <div className="text-[11px] text-slate-400">
                      Đồng bộ Kanban và Thông báo tức thì
                    </div>
                  </div>
                </div>
                <div>
                  {socketStatus ? (
                    <Tag color="purple">Real-time Online</Tag>
                  ) : (
                    <Tag color="warning">Đang kết nối lại</Tag>
                  )}
                </div>
              </div>

              {/* UI Frameworks */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                    <CloudServerOutlined />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800">UI & Styling Engine</div>
                    <div className="text-[11px] text-slate-400">
                      Ant Design 6 + Tailwind CSS v3 + Vite 6
                    </div>
                  </div>
                </div>
                <div>
                  <Tag color="geekblue">Đã tích hợp</Tag>
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Right: User Profile Form */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="font-bold flex items-center gap-2">
                <UserOutlined className="text-blue-600" />
                Hồ Sơ Cá Nhân
              </div>
            }
          >
            <Form form={form} layout="vertical" onFinish={handleUpdateProfile}>
              <Form.Item
                label="Họ và tên"
                name="name"
                rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
              >
                <Input placeholder="Nguyễn Văn A" />
              </Form.Item>

              <Form.Item label="Email tài khoản" name="email">
                <Input disabled className="bg-slate-100" />
              </Form.Item>

              <Form.Item label="Số điện thoại liên hệ" name="phone">
                <Input placeholder="VD: 0901234567" />
              </Form.Item>

              <Form.Item label="Phòng ban" name="department">
                <Input placeholder="VD: Kỹ Thuật" />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                className="font-semibold"
              >
                Lưu thay đổi hồ sơ
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
