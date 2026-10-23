import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { Task } from '../models/Task.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { Workspace } from '../models/Workspace.js';
import { getIO } from '../config/socket.js';

/**
 * Kiểm tra xem người dùng có toàn quyền truy cập cơ cấu phòng ban không
 * (Quản trị viên hệ thống hoặc Chủ sở hữu / Admin của Không gian làm việc)
 */
const isFullAccessUser = async (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const userIdStr = (user._id || user.id || user).toString();
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
  return false;
};

// @desc    Lấy toàn bộ danh sách phòng ban
// @route   GET /api/departments
// @access  Private
export const getDepartments = async (req, res, next) => {
  try {
    const isFullAccess = await isFullAccessUser(req.user);
    const userDeptId = req.user.departmentId ? req.user.departmentId.toString() : null;

    // Thành viên thường chỉ lấy phòng ban họ làm trưởng phòng, thành viên, hoặc được gán departmentId
    const query = isFullAccess
      ? {}
      : {
          $or: [
            { head: req.user._id },
            { members: req.user._id },
            ...(userDeptId ? [{ _id: req.user.departmentId }] : []),
          ],
        };

    const departments = await Department.find(query)
      .populate('head', 'name email avatar phone role')
      .populate('parent', 'name code')
      .populate('members', 'name email avatar phone role')
      .sort({ order: 1, createdAt: 1 });

    // Đính kèm thống kê số công việc và số phòng ban con
    const deptsWithStats = await Promise.all(
      departments.map(async (d) => {
        const memberIds = d.members?.map((m) => m._id) || [];
        const [childrenCount, totalTasks, completedTasks] = await Promise.all([
          Department.countDocuments({ parent: d._id }),
          Task.countDocuments({
            $or: [{ department: d._id }, { assignee: { $in: memberIds } }],
          }),
          Task.countDocuments({
            $or: [{ department: d._id }, { assignee: { $in: memberIds } }],
            status: 'done',
          }),
        ]);

        return {
          ...d.toObject(),
          childrenCount,
          stats: {
            totalTasks,
            completedTasks,
            progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          },
        };
      })
    );

    res.json({
      success: true,
      count: deptsWithStats.length,
      departments: deptsWithStats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy cấu trúc cây phòng ban (Org Chart Tree)
// @route   GET /api/departments/tree
// @access  Private
export const getDepartmentTree = async (req, res, next) => {
  try {
    const isFullAccess = await isFullAccessUser(req.user);
    const userDeptId = req.user.departmentId ? req.user.departmentId.toString() : null;

    const query = isFullAccess
      ? {}
      : {
          $or: [
            { head: req.user._id },
            { members: req.user._id },
            ...(userDeptId ? [{ _id: req.user.departmentId }] : []),
          ],
        };

    const allDepts = await Department.find(query)
      .populate('head', 'name email avatar phone role')
      .populate('members', 'name email avatar phone role')
      .sort({ order: 1, createdAt: 1 });

    // Tính toán stats cho mỗi phòng ban
    const deptsWithStats = await Promise.all(
      allDepts.map(async (d) => {
        const memberIds = d.members?.map((m) => m._id) || [];
        const totalTasks = await Task.countDocuments({
          $or: [{ department: d._id }, { assignee: { $in: memberIds } }],
        });
        const completedTasks = await Task.countDocuments({
          $or: [{ department: d._id }, { assignee: { $in: memberIds } }],
          status: 'done',
        });

        return {
          ...d.toObject(),
          stats: {
            totalTasks,
            completedTasks,
          },
        };
      })
    );

    // Xây dựng cây phân cấp (Tree Hierarchy)
    const deptMap = {};
    deptsWithStats.forEach((d) => {
      deptMap[d._id.toString()] = { ...d, children: [] };
    });

    const rootDepts = [];

    deptsWithStats.forEach((d) => {
      const node = deptMap[d._id.toString()];
      if (d.parent && deptMap[d.parent.toString()]) {
        deptMap[d.parent.toString()].children.push(node);
      } else {
        rootDepts.push(node);
      }
    });

    res.json({
      success: true,
      tree: rootDepts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy chi tiết 1 phòng ban
// @route   GET /api/departments/:id
// @access  Private
export const getDepartmentById = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('head', 'name email avatar phone role')
      .populate('parent', 'name code')
      .populate('members', 'name email avatar phone role department');

    if (!department) {
      return res.status(404).json({ success: false, message: 'Phòng ban không tồn tại' });
    }

    const children = await Department.find({ parent: department._id }).populate(
      'head',
      'name avatar'
    );

    res.json({
      success: true,
      department: {
        ...department.toObject(),
        children,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy tất cả công việc của phòng ban
// @route   GET /api/departments/:id/tasks
// @access  Private
export const getDepartmentTasks = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Phòng ban không tồn tại' });
    }

    const memberIds = department.members || [];
    const tasks = await Task.find({
      $or: [{ department: department._id }, { assignee: { $in: memberIds } }],
    })
      .populate('project', 'name code color')
      .populate('assignee', 'name email avatar')
      .populate('creator', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Tạo phòng ban mới
// @route   POST /api/departments
// @access  Private (Admin, Manager)
export const createDepartment = async (req, res, next) => {
  try {
    const { name, code, description, parent, head, members, color } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên phòng ban' });
    }

    // Nếu có head, đảm bảo head cũng nằm trong danh sách members
    const memberList = members || [];
    if (head && !memberList.includes(head)) {
      memberList.push(head);
    }

    const department = await Department.create({
      name,
      code,
      description,
      parent: parent || null,
      head: head || null,
      members: memberList,
      color: color || '#2563eb',
    });

    // Cập nhật User models tương ứng
    if (memberList.length > 0) {
      await User.updateMany(
        { _id: { $in: memberList } },
        { departmentId: department._id, department: department.name }
      );
    }

    await ActivityLog.create({
      user: req.user._id,
      action: 'CREATED_DEPARTMENT',
      targetType: 'system',
      targetId: department._id.toString(),
      details: { name: department.name },
    });

    const populated = await Department.findById(department._id)
      .populate('head', 'name email avatar role')
      .populate('parent', 'name code')
      .populate('members', 'name email avatar role');

    // Real-time broadcast
    const io = getIO();
    if (io) {
      io.emit('department:changed', { action: 'created', department: populated });
    }

    res.status(201).json({
      success: true,
      message: 'Tạo phòng ban thành công',
      department: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cập nhật phòng ban
// @route   PUT /api/departments/:id
// @access  Private (Admin, Manager)
export const updateDepartment = async (req, res, next) => {
  try {
    const { name, code, description, parent, head, members, color } = req.body;

    // Tránh gán chính nó làm cha
    if (parent && parent.toString() === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'Phòng ban không thể chọn chính nó làm phòng ban cấp trên',
      });
    }

    const memberList = members !== undefined ? members : undefined;
    if (memberList && head && !memberList.includes(head)) {
      memberList.push(head);
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (code !== undefined) updateData.code = code;
    if (description !== undefined) updateData.description = description;
    if (parent !== undefined) updateData.parent = parent || null;
    if (head !== undefined) updateData.head = head || null;
    if (memberList !== undefined) updateData.members = memberList;
    if (color) updateData.color = color;

    const department = await Department.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('head', 'name email avatar role')
      .populate('parent', 'name code')
      .populate('members', 'name email avatar role');

    if (!department) {
      return res.status(404).json({ success: false, message: 'Phòng ban không tồn tại' });
    }

    // Đồng bộ membership cho users
    if (memberList) {
      // 1. Gán departmentId cho các thành viên được chọn
      await User.updateMany(
        { _id: { $in: memberList } },
        { departmentId: department._id, department: department.name }
      );
      // 2. Gỡ departmentId của những người đã bị bỏ khỏi phòng ban này
      await User.updateMany(
        { departmentId: department._id, _id: { $nin: memberList } },
        { $unset: { departmentId: 1 }, department: 'Chưa phân bổ' }
      );
    }

    // Real-time broadcast
    const io = getIO();
    if (io) {
      io.emit('department:changed', { action: 'updated', department });
    }

    res.json({
      success: true,
      message: 'Cập nhật phòng ban thành công',
      department,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Xóa phòng ban
// @route   DELETE /api/departments/:id
// @access  Private (Admin)
export const deleteDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Phòng ban không tồn tại' });
    }

    // Chuyển các phòng ban con lên phòng ban cha của phòng ban hiện tại
    await Department.updateMany(
      { parent: department._id },
      { parent: department.parent || null }
    );

    // Gỡ liên kết phòng ban khỏi nhân viên
    await User.updateMany(
      { departmentId: department._id },
      { departmentId: null, department: 'Chưa phân bổ' }
    );

    await Department.findByIdAndDelete(req.params.id);

    // Real-time broadcast
    const io = getIO();
    if (io) {
      io.emit('department:changed', { action: 'deleted', departmentId: req.params.id });
    }

    res.json({
      success: true,
      message: 'Đã xóa phòng ban thành công',
    });
  } catch (error) {
    next(error);
  }
};
