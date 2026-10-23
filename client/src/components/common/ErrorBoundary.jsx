import React from 'react';
import { Button, Result } from 'antd';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <Result
            status="500"
            title="Đã xảy ra lỗi giao diện"
            subTitle={
              this.state.error?.message ||
              'Hệ thống gặp sự cố khi hiển thị trang này. Vui lòng tải lại trang hoặc quay về trang chủ.'
            }
            extra={[
              <Button type="primary" key="reload" onClick={this.handleReload}>
                Tải lại trang
              </Button>,
              <Button key="home" onClick={this.handleGoHome}>
                Về trang chủ
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
