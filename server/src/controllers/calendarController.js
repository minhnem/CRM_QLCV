import { Task } from '../models/Task.js';
import { Contract } from '../models/Contract.js';

// @desc    Lấy danh sách công việc theo khoảng thời gian cho Lịch
// @route   GET /api/calendar/tasks
// @access  Private
export const getCalendarTasks = async (req, res, next) => {
  try {
    const { month, year, project, workspaceId } = req.query;
    const currentWs = workspaceId || req.user.currentWorkspace;

    const targetYear = parseInt(year) || new Date().getFullYear();
    const targetMonth = parseInt(month) || new Date().getMonth() + 1; // 1-12

    // Dùng native JavaScript Date an toàn, không phụ thuộc thư viện ngoài
    const startOfMonth = new Date(targetYear, targetMonth - 1, 1 - 7, 0, 0, 0);
    const endOfMonth = new Date(targetYear, targetMonth, 7, 23, 59, 59);

    const query = {
      $or: [
        { dueDate: { $gte: startOfMonth, $lte: endOfMonth } },
        { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
      ],
    };

    if (project && project !== 'all') {
      query.project = project;
    }

    const tasks = await Task.find(query)
      .populate('project', 'name code color')
      .populate('department', 'name code color')
      .populate('assignee', 'name email avatar')
      .populate('creator', 'name email avatar')
      .sort({ dueDate: 1, priority: -1 });

    res.json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy danh sách Hợp đồng theo ngày Bắt đầu và Ngày Kết thúc cho Lịch
// @route   GET /api/calendar/contracts
// @access  Private
export const getCalendarContracts = async (req, res, next) => {
  try {
    const { month, year, workspaceId, project } = req.query;
    const currentWs = workspaceId || req.user.currentWorkspace;

    const targetYear = parseInt(year) || new Date().getFullYear();
    const targetMonth = parseInt(month) || new Date().getMonth() + 1; // 1-12

    // Dùng native JavaScript Date an toàn
    const startOfMonth = new Date(targetYear, targetMonth - 1, 1 - 7, 0, 0, 0);
    const endOfMonth = new Date(targetYear, targetMonth, 7, 23, 59, 59);

    const query = {
      $or: [
        // Hợp đồng có ngày bắt đầu trong khoảng tháng
        { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
        // Hợp đồng có ngày kết thúc trong khoảng tháng
        { endDate: { $gte: startOfMonth, $lte: endOfMonth } },
        // Hợp đồng có ngày ký trong khoảng tháng
        { signDate: { $gte: startOfMonth, $lte: endOfMonth } },
        // Hoặc hợp đồng đang diễn ra xuyên suốt tháng này
        {
          startDate: { $lte: endOfMonth },
          endDate: { $gte: startOfMonth },
        },
      ],
    };

    if (currentWs) {
      query.workspace = currentWs;
    }

    if (project && project !== 'all') {
      query.$and = [{ $or: [{ projects: project }, { project: project }] }];
    }

    const contracts = await Contract.find(query)
      .populate('projects', 'name code color')
      .populate('project', 'name code color')
      .populate('departments', 'name code color')
      .populate('department', 'name code color')
      .populate('assignedTo', 'name email avatar')
      .populate('creator', 'name email avatar')
      .sort({ endDate: 1 });

    res.json({
      success: true,
      count: contracts.length,
      contracts,
    });
  } catch (error) {
    next(error);
  }
};
