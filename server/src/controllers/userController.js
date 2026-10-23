import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Workspace } from '../models/Workspace.js';
import { Department } from '../models/Department.js';

// @desc    Get all users
// @route   GET /api/users
// @access  Private
export const getUsers = async (req, res, next) => {
  try {
    const { role, department, search } = req.query;
    const workspaceId = req.workspaceId || req.user.currentWorkspace || req.headers['x-workspace-id'];
    const query = {};

    // Giới hạn danh sách người dùng thuộc Không gian làm việc hiện tại
    if (workspaceId) {
      const ws = await Workspace.findById(workspaceId).select('owner members');
      if (ws) {
        const memberIds = [ws.owner, ...(ws.members || []).map((m) => m.user)].filter(Boolean);
        query._id = { $in: memberIds };
      }
    }

    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    // Khi có workspaceId: Xác định phòng ban THỰC TẾ của từng người dùng trong workspace này
    let formattedUsers = users.map((u) => u.toObject());
    if (workspaceId) {
      // Tìm tất cả phòng ban thuộc workspace này
      const wsDepts = await Department.find({ workspace: workspaceId }).select('_id name code color members head');

      formattedUsers = formattedUsers.map((u) => {
        const userIdStr = (u._id || u.id).toString();

        // Tìm tất cả các phòng ban trong workspace hiện tại mà user này tham gia
        const matchedDepts = wsDepts.filter((d) => {
          const isHead = d.head && d.head.toString() === userIdStr;
          const isMember = Array.isArray(d.members) && d.members.some((m) => m.toString() === userIdStr);
          return isHead || isMember;
        });

        if (matchedDepts.length === 0) {
          // Trong workspace này, người dùng chưa được phân vào phòng ban nào!
          u.departments = [];
          u.department = '';
          u.departmentId = null;
        } else {
          u.departments = matchedDepts.map((d) => ({
            _id: d._id,
            name: d.name,
            code: d.code,
            color: d.color,
            isHead: d.head && d.head.toString() === userIdStr,
          }));
          u.department = matchedDepts.map((d) => d.name).join(', ');
          u.departmentId = matchedDepts[0];
        }

        return u;
      });
    }

    // Nếu có query lọc theo department name hoặc ID
    if (department && department !== 'all') {
      formattedUsers = formattedUsers.filter((u) => {
        if (!u.departments || u.departments.length === 0) return false;
        return u.departments.some(
          (d) => d._id.toString() === department.toString() || d.name === department
        );
      });
    }

    res.json({
      success: true,
      count: formattedUsers.length,
      users: formattedUsers,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user role & department (Admin only)
// @route   PATCH /api/users/:id/role
// @access  Private/Admin
export const updateUserRole = async (req, res, next) => {
  try {
    const { role, department, departmentId, isActive, roleRef } = req.body;
    const updateData = {};
    if (role) {
      updateData.role = role;
      if (!roleRef) {
        const rDoc = await Role.findOne({ code: role });
        if (rDoc) updateData.roleRef = rDoc._id;
      }
    }
    if (roleRef) updateData.roleRef = roleRef;
    if (department) updateData.department = department;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (isActive !== undefined) updateData.isActive = isActive;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    res.json({ success: true, message: 'Cập nhật phân quyền người dùng thành công!', user });
  } catch (error) {
    next(error);
  }
};
