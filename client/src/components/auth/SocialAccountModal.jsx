import React from 'react';
import { Modal, Spin } from 'antd';
import { RightOutlined, CloseOutlined } from '@ant-design/icons';

export const SocialAccountModal = ({
  isOpen,
  onClose,
  userData,
  onGoogleSignIn,
  onLoginWithPassword,
  loading = false,
}) => {
  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      centered
      width={440}
      closeIcon={<CloseOutlined className="text-slate-400 hover:text-slate-600" />}
      className="bitrix-social-modal"
      styles={{
        content: {
          borderRadius: '24px',
          padding: '36px 32px 30px',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.15)',
        },
      }}
    >
      <div className="text-center">
        {/* Title */}
        <h3 className="text-xl font-bold text-slate-800 leading-snug tracking-tight mb-2">
          Email này đã được liên kết<br />với một tài khoản xã hội
        </h3>

        {/* Subtitle */}
        <p className="text-xs text-slate-400 mb-6">
          Các tùy chọn đăng nhập khác
        </p>

        {/* Social Card (Google) */}
        <div
          role="button"
          tabIndex={0}
          onClick={loading ? undefined : onGoogleSignIn}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (!loading) onGoogleSignIn();
            }
          }}
          className={`w-full bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 hover:border-blue-400 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-xs hover:shadow-md transition-all cursor-pointer group mb-6 text-left select-none ${
            loading ? 'opacity-70 pointer-events-none' : ''
          }`}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Google Icon */}
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <svg
                style={{ width: 22, height: 22, minWidth: 22, minHeight: 22 }}
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
            </div>

            {/* Name & Email */}
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors truncate">
                {userData?.name || 'Tài khoản Google'}
              </div>
              <div className="text-xs text-slate-500 font-medium truncate mt-0.5">
                {userData?.email}
              </div>
            </div>
          </div>

          {/* Right Chevron Arrow */}
          <div className="text-slate-400 group-hover:text-blue-600 transition-colors pl-2 shrink-0">
            {loading ? <Spin size="small" /> : <RightOutlined className="text-sm" />}
          </div>
        </div>

        {/* Bottom Link */}
        <div>
          <button
            type="button"
            onClick={onLoginWithPassword}
            className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline bg-transparent border-0 cursor-pointer p-0 transition-colors"
          >
            hoặc đăng nhập bằng mật khẩu
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SocialAccountModal;
