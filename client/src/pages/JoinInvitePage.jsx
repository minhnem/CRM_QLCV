import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Card,
  Button,
  Input,
  Tag,
  Avatar,
  Typography,
  message,
  Spin,
  Alert,
  Form,
} from 'antd';
import {
  AppstoreOutlined,
  UserOutlined,
  LockOutlined,
  MailOutlined,
  ArrowRightOutlined,
  LogoutOutlined,
  ExclamationCircleOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { workspaceApi, authApi } from '../services/api';
import { signInWithGooglePopup, isFirebaseConfigured } from '../config/firebase';
import { SocialAccountModal } from '../components/auth/SocialAccountModal';

const { Title, Text } = Typography;

export const JoinInvitePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const {
    user,
    isAuthenticated,
    login,
    register,
    loginWithGoogle,
    logout,
    refreshWorkspaces,
  } = useAuth();

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Bitrix24 Social Account Smart Modal state
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [socialUserData, setSocialUserData] = useState(null);

  // 'register' (Tạo tài khoản) hoặc 'login' (Đã có tài khoản)
  const [authMode, setAuthMode] = useState('register');
  const [form] = Form.useForm();

  // Tải thông tin lời mời từ Backend
  useEffect(() => {
    if (!token) {
      setErrorMsg('Không tìm thấy mã token lời mời trong đường dẫn.');
      setLoading(false);
      return;
    }

    const fetchInvite = async () => {
      try {
        setLoading(true);
        const res = await workspaceApi.getInviteByToken(token);
        if (res.data.success) {
          setInviteData(res.data.invite);
          if (res.data.invite.email) {
            form.setFieldsValue({ email: res.data.invite.email });

            // Tự động kiểm tra xem email nhận lời mời đã liên kết Google trước đó chưa
            try {
              const checkRes = await authApi.checkEmail(res.data.invite.email);
              if (checkRes.data.success && checkRes.data.exists && checkRes.data.isSocial) {
                setSocialUserData(checkRes.data.user || { email: res.data.invite.email });
                setSocialModalOpen(true);
              }
            } catch (err) {
              // Bỏ qua lỗi ngầm
            }
          }
        }
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          'Lời mời này không hợp lệ hoặc đã hết hạn hiệu lực.';
        setErrorMsg(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token, form]);

  const handleEmailBlur = async () => {
    const emailValue = form.getFieldValue('email');
    if (!emailValue || !emailValue.trim() || !emailValue.includes('@')) return;

    try {
      const res = await authApi.checkEmail(emailValue.trim());
      if (res.data.success && res.data.exists && res.data.isSocial) {
        setSocialUserData(res.data.user || { email: emailValue.trim() });
        setSocialModalOpen(true);
      }
    } catch (err) {
      // Bỏ qua lỗi ngầm
    }
  };

  // Hành động chấp nhận lời mời (khi user đã đăng nhập)
  const handleAcceptInvite = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await workspaceApi.acceptInvite({ token });
      if (res.data.success) {
        message.success(
          res.data.message ||
          `Chào mừng bạn gia nhập "${inviteData?.workspace?.name}"!`
        );
        await refreshWorkspaces();
        navigate('/');
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể chấp nhận lời mời');
    } finally {
      setSubmitting(false);
    }
  };

  // Đăng nhập 1-Click bằng Firebase Google Auth và tự động tham gia
  const handleGoogleJoin = async () => {
    if (!isFirebaseConfigured) {
      setErrorMsg('Firebase chưa được cấu hình biến môi trường.');
      return;
    }

    setErrorMsg('');
    setGoogleLoading(true);
    try {
      const { idToken, user: googleUser } = await signInWithGooglePopup();
      await loginWithGoogle({
        idToken,
        user: googleUser,
      });

      // Sau khi login Google thành công -> tự động chấp nhận lời mời
      const res = await workspaceApi.acceptInvite({ token });
      if (res.data.success) {
        message.success(
          res.data.message ||
          `Chào mừng bạn gia nhập "${inviteData?.workspace?.name}"!`
        );
        await refreshWorkspaces();
        navigate('/');
      }
    } catch (err) {
      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request'
      ) {
        return;
      }
      setErrorMsg(
        err.response?.data?.message ||
        err.message ||
        'Đăng nhập Google thất bại.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  // Tạo tài khoản mới & Tham gia
  const handleQuickRegister = async (values) => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      await register({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      });

      // Tự động chấp nhận lời mời ngay sau khi tạo tài khoản
      const res = await workspaceApi.acceptInvite({ token });
      if (res.data.success) {
        message.success(
          res.data.message ||
          `Chào mừng bạn gia nhập "${inviteData?.workspace?.name}"!`
        );
        await refreshWorkspaces();
        navigate('/');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Đăng ký tài khoản thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  // Đăng nhập tài khoản có sẵn & Tham gia
  const handleQuickLogin = async (values) => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      await login(values.email.trim(), values.password);

      // Tự động chấp nhận lời mời ngay sau khi login
      const res = await workspaceApi.acceptInvite({ token });
      if (res.data.success) {
        message.success(
          res.data.message ||
          `Chào mừng bạn gia nhập "${inviteData?.workspace?.name}"!`
        );
        await refreshWorkspaces();
        navigate('/');
      }
    } catch (err) {
      if (err.response?.data?.isGoogleAccountWithoutPassword) {
        setSocialUserData({ email: values.email });
        setSocialModalOpen(true);
      }
      setErrorMsg(err.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  // Màn hình tải
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50">
        <div className="text-center p-8 bg-white shadow-xl rounded-2xl border border-slate-200">
          <Spin size="large" />
          <div className="text-slate-600 font-medium mt-4 text-sm">
            Đang xác thực liên kết lời mời...
          </div>
        </div>
      </div>
    );
  }

  // Màn hình lỗi nếu token không hợp lệ
  if (!inviteData && errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50">
        <Card className="w-full max-w-md shadow-xl border-slate-200 p-2 md:p-4 text-center rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3 text-2xl">
            <ExclamationCircleOutlined />
          </div>
          <Title level={4} style={{ marginBottom: 8, fontWeight: 800 }}>
            Lời Mời Không Khả Dụng
          </Title>
          <Text type="secondary" className="text-xs leading-relaxed block mb-6">
            {errorMsg}
          </Text>
          <Link to="/login">
            <Button type="primary" block size="large" className="font-bold">
              Quay lại Trang Đăng Nhập
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { workspace, inviter, role } = inviteData || {};
  const isMemberRole = role !== 'admin';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50">
      <Card className="w-full max-w-md shadow-xl border-slate-200 p-2 md:p-4 rounded-2xl">
        {/* Header Logo & Title chuẩn giao diện Login */}
        <div className="text-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/30 mb-3">
            <AppstoreOutlined style={{ fontSize: '28px' }} />
          </div>
          <Title level={3} style={{ marginBottom: 4, fontWeight: 800 }}>
            CRM & Quản Lý Công Việc
          </Title>
          <Text type="secondary" className="text-xs">
            Lời mời tham gia Không gian làm việc
          </Text>
        </div>

        {/* Workspace Invitation Badge Card */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50/70 border border-blue-200/80 rounded-xl p-3.5 mb-4 text-left">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
              <TeamOutlined /> Không Gian Làm Việc
            </span>
            <span className="font-mono text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
              {workspace?.code}
            </span>
          </div>
          <div className="font-extrabold text-slate-800 text-base">
            {workspace?.name}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
            <span>
              Người mời: <strong className="text-slate-700">{inviter?.name || 'Quản trị viên'}</strong>
            </span>
            <Tag
              color={isMemberRole ? 'blue' : 'red'}
              icon={!isMemberRole && <SafetyCertificateOutlined />}
              className="text-[10px] m-0 font-semibold"
            >
              {isMemberRole ? 'Thành viên' : 'Quản trị viên'}
            </Tag>
          </div>
        </div>

        {errorMsg && (
          <Alert
            message={errorMsg}
            type="error"
            showIcon
            className="mb-4 rounded-lg text-xs"
          />
        )}

        {/* TRƯỜNG HỢP 1: NGƯỜI DÙNG ĐÃ ĐĂNG NHẬP */}
        {isAuthenticated ? (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 text-left">
              <Avatar
                size={40}
                src={user?.avatar}
                className="bg-blue-600 font-bold shrink-0"
              >
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-blue-600 font-semibold uppercase">
                  Tài khoản hiện tại
                </div>
                <div className="font-bold text-slate-800 text-sm truncate">
                  {user?.name}
                </div>
                <div className="text-xs text-slate-400 truncate">{user?.email}</div>
              </div>
            </div>

            <Button
              type="primary"
              size="large"
              block
              loading={submitting}
              onClick={handleAcceptInvite}
              className="font-bold h-11"
              icon={<ArrowRightOutlined />}
              iconPosition="end"
            >
              Xác Nhận Tham Gia Ngay
            </Button>

            <div className="text-center pt-1">
              <Button
                type="text"
                danger
                size="small"
                icon={<LogoutOutlined />}
                onClick={logout}
                className="text-xs"
              >
                Đăng xuất tài khoản này để đổi tài khoản khác
              </Button>
            </div>
          </div>
        ) : (
          /* TRƯỜNG HỢP 2: CHƯA ĐĂNG NHẬP (GIAO DIỆN CHUẨN LOGIN / REGISTER) */
          <div>
            {authMode === 'register' ? (
              /* FORM TẠO TÀI KHOẢN */
              <Form
                form={form}
                layout="vertical"
                onFinish={handleQuickRegister}
              >
                <Form.Item
                  label="Họ và tên"
                  name="name"
                  rules={[{ required: true, message: 'Vui lòng nhập họ và tên!' }]}
                  className="mb-3"
                >
                  <Input
                    prefix={<UserOutlined className="text-slate-400 mr-1" />}
                    placeholder="VD: Nguyễn Văn A"
                    size="large"
                  />
                </Form.Item>

                <Form.Item
                  label="Email tài khoản"
                  name="email"
                  rules={[
                    { required: true, message: 'Vui lòng nhập email!' },
                    { type: 'email', message: 'Email không hợp lệ!' },
                  ]}
                  className="mb-3"
                >
                  <Input
                    prefix={<MailOutlined className="text-slate-400 mr-1" />}
                    placeholder="name@example.com"
                    size="large"
                    onBlur={handleEmailBlur}
                  />
                </Form.Item>

                <Form.Item
                  label="Thiết lập mật khẩu"
                  name="password"
                  rules={[
                    { required: true, message: 'Vui lòng nhập mật khẩu!' },
                    { min: 6, message: 'Mật khẩu phải tối thiểu 6 ký tự!' },
                  ]}
                  className="mb-4"
                >
                  <Input.Password
                    prefix={<LockOutlined className="text-slate-400 mr-1" />}
                    placeholder="Tối thiểu 6 ký tự"
                    size="large"
                  />
                </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  loading={submitting}
                  className="font-bold h-11"
                  icon={<ArrowRightOutlined />}
                  iconPosition="end"
                >
                  Tạo Tài Khoản & Tham Gia
                </Button>
              </Form>
            ) : (
              /* FORM ĐĂNG NHẬP */
              <Form
                form={form}
                layout="vertical"
                onFinish={handleQuickLogin}
              >
                <Form.Item
                  label="Email tài khoản"
                  name="email"
                  rules={[
                    { required: true, message: 'Vui lòng nhập email!' },
                    { type: 'email', message: 'Email không hợp lệ!' },
                  ]}
                  className="mb-3"
                >
                  <Input
                    prefix={<MailOutlined className="text-slate-400 mr-1" />}
                    placeholder="name@example.com"
                    size="large"
                    onBlur={handleEmailBlur}
                  />
                </Form.Item>

                <Form.Item
                  label="Mật khẩu"
                  name="password"
                  rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
                  className="mb-1"
                >
                  <Input.Password
                    prefix={<LockOutlined className="text-slate-400 mr-1" />}
                    placeholder="••••••••"
                    size="large"
                  />
                </Form.Item>

                <div className="flex justify-end mb-3">
                  <Link
                    to="/forgot-password"
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline inline-flex items-center"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>

                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  loading={submitting}
                  className="font-bold h-11"
                  icon={<ArrowRightOutlined />}
                  iconPosition="end"
                >
                  Đăng Nhập & Tham Gia
                </Button>
              </Form>
            )}

            {/* Google Firebase Sign-in Button */}
            <div className="relative my-3.5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2.5 text-[11px] text-slate-400 font-semibold tracking-wider">
                  Hoặc tiếp tục với
                </span>
              </div>
            </div>

            <Button
              size="large"
              block
              loading={googleLoading}
              onClick={handleGoogleJoin}
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
              <span>Tham gia bằng tài khoản Google</span>
            </Button>

            {/* Chuyển đổi giữa Tạo tài khoản và Đăng nhập */}
            <div className="text-center text-xs text-slate-500 mt-4 pt-3.5 border-t border-slate-100">
              {authMode === 'register' ? (
                <span>
                  Đã có tài khoản?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setErrorMsg('');
                    }}
                    className="text-blue-600 font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0"
                  >
                    Đăng nhập ngay
                  </button>
                </span>
              ) : (
                <span>
                  Chưa có tài khoản / mật khẩu?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setErrorMsg('');
                    }}
                    className="text-blue-600 font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0"
                  >
                    Tạo tài khoản mới
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Bitrix24 Smart Social Account Modal */}
      <SocialAccountModal
        isOpen={socialModalOpen}
        onClose={() => setSocialModalOpen(false)}
        userData={socialUserData}
        onGoogleSignIn={async () => {
          setSocialModalOpen(false);
          await handleGoogleJoin();
        }}
        onLoginWithPassword={() => {
          setSocialModalOpen(false);
          setAuthMode('login');
        }}
        loading={googleLoading}
      />
    </div>
  );
};

export default JoinInvitePage;
