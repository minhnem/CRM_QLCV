import crypto from 'crypto';
import { Workspace } from '../models/Workspace.js';
import { User } from '../models/User.js';
import { getIO } from '../config/socket.js';
import { sendWorkspaceInviteEmail } from '../config/mail.js';

// @desc    Tạo Không gian làm việc mới
// @route   POST /api/workspaces
// @access  Private
export const createWorkspace = async (req, res, next) => {
  try {
    const { name, description, settings } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên Không gian làm việc',
      });
    }

    const workspace = await Workspace.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      owner: req.user._id,
      members: [
        {
          user: req.user._id,
          role: 'owner',
          joinedAt: new Date(),
        },
      ],
      settings: settings || {},
    });

    // Cập nhật currentWorkspace cho người tạo
    await User.findByIdAndUpdate(req.user._id, {
      currentWorkspace: workspace._id,
    });

    const populated = await Workspace.findById(workspace._id)
      .populate('owner', 'name email avatar role')
      .populate('members.user', 'name email avatar role department');

    res.status(201).json({
      success: true,
      message: 'Tạo không gian làm việc thành công',
      workspace: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy danh sách các workspace của người dùng hiện tại
// @route   GET /api/workspaces/my
// @access  Private
export const getMyWorkspaces = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Tìm các workspace mà user là owner, thành viên, hoặc đang chờ duyệt
    const workspaces = await Workspace.find({
      $or: [
        { owner: userId },
        { 'members.user': userId },
        { 'pendingRequests.user': userId },
      ],
    })
      .populate('owner', 'name email avatar role')
      .populate('members.user', 'name email avatar role department')
      .sort({ updatedAt: -1 });

    const formatted = workspaces.map((ws) => {
      const isOwner = ws.owner._id.toString() === userId.toString();
      const memberItem = ws.members.find(
        (m) => m.user && m.user._id.toString() === userId.toString()
      );
      const isPending = ws.pendingRequests.some(
        (p) => p.user && p.user.toString() === userId.toString()
      );

      return {
        _id: ws._id,
        name: ws.name,
        code: ws.code,
        description: ws.description,
        logo: ws.logo,
        owner: ws.owner,
        isOwner,
        myRole: isOwner ? 'owner' : memberItem?.role || (isPending ? 'pending' : 'guest'),
        isPending,
        membersCount: ws.members.length,
        pendingCount: isOwner || memberItem?.role === 'admin' ? ws.pendingRequests.length : 0,
        settings: ws.settings,
        createdAt: ws.createdAt,
      };
    });

    res.json({
      success: true,
      count: formatted.length,
      currentWorkspaceId: req.user.currentWorkspace,
      workspaces: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy chi tiết 1 workspace
// @route   GET /api/workspaces/:id
// @access  Private
export const getWorkspaceById = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id)
      .populate('owner', 'name email avatar role')
      .populate('members.user', 'name email avatar role department')
      .populate('pendingRequests.user', 'name email avatar role department')
      .populate('invites.invitedBy', 'name email avatar');

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy không gian làm việc',
      });
    }

    // Kiểm tra quyền: Phải là owner hoặc thành viên
    const isOwner = workspace.owner._id.toString() === req.user._id.toString();
    const isMember = workspace.members.some(
      (m) => m.user && m.user._id.toString() === req.user._id.toString()
    );

    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập vào không gian này',
      });
    }

    res.json({
      success: true,
      workspace,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Nhập mã code để xin gia nhập workspace
// @route   POST /api/workspaces/join-by-code
// @access  Private
export const joinByCode = async (req, res, next) => {
  try {
    const { code, message } = req.body;
    const userId = req.user._id;

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mã Không gian làm việc (Workspace Code)',
      });
    }

    const formattedCode = code.trim().toUpperCase();
    const workspace = await Workspace.findOne({ code: formattedCode })
      .populate('owner', 'name email avatar');

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Mã không gian làm việc không tồn tại. Vui lòng kiểm tra lại.',
      });
    }

    // Kiểm tra xem đã là owner hoặc thành viên chưa
    const isOwner = workspace.owner._id.toString() === userId.toString();
    const isMember = workspace.members.some(
      (m) => m.user && m.user.toString() === userId.toString()
    );

    if (isOwner || isMember) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã là thành viên của Không gian làm việc này rồi.',
        workspaceId: workspace._id,
      });
    }

    // Kiểm tra xem đã gửi yêu cầu trước đó chưa
    const isPending = workspace.pendingRequests.some(
      (p) => p.user && p.user.toString() === userId.toString()
    );

    if (isPending) {
      return res.status(400).json({
        success: false,
        message: 'Yêu cầu của bạn đã được gửi trước đó và đang chờ quản trị viên phê duyệt.',
      });
    }

    // Nếu workspace cho phép tự động duyệt mã (Auto-approve)
    if (workspace.settings?.autoApproveJoinCode) {
      workspace.members.push({
        user: userId,
        role: 'member',
        joinedAt: new Date(),
      });
      await workspace.save();

      // Cập nhật currentWorkspace nếu chưa có
      if (!req.user.currentWorkspace) {
        await User.findByIdAndUpdate(userId, { currentWorkspace: workspace._id });
      }

      return res.json({
        success: true,
        status: 'joined',
        message: `Chào mừng bạn gia nhập không gian làm việc "${workspace.name}"!`,
        workspace: {
          _id: workspace._id,
          name: workspace.name,
          code: workspace.code,
        },
      });
    }

    // Ngược lại: Thêm vào danh sách chờ duyệt (Pending Requests)
    workspace.pendingRequests.push({
      user: userId,
      message: message ? message.trim() : '',
      requestedAt: new Date(),
    });
    await workspace.save();

    // Bắn socket thông báo cho Owner của workspace
    const io = getIO();
    if (io) {
      io.to(`user:${workspace.owner._id}`).emit('workspace:join_request', {
        workspaceId: workspace._id,
        workspaceName: workspace.name,
        applicant: {
          _id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          avatar: req.user.avatar,
        },
        message: message || '',
      });
    }

    res.json({
      success: true,
      status: 'pending',
      message: `Yêu cầu tham gia không gian "${workspace.name}" đã được gửi tới Quản trị viên. Vui lòng chờ phê duyệt!`,
      workspace: {
        _id: workspace._id,
        name: workspace.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Phê duyệt hoặc từ chối yêu cầu gia nhập
// @route   POST /api/workspaces/:id/requests/:requestId
// @access  Private (Owner/Admin)
export const handleJoinRequest = async (req, res, next) => {
  try {
    const { id, requestId } = req.params;
    const { action, role = 'member' } = req.body; // action: 'approve' | 'reject'
    const userId = req.user._id;

    const workspace = await Workspace.findById(id).populate(
      'pendingRequests.user',
      'name email avatar'
    );

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy không gian làm việc',
      });
    }

    // Kiểm tra quyền: User phải là Owner hoặc Admin của Workspace
    const isOwner = workspace.owner.toString() === userId.toString();
    const isAdmin = workspace.members.some(
      (m) => m.user.toString() === userId.toString() && (m.role === 'admin' || m.role === 'owner')
    );

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền phê duyệt thành viên cho không gian này',
      });
    }

    const requestItem = workspace.pendingRequests.id(requestId);
    if (!requestItem) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu này hoặc yêu cầu đã được xử lý',
      });
    }

    const targetUser = requestItem.user;
    const targetUserId = targetUser._id || targetUser;

    const io = getIO();

    if (action === 'approve') {
      // Thêm vào danh sách thành viên
      workspace.members.push({
        user: targetUserId,
        role: role === 'admin' ? 'admin' : 'member',
        joinedAt: new Date(),
      });

      // Xóa khỏi pending
      workspace.pendingRequests.pull(requestId);
      await workspace.save();

      // Cập nhật currentWorkspace cho người được duyệt nếu họ chưa có
      const targetUserDoc = await User.findById(targetUserId);
      if (targetUserDoc && !targetUserDoc.currentWorkspace) {
        targetUserDoc.currentWorkspace = workspace._id;
        await targetUserDoc.save();
      }

      // Bắn socket thông báo cho thành viên được duyệt
      if (io) {
        io.to(`user:${targetUserId}`).emit('workspace:request_approved', {
          workspaceId: workspace._id,
          workspaceName: workspace.name,
          role,
        });
      }

      return res.json({
        success: true,
        message: `Đã phê duyệt thành công thành viên vào "${workspace.name}"`,
      });
    } else {
      // Từ chối
      workspace.pendingRequests.pull(requestId);
      await workspace.save();

      if (io) {
        io.to(`user:${targetUserId}`).emit('workspace:request_rejected', {
          workspaceId: workspace._id,
          workspaceName: workspace.name,
        });
      }

      return res.json({
        success: true,
        message: 'Đã từ chối yêu cầu gia nhập',
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Tạo lời mời qua Email (Sinh Invite Token & Link)
// @route   POST /api/workspaces/:id/invites
// @access  Private (Owner/Admin hoặc Member nếu được phép)
export const inviteByEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, role = 'member' } = req.body;
    const userId = req.user._id;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp email người được mời',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const workspace = await Workspace.findById(id);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy không gian làm việc',
      });
    }

    // Kiểm tra quyền mời
    const isOwner = workspace.owner.toString() === userId.toString();
    const userMember = workspace.members.find(
      (m) => m.user.toString() === userId.toString()
    );

    if (!isOwner && (!userMember || (!workspace.settings?.allowMemberInvite && userMember.role !== 'admin'))) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền mời thành viên mới vào không gian này',
      });
    }

    // Kiểm tra xem email đã là thành viên chưa
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      const alreadyMember = workspace.members.some(
        (m) => m.user.toString() === existingUser._id.toString()
      );
      if (alreadyMember) {
        return res.status(400).json({
          success: false,
          message: 'Người này đã là thành viên của Không gian làm việc',
        });
      }
    }

    // Tạo invite token ngẫu nhiên
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày

    workspace.invites.push({
      email: cleanEmail,
      token,
      role: role === 'admin' ? 'admin' : 'member',
      invitedBy: userId,
      invitedAt: new Date(),
      expiresAt,
      status: 'pending',
    });

    await workspace.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const inviteLink = `${clientUrl}/join-invite?token=${token}&ws=${workspace.code}`;

    // Gửi email mời qua Gmail SMTP
    try {
      await sendWorkspaceInviteEmail({
        email: cleanEmail,
        inviteUrl: inviteLink,
        workspaceName: workspace.name,
        inviterName: req.user.name || 'Quản trị viên',
        code: workspace.code,
        role: role === 'admin' ? 'admin' : 'member',
      });
    } catch (mailErr) {
      console.error('⚠️ [Email Invite Warning] Không thể gửi mail tới', cleanEmail, mailErr.message);
    }

    res.json({
      success: true,
      message: `Đã gửi lời mời tham gia tới email ${cleanEmail}`,
      invite: {
        email: cleanEmail,
        token,
        inviteLink,
        expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy thông tin lời mời theo Token (Public - không cần đăng nhập)
// @route   GET /api/workspaces/invite/:token
// @access  Public
export const getInviteByToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Mã token lời mời không hợp lệ',
      });
    }

    const workspace = await Workspace.findOne({
      'invites.token': token.trim(),
    })
      .populate('owner', 'name email avatar')
      .populate('invites.invitedBy', 'name email avatar');

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Lời mời này không tồn tại hoặc đã bị quản trị viên hủy.',
      });
    }

    const invite = workspace.invites.find((i) => i.token === token.trim());
    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin lời mời.',
      });
    }

    const isExpired = new Date(invite.expiresAt) < new Date();
    if (invite.status !== 'pending' || isExpired) {
      return res.status(400).json({
        success: false,
        status: invite.status === 'accepted' ? 'accepted' : 'expired',
        message:
          invite.status === 'accepted'
            ? 'Lời mời này đã được chấp nhận và sử dụng trước đó.'
            : 'Lời mời này đã hết hạn hiệu lực (7 ngày). Vui lòng liên hệ quản trị viên để nhận lời mời mới.',
      });
    }

    res.json({
      success: true,
      invite: {
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
        status: invite.status,
        workspace: {
          _id: workspace._id,
          name: workspace.name,
          code: workspace.code,
          description: workspace.description,
          logo: workspace.logo,
          membersCount: workspace.members.length,
        },
        inviter: invite.invitedBy || workspace.owner,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Gửi lại email lời mời
// @route   POST /api/workspaces/:id/invites/:inviteId/resend
// @access  Private (Owner/Admin)
export const resendInvite = async (req, res, next) => {
  try {
    const { id, inviteId } = req.params;
    const userId = req.user._id;

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy không gian làm việc',
      });
    }

    const isOwner = workspace.owner.toString() === userId.toString();
    const isAdmin = workspace.members.some(
      (m) => m.user.toString() === userId.toString() && m.role === 'admin'
    );

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện thao tác này',
      });
    }

    const invite = workspace.invites.id(inviteId);
    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lời mời này',
      });
    }

    // Cập nhật lại token và gia hạn thêm 7 ngày
    invite.token = crypto.randomBytes(16).toString('hex');
    invite.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    invite.status = 'pending';
    await workspace.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const inviteUrl = `${clientUrl}/join-invite?token=${invite.token}&ws=${workspace.code}`;

    try {
      await sendWorkspaceInviteEmail({
        email: invite.email,
        inviteUrl,
        workspaceName: workspace.name,
        inviterName: req.user.name || 'Quản trị viên',
        code: workspace.code,
        role: invite.role,
      });
    } catch (mailErr) {
      console.error('Lỗi khi gửi lại email lời mời:', mailErr.message);
    }

    res.json({
      success: true,
      message: `Đã gửi lại email lời mời tới ${invite.email}`,
      invite: {
        _id: invite._id,
        email: invite.email,
        token: invite.token,
        inviteUrl,
        expiresAt: invite.expiresAt,
        status: invite.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Hủy lời mời
// @route   DELETE /api/workspaces/:id/invites/:inviteId
// @access  Private (Owner/Admin)
export const cancelInvite = async (req, res, next) => {
  try {
    const { id, inviteId } = req.params;
    const userId = req.user._id;

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy không gian làm việc',
      });
    }

    const isOwner = workspace.owner.toString() === userId.toString();
    const isAdmin = workspace.members.some(
      (m) => m.user.toString() === userId.toString() && m.role === 'admin'
    );

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền hủy lời mời này',
      });
    }

    const invite = workspace.invites.id(inviteId);
    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lời mời',
      });
    }

    workspace.invites.pull(inviteId);
    await workspace.save();

    res.json({
      success: true,
      message: 'Đã hủy lời mời thành công',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Chấp nhận lời mời qua Token
// @route   POST /api/workspaces/accept-invite
// @access  Private
export const acceptInvite = async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = req.user._id;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Mã token lời mời không hợp lệ',
      });
    }

    const workspace = await Workspace.findOne({
      'invites.token': token.trim(),
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Lời mời không tồn tại hoặc đã bị hủy',
      });
    }

    const invite = workspace.invites.find((i) => i.token === token.trim());
    if (!invite || invite.status !== 'pending' || new Date(invite.expiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Lời mời này đã hết hạn hoặc đã được sử dụng trước đó',
      });
    }

    // Kiểm tra xem đã là thành viên chưa
    const alreadyMember = workspace.members.some(
      (m) => m.user.toString() === userId.toString()
    );

    if (!alreadyMember) {
      workspace.members.push({
        user: userId,
        role: invite.role || 'member',
        joinedAt: new Date(),
      });
    }

    invite.status = 'accepted';
    await workspace.save();

    // Đặt currentWorkspace cho user
    await User.findByIdAndUpdate(userId, { currentWorkspace: workspace._id });

    // Bắn socket thông báo cho các thành viên trong workspace
    const io = getIO();
    if (io) {
      io.to(`workspace:${workspace._id}`).emit('workspace:member_joined', {
        workspaceId: workspace._id,
        user: {
          _id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          avatar: req.user.avatar,
        },
      });
    }

    res.json({
      success: true,
      message: `Chúc mừng bạn đã gia nhập thành công không gian "${workspace.name}"!`,
      workspace: {
        _id: workspace._id,
        name: workspace.name,
        code: workspace.code,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Chuyển đổi không gian làm việc hiện tại
// @route   POST /api/workspaces/:id/switch
// @access  Private
export const switchWorkspace = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy không gian làm việc',
      });
    }

    const isOwner = workspace.owner.toString() === userId.toString();
    const isMember = workspace.members.some(
      (m) => m.user.toString() === userId.toString()
    );

    if (!isOwner && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không phải là thành viên của Không gian làm việc này',
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { currentWorkspace: workspace._id },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: `Đã chuyển sang không gian làm việc "${workspace.name}"`,
      currentWorkspace: workspace,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cập nhật thông tin / cài đặt Workspace hoặc tạo lại Mã mời
// @route   PUT /api/workspaces/:id
// @access  Private (Owner/Admin)
export const updateWorkspace = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, settings, regenerateCode } = req.body;
    const userId = req.user._id;

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy không gian làm việc',
      });
    }

    const isOwner = workspace.owner.toString() === userId.toString();
    const isAdmin = workspace.members.some(
      (m) => m.user.toString() === userId.toString() && m.role === 'admin'
    );

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Chủ sở hữu hoặc Quản trị viên mới được sửa cài đặt không gian',
      });
    }

    if (name) workspace.name = name.trim();
    if (description !== undefined) workspace.description = description.trim();
    if (settings) workspace.settings = { ...workspace.settings, ...settings };

    // Tùy chọn làm mới lại mã mời (chỉ Owner)
    if (regenerateCode && isOwner) {
      const randomCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      workspace.code = `WS-${randomCode}`;
    }

    await workspace.save();

    res.json({
      success: true,
      message: 'Cập nhật Không gian làm việc thành công',
      workspace,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Xóa thành viên khỏi Workspace
// @route   DELETE /api/workspaces/:id/members/:targetUserId
// @access  Private (Owner/Admin)
export const removeMember = async (req, res, next) => {
  try {
    const { id, targetUserId } = req.params;
    const userId = req.user._id;

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy không gian làm việc',
      });
    }

    if (workspace.owner.toString() === targetUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa Chủ sở hữu (Owner) khỏi không gian làm việc',
      });
    }

    const isOwner = workspace.owner.toString() === userId.toString();
    const isAdmin = workspace.members.some(
      (m) => m.user.toString() === userId.toString() && m.role === 'admin'
    );

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa thành viên này',
      });
    }

    workspace.members = workspace.members.filter(
      (m) => m.user.toString() !== targetUserId.toString()
    );
    await workspace.save();

    // Reset currentWorkspace nếu user đó đang mở workspace này
    const targetUser = await User.findById(targetUserId);
    if (targetUser && targetUser.currentWorkspace?.toString() === id.toString()) {
      targetUser.currentWorkspace = null;
      await targetUser.save();
    }

    res.json({
      success: true,
      message: 'Đã xóa thành viên khỏi không gian làm việc',
    });
  } catch (error) {
    next(error);
  }
};
