import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { Notification } from '../models/Notification.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import {
  notifyTaskCreated,
  notifyTaskUpdated,
  notifyTaskDeleted,
  getIO,
  broadcastChannelMessage,
} from '../config/socket.js';
import { sendTaskAssignedEmail, sendReviewFeedbackEmail } from '../config/mail.js';

/**
 * Xử lý thông báo 3 kênh khi được giao / chuyển giao Task:
 * 1. Kênh A: In-app Notification (DB + Socket.IO real-time)
 * 2. Kênh B: Email cá nhân qua Gmail SMTP
 * 3. Kênh C: Tin nhắn tương tác kèm thẻ Task Card trong Kênh Chat Dự Án
 */
async function handleTaskAssignmentNotification({ task, assigner, isNew = true }) {
  try {
    if (!task || !task.assignee) return;

    const assigneeId = (task.assignee._id || task.assignee).toString();
    const assignerId = (assigner._id || assigner).toString();
    const isSelfAssigned = assigneeId === assignerId;

    // Lấy thông tin dự án
    let projectName = 'Dự án';
    const projectId = task.project?._id || task.project;
    if (task.project?.name) {
      projectName = task.project.name;
    } else if (projectId) {
      const p = await Project.findById(projectId).select('name');
      if (p) projectName = p.name;
    }

    // Lấy thông tin người được giao
    let assigneeUser = task.assignee;
    if (!assigneeUser?.email) {
      assigneeUser = await User.findById(assigneeId).select('name email avatar');
    }

    const assignerName = assigner.name || 'Người quản lý';
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const taskLink = `${clientUrl}/tasks?project=${projectId}&task=${task._id}`;

    // 1 & 2. In-App Notification + Email (nếu không phải tự giao cho chính mình)
    if (!isSelfAssigned && assigneeUser) {
      try {
        const notif = await Notification.create({
          recipient: assigneeId,
          sender: assignerId,
          type: 'task_assigned',
          title: isNew ? 'Bạn được phân công công việc mới' : 'Bạn được bàn giao công việc',
          message: `${assignerName} đã ${isNew ? 'giao' : 'chuyển giao'} công việc "${task.title}" thuộc dự án "${projectName}" cho bạn.`,
          link: `/tasks?project=${projectId}&task=${task._id}`,
          task: task._id,
          project: projectId,
          isRead: false,
        });

        const populatedNotif = await Notification.findById(notif._id)
          .populate('sender', 'name email avatar')
          .populate('task', 'title status priority dueDate')
          .populate('project', 'name code color');

        const io = getIO();
        if (io) {
          io.to(`user:${assigneeId}`).emit('notification:new', populatedNotif);
        }
      } catch (notifErr) {
        console.error('⚠️ Lỗi tạo thông báo In-app:', notifErr.message);
      }

      // Email notification
      if (assigneeUser.email) {
        sendTaskAssignedEmail({
          to: assigneeUser.email,
          taskTitle: task.title,
          projectName,
          assignerName,
          priority: task.priority || 'medium',
          dueDate: task.dueDate,
          taskLink,
        }).catch((emailErr) => {
          console.error('⚠️ Lỗi gửi email gán task:', emailErr.message);
        });
      }
    }

    // 3. Tin nhắn trong Kênh Chat Dự Án (Channel C)
    if (projectId) {
      try {
        const chatMsg = await Message.create({
          sender: assignerId,
          channelType: 'project',
          channelId: projectId,
          content: isNew
            ? `📋 **Công việc mới:** "${task.title}" đã được giao cho @${assigneeUser?.name || 'thành viên'}`
            : `🔄 **Chuyển giao công việc:** "${task.title}" được giao cho @${assigneeUser?.name || 'thành viên'}`,
          taskRef: task._id,
          mentions: [assigneeId],
        });

        const populatedChatMsg = await Message.findById(chatMsg._id)
          .populate('sender', 'name email avatar role department')
          .populate('mentions', 'name email avatar role')
          .populate('taskRef', 'title status priority dueDate');

        broadcastChannelMessage('project', projectId.toString(), populatedChatMsg);
      } catch (chatErr) {
        console.error('⚠️ Lỗi gửi tin nhắn vào Kênh Chat Dự Án:', chatErr.message);
      }
    }
  } catch (err) {
    console.error('⚠️ Lỗi xử lý handleTaskAssignmentNotification:', err);
  }
}


// Helper chuẩn hóa populate toàn diện cho Task (bao gồm Project, Assignee, Reviewer, Submission, Feedback)
const populateTask = (query) => {
  return query
    .populate('project', 'name code color manager members')
    .populate('department', 'name code color head')
    .populate('assignee', 'name email avatar department role')
    .populate('creator', 'name email avatar')
    .populate('reviewer', 'name email avatar department role')
    .populate('submission.submittedBy', 'name email avatar')
    .populate('reviewFeedback.reviewedBy', 'name email avatar')
    .populate('reviewHistory.reviewer', 'name email avatar');
};

// Helper gửi thông báo real-time khi có sự kiện duyệt công việc
const sendReviewNotification = async ({ recipientId, senderId, type, title, messageText, task }) => {
  try {
    if (!recipientId || recipientId.toString() === senderId.toString()) return;

    const projectId = task.project?._id || task.project;
    const notif = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      type,
      title,
      message: messageText,
      link: `/tasks?project=${projectId}&task=${task._id}`,
      task: task._id,
      project: projectId,
      isRead: false,
    });

    const populatedNotif = await Notification.findById(notif._id)
      .populate('sender', 'name email avatar')
      .populate('task', 'title status priority dueDate')
      .populate('project', 'name code color');

    const io = getIO();
    if (io) {
      io.to(`user:${recipientId}`).emit('notification:new', populatedNotif);
    }
  } catch (err) {
    console.error('⚠️ Lỗi gửi thông báo kiểm duyệt task:', err.message);
  }
};

// Helper gửi tin nhắn thông báo vào Kênh Chat Dự Án cho các sự kiện duyệt / yêu cầu sửa lại / nộp bài
const sendProjectChatReviewMessage = async ({ projectId, senderId, task, action, comment, targetUser }) => {
  if (!projectId || !task) return;
  try {
    const targetUserName = targetUser?.name || 'thành viên';
    const targetUserId = targetUser?._id ? targetUser._id.toString() : targetUser?.toString();
    const reviewerName = task.reviewer?.name || 'Người kiểm duyệt';

    let content = '';
    if (action === 'request_changes') {
      content = `⚠️ **YÊU CẦU CHỈNH SỬA CÔNG VIỆC:** "${task.title}"\n🔍 Người duyệt: **${reviewerName}**\n💬 **Nội dung cần sửa:** "${comment || 'Cần kiểm tra và sửa đổi theo yêu cầu'}"\n👉 Giao cho: @${targetUserName}`;
    } else if (action === 'approve') {
      content = `🎉 **NGHIỆM THU HOÀN THÀNH:** Công việc "${task.title}" của @${targetUserName} đã được **${reviewerName}** phê duyệt đạt yêu cầu!`;
    } else if (action === 'submit_review') {
      const noteText = task.submission?.note ? `\n📝 Ghi chú: "${task.submission.note}"` : '';
      const linkText = task.submission?.url ? `\n🎬 Link sản phẩm: ${task.submission.url}` : '';
      content = `⏳ **NỘP BÀN GIAO CHỜ DUYỆT:** "${task.title}" đã nộp sản phẩm nghiệm thu.${noteText}${linkText}\n👉 Người duyệt: @${targetUserName}`;
    }

    if (!content) return;

    const chatMsg = await Message.create({
      sender: senderId,
      channelType: 'project',
      channelId: projectId,
      content,
      taskRef: task._id,
      mentions: targetUserId ? [targetUserId] : [],
    });

    const populatedChatMsg = await Message.findById(chatMsg._id)
      .populate('sender', 'name email avatar role department')
      .populate('mentions', 'name email avatar role')
      .populate('taskRef', 'title status priority dueDate submission reviewFeedback');

    broadcastChannelMessage('project', projectId.toString(), populatedChatMsg);
  } catch (chatErr) {
    console.error('⚠️ Lỗi gửi tin nhắn kiểm duyệt vào Kênh Chat Dự Án:', chatErr.message);
  }
};

// @desc    Get all tasks with optional filters
// @route   GET /api/tasks
// @access  Private
export const getTasks = async (req, res, next) => {
  try {
    const { project, status, priority, assignee, reviewer, department, search } = req.query;
    const query = {};

    if (project) query.project = project;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignee) query.assignee = assignee;
    if (reviewer) query.reviewer = reviewer;
    if (department) query.department = department;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Phạm vi quyền hạn xem công việc (Permission Scope)
    if (req.permissionScope?.scope === 'own') {
      const ownCond = [
        { assignee: req.user._id },
        { creator: req.user._id },
        { reviewer: req.user._id },
      ];
      const headDepts = await Department.find({ head: req.user._id }).select('_id');
      if (headDepts.length > 0) {
        ownCond.push({ department: { $in: headDepts.map((d) => d._id) } });
      }
      query.$or = query.$or ? { $and: [query.$or, { $or: ownCond }] } : ownCond;
    } else if (req.permissionScope?.scope === 'dept') {
      const userDeptIds = [];
      if (req.user.departmentId) userDeptIds.push(req.user.departmentId);
      const userDepts = await Department.find({
        $or: [
          { members: req.user._id },
          { head: req.user._id },
          ...(req.user.department ? [{ name: req.user.department }] : []),
        ],
      }).select('_id');
      userDepts.forEach((d) => userDeptIds.push(d._id));

      const deptConds = [
        { assignee: req.user._id },
        { creator: req.user._id },
        { reviewer: req.user._id },
      ];
      if (userDeptIds.length > 0) {
        deptConds.push({ department: { $in: userDeptIds } });
      }
      query.$or = query.$or ? { $and: [query.$or, { $or: deptConds }] } : deptConds;
    }

    const tasks = await populateTask(Task.find(query)).sort({ order: 1, createdAt: -1 });

    res.json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
export const getTaskById = async (req, res, next) => {
  try {
    const task = await populateTask(Task.findById(req.params.id));

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private
export const createTask = async (req, res, next) => {
  try {
    const {
      title,
      description,
      project,
      department,
      assignee,
      reviewer,
      status,
      priority,
      startDate,
      dueDate,
      estimatedHours,
      tags,
      submission,
    } = req.body;

    if (!title || !project) {
      return res.status(400).json({
        success: false,
        message: 'Please provide task title and project ID',
      });
    }

    // Verify project exists
    const existingProject = await Project.findById(project);
    if (!existingProject) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Get highest order in this status
    const lastTask = await Task.findOne({ project, status: status || 'todo' }).sort({ order: -1 });
    const nextOrder = lastTask ? (lastTask.order || 0) + 1 : 0;

    const task = await Task.create({
      title,
      description,
      project,
      department: department || null,
      assignee: assignee || null,
      reviewer: reviewer || null,
      creator: req.user._id,
      status: status || 'todo',
      priority: priority || 'medium',
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      estimatedHours: estimatedHours || 0,
      tags: tags || [],
      order: nextOrder,
      submission: submission || undefined,
    });

    const populatedTask = await populateTask(Task.findById(task._id));

    // Real-time broadcast
    notifyTaskCreated(populatedTask);

    // Kích hoạt thông báo 3 kênh (In-app, Email, Kênh chat dự án) nếu có người được giao
    if (populatedTask.assignee) {
      handleTaskAssignmentNotification({
        task: populatedTask,
        assigner: req.user,
        isNew: true,
      });
    }

    await ActivityLog.create({
      user: req.user._id,
      action: 'CREATED_TASK',
      targetType: 'task',
      targetId: task._id.toString(),
      details: { title: task.title, project: existingProject.name },
    });

    res.status(201).json({
      success: true,
      task: populatedTask,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
export const updateTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const previousAssignee = task.assignee ? task.assignee.toString() : null;
    const previousStatus = task.status;

    const updatedTask = await populateTask(
      Task.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      })
    );

    // Real-time broadcast
    notifyTaskUpdated(updatedTask);

    // Kiểm tra nếu người thực hiện (assignee) được gán mới hoặc thay đổi
    const newAssignee = updatedTask.assignee
      ? (updatedTask.assignee._id || updatedTask.assignee).toString()
      : null;
    if (newAssignee && newAssignee !== previousAssignee) {
      handleTaskAssignmentNotification({
        task: updatedTask,
        assigner: req.user,
        isNew: false,
      });
    }

    // Nếu trạng thái chuyển sang review và có người duyệt, gửi thông báo
    if (updatedTask.status === 'review' && previousStatus !== 'review') {
      const reviewerId = updatedTask.reviewer?._id?.toString() || (updatedTask.project?.manager ? (updatedTask.project.manager._id || updatedTask.project.manager).toString() : null);
      if (reviewerId && reviewerId !== req.user._id.toString()) {
        await sendReviewNotification({
          recipientId: reviewerId,
          senderId: req.user._id,
          type: 'task_review_submitted',
          title: 'Công việc chuyển sang chờ duyệt',
          messageText: `${req.user.name} đã cập nhật công việc "${updatedTask.title}" sang trạng thái Chờ duyệt.`,
          task: updatedTask,
        });
      }
    }

    await ActivityLog.create({
      user: req.user._id,
      action: 'UPDATED_TASK',
      targetType: 'task',
      targetId: task._id.toString(),
      details: { title: updatedTask.title },
    });

    res.json({
      success: true,
      message: 'Task updated successfully',
      task: updatedTask,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update task status & order (Kanban drag-and-drop)
// @route   PATCH /api/tasks/:id/status
// @access  Private
export const updateTaskStatus = async (req, res, next) => {
  try {
    const { status, order } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const previousStatus = task.status;
    task.status = status;
    if (order !== undefined) task.order = order;
    await task.save();

    const populatedTask = await populateTask(Task.findById(task._id));

    // Real-time broadcast
    notifyTaskUpdated(populatedTask);

    // Gửi thông báo nếu chuyển sang review
    if (status === 'review' && previousStatus !== 'review') {
      const reviewerId = populatedTask.reviewer?._id?.toString() || (populatedTask.project?.manager ? (populatedTask.project.manager._id || populatedTask.project.manager).toString() : null);
      if (reviewerId && reviewerId !== req.user._id.toString()) {
        await sendReviewNotification({
          recipientId: reviewerId,
          senderId: req.user._id,
          type: 'task_review_submitted',
          title: 'Công việc chuyển sang chờ duyệt',
          messageText: `${req.user.name} đã chuyển công việc "${task.title}" sang trạng thái Chờ duyệt.`,
          task: populatedTask,
        });
      }
    }

    await ActivityLog.create({
      user: req.user._id,
      action: 'MOVED_TASK',
      targetType: 'task',
      targetId: task._id.toString(),
      details: { title: task.title, newStatus: status },
    });

    res.json({
      success: true,
      task: populatedTask,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Nộp sản phẩm và chuyển task sang Chờ duyệt (Submit for Review)
// @route   PUT /api/tasks/:id/submit-review
// @access  Private
export const submitTaskForReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { deliverableUrl, submissionNote } = req.body;

    const task = await Task.findById(id).populate('project');
    if (!task) {
      return res.status(404).json({ success: false, message: 'Công việc không tồn tại' });
    }

    task.status = 'review';
    task.submission = {
      url: deliverableUrl ? deliverableUrl.trim() : '',
      note: submissionNote ? submissionNote.trim() : '',
      submittedAt: new Date(),
      submittedBy: req.user._id,
    };

    // Lưu vào lịch sử nộp duyệt
    task.reviewHistory.push({
      reviewer: task.reviewer || task.project?.manager,
      action: 'submitted',
      deliverableUrl: deliverableUrl ? deliverableUrl.trim() : '',
      comment: submissionNote || 'Đã nộp bài chờ duyệt',
      date: new Date(),
    });

    await task.save();

    const populatedTask = await populateTask(Task.findById(task._id));
    notifyTaskUpdated(populatedTask);

    // Gửi thông báo cho Reviewer hoặc PM dự án
    const reviewerId = task.reviewer?.toString() || (task.project?.manager ? (task.project.manager._id || task.project.manager).toString() : null);
    if (reviewerId && reviewerId !== req.user._id.toString()) {
      await sendReviewNotification({
        recipientId: reviewerId,
        senderId: req.user._id,
        type: 'task_review_submitted',
        title: 'Có sản phẩm mới cần bạn duyệt 🎬',
        messageText: `${req.user.name} đã nộp sản phẩm cho công việc "${task.title}".`,
        task: populatedTask,
      });
    }

    // Gửi tin nhắn vào Kênh Chat Dự Án (Channel C)
    const projectIdForSubmit = populatedTask.project?._id || task.project?._id || task.project;
    if (projectIdForSubmit) {
      const reviewerUser = populatedTask.reviewer || populatedTask.project?.manager;
      await sendProjectChatReviewMessage({
        projectId: projectIdForSubmit,
        senderId: req.user._id,
        task: populatedTask,
        action: 'submit_review',
        targetUser: reviewerUser,
      });
    }

    await ActivityLog.create({
      user: req.user._id,
      action: 'SUBMITTED_FOR_REVIEW',
      targetType: 'task',
      targetId: task._id.toString(),
      details: { title: task.title, deliverableUrl },
    });

    res.json({
      success: true,
      message: 'Đã nộp sản phẩm chờ duyệt thành công!',
      task: populatedTask,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Phê duyệt hoặc Yêu cầu chỉnh sửa lại công việc
// @route   PUT /api/tasks/:id/review
// @access  Private
export const reviewTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, comment } = req.body; // action: 'approve' | 'request_changes'

    if (!['approve', 'request_changes'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Hành động duyệt không hợp lệ' });
    }

    const task = await Task.findById(id).populate('project');
    if (!task) {
      return res.status(404).json({ success: false, message: 'Công việc không tồn tại' });
    }

    const isApprove = action === 'approve';
    task.status = isApprove ? 'done' : 'in_progress';
    task.reviewFeedback = {
      action: isApprove ? 'approved' : 'changes_requested',
      comment: comment || (isApprove ? 'Đã phê duyệt hoàn thành' : 'Yêu cầu chỉnh sửa lại'),
      reviewedAt: new Date(),
      reviewedBy: req.user._id,
    };

    task.reviewHistory.push({
      reviewer: req.user._id,
      action: isApprove ? 'approved' : 'changes_requested',
      comment: comment || (isApprove ? 'Đã phê duyệt' : 'Yêu cầu sửa đổi'),
      deliverableUrl: task.submission?.url || '',
      date: new Date(),
    });

    await task.save();

    const populatedTask = await populateTask(Task.findById(task._id));
    notifyTaskUpdated(populatedTask);

    const targetUserId = task.assignee?.toString() || task.creator?.toString();
    const targetUser = populatedTask.assignee || populatedTask.creator;
    const targetUserName = targetUser?.name || 'thành viên';

    // 1. Kênh A: In-app Notification (DB + Socket.IO real-time)
    if (targetUserId && targetUserId !== req.user._id.toString()) {
      await sendReviewNotification({
        recipientId: targetUserId,
        senderId: req.user._id,
        type: isApprove ? 'task_approved' : 'task_changes_requested',
        title: isApprove ? '🎉 Công việc của bạn đã được phê duyệt!' : '⚠️ Công việc cần chỉnh sửa lại',
        messageText: isApprove
          ? `${req.user.name} đã phê duyệt công việc "${task.title}".`
          : `${req.user.name} yêu cầu sửa công việc "${task.title}": "${comment || 'Xem chi tiết phản hồi'}"`,
        task: populatedTask,
      });
    }

    // 2. Kênh B: Email cá nhân qua SMTP cho người làm (Assignee)
    let userEmail = targetUser?.email;
    if (!userEmail && targetUserId) {
      try {
        const u = await User.findById(targetUserId).select('email name');
        if (u) userEmail = u.email;
      } catch (e) {
        // ignore
      }
    }

    const projectId = populatedTask.project?._id || task.project?._id || task.project;
    let projectName = populatedTask.project?.name || 'Dự án';
    if (!projectName && projectId) {
      try {
        const p = await Project.findById(projectId).select('name');
        if (p) projectName = p.name;
      } catch (e) {
        // ignore
      }
    }

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const taskLink = `${clientUrl}/tasks?project=${projectId}&task=${task._id}`;

    if (userEmail) {
      sendReviewFeedbackEmail({
        to: userEmail,
        recipientName: targetUserName,
        taskTitle: task.title,
        projectName,
        reviewerName: req.user.name || 'Người kiểm duyệt',
        action,
        comment,
        deliverableUrl: task.submission?.url || '',
        taskLink,
      }).catch((emailErr) => {
        console.error('⚠️ Lỗi gửi email phản hồi kiểm duyệt:', emailErr.message);
      });
    }

    // 3. Kênh C: Tin nhắn tương tác kèm thẻ Task Card trong Kênh Chat Dự Án
    if (projectId) {
      await sendProjectChatReviewMessage({
        projectId,
        senderId: req.user._id,
        task: { ...(populatedTask.toObject ? populatedTask.toObject() : populatedTask), reviewer: req.user },
        action,
        comment,
        targetUser,
      });
    }

    await ActivityLog.create({
      user: req.user._id,
      action: isApprove ? 'APPROVED_TASK' : 'REQUESTED_CHANGES_TASK',
      targetType: 'task',
      targetId: task._id.toString(),
      details: { title: task.title, action, comment },
    });

    res.json({
      success: true,
      message: isApprove ? 'Đã phê duyệt công việc hoàn thành!' : 'Đã gửi yêu cầu chỉnh sửa lại!',
      task: populatedTask,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
export const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const projectId = task.project;
    await Task.findByIdAndDelete(req.params.id);

    // Real-time broadcast
    notifyTaskDeleted(req.params.id, projectId);

    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
