import React, { useState } from 'react';
import {
  Drawer,
  Tag,
  Button,
  Tabs,
  Row,
  Col,
  Progress,
  Descriptions,
  Table,
  Space,
  Avatar,
  Divider,
  Popconfirm,
  message,
  Card,
  Select,
  Upload,
  Tooltip,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  DollarOutlined,
  BankOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ProjectOutlined,
  ApartmentOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  UploadOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileImageOutlined,
  FileOutlined,
  DownloadOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { STAGES_CONFIG } from './ContractModal';
import { contractApi } from '../../services/api';
import { usePermission } from '../../hooks/usePermission';

export const ContractDetailDrawer = ({
  visible,
  onClose,
  contract,
  onEdit,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [updatingStage, setUpdatingStage] = useState(false);
  const [updatingMilestone, setUpdatingMilestone] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { canViewValue } = usePermission();
  const allowViewMoney = canViewValue('contracts') && !contract?.valueMasked;

  if (!contract) return null;

  const currentStageConfig =
    STAGES_CONFIG.find((s) => s.key === contract.stage) || STAGES_CONFIG[0];

  // Tính tỷ lệ đã thu tiền
  const totalVal = Number(contract.totalValue) || 0;
  const paidVal = Number(contract.paidAmount) || 0;
  const remainingVal = Math.max(0, totalVal - paidVal);
  const paidPercent = totalVal > 0 ? Math.round((paidVal / totalVal) * 100) : 0;

  // Tính trạng thái hạn
  const now = dayjs();
  const endDate = contract.endDate ? dayjs(contract.endDate) : null;
  const daysLeft = endDate ? endDate.diff(now, 'day') : null;

  let expiryStatus = null;
  if (['completed', 'cancelled'].includes(contract.stage)) {
    expiryStatus = <Tag color="default">Đã kết thúc</Tag>;
  } else if (daysLeft !== null) {
    if (daysLeft < 0) {
      expiryStatus = <Tag color="error">Đã quá hạn {Math.abs(daysLeft)} ngày</Tag>;
    } else if (daysLeft <= 30) {
      expiryStatus = (
        <Tag color="warning" icon={<ClockCircleOutlined />}>
          Còn {daysLeft} ngày (Sắp hết hạn)
        </Tag>
      );
    } else {
      expiryStatus = <Tag color="success">Còn {daysLeft} ngày</Tag>;
    }
  }

  // Đổi giai đoạn nhanh
  const handleStageChange = async (newStage) => {
    try {
      setUpdatingStage(true);
      await contractApi.updateStage(contract._id, newStage);
      message.success('Đã cập nhật giai đoạn hợp đồng');
      onRefresh();
    } catch (err) {
      console.error(err);
      message.error('Không thể cập nhật giai đoạn');
    } finally {
      setUpdatingStage(false);
    }
  };

  // Cập nhật trạng thái đợt thanh toán (Toggle paid / unpaid)
  const handleToggleMilestone = async (milestone) => {
    const newStatus = milestone.status === 'paid' ? 'unpaid' : 'paid';
    try {
      setUpdatingMilestone(milestone._id);
      await contractApi.updateMilestone(contract._id, milestone._id, {
        status: newStatus,
        paidDate: newStatus === 'paid' ? new Date() : null,
      });
      message.success(
        newStatus === 'paid'
          ? `Đã xác nhận thanh toán đợt "${milestone.name}"`
          : `Đã hoàn tác trạng thái đợt "${milestone.name}"`
      );
      onRefresh();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi cập nhật đợt thanh toán');
    } finally {
      setUpdatingMilestone(null);
    }
  };

  // Upload thêm file đính kèm
  const handleUploadMore = async ({ file, onSuccess, onError }) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await contractApi.uploadAttachment(formData);
      if (res.data.success) {
        const newAttachment = res.data.attachment;
        const currentList = contract.attachments || [];
        await contractApi.update(contract._id, {
          attachments: [...currentList, newAttachment],
        });
        message.success(`Đã tải lên tệp ${file.name}`);
        onSuccess('ok');
        onRefresh();
      }
    } catch (err) {
      console.error(err);
      message.error('Không thể tải tệp lên');
      onError(err);
    } finally {
      setUploading(false);
    }
  };

  // Xóa file đính kèm
  const handleDeleteAttachment = async (index) => {
    try {
      const currentList = contract.attachments || [];
      const updatedList = currentList.filter((_, idx) => idx !== index);
      await contractApi.update(contract._id, { attachments: updatedList });
      message.success('Đã xóa tệp đính kèm');
      onRefresh();
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi xóa tệp');
    }
  };

  // Xóa hợp đồng
  const handleDeleteContract = async () => {
    try {
      await contractApi.delete(contract._id);
      message.success('Đã xóa hợp đồng');
      onClose();
      onRefresh();
    } catch (err) {
      console.error(err);
      message.error('Không thể xóa hợp đồng');
    }
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'pdf':
        return <FilePdfOutlined className="text-red-500 text-xl" />;
      case 'doc':
        return <FileWordOutlined className="text-blue-500 text-xl" />;
      case 'image':
        return <FileImageOutlined className="text-emerald-500 text-xl" />;
      default:
        return <FileOutlined className="text-slate-400 text-xl" />;
    }
  };

  return (
    <Drawer
      open={visible}
      onClose={onClose}
      width={780}
      title={
        <div className="flex items-center justify-between pr-4">
          <div className="flex items-center gap-2.5">
            <Tag color="blue" className="font-mono font-bold text-sm px-2.5 py-0.5">
              {contract.code}
            </Tag>
            <Tag
              style={{
                color: currentStageConfig.color,
                backgroundColor: currentStageConfig.bg,
                borderColor: currentStageConfig.border,
              }}
              className="font-medium text-xs px-2 py-0.5"
            >
              {currentStageConfig.label}
            </Tag>
          </div>

          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                onEdit(contract);
              }}
            >
              Chỉnh sửa
            </Button>
            <Popconfirm
              title="Xóa hợp đồng này?"
              description="Hành động này không thể hoàn tác. Bạn chắc chắn chứ?"
              onConfirm={handleDeleteContract}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        </div>
      }
      destroyOnClose
    >
      {/* Title & Stage Selector Bar */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800 leading-snug mb-1">{contract.title}</h2>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Tag color="cyan">{contract.contractType || 'Hợp đồng'}</Tag>
          <span>• Tạo bởi: <strong>{contract.creator?.name || 'Hệ thống'}</strong></span>
          <span>• Ngày tạo: {dayjs(contract.createdAt).format('DD/MM/YYYY HH:mm')}</span>
        </div>
      </div>

      {/* Bitrix24 Pipeline Quick Stage Bar */}
      <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Chuyển Giai Đoạn Nhanh:
        </span>
        <Select
          value={contract.stage}
          loading={updatingStage}
          onChange={handleStageChange}
          className="flex-1 max-w-xs"
        >
          {STAGES_CONFIG.map((s) => (
            <Select.Option key={s.key} value={s.key}>
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: s.color }}
                />
                <span className="font-medium">{s.label}</span>
              </div>
            </Select.Option>
          ))}
        </Select>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'overview',
            label: (
              <span className="flex items-center gap-1.5 font-medium">
                <DollarOutlined /> Tổng Quan & Đối Tác
              </span>
            ),
            children: (
              <div className="space-y-4">
                {/* Financial Summary Box */}
                <Card className="bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white border-blue-200 shadow-2xs">
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Tổng Giá Trị HĐ</div>
                      <div className="text-xl font-black text-blue-700 tracking-tight">
                        {allowViewMoney ? (
                          <>
                            {totalVal.toLocaleString('vi-VN')}{' '}
                            <span className="text-xs font-normal">VNĐ</span>
                          </>
                        ) : (
                          <Tooltip title="Giá trị được bảo mật theo phân quyền của bạn">
                            <span className="font-mono text-slate-400">****** VNĐ</span>
                          </Tooltip>
                        )}
                      </div>
                      {allowViewMoney && contract.taxPercent > 0 && (
                        <div className="text-xs text-slate-400">VAT: {contract.taxPercent}%</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Đã Thanh Toán</div>
                      <div className="text-xl font-black text-emerald-600 tracking-tight">
                        {allowViewMoney ? (
                          <>
                            {paidVal.toLocaleString('vi-VN')}{' '}
                            <span className="text-xs font-normal">VNĐ</span>
                          </>
                        ) : (
                          <Tooltip title="Giá trị được bảo mật theo phân quyền của bạn">
                            <span className="font-mono text-slate-400">****** VNĐ</span>
                          </Tooltip>
                        )}
                      </div>
                      <div className="text-xs text-emerald-600 font-medium">
                        {allowViewMoney ? `Đạt ${paidPercent}% tổng giá trị` : 'Theo dõi theo tiến độ'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Công Nợ Còn Phải Thu</div>
                      <div className="text-xl font-black text-amber-600 tracking-tight">
                        {allowViewMoney ? (
                          <>
                            {remainingVal.toLocaleString('vi-VN')}{' '}
                            <span className="text-xs font-normal">VNĐ</span>
                          </>
                        ) : (
                          <Tooltip title="Giá trị được bảo mật theo phân quyền của bạn">
                            <span className="font-mono text-slate-400">****** VNĐ</span>
                          </Tooltip>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {contract.paymentMilestones?.filter((m) => m.status === 'unpaid').length || 0} đợt chưa thu
                      </div>
                    </div>
                  </div>
                  {allowViewMoney && (
                    <Progress
                      percent={paidPercent}
                      strokeColor={{ '0%': '#2563eb', '100%': '#059669' }}
                      status={paidPercent >= 100 ? 'success' : 'active'}
                      strokeWidth={8}
                    />
                  )}
                </Card>

                {/* Partner Information Card */}
                <Card
                  title={
                    <div className="flex items-center gap-2 text-slate-800 text-sm font-bold">
                      <BankOutlined className="text-blue-600" />
                      <span>Thông Tin Khách Hàng / Đối Tác</span>
                    </div>
                  }
                  size="small"
                  className="border-slate-200"
                >
                  <Descriptions column={2} size="small" bordered>
                    <Descriptions.Item label="Doanh nghiệp" span={2}>
                      <strong className="text-slate-800">{contract.partner?.name}</strong>
                    </Descriptions.Item>
                    <Descriptions.Item label="Mã số thuế (MST)">
                      {contract.partner?.taxCode || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Đại diện ký kết">
                      {contract.partner?.representative ? (
                        <span>
                          {contract.partner.representative}{' '}
                          {contract.partner.role && `(${contract.partner.role})`}
                        </span>
                      ) : (
                        '—'
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Số điện thoại">
                      {contract.partner?.phone ? (
                        <a href={`tel:${contract.partner.phone}`} className="text-blue-600">
                          <PhoneOutlined /> {contract.partner.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Email">
                      {contract.partner?.email ? (
                        <a href={`mailto:${contract.partner.email}`} className="text-blue-600">
                          <MailOutlined /> {contract.partner.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Địa chỉ trụ sở" span={2}>
                      {contract.partner?.address || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tài khoản ngân hàng" span={2}>
                      {contract.partner?.bankAccount ? (
                        <span>
                          <strong>{contract.partner.bankAccount}</strong> - {contract.partner.bankName}
                        </span>
                      ) : (
                        '—'
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                {/* Internal Ownership & Project Linkage */}
                <Card
                  title={
                    <div className="flex items-center gap-2 text-slate-800 text-sm font-bold">
                      <ProjectOutlined className="text-blue-600" />
                      <span>Thực Hiện & Thời Hạn Hiệu Lực</span>
                    </div>
                  }
                  size="small"
                  className="border-slate-200"
                >
                  <Descriptions column={2} size="small" bordered>
                    <Descriptions.Item label="Dự án liên kết" span={2}>
                      {(() => {
                        const projList = Array.isArray(contract.projects) && contract.projects.length > 0
                          ? contract.projects
                          : (contract.project ? [contract.project] : []);
                        if (projList.length === 0) {
                          return <span className="text-slate-400">Không liên kết dự án</span>;
                        }
                        return (
                          <div className="flex flex-wrap gap-1.5">
                            {projList.map((p) => (
                              <Tag key={p._id || p} color="geekblue" className="font-semibold flex items-center gap-1 py-0.5">
                                <ProjectOutlined style={{ color: p.color || '#2563eb' }} /> {p.name || 'Dự án'}
                              </Tag>
                            ))}
                          </div>
                        );
                      })()}
                    </Descriptions.Item>
                    <Descriptions.Item label="Phòng ban phụ trách / Phối hợp" span={2}>
                      {(() => {
                        const deptList = Array.isArray(contract.departments) && contract.departments.length > 0
                          ? contract.departments
                          : (contract.department ? [contract.department] : []);
                        if (deptList.length === 0) {
                          return <span className="text-slate-400">Không chỉ định</span>;
                        }
                        return (
                          <div className="flex flex-wrap gap-1.5">
                            {deptList.map((d) => (
                              <Tag key={d._id || d} color="purple" className="flex items-center gap-1 py-0.5">
                                <ApartmentOutlined style={{ color: d.color || '#9333ea' }} /> {d.name || 'Phòng ban'}
                              </Tag>
                            ))}
                          </div>
                        );
                      })()}
                    </Descriptions.Item>
                    <Descriptions.Item label="Chuyên viên phụ trách">
                      {contract.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <Avatar size="small" style={{ backgroundColor: '#2563eb' }}>
                            {contract.assignedTo.name?.[0]?.toUpperCase()}
                          </Avatar>
                          <span className="font-medium text-slate-800">
                            {contract.assignedTo.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Chưa phân công</span>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tự động gia hạn">
                      {contract.isAutoRenew ? (
                        <Tag color="success">Bật tự động gia hạn</Tag>
                      ) : (
                        <Tag color="default">Không gia hạn</Tag>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày ký kết">
                      {contract.signDate ? dayjs(contract.signDate).format('DD/MM/YYYY') : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày hiệu lực">
                      {contract.startDate ? dayjs(contract.startDate).format('DD/MM/YYYY') : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày hết hạn">
                      <span className="font-semibold text-slate-800">
                        {contract.endDate ? dayjs(contract.endDate).format('DD/MM/YYYY') : '—'}
                      </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Trạng thái hiệu lực">
                      {expiryStatus}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                {/* Scope & Notes */}
                {(contract.description || contract.notes) && (
                  <Card size="small" className="border-slate-200">
                    {contract.description && (
                      <div className="mb-2">
                        <div className="text-xs font-bold text-slate-700 uppercase mb-1">
                          Phạm vi & Nội dung công việc:
                        </div>
                        <div className="text-sm text-slate-600 whitespace-pre-line bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          {contract.description}
                        </div>
                      </div>
                    )}
                    {contract.notes && (
                      <div>
                        <div className="text-xs font-bold text-slate-700 uppercase mb-1">
                          Ghi chú nội bộ:
                        </div>
                        <div className="text-sm text-slate-600 whitespace-pre-line bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                          {contract.notes}
                        </div>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            ),
          },
          {
            key: 'milestones',
            label: (
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircleOutlined /> Tiến Độ Thanh Toán ({contract.paymentMilestones?.length || 0})
              </span>
            ),
            children: (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-slate-500 font-medium">
                    Bấm nút <strong>"Xác nhận đã thu"</strong> để ghi nhận dòng tiền thực tế
                  </div>
                </div>

                <div className="space-y-3">
                  {(contract.paymentMilestones || []).map((m, idx) => {
                    const isPaid = m.status === 'paid';
                    return (
                      <div
                        key={m._id || idx}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isPaid
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : 'bg-white border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-slate-800 text-sm">{m.name}</span>
                              {isPaid ? (
                                <Tag color="success" icon={<CheckCircleOutlined />}>
                                  Đã thanh toán
                                </Tag>
                              ) : (
                                <Tag color="default">Chưa thanh toán</Tag>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-4">
                              <span>
                                Hạn thanh toán:{' '}
                                <strong>
                                  {m.dueDate ? dayjs(m.dueDate).format('DD/MM/YYYY') : 'Không ghi'}
                                </strong>
                              </span>
                              {m.paidDate && (
                                <span className="text-emerald-700">
                                  Ngày trả thực tế:{' '}
                                  <strong>{dayjs(m.paidDate).format('DD/MM/YYYY')}</strong>
                                </span>
                              )}
                            </div>
                            {m.note && (
                              <div className="text-xs text-slate-400 mt-1 italic">
                                Ghi chú: {m.note}
                              </div>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-base font-black text-slate-800 mb-1">
                              {allowViewMoney ? (
                                `${(Number(m.amount) || 0).toLocaleString('vi-VN')} VNĐ`
                              ) : (
                                <Tooltip title="Giá trị được bảo mật theo phân quyền của bạn">
                                  <span className="font-mono text-slate-400 text-xs">****** VNĐ</span>
                                </Tooltip>
                              )}
                            </div>
                            <Button
                              size="small"
                              type={isPaid ? 'default' : 'primary'}
                              loading={updatingMilestone === m._id}
                              onClick={() => handleToggleMilestone(m)}
                              className={
                                isPaid
                                  ? 'hover:border-red-400 hover:text-red-600'
                                  : 'bg-emerald-600 hover:bg-emerald-700'
                              }
                            >
                              {isPaid ? 'Đánh dấu chưa trả' : 'Xác nhận đã thu'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {(!contract.paymentMilestones || contract.paymentMilestones.length === 0) && (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      Chưa có đợt thanh toán nào được thiết lập. Hãy bấm Chỉnh sửa để thêm đợt!
                    </div>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'attachments',
            label: (
              <span className="flex items-center gap-1.5 font-medium">
                <UploadOutlined /> Hồ Sơ & File Scan ({contract.attachments?.length || 0})
              </span>
            ),
            children: (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs text-slate-500">
                    Lưu trữ bản scan hợp đồng, phụ lục, biên bản bàn giao
                  </div>
                  <Upload customRequest={handleUploadMore} showUploadList={false} disabled={uploading}>
                    <Button icon={<UploadOutlined />} loading={uploading} size="small" type="primary">
                      Tải thêm tệp
                    </Button>
                  </Upload>
                </div>

                <div className="space-y-2">
                  {(contract.attachments || []).map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {getFileIcon(file.fileType)}
                        <div className="min-w-0">
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-blue-600 hover:underline block truncate text-sm"
                          >
                            {file.name}
                          </a>
                          <div className="text-xs text-slate-400">
                            {(file.size / 1024).toFixed(1)} KB • Tải lên lúc:{' '}
                            {dayjs(file.uploadedAt).format('DD/MM/YYYY HH:mm')}
                          </div>
                        </div>
                      </div>

                      <Space>
                        <Tooltip title="Tải xuống tệp">
                          <a href={file.url} download={file.name} target="_blank" rel="noreferrer">
                            <Button size="small" icon={<DownloadOutlined />} />
                          </a>
                        </Tooltip>
                        <Popconfirm
                          title="Xóa tệp này?"
                          onConfirm={() => handleDeleteAttachment(idx)}
                          okText="Xóa"
                          cancelText="Hủy"
                          okButtonProps={{ danger: true }}
                        >
                          <Button size="small" danger type="text" icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    </div>
                  ))}

                  {(!contract.attachments || contract.attachments.length === 0) && (
                    <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                      Chưa có tệp đính kèm nào
                    </div>
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />
    </Drawer>
  );
};
