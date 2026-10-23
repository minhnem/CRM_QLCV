import React, { useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Card, Form, Input, Button, Alert, Typography, message } from 'antd';
import { LockOutlined, CheckCircleOutlined, ArrowRightOutlined, AppstoreOutlined } from '@ant-design/icons';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

export const ResetPassword = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { token: paramToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = paramToken || searchParams.get('token');

  const { handleResetPasswordSuccess } = useAuth();
  const navigate = useNavigate();

  const handleFinish = async (values) => {
    if (!token) {
      setError('Mã token xác thực đặt lại mật khẩu không hợp lệ hoặc bị thiếu.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await authApi.resetPassword(token, { password: values.password });
      if (res.data.success) {
        message.success(res.data.message || 'Đặt lại mật khẩu thành công!');
        setSuccess(true);

        if (res.data.token && res.data.user) {
          handleResetPasswordSuccess(res.data.token, res.data.user);
          setTimeout(() => {
            navigate('/');
          }, 1500);
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại liên kết mới.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50">
      <Card className="w-full max-w-md shadow-xl border-slate-200 p-2 md:p-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/30 mb-3">
            <AppstoreOutlined style={{ fontSize: '28px' }} />
          </div>
          <Title level={3} style={{ marginBottom: 4, fontWeight: 800 }}>
            Tạo Mật Khẩu Mới
          </Title>
          <Text type="secondary" className="text-sm">
            Nhập mật khẩu mới an toàn cho tài khoản của bạn
          </Text>
        </div>

        {!token ? (
          <div className="text-center py-4">
            <Alert
              message="Thiếu mã xác nhận"
              description="Liên kết đặt lại mật khẩu không hợp lệ. Vui lòng kiểm tra lại đường link từ email của bạn."
              type="warning"
              showIcon
              className="mb-6 text-left"
            />
            <Link to="/forgot-password">
              <Button type="primary">Yêu cầu liên kết mới</Button>
            </Link>
          </div>
        ) : success ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              <CheckCircleOutlined />
            </div>
            <Title level={4} style={{ color: '#0f172a' }}>
              Mật khẩu đã được thay đổi!
            </Title>
            <Text type="secondary" className="text-sm">
              Đang tự động chuyển hướng vào hệ thống làm việc...
            </Text>
          </div>
        ) : (
          <>
            {error && (
              <Alert
                message={error}
                type="error"
                showIcon
                className="mb-5 rounded-lg text-xs"
              />
            )}

            <Form form={form} layout="vertical" onFinish={handleFinish}>
              <Form.Item
                label="Mật khẩu mới"
                name="password"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu mới!' },
                  { min: 6, message: 'Mật khẩu phải có tối thiểu 6 ký tự!' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined className="text-slate-400 mr-1" />}
                  placeholder="Tối thiểu 6 ký tự"
                  size="large"
                  autoFocus
                />
              </Form.Item>

              <Form.Item
                label="Xác nhận mật khẩu mới"
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Vui lòng xác nhận lại mật khẩu!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined className="text-slate-400 mr-1" />}
                  placeholder="Nhập lại mật khẩu mới"
                  size="large"
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                icon={<ArrowRightOutlined />}
                iconPosition="end"
                className="mt-2 font-bold"
              >
                Lưu mật khẩu mới & Đăng nhập
              </Button>
            </Form>

            <div className="text-center text-xs text-slate-500 mt-6 pt-4 border-t border-slate-100">
              <Link to="/login" className="text-blue-600 font-semibold hover:underline">
                Quay lại màn hình Đăng nhập
              </Link>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
