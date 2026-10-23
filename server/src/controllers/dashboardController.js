import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { ActivityLog } from '../models/ActivityLog.js';
import mongoose from 'mongoose';

// @desc    Get dashboard metrics & statistics
// @route   GET /api/dashboard/overview
// @access  Private
export const getDashboardOverview = async (req, res, next) => {
  try {
    const [
      totalProjects,
      activeProjects,
      totalTasks,
      todoTasks,
      inProgressTasks,
      reviewTasks,
      doneTasks,
      totalUsers,
      recentActivities,
      upcomingTasks,
    ] = await Promise.all([
      Project.countDocuments(),
      Project.countDocuments({ status: 'active' }),
      Task.countDocuments(),
      Task.countDocuments({ status: 'todo' }),
      Task.countDocuments({ status: 'in_progress' }),
      Task.countDocuments({ status: 'review' }),
      Task.countDocuments({ status: 'done' }),
      User.countDocuments({ isActive: true }),
      ActivityLog.find()
        .populate('user', 'name email avatar')
        .sort({ createdAt: -1 })
        .limit(8),
      Task.find({
        status: { $ne: 'done' },
        dueDate: { $gte: new Date() },
      })
        .populate('project', 'name code color')
        .populate('assignee', 'name avatar')
        .sort({ dueDate: 1 })
        .limit(5),
    ]);

    res.json({
      success: true,
      data: {
        projects: {
          total: totalProjects,
          active: activeProjects,
        },
        tasks: {
          total: totalTasks,
          todo: todoTasks,
          inProgress: inProgressTasks,
          review: reviewTasks,
          done: doneTasks,
          completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
        },
        users: {
          total: totalUsers,
        },
        recentActivities,
        upcomingTasks,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed employee task statistics & KPIs
// @route   GET /api/dashboard/employee-stats
// @access  Private
export const getEmployeeStats = async (req, res, next) => {
  try {
    const { department, project, timeRange = 'all', startDate, endDate } = req.query;

    const taskMatch = {};

    // 1. Lọc theo Dự án
    if (project && project !== 'all') {
      taskMatch.project = new mongoose.Types.ObjectId(project);
    }

    // 2. Lọc theo Phòng ban
    if (department && department !== 'all') {
      taskMatch.department = new mongoose.Types.ObjectId(department);
    }

    // 3. Lọc theo Khoảng thời gian
    const now = new Date();
    if (timeRange === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      taskMatch.createdAt = { $gte: startOfDay };
    } else if (timeRange === 'this_week') {
      const day = now.getDay() || 7;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - day + 1);
      startOfWeek.setHours(0, 0, 0, 0);
      taskMatch.createdAt = { $gte: startOfWeek };
    } else if (timeRange === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      taskMatch.createdAt = { $gte: startOfMonth };
    } else if (timeRange === 'this_quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1);
      taskMatch.createdAt = { $gte: startOfQuarter };
    } else if (timeRange === 'custom' && (startDate || endDate)) {
      taskMatch.createdAt = {};
      if (startDate) taskMatch.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        taskMatch.createdAt.$lte = end;
      }
    }

    // Pipeline nhóm thống kê theo từng Assignee
    const aggregationPipeline = [
      { $match: taskMatch },
      {
        $group: {
          _id: '$assignee',
          total: { $sum: 1 },
          todo: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          review: { $sum: { $cond: [{ $eq: ['$status', 'review'] }, 1, 0] } },
          done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$status', 'done'] },
                    { $ifNull: ['$dueDate', false] },
                    { $lt: ['$dueDate', now] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          changesRequested: {
            $sum: {
              $cond: [
                { $eq: ['$reviewFeedback.action', 'changes_requested'] },
                1,
                0,
              ],
            },
          },
        },
      },
    ];

    const [aggregatedData, allTasksSummary, users] = await Promise.all([
      Task.aggregate(aggregationPipeline),
      Task.aggregate([
        { $match: taskMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            todo: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
            inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
            review: { $sum: { $cond: [{ $eq: ['$status', 'review'] }, 1, 0] } },
            done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
            overdue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$status', 'done'] },
                      { $ifNull: ['$dueDate', false] },
                      { $lt: ['$dueDate', now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            changesRequested: {
              $sum: {
                $cond: [
                  { $eq: ['$reviewFeedback.action', 'changes_requested'] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      User.find({
        isActive: true,
        ...(department && department !== 'all' ? { departmentId: department } : {}),
      })
        .select('name email avatar role department departmentId')
        .populate('departmentId', 'name code color'),
    ]);

    // Tạo Map từ aggregated data
    const statsMap = new Map();
    aggregatedData.forEach((item) => {
      if (item._id) {
        statsMap.set(item._id.toString(), item);
      }
    });

    // Map qua danh sách Users để mỗi nhân viên đều có dữ liệu thống kê
    const employeeStats = users.map((u) => {
      const stat = statsMap.get(u._id.toString()) || {
        total: 0,
        todo: 0,
        inProgress: 0,
        review: 0,
        done: 0,
        overdue: 0,
        changesRequested: 0,
      };

      const completionRate = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;

      return {
        user: {
          _id: u._id,
          name: u.name,
          email: u.email,
          avatar: u.avatar,
          role: u.role,
          department: u.department,
        },
        departmentName:
          u.departmentId?.name || (typeof u.department === 'string' ? u.department : '') || 'Chưa gán',
        total: stat.total,
        todo: stat.todo,
        inProgress: stat.inProgress,
        review: stat.review,
        done: stat.done,
        overdue: stat.overdue,
        changesRequested: stat.changesRequested,
        completionRate,
      };
    });

    // Sắp xếp: Ưu tiên người có nhiều việc hoặc % cao
    employeeStats.sort((a, b) => b.total - a.total || b.done - a.done);

    const summary = allTasksSummary[0] || {
      total: 0,
      todo: 0,
      inProgress: 0,
      review: 0,
      done: 0,
      overdue: 0,
      changesRequested: 0,
    };

    const overallCompletionRate = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;

    // Status distribution for Pie Chart
    const statusDistribution = [
      {
        status: 'done',
        label: 'Hoàn thành (Done)',
        count: summary.done,
        percent: summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0,
        color: '#10b981',
      },
      {
        status: 'in_progress',
        label: 'Đang làm (In Progress)',
        count: summary.inProgress,
        percent: summary.total > 0 ? Math.round((summary.inProgress / summary.total) * 100) : 0,
        color: '#2563eb',
      },
      {
        status: 'review',
        label: 'Chờ duyệt (Review)',
        count: summary.review,
        percent: summary.total > 0 ? Math.round((summary.review / summary.total) * 100) : 0,
        color: '#f59e0b',
      },
      {
        status: 'todo',
        label: 'Cần làm (To Do)',
        count: summary.todo,
        percent: summary.total > 0 ? Math.round((summary.todo / summary.total) * 100) : 0,
        color: '#64748b',
      },
    ];

    res.json({
      success: true,
      data: {
        summary: {
          ...summary,
          overallCompletionRate,
          totalEmployees: users.length,
          activeEmployeesWithTasks: aggregatedData.filter((i) => i._id).length,
        },
        statusDistribution,
        employeeStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

