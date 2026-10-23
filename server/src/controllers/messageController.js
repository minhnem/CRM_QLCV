import path from 'path';
import { Message } from '../models/Message.js';
import { Department } from '../models/Department.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { Workspace } from '../models/Workspace.js';
import { broadcastChannelMessage } from '../config/socket.js';

/**
 * Kiểm tra xem người dùng có quyền truy cập kênh chat (Phòng ban hoặc Dự án) hay không.
 * - Admin hệ thống hoặc Owner/Admin của Workspace: Toàn quyền truy cập tất cả kênh.
 * - Thành viên thường (member / manager): Chỉ được truy cập nếu đã được thêm vào phòng ban hoặc dự án đó.
 */
export const canUserAccessChannel = async (user, channelType, channelId) => {
  if (!user) return false;

  // 1. Quản trị viên hệ thống có toàn quyền
  if (user.role === 'admin') return true;

  const userIdStr = (user._id || user.id || user).toString();

  // 2. Chủ sở hữu hoặc Quản trị viên Không gian làm việc (Workspace Owner / Admin)
  if (user.currentWorkspace) {
    try {
      const ws = await Workspace.findById(user.currentWorkspace).select('owner members');
      if (ws) {
        if (ws.owner && ws.owner.toString() === userIdStr) return true;
        const memberEntry = ws.members?.find(
          (m) => m.user && m.user.toString() === userIdStr
        );
        if (memberEntry && ['owner', 'admin'].includes(memberEntry.role)) {
          return true;
        }
      }
    } catch (wsErr) {
      console.error('Lỗi kiểm tra quyền Workspace:', wsErr.message);
    }
  }

  // 3. Kênh Phòng ban (Department)
  if (channelType === 'department') {
    const dept = await Department.findById(channelId).select('members head');
    if (!dept) return false;

    // Trưởng phòng
    if (dept.head && dept.head.toString() === userIdStr) return true;

    // Thành viên trong danh sách members của phòng ban
    if (dept.members && dept.members.some((m) => m.toString() === userIdStr)) {
      return true;
    }

    // User được gán trực tiếp departmentId của phòng ban này
    if (user.departmentId && user.departmentId.toString() === dept._id.toString()) {
      return true;
    }

    return false;
  }

  // 4. Kênh Dự án (Project)
  if (channelType === 'project') {
    const proj = await Project.findById(channelId).select(
      'owner manager supervisor members departments'
    );
    if (!proj) return false;

    // Người tạo / Quản lý / Giám sát dự án
    if (proj.owner && proj.owner.toString() === userIdStr) return true;
    if (proj.manager && proj.manager.toString() === userIdStr) return true;
    if (proj.supervisor && proj.supervisor.toString() === userIdStr) return true;

    // Thành viên trực tiếp trong dự án
    if (proj.members && proj.members.some((m) => m.toString() === userIdStr)) {
      return true;
    }

    // Dự án thuộc phòng ban mà người dùng đang trực thuộc
    if (user.departmentId && proj.departments && proj.departments.length > 0) {
      const userDeptId = user.departmentId.toString();
      if (proj.departments.some((d) => d.toString() === userDeptId)) {
        return true;
      }
    }

    return false;
  }

  return false;
};

// @desc    Lấy danh sách các kênh chat (Phòng ban & Dự án)
// @route   GET /api/messages/channels
// @access  Private
export const getChannels = async (req, res, next) => {
  try {
    const user = req.user;
    const userIdStr = user._id.toString();

    // 1. Kiểm tra xem người dùng có quyền Quản trị viên (Admin / Workspace Owner / Workspace Admin)
    let isFullAccess = user.role === 'admin';
    if (!isFullAccess && user.currentWorkspace) {
      try {
        const ws = await Workspace.findById(user.currentWorkspace).select('owner members');
        if (ws) {
          if (ws.owner && ws.owner.toString() === userIdStr) isFullAccess = true;
          const memberEntry = ws.members?.find(
            (m) => m.user && m.user.toString() === userIdStr
          );
          if (memberEntry && ['owner', 'admin'].includes(memberEntry.role)) {
            isFullAccess = true;
          }
        }
      } catch (wsErr) {
        console.error('Lỗi kiểm tra quyền Workspace:', wsErr.message);
      }
    }

    const [allDepartments, allProjects] = await Promise.all([
      Department.find()
        .select('name code color description members head parent')
        .populate('members', 'name email avatar role department')
        .populate('head', 'name email avatar role department'),
      Project.find()
        .select('name code color description status members departments owner manager supervisor')
        .populate('members', 'name email avatar role department')
        .populate('owner', 'name email avatar role department')
        .populate('manager', 'name email avatar role department')
        .populate('supervisor', 'name email avatar role department'),
    ]);

    // 2. Lọc danh sách phòng ban: nếu không phải Admin, chỉ lấy các phòng ban mà user là thành viên / trưởng phòng
    const userDeptId = user.departmentId ? user.departmentId.toString() : null;
    const allowedDepartments = isFullAccess
      ? allDepartments
      : allDepartments.filter((dept) => {
          const isHead = dept.head && (dept.head._id || dept.head).toString() === userIdStr;
          const isMember =
            dept.members &&
            dept.members.some((m) => (m._id || m).toString() === userIdStr);
          const isMyDept = userDeptId && dept._id.toString() === userDeptId;
          return isHead || isMember || isMyDept;
        });

    // 3. Lọc danh sách dự án: nếu không phải Admin, chỉ lấy các dự án mà user là owner, manager, supervisor, member hoặc thuộc phòng ban được gán dự án
    const allowedProjects = isFullAccess
      ? allProjects
      : allProjects.filter((proj) => {
          const isOwner = proj.owner && (proj.owner._id || proj.owner).toString() === userIdStr;
          const isManager = proj.manager && (proj.manager._id || proj.manager).toString() === userIdStr;
          const isSupervisor = proj.supervisor && (proj.supervisor._id || proj.supervisor).toString() === userIdStr;
          const isMember =
            proj.members &&
            proj.members.some((m) => (m._id || m).toString() === userIdStr);
          const isDeptMatched =
            userDeptId &&
            proj.departments &&
            proj.departments.some((d) => (d._id || d).toString() === userDeptId);

          return isOwner || isManager || isSupervisor || isMember || isDeptMatched;
        });

    // 4. Lấy tin nhắn mới nhất & danh sách thành viên cho từng kênh phòng ban
    const deptChannels = await Promise.all(
      allowedDepartments.map(async (dept) => {
        const lastMsg = await Message.findOne({
          channelType: 'department',
          channelId: dept._id,
        })
          .sort({ createdAt: -1 })
          .populate('sender', 'name avatar');

        const userMap = new Map();
        (dept.members || []).forEach((u) => {
          if (u && u._id) userMap.set(u._id.toString(), u);
        });
        if (dept.head && dept.head._id) {
          userMap.set(dept.head._id.toString(), dept.head);
        }

        const deptUsers = await User.find({ departmentId: dept._id }).select(
          'name email avatar role department'
        );
        deptUsers.forEach((u) => userMap.set(u._id.toString(), u));
        const channelMembers = Array.from(userMap.values());

        return {
          _id: dept._id,
          type: 'department',
          name: dept.name,
          code: dept.code,
          color: dept.color || '#2563eb',
          description: dept.description,
          members: channelMembers,
          membersCount: channelMembers.length || 1,
          lastMessage: lastMsg
            ? {
                content: lastMsg.content,
                sender: lastMsg.sender?.name || 'Nhân viên',
                createdAt: lastMsg.createdAt,
              }
            : null,
        };
      })
    );

    // 5. Lấy tin nhắn mới nhất & danh sách thành viên cho từng kênh dự án
    const projChannels = await Promise.all(
      allowedProjects.map(async (proj) => {
        const lastMsg = await Message.findOne({
          channelType: 'project',
          channelId: proj._id,
        })
          .sort({ createdAt: -1 })
          .populate('sender', 'name avatar');

        const userMap = new Map();
        (proj.members || []).forEach((u) => {
          if (u && u._id) userMap.set(u._id.toString(), u);
        });
        if (proj.owner && proj.owner._id) userMap.set(proj.owner._id.toString(), proj.owner);
        if (proj.manager && proj.manager._id) userMap.set(proj.manager._id.toString(), proj.manager);
        if (proj.supervisor && proj.supervisor._id) userMap.set(proj.supervisor._id.toString(), proj.supervisor);

        if (proj.departments && proj.departments.length > 0) {
          const deptIds = proj.departments.map((d) => d._id || d);
          const deptUsers = await User.find({
            departmentId: { $in: deptIds },
          }).select('name email avatar role department');
          deptUsers.forEach((u) => userMap.set(u._id.toString(), u));
        }
        const channelMembers = Array.from(userMap.values());

        return {
          _id: proj._id,
          type: 'project',
          name: proj.name,
          code: proj.code,
          color: proj.color || '#10b981',
          description: proj.description,
          status: proj.status,
          members: channelMembers,
          membersCount: channelMembers.length || 1,
          lastMessage: lastMsg
            ? {
                content: lastMsg.content,
                sender: lastMsg.sender?.name || 'Nhân viên',
                createdAt: lastMsg.createdAt,
              }
            : null,
        };
      })
    );

    res.json({
      success: true,
      departments: deptChannels,
      projects: projChannels,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy lịch sử tin nhắn của một kênh
// @route   GET /api/messages/:channelType/:channelId
// @access  Private
export const getChannelMessages = async (req, res, next) => {
  try {
    const { channelType, channelId } = req.params;
    const { limit = 50, before } = req.query;

    // Kiểm tra quyền truy cập kênh
    const hasAccess = await canUserAccessChannel(req.user, channelType, channelId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập vào kênh chat này vì chưa được thêm vào phòng ban/dự án.',
      });
    }

    const query = { channelType, channelId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('sender', 'name email avatar role department')
      .populate('mentions', 'name email avatar role')
      .populate('taskRef', 'title status priority dueDate submission reviewFeedback');

    // Đảo chiều mảng để client hiển thị từ cũ -> mới nhất ở cuối
    const sortedMessages = messages.reverse();

    res.json({
      success: true,
      count: sortedMessages.length,
      messages: sortedMessages,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Gửi tin nhắn vào kênh
// @route   POST /api/messages/:channelType/:channelId
// @access  Private
export const sendMessage = async (req, res, next) => {
  try {
    const { channelType, channelId } = req.params;
    const { content, attachments, taskRef, mentions, isMentionAll } = req.body;

    // Kiểm tra quyền gửi tin nhắn vào kênh
    const hasAccess = await canUserAccessChannel(req.user, channelType, channelId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền gửi tin nhắn vào kênh này vì chưa được thêm vào phòng ban/dự án.',
      });
    }

    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn hoặc tệp đính kèm không được để trống',
      });
    }

    const message = await Message.create({
      sender: req.user._id,
      channelType,
      channelId,
      content: content || 'Đã gửi một tệp đính kèm',
      attachments: attachments || [],
      taskRef: taskRef || null,
      mentions: mentions || [],
      isMentionAll: !!isMentionAll,
    });

    const populated = await Message.findById(message._id)
      .populate('sender', 'name email avatar role department')
      .populate('mentions', 'name email avatar role')
      .populate('taskRef', 'title status priority dueDate submission reviewFeedback');

    // Broadcast realtime qua Socket.IO tới toàn bộ nhân sự đang mở kênh này
    broadcastChannelMessage(channelType, channelId, populated);

    res.status(201).json({
      success: true,
      message: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload file đính kèm cho kênh chat
// @route   POST /api/messages/upload
// @access  Private
export const uploadMessageAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn một tệp để tải lên',
      });
    }

    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase();

    // Xác định loại file
    let fileType = 'file';
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].includes(ext)) {
      fileType = 'image';
    } else if (['.doc', '.docx'].includes(ext)) {
      fileType = 'doc';
    } else if (['.pdf'].includes(ext)) {
      fileType = 'pdf';
    } else if (['.xls', '.xlsx', '.csv'].includes(ext)) {
      fileType = 'sheet';
    } else if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) {
      fileType = 'zip';
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const fileUrl = `${protocol}://${host}/uploads/${file.filename}`;

    res.json({
      success: true,
      file: {
        name: file.originalname,
        url: fileUrl,
        fileType,
        size: file.size,
      },
    });
  } catch (error) {
    next(error);
  }
};
