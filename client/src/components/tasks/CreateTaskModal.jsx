import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Row,
  Col,
  Button,
  Alert,
  Tooltip,
  Tag,
  Divider,
} from 'antd';
import {
  VideoCameraOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SafetyCertificateOutlined,
  CrownOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { taskApi, projectApi, userApi, departmentApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';

const { TextArea } = Input;

export const CreateTaskModal = ({
  isOpen,
  onClose,
  onTaskCreated,
  initialDepartmentId,
  initialProjectId,
  taskToEdit = null,
}) => {
  const { user } = useAuth();
  const { can } = usePermission();
  const [form] = Form.useForm();
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Watch selected project, department, and status
  const selectedProjectId = Form.useWatch('project', form);
  const selectedDepartmentId = Form.useWatch('department', form);
  const selectedStatus = Form.useWatch('status', form);

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const canViewProjects = can('projects', 'view');
          const canViewDepts = can('departments', 'view');

          const [projRes, deptRes, userRes] = await Promise.all([
            canViewProjects
              ? projectApi.getAll().catch(() => ({ data: { success: false, projects: [] } }))
              : Promise.resolve({ data: { success: true, projects: [] } }),
            canViewDepts
              ? departmentApi.getAll().catch(() => ({ data: { success: false, departments: [] } }))
              : Promise.resolve({ data: { success: true, departments: [] } }),
            userApi.getAll().catch(() => ({ data: { success: false, users: [] } })),
          ]);
          setProjects(projRes.data?.projects || []);
          setDepartments(deptRes.data?.departments || []);
          setUsers(userRes.data?.users || []);

          if (taskToEdit) {
            form.setFieldsValue({
              title: taskToEdit.title,
              description: taskToEdit.description || '',
              project: taskToEdit.project?._id || taskToEdit.project,
              department: taskToEdit.department?._id || taskToEdit.department || undefined,
              assignee: taskToEdit.assignee?._id || taskToEdit.assignee || undefined,
              reviewer: taskToEdit.reviewer?._id || taskToEdit.reviewer || undefined,
              status: taskToEdit.status || 'todo',
              priority: taskToEdit.priority || 'medium',
              startDate: taskToEdit.startDate ? dayjs(taskToEdit.startDate) : undefined,
              dueDate: taskToEdit.dueDate ? dayjs(taskToEdit.dueDate) : undefined,
              deliverableUrl: taskToEdit.submission?.url || '',
              submissionNote: taskToEdit.submission?.note || '',
            });
          } else {
            const defaultProj = projRes.data.projects?.find((p) => p._id === initialProjectId) || projRes.data.projects?.[0];
            const defaultProjectId = initialProjectId || defaultProj?._id;
            const defaultReviewer = defaultProj?.manager?._id || defaultProj?.manager;

            form.setFieldsValue({
              title: '',
              description: '',
              project: defaultProjectId,
              department: initialDepartmentId || undefined,
              assignee: undefined,
              reviewer: defaultReviewer || undefined,
              status: 'todo',
              priority: 'medium',
              startDate: undefined,
              dueDate: undefined,
              deliverableUrl: '',
              submissionNote: '',
            });
          }
        } catch (err) {
          console.error('Failed to load modal dependencies:', err);
        }
      };
      fetchData();
    } else {
      form.resetFields();
      setIsRejectModalOpen(false);
      setRejectComment('');
    }
  }, [isOpen, form, initialDepartmentId, initialProjectId, taskToEdit]);

  // Find the selected project object
  const currentProject = projects.find((p) => p._id === selectedProjectId);
  const projectDeptIds = (currentProject?.departments || []).map((d) => (d._id || d).toString());

  // Departments allowed for this project
  const selectableDepartments = useMemo(() => {
    if (currentProject && projectDeptIds.length > 0) {
      return departments.filter((d) => projectDeptIds.includes(d._id.toString()));
    }
    return departments;
  }, [currentProject, projectDeptIds, departments]);

  // Users allowed based on selected department or project departments
  const selectableUsers = useMemo(() => {
    // 1. If a specific department is chosen
    if (selectedDepartmentId) {
      const dept = departments.find((d) => d._id === selectedDepartmentId);
      const memberIds = new Set();
      if (dept) {
        (dept.members || []).forEach((m) => memberIds.add((m._id || m).toString()));
        if (dept.head) memberIds.add((dept.head._id || dept.head).toString());
      }

      return users.filter((u) => {
        const uDeptId = (u.departmentId && (u.departmentId._id || u.departmentId))?.toString();
        return (
          memberIds.has(u._id.toString()) ||
          (uDeptId && uDeptId === selectedDepartmentId.toString()) ||
          (dept && u.department === dept.name)
        );
      });
    }

    // 2. If no department is selected, but the project has linked departments
    if (currentProject && projectDeptIds.length > 0) {
      const allDeptMemberIds = new Set();
      departments
        .filter((d) => projectDeptIds.includes(d._id.toString()))
        .forEach((d) => {
          (d.members || []).forEach((m) => allDeptMemberIds.add((m._id || m).toString()));
          if (d.head) allDeptMemberIds.add((d.head._id || d.head).toString());
        });

      // Also include direct project members
      (currentProject.members || []).forEach((m) => allDeptMemberIds.add((m._id || m).toString()));

      return users.filter((u) => {
        const uDeptId = (u.departmentId && (u.departmentId._id || u.departmentId))?.toString();
        return (
          allDeptMemberIds.has(u._id.toString()) ||
          (uDeptId && projectDeptIds.includes(uDeptId)) ||
          departments.some((d) => projectDeptIds.includes(d._id.toString()) && u.department === d.name)
        );
      });
    }

    // 3. Fallback: all users
    return users;
  }, [selectedDepartmentId, selectedProjectId, departments, users, currentProject, projectDeptIds]);

  // Giới hạn người nhận việc nếu vai trò không có quyền phân công cho người khác
  const canAssignOthers = can('tasks', 'assign');
  const finalSelectableUsers = useMemo(() => {
    if (canAssignOthers) return selectableUsers;
    return selectableUsers.filter(
      (u) => (u._id || u.id)?.toString() === (user?._id || user?.id)?.toString()
    );
  }, [canAssignOthers, selectableUsers, user]);

  // When project changes, adjust department if current is invalid
  useEffect(() => {
    if (selectedProjectId && selectableDepartments.length > 0) {
      const currentDept = form.getFieldValue('department');
      const isDeptValid = selectableDepartments.some(
        (d) => d._id.toString() === currentDept?.toString()
      );
      if (!isDeptValid) {
        form.setFieldsValue({
          department: selectableDepartments.length === 1 ? selectableDepartments[0]._id : undefined,
        });
      }
    }
  }, [selectedProjectId, selectableDepartments, form]);

  // When department or selectableUsers changes, validate current assignee
  useEffect(() => {
    const currentAssignee = form.getFieldValue('assignee');
    if (currentAssignee) {
      const isAssigneeValid = selectableUsers.some(
        (u) => u._id.toString() === currentAssignee.toString()
      );
      if (!isAssigneeValid) {
        form.setFieldsValue({ assignee: undefined });
      }
    }
  }, [selectedDepartmentId, selectableUsers, form]);

  // Check if current user has permission to review this task
  const currentUserId = (user?._id || user?.id)?.toString();
  const canReview = useMemo(() => {
    if (!taskToEdit) return false;
    if (['admin', 'director'].includes(user?.role)) return true;
    if (can('tasks', 'edit') || can('tasks', 'delete')) return true;
    const reviewerId = (taskToEdit.reviewer?._id || taskToEdit.reviewer)?.toString();
    if (reviewerId && reviewerId === currentUserId) return true;
    const pmId = (taskToEdit.project?.manager?._id || taskToEdit.project?.manager)?.toString();
    if (pmId && pmId === currentUserId) return true;
    return false;
  }, [taskToEdit, user, can, currentUserId]);

  const handleApprove = async () => {
    if (!taskToEdit) return;
    try {
      setReviewing(true);
      const res = await taskApi.reviewTask(taskToEdit._id, {
        action: 'approve',
        comment: 'Đã phê duyệt công việc đạt yêu cầu',
      });
      if (res.data?.success) {
        message.success('Đã phê duyệt công việc thành công! Trạng thái chuyển sang Hoàn thành.');
        if (onTaskCreated) onTaskCreated(res.data.task);
        onClose();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi phê duyệt công việc');
    } finally {
      setReviewing(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!taskToEdit) return;
    if (!rejectComment.trim()) {
      message.warning('Vui lòng nhập lý do hoặc yêu cầu chỉnh sửa!');
      return;
    }
    try {
      setReviewing(true);
      const res = await taskApi.reviewTask(taskToEdit._id, {
        action: 'request_changes',
        comment: rejectComment.trim(),
      });
      if (res.data?.success) {
        message.info('Đã gửi phản hồi yêu cầu sửa đổi cho người phụ trách!');
        setIsRejectModalOpen(false);
        setRejectComment('');
        if (onTaskCreated) onTaskCreated(res.data.task);
        onClose();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi gửi yêu cầu chỉnh sửa');
    } finally {
      setReviewing(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        title: values.title,
        description: values.description,
        project: values.project,
        department: values.department || undefined,
        assignee: values.assignee || undefined,
        reviewer: values.reviewer || undefined,
        priority: values.priority || 'medium',
        status: values.status || 'todo',
        startDate: values.startDate ? values.startDate.toISOString() : undefined,
        dueDate: values.dueDate ? values.dueDate.toISOString() : undefined,
      };

      if (values.deliverableUrl || values.submissionNote) {
        payload.submission = {
          url: values.deliverableUrl || '',
          note: values.submissionNote || '',
          submittedAt: new Date(),
          submittedBy: currentUserId,
        };
      }

      if (taskToEdit) {
        const res = await taskApi.update(taskToEdit._id, payload);
        if (res.data.success) {
          message.success('Cập nhật công việc thành công!');
          form.resetFields();
          if (onTaskCreated) onTaskCreated(res.data.task);
          onClose();
        }
      } else {
        const res = await taskApi.create(payload);
        if (res.data.success) {
          message.success('Tạo công việc mới thành công!');
          form.resetFields();
          if (onTaskCreated) onTaskCreated(res.data.task);
          onClose();
        }
      }
    } catch (err) {
      if (err.errorFields) return; // Antd validation error
      message.error(err.response?.data?.message || 'Có lỗi khi xử lý công việc');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        title={
          <div className="flex items-center justify-between pr-6">
            <span className="text-lg font-bold">
              {taskToEdit ? 'Chi Tiết & Chỉnh Sửa Công Việc' : 'Tạo Công Việc Mới'}
            </span>
            {taskToEdit?.status && (
              <Tag
                color={
                  taskToEdit.status === 'done'
                    ? 'success'
                    : taskToEdit.status === 'review'
                    ? 'warning'
                    : taskToEdit.status === 'in_progress'
                    ? 'processing'
                    : 'default'
                }
                className="font-medium px-2 py-0.5"
              >
                {taskToEdit.status === 'done'
                  ? 'Hoàn thành'
                  : taskToEdit.status === 'review'
                  ? 'Chờ duyệt'
                  : taskToEdit.status === 'in_progress'
                  ? 'Đang làm'
                  : 'Cần làm'}
              </Tag>
            )}
          </div>
        }
        open={isOpen}
        onOk={handleSubmit}
        onCancel={onClose}
        confirmLoading={loading}
        okText={taskToEdit ? 'Lưu thay đổi' : 'Tạo công việc'}
        cancelText="Đóng"
        width={680}
        destroyOnClose
      >
        {/* BANNER 1: CÔNG VIỆC ĐANG CHỜ DUYỆT */}
        {taskToEdit && taskToEdit.status === 'review' && (
          <div className="mt-3 mb-4 p-4 rounded-xl border border-amber-300 bg-amber-50 shadow-xs">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">⏳</span>
                <div>
                  <div className="font-semibold text-amber-900 text-sm">
                    Công việc đang ở giai đoạn Chờ Duyệt
                  </div>
                  <div className="text-xs text-amber-700 mt-0.5">
                    {taskToEdit.reviewer ? (
                      <>
                        Người duyệt: <strong className="font-medium text-amber-900">{taskToEdit.reviewer.name}</strong>
                      </>
                    ) : (
                      'Chưa chỉ định người duyệt riêng (Quản lý dự án duyệt)'
                    )}
                  </div>
                  {taskToEdit.submission?.submittedAt && (
                    <div className="text-[11px] text-amber-600 mt-1">
                      Nộp lúc: {dayjs(taskToEdit.submission.submittedAt).format('HH:mm DD/MM/YYYY')}
                      {taskToEdit.submission.submittedBy?.name ? ` bởi ${taskToEdit.submission.submittedBy.name}` : ''}
                    </div>
                  )}
                </div>
              </div>

              {canReview && (
                <div className="flex items-center gap-2">
                  <Button
                    type="primary"
                    danger
                    icon={<CloseCircleOutlined />}
                    loading={reviewing}
                    onClick={() => {
                      setRejectComment('');
                      setIsRejectModalOpen(true);
                    }}
                  >
                    Yêu cầu sửa lại
                  </Button>
                  <Button
                    type="primary"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 shadow-sm"
                    icon={<CheckCircleOutlined />}
                    loading={reviewing}
                    onClick={handleApprove}
                  >
                    Duyệt Đạt
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BANNER 2: PHẢN HỒI YÊU CẦU CHỈNH SỬA (NẾU CÓ) */}
        {taskToEdit?.reviewFeedback?.action === 'changes_requested' && (
          <div className="mt-3 mb-4 p-3.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 shadow-xs">
            <div className="flex items-center gap-2 font-semibold text-xs text-rose-800 uppercase tracking-wide">
              <ExclamationCircleOutlined className="text-rose-600 text-base" />
              Yêu cầu chỉnh sửa từ {taskToEdit.reviewFeedback.reviewedBy?.name || 'Reviewer'}:
            </div>
            <div className="mt-2 text-sm bg-white p-2.5 rounded-lg border border-rose-200 text-slate-800 leading-relaxed">
              {taskToEdit.reviewFeedback.comment}
            </div>
            {taskToEdit.reviewFeedback.reviewedAt && (
              <div className="text-[11px] text-rose-600 mt-1 text-right">
                {dayjs(taskToEdit.reviewFeedback.reviewedAt).format('HH:mm DD/MM/YYYY')}
              </div>
            )}
          </div>
        )}

        <Form form={form} layout="vertical" className="mt-3">
          <Form.Item
            label="Tên công việc"
            name="title"
            rules={[{ required: true, message: 'Vui lòng nhập tên công việc' }]}
          >
            <Input placeholder="VD: Edit video giới thiệu sản phẩm bản Full HD..." autoFocus />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Dự án trực thuộc"
                name="project"
                rules={[{ required: true, message: 'Vui lòng chọn dự án' }]}
              >
                <Select placeholder="Chọn dự án">
                  {projects.map((p) => (
                    <Select.Option key={p._id} value={p._id}>
                      [{p.code || 'PRJ'}] {p.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Phòng ban phụ trách"
                name="department"
                tooltip="Chỉ hiển thị các phòng ban tham gia dự án đã chọn"
              >
                <Select
                  placeholder={
                    selectableDepartments.length === 0
                      ? '-- Dự án chưa gán phòng ban --'
                      : '-- Chọn phòng ban --'
                  }
                  allowClear
                >
                  {selectableDepartments.map((d) => (
                    <Select.Option key={d._id} value={d._id}>
                      🏢 {d.name} {d.parent ? `(${d.parent.name})` : ''}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Người phụ trách (Assignee)"
                name="assignee"
                tooltip={
                  selectedDepartmentId
                    ? 'Chỉ hiển thị nhân viên thuộc phòng ban đã chọn'
                    : currentProject && projectDeptIds.length > 0
                    ? 'Chỉ hiển thị nhân viên thuộc các phòng ban của dự án này'
                    : 'Chọn nhân sự nhận việc'
                }
              >
                <Select
                  placeholder={
                    finalSelectableUsers.length === 0
                      ? '-- Chưa có nhân viên phù hợp --'
                      : '-- Chưa giao --'
                  }
                  allowClear
                  showSearch
                  optionFilterProp="filterText"
                  optionLabelProp="label"
                >
                  {finalSelectableUsers.map((u) => (
                    <Select.Option
                      key={u._id}
                      value={u._id}
                      label={u.name}
                      filterText={`${u.name} ${u.email}`}
                    >
                      <div className="flex items-center justify-between py-0.5">
                        <span className="font-medium text-slate-800">{u.name}</span>
                        <span className="text-xs text-slate-400">{u.email}</span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label={
                  <span className="flex items-center gap-1 font-medium text-indigo-700">
                    <SafetyCertificateOutlined /> Người kiểm duyệt (Reviewer)
                  </span>
                }
                name="reviewer"
                tooltip="Người sẽ nhận thông báo và trực tiếp duyệt nghiệm thu sản phẩm (Video/Thiết kế/Tài liệu)"
              >
                <Select
                  placeholder="-- Chọn người duyệt (mặc định PM dự án) --"
                  allowClear
                  showSearch
                  optionFilterProp="filterText"
                  optionLabelProp="label"
                >
                  {users.map((u) => (
                    <Select.Option
                      key={u._id}
                      value={u._id}
                      label={`⭐ ${u.name}`}
                      filterText={`${u.name} ${u.email}`}
                    >
                      <div className="flex items-center justify-between py-0.5">
                        <span className="font-medium text-slate-800">⭐ {u.name}</span>
                        <span className="text-xs text-slate-400">{u.email}</span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* KHU VỰC BÀN GIAO SẢN PHẨM / LINK DRIVE / VIDEO */}
          <div className="p-3.5 mb-4 rounded-xl border border-blue-200 bg-blue-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-xs uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <VideoCameraOutlined className="text-blue-600 text-sm" />
                Sản phẩm nghiệm thu (Link Video / Drive / Figma / File)
              </span>
              {form.getFieldValue('deliverableUrl') && (
                <a
                  href={form.getFieldValue('deliverableUrl')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-blue-300 shadow-2xs"
                >
                  <LinkOutlined /> Mở xem sản phẩm ↗
                </a>
              )}
            </div>

            <Form.Item
              name="deliverableUrl"
              label={<span className="text-xs text-slate-600 font-medium">Link nộp bài (Google Drive, Youtube, Figma, OneDrive...)</span>}
              className="mb-2"
            >
              <Input
                prefix={<LinkOutlined className="text-slate-400" />}
                placeholder="https://drive.google.com/file/... hoặc https://youtube.com/watch?v=..."
              />
            </Form.Item>

            <Form.Item
              name="submissionNote"
              label={<span className="text-xs text-slate-600 font-medium">Ghi chú cho Reviewer (nếu có)</span>}
              className="mb-0"
            >
              <Input
                placeholder="VD: Đã cắt ghép xong theo kịch bản v2, thời lượng 1p30s..."
              />
            </Form.Item>
          </div>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Trạng thái công việc" name="status" initialValue="todo">
                <Select>
                  <Select.Option value="todo">📋 Cần làm (To Do)</Select.Option>
                  <Select.Option value="in_progress">⚙️ Đang làm (In Progress)</Select.Option>
                  <Select.Option value="review">⏳ Chờ duyệt (Review)</Select.Option>
                  <Select.Option value="done">✅ Hoàn thành (Done)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Mức độ ưu tiên" name="priority" initialValue="medium">
                <Select>
                  <Select.Option value="low">Thấp</Select.Option>
                  <Select.Option value="medium">Bình thường</Select.Option>
                  <Select.Option value="high">Ưu tiên cao</Select.Option>
                  <Select.Option value="urgent">Khẩn cấp</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Ngày bắt đầu" name="startDate">
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày bắt đầu" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Hạn hoàn thành (Deadline)" name="dueDate">
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày hạn chót" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Mô tả chi tiết" name="description">
            <TextArea rows={3} placeholder="Ghi chú chi tiết yêu cầu công việc..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* POPUP NHẬP LÝ DO / YÊU CẦU SỬA ĐỔI */}
      <Modal
        title={
          <div className="text-rose-600 font-bold flex items-center gap-2">
            <CloseCircleOutlined /> Yêu Cầu Chỉnh Sửa Lại
          </div>
        }
        open={isRejectModalOpen}
        onOk={handleConfirmReject}
        onCancel={() => setIsRejectModalOpen(false)}
        confirmLoading={reviewing}
        okText="Gửi yêu cầu sửa"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
        destroyOnClose
      >
        <div className="py-2">
          <p className="text-sm text-slate-600 mb-2">
            Vui lòng ghi rõ nội dung hoặc mốc thời gian (timestamp trong video) cần điều chỉnh để nhân viên thực hiện nắm được:
          </p>
          <TextArea
            rows={4}
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="VD: Ở giây thứ 15 phần nhạc nền bị lấn tiếng thuyết minh; Thay đổi logo sang màu trắng ở phút 01:20..."
            autoFocus
          />
        </div>
      </Modal>
    </>
  );
};

