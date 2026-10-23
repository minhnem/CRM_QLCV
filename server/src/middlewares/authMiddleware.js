import { verifyToken } from '../config/jwt.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Workspace } from '../models/Workspace.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Please provide a Bearer token.',
    });
  }

  try {
    const decoded = verifyToken(token);
    const currentUser = await User.findById(decoded.id).select('-password');

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    if (!currentUser.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated.',
      });
    }

    req.user = currentUser;

    // Xác định Không gian làm việc hiện tại (Workspace)
    const headerWsId = req.headers['x-workspace-id'];
    req.workspaceId = headerWsId || (currentUser.currentWorkspace ? currentUser.currentWorkspace.toString() : null);

    // Xác định vai trò của người dùng trong Không gian làm việc hiện tại
    req.isWorkspaceAdmin = currentUser.role === 'admin';
    if (req.workspaceId) {
      try {
        const ws = await Workspace.findById(req.workspaceId).select('owner members');
        if (ws) {
          const userIdStr = currentUser._id.toString();
          const isOwner = ws.owner && ws.owner.toString() === userIdStr;
          const memberEntry = ws.members?.find((m) => m.user && m.user.toString() === userIdStr);
          if (isOwner) {
            req.workspaceRole = 'owner';
            req.isWorkspaceAdmin = true;
          } else if (memberEntry) {
            req.workspaceRole = memberEntry.role || 'member';
            if (memberEntry.role === 'admin' || memberEntry.role === 'owner') {
              req.isWorkspaceAdmin = true;
            }
          }
        }
      } catch (wsErr) {
        console.error('Lỗi phân tích quyền Workspace trong authMiddleware:', wsErr.message);
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized or invalid/expired token.',
      error: error.message,
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    // Nếu yêu cầu admin và người dùng là admin hệ thống hoặc admin/owner của workspace này
    if (roles.includes('admin') && req.isWorkspaceAdmin) {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user?.role}' is not authorized to access this resource.`,
      });
    }
    next();
  };
};

// Middleware kiểm tra ma trận phân quyền động (Dynamic Permission Matrix RBAC)
export const checkPermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Yêu cầu xác thực tài khoản.' });
      }

      // Super Admin hệ thống hoặc Chủ sở hữu / Quản trị viên của Workspace hiện tại luôn có toàn quyền
      if (req.user.role === 'admin' || req.isWorkspaceAdmin) {
        req.permissionScope = { scope: 'all', canViewValue: true };
        return next();
      }

      const workspaceId = req.user.currentWorkspace || req.headers['x-workspace-id'];

      let roleDoc = await Role.findOne({
        code: req.user.role,
        ...(workspaceId ? { workspace: workspaceId } : {}),
      });

      // Nếu không tìm thấy cấu hình roleDoc, fallback theo vai trò chuẩn
      if (!roleDoc) {
        if (req.user.role === 'manager') {
          req.permissionScope = { scope: 'dept', canViewValue: true };
          return next();
        }
        if (action === 'delete') {
          return res.status(403).json({
            success: false,
            message: 'Bạn không có quyền thực hiện xóa dữ liệu này.',
          });
        }
        req.permissionScope = { scope: 'own', canViewValue: false };
        return next();
      }

      const resourcePerm = roleDoc.permissions?.[resource];
      if (!resourcePerm) {
        return res.status(403).json({
          success: false,
          message: `Không tìm thấy cấu hình quyền cho phân hệ: ${resource}`,
        });
      }

      // 1. Quyền XEM (view)
      if (action === 'view') {
        if (resourcePerm.view === 'none') {
          return res.status(403).json({
            success: false,
            message: `Bạn không có quyền xem dữ liệu phân hệ ${resource}.`,
          });
        }
        req.permissionScope = {
          scope: resourcePerm.view,
          canViewValue: resourcePerm.viewValue !== false,
        };
        return next();
      }

      // 2. Quyền TẠO MỚI (create)
      if (action === 'create') {
        if (!resourcePerm.create) {
          return res.status(403).json({
            success: false,
            message: `Bạn không có quyền tạo mới trong phân hệ ${resource}.`,
          });
        }
        req.permissionScope = {
          scope: 'all',
          canViewValue: resourcePerm.viewValue !== false,
        };
        return next();
      }

      // 3. Quyền CHỈNH SỬA (edit)
      if (action === 'edit') {
        if (resourcePerm.edit === 'none' || resourcePerm.edit === false) {
          return res.status(403).json({
            success: false,
            message: `Bạn không có quyền chỉnh sửa trong phân hệ ${resource}.`,
          });
        }
        req.permissionScope = {
          scope: resourcePerm.edit,
          canViewValue: resourcePerm.viewValue !== false,
        };
        return next();
      }

      // 4. Quyền XÓA (delete)
      if (action === 'delete') {
        if (!resourcePerm.delete) {
          return res.status(403).json({
            success: false,
            message: `Bạn không có quyền xóa dữ liệu trong phân hệ ${resource}.`,
          });
        }
        return next();
      }

      // 5. Quyền PHÂN CÔNG (assign)
      if (action === 'assign') {
        if (!resourcePerm.assign) {
          return res.status(403).json({
            success: false,
            message: `Bạn không có quyền phân công trong phân hệ ${resource}.`,
          });
        }
        return next();
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

