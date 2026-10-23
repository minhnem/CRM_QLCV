import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Form, Input, Button, Alert, Typography, Result, Space } from 'antd';
import { MailOutlined, ArrowLeftOutlined, SendOutlined, CheckCircleFilled, AppstoreOutlined } from '@ant-design/icons';
import { authApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;

export const ForgotPassword = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentEmail, setSentEmail] = useState('');

  const handleFinish = async (values) => {
    setError('');
    setLoading(true);

    try {
      const res = await authApi.forgotPassword({ email: values.email });
      if (res.data.success) {
        setSentEmail(values.email);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau.'
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
            Quên Mật Khẩu?
          </Title>
          <Text type="secondary" className="text-sm">
            Nhập email tài khoản để nhận liên kết khôi phục
          </Text>
        </div>

        {sentEmail ? (
          <div className="text-center py-2">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              <CheckCircleFilled />
            </div>
            <Title level={4} style={{ marginBottom: 8, color: '#0f172a' }}>
              Kiểm tra hộp thư của bạn
            </Title>
            <Paragraph className="text-slate-600 text-sm mb-6">
              Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu tới địa chỉ:
              <br />
              <strong className="text-blue-600">{sentEmail}</strong>
              <br />
              <span className="text-xs text-slate-400 mt-2 block">
                (Liên kết có hiệu lực trong vòng 30 phút. Đừng quên kiểm tra cả thư mục Spam/Rác)
              </span>
            </Paragraph>

            <Space direction="vertical" className="w-full" size="middle">
              <Button
                type="default"
                block
                size="large"
                onClick={() => {
                  setSentEmail('');
                  form.resetFields();
                }}
              >
                Gửi lại với email khác
              </Button>

              <Link to="/login" className="block text-center">
                <Button type="link" icon={<ArrowLeftOutlined />}>
                  Quay lại Đăng nhập
                </Button>
              </Link>
            </Space>
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
                label="Email đã đăng ký"
                name="email"
                rules={[
                  { required: true, message: 'Vui lòng nhập địa chỉ email!' },
                  { type: 'email', message: 'Địa chỉ email không hợp lệ!' },
                ]}
              >
                <Input
                  prefix={<MailOutlined className="text-slate-400 mr-1" />}
                  placeholder="name@example.com"
                  size="large"
                  autoFocus
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                icon={<SendOutlined />}
                className="mt-2 font-bold"
              >
                Gửi liên kết đặt lại mật khẩu
              </Button>
            </Form>

            <div className="text-center text-xs text-slate-500 mt-6 pt-4 border-t border-slate-100">
              <Link to="/login" className="text-slate-600 hover:text-blue-600 font-semibold inline-flex items-center gap-1">
                <ArrowLeftOutlined /> Quay lại Đăng nhập
              </Link>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
