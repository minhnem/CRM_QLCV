import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Switch,
  Button,
  Tabs,
  Row,
  Col,
  Divider,
  Tag,
  Space,
  Upload,
  message,
  Card,
  AutoComplete,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileImageOutlined,
  FileOutlined,
  DollarOutlined,
  ApartmentOutlined,
  ProjectOutlined,
  UserOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  BankOutlined,
  PhoneOutlined,
  MailOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { contractApi } from '../../services/api';
import { usePermission } from '../../hooks/usePermission';

const { TextArea } = Input;

// Gợi ý loại hợp đồng thông dụng nhưng người dùng hoàn toàn có thể tự do nhập bất kỳ text nào
const CONTRACT_TYPE_SUGGESTIONS = [
  { value: 'Hợp đồng Bán / Cung cấp dịch vụ' },
  { value: 'Hợp đồng Mua / Thuê ngoài từ nhà cung cấp' },
  { value: 'Hợp đồng Hợp tác kinh doanh' },
  { value: 'Hợp đồng Nguyên tắc' },
  { value: 'Hợp đồng Dịch vụ / Bảo trì (SLA)' },
  { value: 'Hợp đồng Tư vấn & Đào tạo' },
  { value: 'Hợp đồng Thuê văn phòng / Hạ tầng' },
];

export const STAGES_CONFIG = [
  {
    key: 'draft',
    label: 'Dự thảo / Thương thảo',
    color: '#64748b',
    bg: '#f8fafc',
    border: '#cbd5e1',
  },
  {
    key: 'pending_sign',
    label: 'Chờ ký kết & Duyệt',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  {
    key: 'active',
    label: 'Đang hiệu lực & Thực hiện',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  {
    key: 'settlement',
    label: 'Nghiệm thu & Thanh lý',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
  },
  {
    key: 'completed',
    label: 'Đã hoàn tất & Tất toán',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
  },
  {
    key: 'cancelled',
    label: 'Đã hủy / Thất bại',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
  },
];

export const ContractModal = ({
  visible,
  onClose,
  onSuccess,
  contract = null,
  projects = [],
  departments = [],
  users = [],
}) => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('general');
  const [submitting, setSubmitting] = useState(false);
  const [milestones, setMilestones] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const { canViewValue } = usePermission();
  const allowViewMoney = canViewValue('contracts');

  // Watch totalValue để tính toán đối chiếu đợt thanh toán
  const totalValue = Form.useWatch('totalValue', form) || 0;

  useEffect(() => {
    if (visible) {
      if (contract) {
        // Edit mode
        form.setFieldsValue({
          code: contract.code,
          title: contract.title,
          contractType: contract.contractType || 'Hợp đồng dịch vụ',
          stage: contract.stage || 'draft',
          totalValue: contract.totalValue || 0,
          taxPercent: contract.taxPercent || 0,
          partnerName: contract.partner?.name || '',
          partnerTaxCode: contract.partner?.taxCode || '',
          partnerRepresentative: contract.partner?.representative || '',
          partnerRole: contract.partner?.role || '',
          partnerPhone: contract.partner?.phone || '',
          partnerEmail: contract.partner?.email || '',
          partnerAddress: contract.partner?.address || '',
          partnerBankAccount: contract.partner?.bankAccount || '',
          partnerBankName: contract.partner?.bankName || '',
          signDate: contract.signDate ? dayjs(contract.signDate) : null,
          startDate: contract.startDate ? dayjs(contract.startDate) : null,
          endDate: contract.endDate ? dayjs(contract.endDate) : null,
          isAutoRenew: contract.isAutoRenew || false,
          projects: Array.isArray(contract.projects) && contract.projects.length > 0
            ? contract.projects.map((p) => p?._id || p)
            : (contract.project ? [contract.project?._id || contract.project] : []),
          departments: Array.isArray(contract.departments) && contract.departments.length > 0
            ? contract.departments.map((d) => d?._id || d)
            : (contract.department ? [contract.department?._id || contract.department] : []),
          assignedTo: contract.assignedTo?._id || contract.assignedTo || null,
          description: contract.description || '',
          notes: contract.notes || '',
        });
        setMilestones(contract.paymentMilestones || []);
        setAttachments(contract.attachments || []);
      } else {
        // Create mode
        form.resetFields();
        form.setFieldsValue({
          contractType: 'Hợp đồng dịch vụ',
          stage: 'draft',
          totalValue: 0,
          taxPercent: 0,
          startDate: dayjs(),
          isAutoRenew: false,
          projects: [],
          departments: [],
        });
        setMilestones([
          {
            name: 'Đợt 1 - Tạm ứng khi ký HĐ',
            amount: 0,
            dueDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
            status: 'unpaid',
            note: '',
          },
        ]);
        setAttachments([]);
      }
      setActiveTab('general');
    }
  }, [visible, contract, form]);

  // Thêm một đợt thanh toán
  const handleAddMilestone = () => {
    setMilestones([
      ...milestones,
      {
        name: `Đợt ${milestones.length + 1}`,
        amount: 0,
        dueDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
        status: 'unpaid',
        note: '',
      },
    ]);
  };

  // Xóa đợt thanh toán
  const handleRemoveMilestone = (index) => {
    setMilestones(milestones.filter((_, idx) => idx !== index));
  };

  // Cập nhật giá trị đợt thanh toán
  const handleMilestoneChange = (index, field, value) => {
    const updated = [...milestones];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setMilestones(updated);
  };

  // Upload file đính kèm
  const handleUploadFile = async ({ file, onSuccess: uploadSuccess, onError }) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await contractApi.uploadAttachment(formData);
      if (res.data.success) {
        setAttachments((prev) => [...prev, res.data.attachment]);
        message.success(`Đã tải lên tệp ${file.name}`);
        uploadSuccess('ok');
      }
    } catch (err) {
      console.error('Upload error:', err);
      message.error('Không thể tải tệp lên');
      onError(err);
    } finally {
      setUploading(false);
    }
  };

  // Xóa file đính kèm
  const handleRemoveAttachment = (index) => {
    setAttachments(attachments.filter((_, idx) => idx !== index));
  };

  // Submit Form
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        code: values.code,
        title: values.title,
        contractType: values.contractType, // Input text tự do
        stage: values.stage,
        totalValue: allowViewMoney ? values.totalValue : (contract?.totalValue || 0),
        taxPercent: allowViewMoney ? values.taxPercent : (contract?.taxPercent || 0),
        partner: {
          name: values.partnerName,
          taxCode: values.partnerTaxCode,
          representative: values.partnerRepresentative,
          role: values.partnerRole,
          phone: values.partnerPhone,
          email: values.partnerEmail,
          address: values.partnerAddress,
          bankAccount: values.partnerBankAccount,
          bankName: values.partnerBankName,
        },
        paymentMilestones: allowViewMoney
          ? milestones.map((m) => ({
              ...m,
              amount: Number(m.amount) || 0,
              dueDate: m.dueDate ? dayjs(m.dueDate).toDate() : null,
              paidDate: m.status === 'paid' && !m.paidDate ? new Date() : m.paidDate || null,
            }))
          : (contract?.paymentMilestones || []),
        signDate: values.signDate ? values.signDate.toDate() : null,
        startDate: values.startDate ? values.startDate.toDate() : null,
        endDate: values.endDate ? values.endDate.toDate() : null,
        isAutoRenew: values.isAutoRenew,
        projects: values.projects || [],
        project: (values.projects && values.projects[0]) || null,
        departments: values.departments || [],
        department: (values.departments && values.departments[0]) || null,
        assignedTo: values.assignedTo,
        attachments,
        description: values.description,
        notes: values.notes,
      };

      if (contract) {
        await contractApi.update(contract._id, payload);
        message.success('Cập nhật hợp đồng thành công!');
      } else {
        await contractApi.create(payload);
        message.success('Tạo hợp đồng mới thành công!');
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Submit error:', err);
      if (err.errorFields) {
        message.error('Vui lòng kiểm tra lại các trường thông tin bắt buộc');
      } else {
        message.error(err.response?.data?.message || 'Có lỗi xảy ra');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Tính tổng số tiền các đợt thanh toán
  const totalMilestonesAmount = milestones.reduce(
    (sum, m) => sum + (Number(m.amount) || 0),
    0
  );

  const getFileIcon = (type) => {
    switch (type) {
      case 'pdf':
        return <FilePdfOutlined className="text-red-500 text-lg" />;
      case 'doc':
        return <FileWordOutlined className="text-blue-500 text-lg" />;
      case 'image':
        return <FileImageOutlined className="text-emerald-500 text-lg" />;
      default:
        return <FileOutlined className="text-slate-400 text-lg" />;
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-800 text-base font-bold">
          <DollarOutlined className="text-blue-600" />
          <span>{contract ? `Chỉnh Sửa Hợp Đồng: ${contract.code}` : 'Tạo Mới Hợp Đồng / CRM Deal'}</span>
        </div>
      }
      width={880}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Hủy bỏ
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          onClick={handleSubmit}
          className="bg-blue-600 hover:bg-blue-700 font-semibold"
        >
          {contract ? 'Lưu Thay Đổi' : 'Tạo Hợp Đồng'}
        </Button>,
      ]}
      destroyOnClose
    >
      <Form form={form} layout="vertical" className="mt-2">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'general',
              label: (
                <span className="flex items-center gap-1.5 font-medium">
                  <InfoCircleOutlined /> Thông Tin Chung & Pháp Lý
                </span>
              ),
              children: (
                <div className="py-2">
                  <Row gutter={16}>
                    <Col span={10}>
                      <Form.Item
                        name="code"
                        label="Số / Mã Hợp Đồng"
                        tooltip="Để trống hệ thống sẽ tự động tạo mã dạng HD-YYYY/MM-XXX"
                      >
                        <Input
                          placeholder="VD: HD-2026/04-001"
                          className="uppercase font-semibold tracking-wide"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={14}>
                      <Form.Item
                        name="title"
                        label="Tên / Trích Yếu Hợp Đồng"
                        rules={[{ required: true, message: 'Vui lòng nhập tên hợp đồng' }]}
                      >
                        <Input placeholder="VD: Cung cấp giải pháp phần mềm CRM & Quản lý" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      {/* contractType là Input dạng nhập text tự do theo yêu cầu của user */}
                      <Form.Item
                        name="contractType"
                        label="Loại Hợp Đồng (Nhập tự do)"
                        rules={[{ required: true, message: 'Vui lòng nhập loại hợp đồng' }]}
                        tooltip="Bạn có thể nhập bất kỳ tên loại hợp đồng nào theo nghiệp vụ thực tế"
                      >
                        <AutoComplete
                          options={CONTRACT_TYPE_SUGGESTIONS}
                          placeholder="VD: Hợp đồng Dịch vụ, Hợp đồng Bán hàng..."
                          filterOption={(inputValue, option) =>
                            option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                          }
                        >
                          <Input allowClear />
                        </AutoComplete>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="stage"
                        label="Giai Đoạn Hợp Đồng (Bitrix24 Pipeline)"
                        rules={[{ required: true }]}
                      >
                        <Select>
                          {STAGES_CONFIG.map((s) => (
                            <Select.Option key={s.key} value={s.key}>
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full inline-block"
                                  style={{ backgroundColor: s.color }}
                                />
                                <span>{s.label}</span>
                              </div>
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="signDate" label="Ngày Ký Kết">
                        <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày ký" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="startDate" label="Ngày Bắt Đầu Hiệu Lực">
                        <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày bắt đầu" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="endDate" label="Ngày Hết Hạn / Kết Thúc">
                        <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày hết hạn" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        name="departments"
                        label="Phòng Ban Phụ Trách / Liên Quan"
                        tooltip="Có thể chọn nhiều phòng ban cùng phối hợp thực hiện hợp đồng (VD: Team Web, Team Media)"
                      >
                        <Select
                          mode="multiple"
                          placeholder="Chọn các phòng ban liên quan"
                          allowClear
                          showSearch
                          optionFilterProp="children"
                          maxTagCount="responsive"
                        >
                          {departments.map((d) => (
                            <Select.Option key={d._id} value={d._id}>
                              <div className="flex items-center gap-2">
                                <ApartmentOutlined style={{ color: d.color || '#2563eb' }} />
                                <span>{d.name}</span>
                              </div>
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="projects"
                        label="Dự Án Triển Khai Liên Kết"
                        tooltip="Gắn một hoặc nhiều dự án triển khai cho hợp đồng này (VD: Dự án Làm web, Dự án Media/Video)"
                      >
                        <Select
                          mode="multiple"
                          placeholder="Liên kết các dự án triển khai"
                          allowClear
                          showSearch
                          optionFilterProp="children"
                          maxTagCount="responsive"
                        >
                          {projects.map((p) => (
                            <Select.Option key={p._id} value={p._id}>
                              <div className="flex items-center gap-2">
                                <ProjectOutlined style={{ color: p.color || '#2563eb' }} />
                                <span>{p.name}</span>
                              </div>
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="assignedTo" label="Chuyên Viên Phụ Trách (Sales/PM)">
                        <Select placeholder="Chỉ định nhân sự" allowClear showSearch optionFilterProp="children">
                          {users.map((u) => (
                            <Select.Option key={u._id} value={u._id}>
                              <div className="flex items-center gap-2">
                                <UserOutlined className="text-slate-400" />
                                <span>{u.name}</span>
                                {u.role && <Tag className="text-xs">{u.role}</Tag>}
                              </div>
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div>
                      <div className="font-medium text-slate-800 text-sm">Tự động gia hạn hợp đồng</div>
                      <div className="text-xs text-slate-500">
                        Hệ thống sẽ giữ hiệu lực và nhắc nhở khi đến ngày kết thúc
                      </div>
                    </div>
                    <Form.Item name="isAutoRenew" valuePropName="checked" noStyle>
                      <Switch />
                    </Form.Item>
                  </div>
                </div>
              ),
            },
            {
              key: 'partner',
              label: (
                <span className="flex items-center gap-1.5 font-medium">
                  <BankOutlined /> Đối Tác / Khách Hàng
                </span>
              ),
              children: (
                <div className="py-2">
                  <Row gutter={16}>
                    <Col span={16}>
                      <Form.Item
                        name="partnerName"
                        label="Tên Doanh Nghiệp / Khách Hàng (Bên liên kết)"
                        rules={[{ required: true, message: 'Vui lòng nhập tên đối tác / khách hàng' }]}
                      >
                        <Input placeholder="VD: Công ty Cổ phần Công nghệ ABC" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="partnerTaxCode" label="Mã Số Thuế (MST)">
                        <Input placeholder="VD: 0101234567" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="partnerRepresentative" label="Người Đại Diện Ký Kết">
                        <Input placeholder="VD: Ông Nguyễn Văn A" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="partnerRole" label="Chức Vụ Đại Diện">
                        <Input placeholder="VD: Giám đốc / Tổng giám đốc" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="partnerPhone" label="Số Điện Thoại Liên Hệ">
                        <Input prefix={<PhoneOutlined className="text-slate-400" />} placeholder="0901234567" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="partnerEmail" label="Email Nhận Hóa Đơn / Thông Báo">
                        <Input prefix={<MailOutlined className="text-slate-400" />} placeholder="contact@partner.com" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item name="partnerAddress" label="Địa Chỉ Trụ Sở Đăng Ký">
                    <Input placeholder="VD: Tòa nhà Bitexco, Số 2 Hải Triều, Q.1, TP.HCM" />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="partnerBankAccount" label="Số Tài Khoản Ngân Hàng">
                        <Input placeholder="VD: 1903678999901" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="partnerBankName" label="Tên Ngân Hàng & Chi Nhánh">
                        <Input placeholder="VD: Techcombank - Chi nhánh Sài Gòn" />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              ),
            },
            {
              key: 'finance',
              label: (
                <span className="flex items-center gap-1.5 font-medium">
                  <DollarOutlined /> Tài Chính & Đợt Thanh Toán
                </span>
              ),
              children: !allowViewMoney ? (
                <div className="py-12 text-center text-slate-500">
                  <div className="font-semibold text-slate-700">Thông tin tài chính được bảo mật</div>
                  <div className="text-xs text-slate-400 mt-1">Vai trò của bạn không có quyền xem hoặc chỉnh sửa giá trị hợp đồng.</div>
                </div>
              ) : (
                <div className="py-2">
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="totalValue"
                        label="Tổng Giá Trị Hợp Đồng (VNĐ)"
                        rules={allowViewMoney ? [{ required: true, message: 'Vui lòng nhập giá trị hợp đồng' }] : []}
                      >
                        <InputNumber
                          className="w-full font-bold text-base text-blue-600"
                          formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(val) => val.replace(/\$\s?|(,*)/g, '')}
                          placeholder="0"
                          addonAfter="VNĐ"
                          min={0}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="taxPercent" label="Thuế VAT (%)">
                        <InputNumber className="w-full" min={0} max={100} addonAfter="%" placeholder="0" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider orientation="left" className="!text-sm !font-semibold !text-slate-700 !my-3">
                    Lịch Trình & Các Đợt Thanh Toán (Milestones)
                  </Divider>

                  {/* Cảnh báo chênh lệch nếu tổng đợt thanh toán không khớp tổng hợp đồng */}
                  {totalValue > 0 && totalMilestonesAmount !== totalValue && (
                    <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between">
                      <span>
                        ⚠️ Tổng các đợt hiện tại:{' '}
                        <strong>{totalMilestonesAmount.toLocaleString('vi-VN')} VNĐ</strong> (Chênh lệch:{' '}
                        {Math.abs(totalValue - totalMilestonesAmount).toLocaleString('vi-VN')} VNĐ so với Tổng hợp đồng)
                      </span>
                      <Button
                        size="small"
                        type="link"
                        onClick={() => {
                          const diff = totalValue - totalMilestonesAmount;
                          if (diff > 0) {
                            setMilestones([
                              ...milestones,
                              {
                                name: `Đợt ${milestones.length + 1} - Quyết toán`,
                                amount: diff,
                                dueDate: dayjs().add(60, 'day').format('YYYY-MM-DD'),
                                status: 'unpaid',
                                note: '',
                              },
                            ]);
                          }
                        }}
                      >
                        Thêm đợt bù chênh lệch
                      </Button>
                    </div>
                  )}

                  <div className="space-y-3 mb-4">
                    {milestones.map((m, idx) => (
                      <Card
                        key={idx}
                        size="small"
                        className="bg-slate-50/70 border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors"
                      >
                        <Row gutter={12} align="middle">
                          <Col span={7}>
                            <div className="text-xs text-slate-500 mb-1 font-medium">Tên đợt thanh toán</div>
                            <Input
                              value={m.name}
                              placeholder="VD: Đợt 1 - Cọc 30%"
                              onChange={(e) => handleMilestoneChange(idx, 'name', e.target.value)}
                            />
                          </Col>
                          <Col span={6}>
                            <div className="text-xs text-slate-500 mb-1 font-medium">Số tiền (VNĐ)</div>
                            <InputNumber
                              className="w-full font-semibold"
                              value={m.amount}
                              min={0}
                              formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={(val) => val.replace(/\$\s?|(,*)/g, '')}
                              onChange={(val) => handleMilestoneChange(idx, 'amount', val || 0)}
                            />
                          </Col>
                          <Col span={5}>
                            <div className="text-xs text-slate-500 mb-1 font-medium">Hạn thanh toán</div>
                            <DatePicker
                              className="w-full"
                              format="DD/MM/YYYY"
                              value={m.dueDate ? dayjs(m.dueDate) : null}
                              onChange={(d) =>
                                handleMilestoneChange(
                                  idx,
                                  'dueDate',
                                  d ? d.format('YYYY-MM-DD') : null
                                )
                              }
                            />
                          </Col>
                          <Col span={4}>
                            <div className="text-xs text-slate-500 mb-1 font-medium">Trạng thái</div>
                            <Select
                              className="w-full"
                              value={m.status || 'unpaid'}
                              onChange={(val) => handleMilestoneChange(idx, 'status', val)}
                            >
                              <Select.Option value="unpaid">
                                <Tag color="default">Chưa trả</Tag>
                              </Select.Option>
                              <Select.Option value="paid">
                                <Tag color="success">Đã thu</Tag>
                              </Select.Option>
                              <Select.Option value="overdue">
                                <Tag color="error">Quá hạn</Tag>
                              </Select.Option>
                            </Select>
                          </Col>
                          <Col span={2} className="text-right">
                            <Button
                              danger
                              type="text"
                              icon={<DeleteOutlined />}
                              onClick={() => handleRemoveMilestone(idx)}
                            />
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </div>

                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={handleAddMilestone}
                    className="border-blue-400 text-blue-600 hover:text-blue-700"
                  >
                    Thêm Đợt Thanh Toán Mới
                  </Button>
                </div>
              ),
            },
            {
              key: 'attachments',
              label: (
                <span className="flex items-center gap-1.5 font-medium">
                  <UploadOutlined /> Tệp Đính Kèm & Ghi Chú
                </span>
              ),
              children: (
                <div className="py-2">
                  <div className="mb-4">
                    <div className="font-medium text-slate-800 text-sm mb-2">
                      Tệp scan hợp đồng (Chữ ký & dấu mộc đỏ, phụ lục...)
                    </div>
                    <Upload
                      customRequest={handleUploadFile}
                      showUploadList={false}
                      disabled={uploading}
                    >
                      <Button icon={<UploadOutlined />} loading={uploading}>
                        Tải tệp lên (PDF, DOCX, Ảnh)
                      </Button>
                    </Upload>
                  </div>

                  {attachments.length > 0 && (
                    <div className="space-y-2 mb-6">
                      {attachments.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {getFileIcon(file.fileType)}
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-blue-600 hover:underline truncate"
                            >
                              {file.name}
                            </a>
                            <span className="text-xs text-slate-400">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <Button
                            danger
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveAttachment(idx)}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <Form.Item name="description" label="Phạm Vi & Nội Dung Công Việc">
                    <TextArea rows={3} placeholder="Tóm tắt nội dung chính của hợp đồng..." />
                  </Form.Item>

                  <Form.Item name="notes" label="Ghi Chú Nội Bộ / Điều Khoản Đặc Biệt">
                    <TextArea rows={2} placeholder="Ghi chú riêng cho nhân viên quản lý hoặc kế toán..." />
                  </Form.Item>
                </div>
              ),
            },
          ]}
        />
      </Form>
    </Modal>
  );
};
