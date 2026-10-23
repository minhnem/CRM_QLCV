import path from 'path';
import { Message } from '../models/Message.js';
import { Department } from '../models/Department.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { Workspace } from '../models/Workspace.js';
import { broadcastChannelMessage } from '../config/socket.js';

/**
 * Kiểm tra xem người dùng có quyền truy cập kênh chat (Phòng ban hoặc Dự án) hay không.
 * - Admin hệ thống hoặc Owner/Admin của Workspace: Toàn quyền truy cập tất cả kênh trong workspace đó.
 * - Kênh Phòng ban: User là trưởng phòng, nằm trong members, hoặc có departmentId trực thuộc.
 * - Kênh Dự án: User là owner, manager, supervisor, nằm trong members, thuộc phòng ban tham gia (kể cả phân cấp cha/con), hoặc được giao việc trong dự án.
 * - Kênh chat BẮT BUỘC phải thuộc Không gian làm việc hiện tại (Workspace)
 */
export const canUserAccessChannel = async (user, channelType, channelId, workspaceId) => {
  if (!user || !channelType || !channelId) return false;

  const userIdStr = (user._id || user.id || user).toString();
  const currentWsId = workspaceId || user.currentWorkspace;

  // 1. Kiểm tra đối tượng kênh (Phòng ban hoặc Dự án)
  let channelDoc = null;
  if (channelType === 'department') {
    channelDoc = await Department.findById(channelId).select('members head workspace parent');
  } else if (channelType === 'project') {
    channelDoc = await Project.findById(channelId).select(
      'owner manager supervisor members departments workspace'
    );
  }

  if (!channelDoc) return false;

  // Đảm bảo kênh thuộc về Không gian làm việc hiện tại
  if (currentWsId && channelDoc.workspace) {
    if (channelDoc.workspace.toString() !== currentWsId.toString()) {
      return false;
    }
  }

  // 2. Quản trị viên hệ thống có toàn quyền
  if (user.role === 'admin') return true;

  // 3. Chủ sở hữu hoặc Quản trị viên Không gian làm việc (Workspace Owner / Admin)
  if (currentWsId) {
    try {
      const ws = await Workspace.findById(currentWsId).select('owner members');
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

  // 4. Kênh Phòng ban (Department)
  if (channelType === 'department') {
    // Trưởng phòng
    if (channelDoc.head && channelDoc.head.toString() === userIdStr) return true;

    // Thành viên trong danh sách members của phòng ban
    if (channelDoc.members && channelDoc.members.some((m) => (m._id || m).toString() === userIdStr)) {
      return true;
    }

    // User được gán trực tiếp departmentId của phòng ban này
    if (user.departmentId && user.departmentId.toString() === channelDoc._id.toString()) {
      return true;
    }

    return false;
  }

  // 5. Kênh Dự án (Project)
  if (channelType === 'project') {
    // Người tạo / Quản lý / Giám sát dự án
    if (channelDoc.owner && channelDoc.owner.toString() === userIdStr) return true;
    if (channelDoc.manager && channelDoc.manager.toString() === userIdStr) return true;
    if (channelDoc.supervisor && channelDoc.supervisor.toString() === userIdStr) return true;

    // Thành viên trực tiếp trong dự án
    if (channelDoc.members && channelDoc.members.some((m) => (m._id || m).toString() === userIdStr)) {
      return true;
    }

    // 5.1. Kiểm tra qua phòng ban tham gia dự án
    if (channelDoc.departments && channelDoc.departments.length > 0) {
      const projDeptIdStrs = new Set(
        channelDoc.departments.map((d) => (d._id || d).toString())
      );

      // Lấy tất cả phòng ban mà user trực tiếp tham gia trong workspace
      const userDepts = await Department.find({
        workspace: currentWsId,
        $or: [
          { head: user._id },
          { members: user._id },
          ...(user.departmentId ? [{ _id: user.departmentId }] : []),
        ],
      }).select('_id parent');

      const userDirectDeptIds = new Set(userDepts.map((d) => d._id.toString()));
      const userAncestorDeptIds = new Set();
      userDepts.forEach((d) => {
        if (d.parent) userAncestorDeptIds.add(d.parent.toString());
      });

      // Kiểm tra xem phòng ban của dự án có khớp trực tiếp hoặc khớp phòng ban cha không
      for (const pDeptId of projDeptIdStrs) {
        if (userDirectDeptIds.has(pDeptId) || userAncestorDeptIds.has(pDeptId)) {
          return true;
        }
      }

      // Nếu user thuộc phòng ban cha, kiểm tra dự án có gán cho phòng ban con không
      const hasChildDept = await Department.exists({
        workspace: currentWsId,
        _id: { $in: Array.from(projDeptIdStrs) },
        parent: { $in: Array.from(userDirectDeptIds) },
      });
      if (hasChildDept) return true;
    }

    // 5.2. Kiểm tra qua công việc được giao trong dự án
    const hasAssignedTask = await Task.exists({
      project: channelDoc._id,
      ...(currentWsId ? { workspace: currentWsId } : {}),
      $or: [
        { assignee: user._id },
        { members: user._id },
        { reviewer: user._id },
        { creator: user._id },
      ],
    });
    if (hasAssignedTask) return true;

    return false;
  }

  return false;
};

// @desc    Lấy danh sách các kênh chat (Phòng ban & Dự án) thuộc Workspace hiện tại
// @route   GET /api/messages/channels
// @access  Private
export const getChannels = async (req, res, next) => {
  try {
    const user = req.user;
    const userIdStr = user._id.toString();
    const workspaceId = req.workspaceId || user.currentWorkspace || req.headers['x-workspace-id'];

    if (!workspaceId) {
      return res.json({
        success: true,
        departments: [],
        projects: [],
      });
    }

    const wsFilter = { workspace: workspaceId };

    // 1. Kiểm tra xem người dùng có quyền Quản trị viên trong Workspace này không
    let isFullAccess = user.role === 'admin' || req.isWorkspaceAdmin;
    if (!isFullAccess && workspaceId) {
      try {
        const ws = await Workspace.findById(workspaceId).select('owner members');
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
      Department.find(wsFilter)
        .select('name code color description members head parent workspace')
        .populate('members', 'name email avatar role department')
        .populate('head', 'name email avatar role department'),
      Project.find(wsFilter)
        .select('name code color description status members departments owner manager supervisor workspace')
        .populate('members', 'name email avatar role department')
        .populate('owner', 'name email avatar role department')
        .populate('manager', 'name email avatar role department')
        .populate('supervisor', 'name email avatar role department'),
    ]);

    // 2. Xác định các phòng ban mà user trực tiếp tham gia trong workspace
    const userDepts = allDepartments.filter((dept) => {
      const isHead = dept.head && (dept.head._id || dept.head).toString() === userIdStr;
      const isMember =
        dept.members &&
        dept.members.some((m) => (m._id || m).toString() === userIdStr);
      const isMyDept = user.departmentId && dept._id.toString() === user.departmentId.toString();
      return isHead || isMember || isMyDept;
    });

    const userDirectDeptIds = new Set(userDepts.map((d) => d._id.toString()));
    if (user.departmentId) userDirectDeptIds.add(user.departmentId.toString());

    // Phòng ban cha (ancestors): Nếu user thuộc phòng ban con, user cũng được tham gia dự án của phòng ban cha
    const userAncestorDeptIds = new Set();
    userDepts.forEach((d) => {
      if (d.parent) userAncestorDeptIds.add((d.parent._id || d.parent).toString());
    });

    // Phòng ban con (descendants): Nếu user thuộc phòng ban cha, user được xem dự án của phòng ban con
    const userDescendantDeptIds = new Set();
    allDepartments.forEach((d) => {
      if (d.parent && userDirectDeptIds.has((d.parent._id || d.parent).toString())) {
        userDescendantDeptIds.add(d._id.toString());
      }
    });

    // Tập hợp ID phòng ban hợp lệ mà dự án có thể đối chiếu với user
    const validDeptIdsForProject = new Set([
      ...userDirectDeptIds,
      ...userAncestorDeptIds,
      ...userDescendantDeptIds,
    ]);

    // Tìm các dự án mà user có công việc được phân công trong workspace
    const userTaskProjects = await Task.find({
      workspace: workspaceId,
      $or: [
        { assignee: user._id },
        { members: user._id },
        { reviewer: user._id },
        { creator: user._id },
      ],
    }).distinct('project');
    const userTaskProjectIds = new Set(userTaskProjects.map((p) => p.toString()));

    const allowedDepartments = isFullAccess
      ? allDepartments
      : userDepts;

    // 3. Lọc danh sách dự án: nếu không phải Admin, chỉ lấy các dự án mà:
    // - User là owner, manager, supervisor, member
    // - HOẶC phòng ban của user (hoặc cha/con) tham gia dự án
    // - HOẶC user có nhiệm vụ/công việc được phân công trong dự án đó
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
            proj.departments &&
            proj.departments.some((d) => validDeptIdsForProject.has((d._id || d).toString()));
          const hasTaskInProject = userTaskProjectIds.has(proj._id.toString());

          return isOwner || isManager || isSupervisor || isMember || isDeptMatched || hasTaskInProject;
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

        // Thêm nhân sự thuộc các phòng ban tham gia dự án (bao gồm cả phòng ban con)
        if (proj.departments && proj.departments.length > 0) {
          const projDeptIds = new Set(proj.departments.map((d) => (d._id || d).toString()));
          const matchingDepts = allDepartments.filter(
            (d) =>
              projDeptIds.has(d._id.toString()) ||
              (d.parent && projDeptIds.has((d.parent._id || d.parent).toString()))
          );
          matchingDepts.forEach((dept) => {
            if (dept.head && dept.head._id) {
              userMap.set(dept.head._id.toString(), dept.head);
            }
            (dept.members || []).forEach((m) => {
              if (m && m._id) userMap.set(m._id.toString(), m);
            });
          });

          const deptUsers = await User.find({
            departmentId: { $in: Array.from(projDeptIds) },
          }).select('name email avatar role department');
          deptUsers.forEach((u) => userMap.set(u._id.toString(), u));
        }

        // Thêm nhân sự được gán công việc trong dự án
        const taskAssignees = await Task.find({ project: proj._id })
          .populate('assignee', 'name email avatar role department')
          .populate('reviewer', 'name email avatar role department')
          .select('assignee reviewer');
        taskAssignees.forEach((t) => {
          if (t.assignee && t.assignee._id) {
            userMap.set(t.assignee._id.toString(), t.assignee);
          }
          if (t.reviewer && t.reviewer._id) {
            userMap.set(t.reviewer._id.toString(), t.reviewer);
          }
        });

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
    const workspaceId = req.workspaceId || req.user.currentWorkspace || req.headers['x-workspace-id'];

    // Kiểm tra quyền truy cập kênh và tính hợp lệ của workspace
    const hasAccess = await canUserAccessChannel(req.user, channelType, channelId, workspaceId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập vào kênh chat này vì không thuộc không gian làm việc hiện tại hoặc chưa được thêm vào phòng ban/dự án.',
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
    const workspaceId = req.workspaceId || req.user.currentWorkspace || req.headers['x-workspace-id'];

    // Kiểm tra quyền gửi tin nhắn vào kênh
    const hasAccess = await canUserAccessChannel(req.user, channelType, channelId, workspaceId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền gửi tin nhắn vào kênh này vì không thuộc không gian làm việc hiện tại hoặc chưa được thêm vào phòng ban/dự án.',
      });
    }

    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn hoặc tệp đính kèm không được để trống',
      });
    }

    // Xác định workspace của message
    let msgWorkspace = workspaceId;
    if (!msgWorkspace) {
      if (channelType === 'department') {
        const d = await Department.findById(channelId).select('workspace');
        if (d?.workspace) msgWorkspace = d.workspace;
      } else if (channelType === 'project') {
        const p = await Project.findById(channelId).select('workspace');
        if (p?.workspace) msgWorkspace = p.workspace;
      }
    }

    const message = await Message.create({
      sender: req.user._id,
      workspace: msgWorkspace || null,
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
