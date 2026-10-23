import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, Form, Input, Button, Alert, Typography, message } from 'antd';
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  ArrowRightOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { isFirebaseConfigured, signInWithGooglePopup } from '../config/firebase';

const { Title, Text } = Typography;

export const Register = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (values) => {
    setError('');
    setLoading(true);

    try {
      await register({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      message.success('Đăng ký tài khoản thành công! Hãy tạo hoặc tham gia Không gian làm việc.');
      navigate('/workspace/onboarding');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký tài khoản thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured) {
      setError(
        'Firebase chưa được cấu hình. Vui lòng thêm các biến VITE_FIREBASE_* vào file client/.env'
      );
      return;
    }

    setError('');
    setGoogleLoading(true);
    try {
      const { idToken, user } = await signInWithGooglePopup();
      const loginResult = await loginWithGoogle({ idToken, user });
      message.success('Đăng ký / Đăng nhập Google thành công!');
      const hasActiveWs = (loginResult?.workspaces || []).some((w) => !w.isPending);
      if (hasActiveWs) {
        navigate('/');
      } else {
        navigate('/workspace/onboarding');
      }
    } catch (err) {
      console.error('Firebase Google sign-in error:', err);
      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request'
      ) {
        // Người dùng chủ động đóng cửa sổ -> Không hiển thị lỗi đỏ
        return;
      }
      setError(err.response?.data?.message || err.message || 'Đăng ký với Google thất bại.');
    } finally {
      setGoogleLoading(false);
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
            Tạo Tài Khoản Mới
          </Title>
          <Text type="secondary" className="text-sm">
            Bắt đầu với hệ thống Quản lý Công việc CRM
          </Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            className="mb-5 rounded-lg text-xs"
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleRegister}
        >
          <Form.Item
            label="Họ và tên"
            name="name"
            rules={[{ required: true, message: 'Vui lòng nhập họ và tên!' }]}
          >
            <Input
              prefix={<UserOutlined className="text-slate-400 mr-1" />}
              placeholder="VD: Nguyễn Văn A"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="Email công việc"
            name="email"
            rules={[
              { required: true, message: 'Vui lòng nhập email!' },
              { type: 'email', message: 'Email không hợp lệ!' },
            ]}
          >
            <Input
              prefix={<MailOutlined className="text-slate-400 mr-1" />}
              placeholder="user@crm.local"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="Mật khẩu"
            name="password"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu!' },
              { min: 6, message: 'Mật khẩu phải có tối thiểu 6 ký tự!' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-slate-400 mr-1" />}
              placeholder="••••••••"
              size="large"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={loading}
            className="mt-2 font-bold"
            icon={<ArrowRightOutlined />}
            iconPosition="end"
          >
            Hoàn tất đăng ký
          </Button>
        </Form>

        {/* Google Firebase Sign-up Section */}
        <div className="relative my-3.5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2.5 text-[11px] text-slate-400 font-semibold tracking-wider">
              Hoặc đăng ký nhanh với
            </span>
          </div>
        </div>

        <div>
          <Button
            size="large"
            block
            loading={googleLoading}
            onClick={handleGoogleSignIn}
            className="flex items-center justify-center gap-2.5 font-semibold text-slate-700 hover:text-blue-600 hover:border-blue-400 shadow-2xs h-10 rounded-lg transition-all"
          >
            <svg
              style={{ width: 18, height: 18, minWidth: 18, minHeight: 18 }}
              className="shrink-0 inline-block mr-2"
              viewBox="0 0 24 24"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Đăng ký với Google</span>
          </Button>

          {!isFirebaseConfigured && (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/80 rounded-lg p-2 mt-2 text-center leading-relaxed">
              ⚠️ Cần dán cấu hình Firebase (<code>VITE_FIREBASE_*</code>) vào file <code>client/.env</code>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-slate-500 mt-4 pt-3.5 border-t border-slate-100">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">
            Đăng nhập ngay
          </Link>
        </div>
      </Card>
    </div>
  );
};
