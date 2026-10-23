import { Role } from '../models/Role.js';
import { User } from '../models/User.js';
import { getDefaultRoleTemplates } from '../utils/defaultRoles.js';
import { getIO } from '../config/socket.js';

// @desc    Get all roles & permissions for current workspace (auto-seed if empty)
// @route   GET /api/roles
// @access  Private
export const getRoles = async (req, res, next) => {
  try {
    const workspaceId = req.user.currentWorkspace || req.query.workspaceId;

    let roles = await Role.find({ workspace: workspaceId }).sort({ order: 1, createdAt: 1 });

    // Tự động seed nếu workspace chưa có role nào
    if (roles.length === 0 && workspaceId) {
      const templates = getDefaultRoleTemplates(workspaceId);
      await Role.insertMany(templates);
      roles = await Role.find({ workspace: workspaceId }).sort({ order: 1, createdAt: 1 });
    }

    res.json({
      success: true,
      count: roles.length,
      roles,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get effective permissions of the current logged-in user
// @route   GET /api/roles/my-permissions
// @access  Private
export const getMyPermissions = async (req, res, next) => {
  try {
    const userRoleCode = req.user.role || 'member';
    const workspaceId = req.user.currentWorkspace;

    // Super Admin có full quyền tuyệt đối
    if (userRoleCode === 'admin') {
      const fullPermissions = {
        contracts: { view: 'all', viewValue: true, create: true, edit: 'all', delete: true, assign: true },
        projects: { view: 'all', viewValue: true, create: true, edit: 'all', delete: true, assign: true },
        tasks: { view: 'all', viewValue: true, create: true, edit: 'all', delete: true, assign: true },
        departments: { view: 'all', viewValue: true, create: true, edit: 'all', delete: true, assign: true },
        team: { view: 'all', viewValue: true, create: true, edit: 'all', delete: true, assign: true },
        settings: { view: 'all', viewValue: true, create: true, edit: 'all', delete: true, assign: true },
      };

      return res.json({
        success: true,
        role: 'admin',
        roleName: 'Quản trị viên (Admin)',
        isAdmin: true,
        isManager: true,
        permissions: fullPermissions,
      });
    }

    // Tìm Role document tương ứng của workspace
    let roleDoc = await Role.findOne({
      code: userRoleCode,
      ...(workspaceId ? { workspace: workspaceId } : {}),
    });

    // Nếu chưa có trong workspace, thử tìm template mặc định
    if (!roleDoc && workspaceId) {
      const templates = getDefaultRoleTemplates(workspaceId);
      await Role.insertMany(templates);
      roleDoc = await Role.findOne({ code: userRoleCode, workspace: workspaceId });
    }

    // Fallback an toàn nếu vẫn chưa tìm thấy
    const permissions = roleDoc?.permissions || {
      contracts: { view: 'own', viewValue: false, create: true, edit: 'own', delete: false, assign: false },
      projects: { view: 'own', viewValue: false, create: false, edit: 'own', delete: false, assign: false },
      tasks: { view: 'own', viewValue: true, create: true, edit: 'own', delete: false, assign: false },
      departments: { view: 'all', viewValue: true, create: false, edit: 'none', delete: false, assign: false },
      team: { view: 'all', viewValue: true, create: false, edit: 'none', delete: false, assign: false },
      settings: { view: 'none', viewValue: false, create: false, edit: 'none', delete: false, assign: false },
    };

    res.json({
      success: true,
      role: userRoleCode,
      roleName: roleDoc?.name || userRoleCode,
      isAdmin: userRoleCode === 'admin',
      isManager: userRoleCode === 'manager' || userRoleCode === 'admin',
      color: roleDoc?.color || '#3b82f6',
      permissions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new custom role
// @route   POST /api/roles
// @access  Private (Admin / Manager with permission)
export const createRole = async (req, res, next) => {
  try {
    const workspaceId = req.user.currentWorkspace || req.body.workspaceId;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Workspace ID là bắt buộc' });
    }

    const { name, code, description, color, permissions } = req.body;

    const roleCode = (code || name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 30);

    // Kiểm tra trùng code
    const existing = await Role.findOne({ workspace: workspaceId, code: roleCode });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Mã vai trò '${roleCode}' đã tồn tại trong không gian này.`,
      });
    }

    const maxOrderRole = await Role.findOne({ workspace: workspaceId }).sort({ order: -1 });
    const order = (maxOrderRole?.order || 0) + 1;

    const newRole = await Role.create({
      workspace: workspaceId,
      name,
      code: roleCode,
      description: description || '',
      color: color || '#2563eb',
      isSystem: false,
      order,
      permissions,
    });

    res.status(201).json({
      success: true,
      message: 'Tạo vai trò mới thành công',
      role: newRole,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update role permissions & details
// @route   PUT /api/roles/:id
// @access  Private (Admin)
export const updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, color, permissions, order } = req.body;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vai trò' });
    }

    // Nếu là admin hệ thống, không cho tắt các quyền tối cao để tránh lock out
    if (role.isSystem && role.code === 'admin') {
      if (name) role.name = name;
      if (description !== undefined) role.description = description;
      if (color) role.color = color;
      // Admin luôn giữ full quyền
      await role.save();
      return res.json({
        success: true,
        message: 'Đã cập nhật thông tin vai trò Admin (quyền tối cao được bảo vệ)',
        role,
      });
    }

    if (name) role.name = name;
    if (description !== undefined) role.description = description;
    if (color) role.color = color;
    if (order !== undefined) role.order = order;
    if (permissions) {
      role.permissions = {
        ...role.permissions.toObject(),
        ...permissions,
      };
    }

    await role.save();

    const io = getIO();
    if (io) {
      io.emit('role:permissions_updated', { roleCode: role.code, workspace: role.workspace });
    }

    res.json({
      success: true,
      message: `Cập nhật ma trận phân quyền cho vai trò '${role.name}' thành công!`,
      role,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete custom role
// @route   DELETE /api/roles/:id
// @access  Private (Admin)
export const deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const role = await Role.findById(id);

    if (!role) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vai trò' });
    }

    if (role.isSystem) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa vai trò mặc định của hệ thống.',
      });
    }

    // Chuyển tất cả user đang thuộc role này về role 'member'
    await User.updateMany({ role: role.code }, { role: 'member', roleRef: null });

    await Role.findByIdAndDelete(id);

    const io = getIO();
    if (io) {
      io.emit('role:permissions_updated', { workspace: role.workspace });
    }

    res.json({
      success: true,
      message: `Đã xóa vai trò '${role.name}'. Các thành viên đã được chuyển về vai trò Nhân viên (Member).`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset roles to system defaults
// @route   POST /api/roles/reset-defaults
// @access  Private (Admin)
export const resetRolesToDefault = async (req, res, next) => {
  try {
    const workspaceId = req.user.currentWorkspace || req.body.workspaceId;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Workspace ID là bắt buộc' });
    }

    // Xóa các role hiện tại của workspace
    await Role.deleteMany({ workspace: workspaceId });

    // Seed lại từ templates
    const templates = getDefaultRoleTemplates(workspaceId);
    await Role.insertMany(templates);

    const roles = await Role.find({ workspace: workspaceId }).sort({ order: 1, createdAt: 1 });

    const io = getIO();
    if (io) {
      io.emit('role:permissions_updated', { workspace: workspaceId });
    }

    res.json({
      success: true,
      message: 'Đã khôi phục ma trận phân quyền về cấu hình mặc định ban đầu!',
      roles,
    });
  } catch (error) {
    next(error);
  }
};
