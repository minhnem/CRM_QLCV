import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Input,
  Button,
  Tabs,
  Tag,
  Avatar,
  Badge,
  Typography,
  message,
  Switch,
  Alert,
  Space,
  Divider,
} from 'antd';
import {
  AppstoreOutlined,
  PlusCircleOutlined,
  KeyOutlined,
  RightOutlined,
  CrownOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  LogoutOutlined,
  CheckCircleOutlined,
  ThunderboltFilled,
  CopyOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { workspaceApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export const WorkspaceOnboarding = () => {
  const {
    user,
    workspaces,
    currentWorkspace,
    refreshWorkspaces,
    switchWorkspace,
    logout,
  } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('join'); // 'create' | 'join'
  const [loading, setLoading] = useState(false);

  // Form Create State
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);

  // Form Join State
  const [joinCode, setJoinCode] = useState('');
  const [joinMessage, setJoinMessage] = useState('');

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!createName.trim()) {
      return message.warning('Vui lòng nhập tên Không gian làm việc!');
    }

    setLoading(true);
    try {
      const res = await workspaceApi.create({
        name: createName.trim(),
        description: createDesc.trim(),
        settings: {
          autoApproveJoinCode: autoApprove,
          allowMemberInvite: true,
        },
      });

      if (res.data.success) {
        message.success(`🎉 Đã tạo không gian "${res.data.workspace.name}" với mã ${res.data.workspace.code}!`);
        await refreshWorkspaces();
        navigate('/');
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể tạo không gian làm việc');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      return message.warning('Vui lòng nhập mã Không gian làm việc!');
    }

    setLoading(true);
    try {
      const res = await workspaceApi.joinByCode({
        code: joinCode.trim(),
        message: joinMessage.trim(),
      });

      if (res.data.success) {
        message.success(res.data.message);
        await refreshWorkspaces();

        if (res.data.status === 'joined') {
          navigate('/');
        } else {
          // Trạng thái pending, reset input
          setJoinCode('');
          setJoinMessage('');
        }
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể tham gia không gian làm việc này');
    } finally {
      setLoading(false);
    }
  };

  const handleEnterWorkspace = async (ws) => {
    if (ws.isPending) {
      return message.info('Yêu cầu của bạn đang chờ Quản trị viên của không gian này phê duyệt!');
    }

    try {
      await switchWorkspace(ws._id);
      navigate('/');
    } catch (err) {
      console.error(err);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    message.success(`Đã sao chép mã ${code}`);
  };

  // Lọc danh sách: các workspace có thể vào được (active) và đang chờ (pending)
  const activeWorkspaces = workspaces.filter((w) => !w.isPending);
  const pendingWorkspaces = workspaces.filter((w) => w.isPending);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <AppstoreOutlined style={{ fontSize: '22px' }} />
          </div>
          <div>
            <div className="font-extrabold text-slate-900 tracking-tight text-base leading-tight">
              CRM • QLCV
            </div>
            <div className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
              Hệ thống Không gian làm việc
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Avatar style={{ backgroundColor: '#2563eb' }}>
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </Avatar>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-800">{user?.name}</div>
              <div className="text-[11px] text-slate-400">{user?.email}</div>
            </div>
          </div>
          <Button
            type="text"
            danger
            icon={<LogoutOutlined />}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Đăng xuất
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <Tag color="blue" className="px-3 py-1 font-semibold uppercase tracking-wider text-xs mb-3">
            Thiết lập Không gian làm việc (Workspace)
          </Tag>
          <Title level={2} style={{ fontWeight: 800, marginBottom: 8, color: '#0f172a' }}>
            Chào mừng {user?.name || 'bạn'} đến với hệ thống!
          </Title>
          <Paragraph className="text-slate-500 text-sm md:text-base">
            Hãy tham gia vào không gian của doanh nghiệp bằng <b>Mã mời</b> hoặc <b>Khởi tạo không gian mới</b> để bắt đầu quản lý dự án và nhân sự.
          </Paragraph>
        </div>

        {/* Existing Workspaces List (If any) */}
        {workspaces.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Không gian bạn đang tham gia ({workspaces.length})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeWorkspaces.map((ws) => {
                const isCurrent = currentWorkspace?._id === ws._id;
                return (
                  <Card
                    key={ws._id}
                    hoverable
                    onClick={() => handleEnterWorkspace(ws)}
                    className={`border transition-all ${
                      isCurrent
                        ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/20'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          size={44}
                          shape="square"
                          className="rounded-xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm"
                        >
                          {ws.name[0]?.toUpperCase()}
                        </Avatar>
                        <div>
                          <div className="font-bold text-slate-800 text-base flex items-center gap-2">
                            {ws.name}
                            {ws.isOwner && (
                              <Tag color="gold" icon={<CrownOutlined />} className="text-[11px] m-0">
                                Chủ sở hữu
                              </Tag>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Tag color="cyan" className="font-mono font-semibold text-xs">
                              {ws.code}
                            </Tag>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <TeamOutlined /> {ws.membersCount} thành viên
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button
                        type={isCurrent ? 'primary' : 'default'}
                        icon={<RightOutlined />}
                        className="font-semibold"
                      >
                        {isCurrent ? 'Tiếp tục vào' : 'Chuyển vào'}
                      </Button>
                    </div>

                    {ws.description && (
                      <div className="mt-3 text-xs text-slate-500 line-clamp-1 border-t border-slate-100 pt-2">
                        {ws.description}
                      </div>
                    )}
                  </Card>
                );
              })}

              {/* Pending Workspaces */}
              {pendingWorkspaces.map((ws) => (
                <Card
                  key={ws._id}
                  className="border-dashed border-amber-300 bg-amber-50/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        size={44}
                        shape="square"
                        className="rounded-xl font-bold bg-amber-500 shadow-sm text-white"
                      >
                        <ClockCircleOutlined />
                      </Avatar>
                      <div>
                        <div className="font-bold text-slate-800 text-base">{ws.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Tag color="warning" icon={<ClockCircleOutlined />}>
                            Đang chờ duyệt
                          </Tag>
                          <Tag color="cyan" className="font-mono text-xs">
                            {ws.code}
                          </Tag>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-amber-700 bg-amber-100/60 p-2 rounded-lg">
                    Yêu cầu gia nhập của bạn đã được gửi tới Quản trị viên. Hệ thống sẽ kích hoạt ngay khi được duyệt!
                  </div>
                </Card>
              ))}
            </div>

            <Divider className="my-6">
              <span className="text-xs text-slate-400 font-medium">Hoặc tạo thêm / tham gia không gian khác</span>
            </Divider>
          </div>
        )}

        {/* Tab Actions: Join by code or Create new */}
        <Card className="shadow-lg border-slate-200">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            centered
            size="large"
            items={[
              {
                key: 'join',
                label: (
                  <span className="font-bold flex items-center gap-2 px-2">
                    <KeyOutlined /> Gia Nhập Bằng Mã (Join Code)
                  </span>
                ),
                children: (
                  <div className="max-w-xl mx-auto py-4">
                    <Alert
                      type="info"
                      showIcon
                      message="Tham gia không gian của công ty hoặc đội nhóm"
                      description="Nếu người quản lý đã gửi cho bạn Mã không gian làm việc (ví dụ: WS-TRUE), hãy nhập mã dưới đây để yêu cầu quyền truy cập."
                      className="mb-6 rounded-xl"
                    />

                    <form onSubmit={handleJoinByCode} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                          Mã Không Gian Làm Việc (Workspace Code) <span className="text-red-500">*</span>
                        </label>
                        <Input
                          size="large"
                          prefix={<KeyOutlined className="text-blue-500 mr-2" />}
                          placeholder="Ví dụ: WS-TRUE hoặc WS-XXXXXX"
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                          className="font-mono font-bold text-base rounded-xl"
                          allowClear
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                          Lời nhắn gửi Quản trị viên (Tùy chọn)
                        </label>
                        <TextArea
                          rows={2}
                          placeholder="Ví dụ: Em là Nguyễn Văn A bên phòng Thiết kế mới vào..."
                          value={joinMessage}
                          onChange={(e) => setJoinMessage(e.target.value)}
                          className="rounded-xl"
                        />
                      </div>

                      <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        loading={loading}
                        block
                        className="font-bold rounded-xl h-11 text-base shadow-md shadow-blue-500/20"
                      >
                        Gửi Yêu Cầu Gia Nhập
                      </Button>
                    </form>

                    {/* Quick Test Demo Hint */}
                    <div className="mt-6 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-700">Mã không gian mẫu: </span>
                        <Tag color="blue" className="font-mono font-bold text-xs cursor-pointer ml-1" onClick={() => setJoinCode('WS-TRUE')}>
                          WS-TRUE
                        </Tag>
                        <span className="text-slate-400 text-[11px] block mt-0.5">
                          (Bấm vào để điền nhanh không gian mẫu Bitrix24 Vietnam Corp)
                        </span>
                      </div>
                      <Button size="small" type="dashed" onClick={() => copyCode('WS-TRUE')} icon={<CopyOutlined />}>
                        Copy mã
                      </Button>
                    </div>
                  </div>
                ),
              },
              {
                key: 'create',
                label: (
                  <span className="font-bold flex items-center gap-2 px-2">
                    <PlusCircleOutlined /> Tạo Không Gian Mới (Create New)
                  </span>
                ),
                children: (
                  <div className="max-w-xl mx-auto py-4">
                    <Alert
                      type="success"
                      showIcon
                      message="Khởi tạo tổ chức / doanh nghiệp mới"
                      description="Bạn sẽ trở thành Chủ sở hữu (Owner) của không gian này, có toàn quyền quản trị, duyệt thành viên và cấp mã tham gia."
                      className="mb-6 rounded-xl"
                    />

                    <form onSubmit={handleCreateWorkspace} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                          Tên Không Gian Làm Việc <span className="text-red-500">*</span>
                        </label>
                        <Input
                          size="large"
                          prefix={<AppstoreOutlined className="text-blue-500 mr-2" />}
                          placeholder="Ví dụ: Công ty TNHH Nam Minh Media"
                          value={createName}
                          onChange={(e) => setCreateName(e.target.value)}
                          className="font-semibold text-base rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                          Mô tả hoạt động (Tùy chọn)
                        </label>
                        <TextArea
                          rows={2}
                          placeholder="Ví dụ: Quản lý dự án truyền thông và vận hành sàn thương mại điện tử..."
                          value={createDesc}
                          onChange={(e) => setCreateDesc(e.target.value)}
                          className="rounded-xl"
                        />
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs text-slate-800">
                            Tự động duyệt khi nhập đúng mã
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Nếu bật, bất kỳ ai có mã đều vào được ngay mà không cần bạn phê duyệt.
                          </div>
                        </div>
                        <Switch checked={autoApprove} onChange={setAutoApprove} />
                      </div>

                      <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        loading={loading}
                        block
                        className="font-bold rounded-xl h-11 text-base shadow-md shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-500 border-emerald-600"
                      >
                        Khởi Tạo & Nhận Mã Mời
                      </Button>
                    </form>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-slate-400 border-t border-slate-200 bg-white">
        CRM & Quản Lý Công Việc • Nền tảng Đa Không Gian Làm Việc Real-time
      </footer>
    </div>
  );
};
