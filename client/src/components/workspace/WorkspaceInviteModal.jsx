import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Tabs,
  Input,
  Button,
  Tag,
  Avatar,
  Table,
  Select,
  Typography,
  message,
  Alert,
  Popconfirm,
  Badge,
  Spin,
  Empty,
  Card,
  Space,
} from 'antd';
import {
  KeyOutlined,
  MailOutlined,
  CopyOutlined,
  CheckOutlined,
  UserAddOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CrownOutlined,
  SafetyCertificateOutlined,
  DeleteOutlined,
  SendOutlined,
  ReloadOutlined,
  StopOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { workspaceApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const { Title, Text, Paragraph } = Typography;

export const WorkspaceInviteModal = ({ isOpen, onClose }) => {
  const { currentWorkspace, user, refreshWorkspaces } = useAuth();

  const [workspaceData, setWorkspaceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('invite');

  // Form Invite Email
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState('');

  // Processing Request / Invites
  const [processingId, setProcessingId] = useState(null);
  const [resendingId, setResendingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchWorkspaceDetails = useCallback(async () => {
    if (!currentWorkspace?._id) return;
    setLoading(true);
    try {
      const res = await workspaceApi.getById(currentWorkspace._id);
      if (res.data.success) {
        setWorkspaceData(res.data.workspace);
      }
    } catch (err) {
      console.error('Lỗi khi tải thông tin Không gian làm việc:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?._id]);

  useEffect(() => {
    if (isOpen && currentWorkspace?._id) {
      fetchWorkspaceDetails();
      setLastInviteLink('');
      setInviteEmail('');
    }
  }, [isOpen, currentWorkspace?._id, fetchWorkspaceDetails]);

  const copyToClipboard = (text, msg = 'Đã sao chép vào bộ nhớ tạm!') => {
    navigator.clipboard.writeText(text);
    message.success(msg);
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      return message.warning('Vui lòng nhập email người muốn mời!');
    }

    setInviting(true);
    try {
      const res = await workspaceApi.inviteByEmail(currentWorkspace._id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      if (res.data.success) {
        message.success(res.data.message || 'Đã tạo lời mời thành công!');
        setLastInviteLink(res.data.invite?.inviteLink || '');
        setInviteEmail('');
        fetchWorkspaceDetails();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể tạo lời mời');
    } finally {
      setInviting(false);
    }
  };

  const handleProcessRequest = async (requestId, action, role = 'member') => {
    setProcessingId(requestId);
    try {
      const res = await workspaceApi.handleJoinRequest(currentWorkspace._id, requestId, {
        action,
        role,
      });

      if (res.data.success) {
        message.success(res.data.message);
        await fetchWorkspaceDetails();
        await refreshWorkspaces();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể xử lý yêu cầu');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemoveMember = async (targetUserId) => {
    try {
      const res = await workspaceApi.removeMember(currentWorkspace._id, targetUserId);
      if (res.data.success) {
        message.success(res.data.message);
        fetchWorkspaceDetails();
        refreshWorkspaces();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể xóa thành viên');
    }
  };

  const handleResendInvite = async (inviteId) => {
    setResendingId(inviteId);
    try {
      const res = await workspaceApi.resendInvite(currentWorkspace._id, inviteId);
      if (res.data.success) {
        message.success(res.data.message || 'Đã gửi lại email lời mời thành công!');
        fetchWorkspaceDetails();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể gửi lại email lời mời');
    } finally {
      setResendingId(null);
    }
  };

  const handleCancelInvite = async (inviteId) => {
    setCancellingId(inviteId);
    try {
      const res = await workspaceApi.cancelInvite(currentWorkspace._id, inviteId);
      if (res.data.success) {
        message.success(res.data.message || 'Đã hủy lời mời');
        fetchWorkspaceDetails();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể hủy lời mời');
    } finally {
      setCancellingId(null);
    }
  };

  const isOwner =
    workspaceData?.owner?._id === user?._id ||
    workspaceData?.owner === user?._id ||
    currentWorkspace?.isOwner;

  const isAdmin =
    isOwner ||
    workspaceData?.members?.some(
      (m) =>
        (m.user?._id === user?._id || m.user === user?._id) &&
        (m.role === 'admin' || m.role === 'owner')
    );

  const pendingList = workspaceData?.pendingRequests || [];
  const membersList = workspaceData?.members || [];
  const invitesList = workspaceData?.invites || [];
  const pendingInvitesCount = invitesList.filter(
    (i) => i.status === 'pending' && new Date(i.expiresAt) > new Date()
  ).length;

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={720}
      title={
        <div className="flex items-center gap-2 text-slate-800 text-lg font-bold pb-2 border-b border-slate-100">
          <TeamOutlined className="text-blue-600" />
          <span>Thành Viên & Mã Mời Không Gian: {currentWorkspace?.name}</span>
        </div>
      }
      destroyOnClose
    >
      {loading && !workspaceData ? (
        <div className="py-16 text-center">
          <Spin size="large" tip="Đang tải dữ liệu không gian làm việc..." />
        </div>
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'invite',
              label: (
                <span className="font-semibold flex items-center gap-1.5">
                  <KeyOutlined /> Mã Tham Gia & Mời Email
                </span>
              ),
              children: (
                <div className="space-y-5 py-2">
                  {/* Workspace Code Box */}
                  <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
                          Mã Không Gian Làm Việc (Workspace Code)
                        </div>
                        <div className="text-2xl font-black font-mono tracking-wider text-slate-900 mt-0.5">
                          {currentWorkspace?.code}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Chia sẻ mã này cho đồng nghiệp để họ gửi yêu cầu gia nhập vào không gian.
                        </div>
                      </div>

                      <Button
                        type="primary"
                        icon={<CopyOutlined />}
                        size="large"
                        className="font-bold shadow-md shadow-blue-500/20"
                        onClick={() =>
                          copyToClipboard(
                            currentWorkspace?.code,
                            `Đã sao chép mã ${currentWorkspace?.code}!`
                          )
                        }
                      >
                        Sao Chép Mã
                      </Button>
                    </div>
                  </Card>

                  {/* Send Email Invite Form */}
                  <Card title={<span className="font-bold text-sm text-slate-700">Mời Thành Viên Mới Qua Email</span>} className="border-slate-200">
                    <form onSubmit={handleSendInvite} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                            Email người nhận <span className="text-red-500">*</span>
                          </label>
                          <Input
                            prefix={<MailOutlined className="text-slate-400 mr-1" />}
                            placeholder="nhanvien@doanhnghiep.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="rounded-lg"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                            Vai trò chỉ định
                          </label>
                          <Select
                            value={inviteRole}
                            onChange={setInviteRole}
                            className="w-full"
                            options={[
                              { value: 'member', label: 'Thành viên (Member)' },
                              { value: 'admin', label: 'Quản trị viên (Admin)' },
                            ]}
                          />
                        </div>
                      </div>

                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={inviting}
                        icon={<SendOutlined />}
                        className="font-semibold bg-blue-600 shadow-sm"
                      >
                        Tạo Lời Mời
                      </Button>
                    </form>

                    {/* Result Link */}
                    {lastInviteLink && (
                      <Alert
                        type="success"
                        className="mt-4 rounded-xl"
                        message="Link mời đã sẵn sàng!"
                        description={
                          <div className="space-y-2 mt-1">
                            <div className="p-2 bg-white rounded border border-emerald-200 font-mono text-xs break-all text-slate-700 select-all">
                              {lastInviteLink}
                            </div>
                            <Button
                              size="small"
                              type="primary"
                              icon={<CopyOutlined />}
                              onClick={() => copyToClipboard(lastInviteLink, 'Đã sao chép Link mời tham gia!')}
                              className="font-semibold"
                            >
                              Sao chép Link mời gửi nhanh (Zalo/Telegram)
                            </Button>
                          </div>
                        }
                      />
                    )}
                  </Card>
                </div>
              ),
            },
            {
              key: 'sent_invites',
              label: (
                <span className="font-semibold flex items-center gap-1.5">
                  <MailOutlined /> Lời Mời Đã Gửi
                  {pendingInvitesCount > 0 && (
                    <Badge count={pendingInvitesCount} size="small" className="ml-1" />
                  )}
                </span>
              ),
              children: (
                <div className="py-2 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2 px-1">
                    <span>
                      Danh sách các tài khoản đã nhận link/email mời vào Không gian làm việc.
                    </span>
                    <span className="font-bold text-slate-700">
                      Tổng số: {invitesList.length}
                    </span>
                  </div>

                  {invitesList.length === 0 ? (
                    <Empty
                      description="Chưa có lời mời qua email nào được tạo."
                      className="py-12"
                    />
                  ) : (
                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                      {invitesList.map((inv) => {
                        const isExpired =
                          inv.status === 'expired' ||
                          (inv.status === 'pending' &&
                            new Date(inv.expiresAt) < new Date());
                        const isAccepted = inv.status === 'accepted';
                        const isPending = inv.status === 'pending' && !isExpired;
                        const inviteLink = `${window.location.origin}/join-invite?token=${inv.token}`;

                        return (
                          <div
                            key={inv._id || inv.token}
                            className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-200 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar
                                style={{
                                  backgroundColor: isAccepted
                                    ? '#10b981'
                                    : isPending
                                    ? '#f59e0b'
                                    : '#94a3b8',
                                }}
                              >
                                {inv.email ? inv.email.charAt(0).toUpperCase() : 'M'}
                              </Avatar>
                              <div>
                                <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                  <span>{inv.email}</span>
                                  {inv.role === 'admin' ? (
                                    <Tag color="red" className="text-[10px] m-0">
                                      Admin
                                    </Tag>
                                  ) : (
                                    <Tag color="blue" className="text-[10px] m-0">
                                      Member
                                    </Tag>
                                  )}
                                  {isAccepted ? (
                                    <Tag
                                      color="green"
                                      icon={<CheckCircleOutlined />}
                                      className="text-[11px] m-0"
                                    >
                                      Đã tham gia
                                    </Tag>
                                  ) : isPending ? (
                                    <Tag
                                      color="gold"
                                      icon={<ClockCircleOutlined />}
                                      className="text-[11px] m-0"
                                    >
                                      Chờ xác nhận
                                    </Tag>
                                  ) : (
                                    <Tag color="default" className="text-[11px] m-0">
                                      Đã hết hạn
                                    </Tag>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                                  <span>
                                    Hạn: {new Date(inv.expiresAt).toLocaleDateString('vi-VN')}
                                  </span>
                                  {inv.invitedBy?.name && (
                                    <span>Người mời: {inv.invitedBy.name}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions for pending / expired invites */}
                            {isAdmin && !isAccepted && (
                              <div className="flex items-center gap-2 self-end sm:self-center">
                                <Button
                                  size="small"
                                  icon={<CopyOutlined />}
                                  onClick={() =>
                                    copyToClipboard(
                                      inviteLink,
                                      `Đã sao chép link mời của ${inv.email}!`
                                    )
                                  }
                                  title="Sao chép Link mời"
                                />

                                <Button
                                  size="small"
                                  icon={<ReloadOutlined />}
                                  loading={resendingId === inv._id}
                                  onClick={() => handleResendInvite(inv._id)}
                                  className="text-blue-600 border-blue-200 hover:border-blue-500"
                                >
                                  Gửi lại mail
                                </Button>

                                <Popconfirm
                                  title="Hủy lời mời này?"
                                  description="Người nhận sẽ không thể sử dụng liên kết cũ nữa."
                                  onConfirm={() => handleCancelInvite(inv._id)}
                                  okText="Hủy lời mời"
                                  cancelText="Đóng"
                                  okButtonProps={{ danger: true }}
                                >
                                  <Button
                                    danger
                                    type="text"
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    loading={cancellingId === inv._id}
                                  />
                                </Popconfirm>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'requests',
              label: (
                <span className="font-semibold flex items-center gap-1.5">
                  <ClockCircleOutlined /> Yêu Cầu Chờ Duyệt
                  {pendingList.length > 0 && (
                    <Badge count={pendingList.length} size="small" className="ml-1" />
                  )}
                </span>
              ),
              children: (
                <div className="py-2 space-y-3">
                  {!isAdmin && (
                    <Alert
                      type="warning"
                      showIcon
                      message="Chỉ Chủ sở hữu hoặc Quản trị viên mới có quyền phê duyệt yêu cầu gia nhập."
                      className="mb-3"
                    />
                  )}

                  {pendingList.length === 0 ? (
                    <Empty
                      description="Hiện không có yêu cầu nào đang chờ duyệt."
                      className="py-12"
                    />
                  ) : (
                    pendingList.map((req) => {
                      const applicant = req.user || {};
                      const isProcessing = processingId === req._id;

                      return (
                        <div
                          key={req._id}
                          className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar style={{ backgroundColor: '#2563eb' }} size="large">
                              {applicant.name ? applicant.name[0].toUpperCase() : 'U'}
                            </Avatar>
                            <div>
                              <div className="font-bold text-slate-800 text-sm">
                                {applicant.name || 'Người dùng'}
                              </div>
                              <div className="text-xs text-slate-400">{applicant.email}</div>
                              {req.message && (
                                <div className="text-xs text-slate-600 mt-1 italic bg-white p-1.5 rounded border border-slate-100">
                                  "{req.message}"
                                </div>
                              )}
                              <div className="text-[11px] text-slate-400 mt-1">
                                Gửi lúc: {new Date(req.requestedAt).toLocaleString('vi-VN')}
                              </div>
                            </div>
                          </div>

                          {isAdmin && (
                            <div className="flex items-center gap-2 self-end sm:self-center">
                              <Button
                                danger
                                size="small"
                                disabled={isProcessing}
                                onClick={() => handleProcessRequest(req._id, 'reject')}
                              >
                                Từ chối
                              </Button>
                              <Button
                                type="primary"
                                size="small"
                                loading={isProcessing}
                                onClick={() => handleProcessRequest(req._id, 'approve', 'member')}
                                className="bg-emerald-600 hover:bg-emerald-500 border-emerald-600 font-semibold"
                              >
                                Phê duyệt
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ),
            },
            {
              key: 'members',
              label: (
                <span className="font-semibold flex items-center gap-1.5">
                  <TeamOutlined /> Danh Sách Thành Viên ({membersList.length})
                </span>
              ),
              children: (
                <div className="py-2">
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {membersList.map((m) => {
                      const u = m.user || {};
                      const isThisOwner =
                        u._id === workspaceData?.owner?._id ||
                        u._id === workspaceData?.owner;

                      return (
                        <div
                          key={u._id || Math.random()}
                          className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 hover:border-blue-200 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar style={{ backgroundColor: '#2563eb' }}>
                              {u.name ? u.name[0].toUpperCase() : 'U'}
                            </Avatar>
                            <div>
                              <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                {u.name}
                                {isThisOwner ? (
                                  <Tag color="gold" icon={<CrownOutlined />} className="text-[11px] m-0">
                                    Chủ sở hữu
                                  </Tag>
                                ) : m.role === 'admin' ? (
                                  <Tag color="red" icon={<SafetyCertificateOutlined />} className="text-[11px] m-0">
                                    Quản trị viên
                                  </Tag>
                                ) : (
                                  <Tag color="blue" className="text-[11px] m-0">
                                    Thành viên
                                  </Tag>
                                )}
                              </div>
                              <div className="text-xs text-slate-400">{u.email}</div>
                            </div>
                          </div>

                          {/* Action remove member */}
                          {isAdmin && !isThisOwner && u._id !== user?._id && (
                            <Popconfirm
                              title="Xác nhận xóa thành viên"
                              description={`Bạn có chắc muốn xóa ${u.name} khỏi không gian làm việc này?`}
                              onConfirm={() => handleRemoveMember(u._id)}
                              okText="Xóa"
                              cancelText="Hủy"
                              okButtonProps={{ danger: true }}
                            >
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                size="small"
                                className="hover:bg-red-50"
                              />
                            </Popconfirm>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ),
            },
          ]}
        />
      )}
    </Modal>
  );
};
