import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { Contract } from '../models/Contract.js';
import { Workspace } from '../models/Workspace.js';
import mongoose from 'mongoose';

// @desc    Get dashboard metrics & statistics (Upgraded All-in-One)
// @route   GET /api/dashboard/overview
// @access  Private
export const getDashboardOverview = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const workspaceId = req.workspaceId || req.user?.currentWorkspace || req.headers['x-workspace-id'];
    const isAdmin = req.user?.role === 'admin' || req.isWorkspaceAdmin;
    const now = new Date();
    const next30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const userObjectId = userId ? new mongoose.Types.ObjectId(userId) : null;
    const wsObjectId = workspaceId ? new mongoose.Types.ObjectId(workspaceId) : null;

    const wsFilter = workspaceId ? { workspace: workspaceId } : {};
    const wsMatch = wsObjectId
      ? { $or: [{ workspace: wsObjectId }, { workspace: workspaceId }] }
      : {};
    const contractFilter = wsFilter;
    const contractMatch = wsMatch;

    // Tìm danh sách ID dự án mà nhân viên có công việc được giao trong không gian này
    const taskProjectIds = userObjectId
      ? await Task.find({ ...wsFilter, assignee: userObjectId }).distinct('project')
      : [];

    const myProjectCondition = userObjectId
      ? {
          ...wsFilter,
          $or: [
            { _id: { $in: taskProjectIds } },
            { members: userObjectId },
            { manager: userObjectId },
            { owner: userObjectId },
          ],
        }
      : null;

    const [
      totalProjects,
      activeProjects,
      totalTasks,
      todoTasks,
      inProgressTasks,
      reviewTasks,
      doneTasks,
      overdueTasksCount,
      urgentTasksCount,
      totalUsers,
      recentActivities,
      upcomingTasks,
      contractsSummary,
      expiringContracts,
      myAssignedTasks,
      myReviewTasks,
      myStatsAgg,
      myProjectsCount,
      myUrgentCount,
      myUpcomingTasks,
      myPriorityAgg,
      activeProjectList,
      priorityAgg,
    ] = await Promise.all([
      Project.countDocuments(wsFilter),
      Project.countDocuments({ ...wsFilter, status: 'active' }),
      Task.countDocuments(wsFilter),
      Task.countDocuments({ ...wsFilter, status: 'todo' }),
      Task.countDocuments({ ...wsFilter, status: 'in_progress' }),
      Task.countDocuments({ ...wsFilter, status: 'review' }),
      Task.countDocuments({ ...wsFilter, status: 'done' }),
      Task.countDocuments({
        ...wsFilter,
        status: { $ne: 'done' },
        dueDate: { $lt: now },
      }),
      Task.countDocuments({
        ...wsFilter,
        status: { $ne: 'done' },
        priority: 'urgent',
      }),
      workspaceId
        ? Workspace.findById(workspaceId).then((w) => (w ? 1 + (w.members?.length || 0) : 0))
        : User.countDocuments({ isActive: true }),
      ActivityLog.find(wsFilter)
        .populate('user', 'name email avatar')
        .sort({ createdAt: -1 })
        .limit(7),
      Task.find({
        ...wsFilter,
        status: { $ne: 'done' },
        dueDate: { $gte: now },
      })
        .populate('project', 'name code color')
        .populate('assignee', 'name avatar')
        .sort({ dueDate: 1 })
        .limit(5),

      // Tổng hợp Hợp đồng & Deals (Chỉ Admin / Quản trị viên mới xem)
      isAdmin
        ? Contract.aggregate([
            { $match: contractMatch },
            {
              $group: {
                _id: null,
                totalCount: { $sum: 1 },
                activeCount: {
                  $sum: { $cond: [{ $in: ['$stage', ['pending_sign', 'active', 'settlement']] }, 1, 0] },
                },
                totalValue: { $sum: '$totalValue' },
                paidAmount: { $sum: '$paidAmount' },
              },
            },
          ])
        : Promise.resolve([]),

      // Hợp đồng sắp hết hạn trong 30 ngày (Chỉ Admin)
      isAdmin
        ? Contract.find({
            ...contractFilter,
            endDate: { $gte: now, $lte: next30Days },
            stage: { $nin: ['completed', 'cancelled'] },
          })
            .select('code title partner totalValue stage endDate remainingAmount')
            .sort({ endDate: 1 })
            .limit(4)
        : Promise.resolve([]),

      // Công việc được giao cho tôi
      userId
        ? Task.find({
            ...wsFilter,
            assignee: userId,
            status: { $ne: 'done' },
          })
            .populate('project', 'name code color')
            .sort({ dueDate: 1, priority: -1 })
            .limit(5)
        : Promise.resolve([]),

      // Công việc đang chờ tôi duyệt
      userId
        ? Task.find({
            ...wsFilter,
            status: 'review',
            $or: [{ reviewer: userId }, { creator: userId, reviewer: null }],
          })
            .populate('project', 'name code color')
            .populate('assignee', 'name avatar')
            .sort({ updatedAt: -1 })
            .limit(5)
        : Promise.resolve([]),

      // Thống kê cá nhân
      userObjectId
        ? Task.aggregate([
            { $match: { ...wsMatch, assignee: userObjectId } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
                inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
                review: { $sum: { $cond: [{ $eq: ['$status', 'review'] }, 1, 0] } },
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
              },
            },
          ])
        : Promise.resolve([]),

      // Số dự án nhân viên được tham gia (qua phân công task hoặc danh sách thành viên/quản lý)
      myProjectCondition
        ? Project.countDocuments(myProjectCondition)
        : Promise.resolve(0),

      // Số việc khẩn cấp của nhân viên
      userObjectId
        ? Task.countDocuments({
            ...wsFilter,
            assignee: userObjectId,
            status: { $ne: 'done' },
            priority: 'urgent',
          })
        : Promise.resolve(0),

      // Hạn chót sắp tới của riêng nhân viên
      userObjectId
        ? Task.find({
            ...wsFilter,
            assignee: userObjectId,
            status: { $ne: 'done' },
            dueDate: { $gte: now },
          })
            .populate('project', 'name code color')
            .sort({ dueDate: 1 })
            .limit(5)
        : Promise.resolve([]),

      // Phân bổ ưu tiên các việc của riêng nhân viên
      userObjectId
        ? Task.aggregate([
            { $match: { ...wsMatch, assignee: userObjectId, status: { $ne: 'done' } } },
            {
              $group: {
                _id: '$priority',
                count: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([]),

      // Dự án đang chạy để tính tiến độ (Admin xem toàn cty, Nhân viên xem các dự án mình tham gia)
      Project.find({
        ...wsFilter,
        status: { $in: ['active', 'planning'] },
        ...(!isAdmin && myProjectCondition ? myProjectCondition : {}),
      })
        .select('name code color status budget startDate endDate manager members')
        .populate('manager', 'name avatar')
        .populate('members', 'name avatar')
        .sort({ updatedAt: -1 })
        .limit(5),

      // Phân bổ độ ưu tiên
      Task.aggregate([
        { $match: { ...wsMatch, status: { $ne: 'done' } } },
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Tính % hoàn thành từng dự án
    const projectIds = activeProjectList.map((p) => p._id);
    const projectTaskCounts = await Task.aggregate([
      { $match: { project: { $in: projectIds } } },
      {
        $group: {
          _id: '$project',
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        },
      },
    ]);

    const projectStatsMap = {};
    projectTaskCounts.forEach((pt) => {
      projectStatsMap[pt._id.toString()] = {
        total: pt.total,
        done: pt.done,
        percent: pt.total > 0 ? Math.round((pt.done / pt.total) * 100) : 0,
      };
    });

    const projectsWithProgress = activeProjectList.map((p) => {
      const stats = projectStatsMap[p._id.toString()] || { total: 0, done: 0, percent: 0 };
      return {
        ...p.toObject(),
        taskStats: stats,
      };
    });

    // Format Contracts
    const cSummary = contractsSummary[0] || {
      totalCount: 0,
      activeCount: 0,
      totalValue: 0,
      paidAmount: 0,
    };
    const remainingAmount = Math.max(0, (cSummary.totalValue || 0) - (cSummary.paidAmount || 0));
    const collectionRate =
      cSummary.totalValue > 0 ? Math.round((cSummary.paidAmount / cSummary.totalValue) * 100) : 0;

    // Format Priority
    const priorityCounts = { urgent: 0, high: 0, medium: 0, low: 0 };
    priorityAgg.forEach((p) => {
      if (p._id && priorityCounts[p._id] !== undefined) {
        priorityCounts[p._id] = p.count;
      }
    });

    // Format My Priority
    const myPriorityCounts = { urgent: 0, high: 0, medium: 0, low: 0 };
    (myPriorityAgg || []).forEach((p) => {
      if (p._id && myPriorityCounts[p._id] !== undefined) {
        myPriorityCounts[p._id] = p.count;
      }
    });

    // Format My Stats
    const myStat = myStatsAgg[0] || { total: 0, done: 0, inProgress: 0, review: 0, overdue: 0 };
    myStat.projectsCount = myProjectsCount || 0;
    myStat.urgent = myUrgentCount || 0;
    myStat.completionRate =
      myStat.total > 0 ? Math.round((myStat.done / myStat.total) * 100) : 0;
    myStat.todo = Math.max(
      0,
      (myStat.total || 0) - (myStat.done || 0) - (myStat.inProgress || 0) - (myStat.review || 0)
    );

    res.json({
      success: true,
      data: {
        projects: {
          total: totalProjects,
          active: activeProjects,
          topList: projectsWithProgress,
        },
        tasks: {
          total: totalTasks,
          todo: todoTasks,
          inProgress: inProgressTasks,
          review: reviewTasks,
          done: doneTasks,
          overdue: overdueTasksCount,
          urgent: urgentTasksCount,
          completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
          priorityDistribution: priorityCounts,
        },
        contracts: {
          total: cSummary.totalCount,
          active: cSummary.activeCount,
          totalValue: cSummary.totalValue,
          paidAmount: cSummary.paidAmount,
          remainingAmount,
          collectionRate,
          expiringSoon: expiringContracts,
        },
        personal: {
          stats: myStat,
          assignedTasks: myAssignedTasks,
          reviewTasks: myReviewTasks,
          upcomingTasks: myUpcomingTasks,
          priorityDistribution: myPriorityCounts,
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
    const workspaceId = req.workspaceId || req.user?.currentWorkspace || req.headers['x-workspace-id'];
    const wsObjectId = workspaceId ? new mongoose.Types.ObjectId(workspaceId) : null;

    const taskMatch = {};

    // 0. Lọc theo Không gian làm việc
    if (wsObjectId) {
      taskMatch.workspace = wsObjectId;
    }

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

    // Lọc danh sách thành viên thuộc Không gian làm việc
    let memberIds = null;
    if (workspaceId) {
      const ws = await Workspace.findById(workspaceId).select('owner members');
      if (ws) {
        memberIds = [ws.owner, ...(ws.members || []).map((m) => m.user)].filter(Boolean);
      }
    }

    const userFilter = {
      isActive: true,
      ...(memberIds ? { _id: { $in: memberIds } } : {}),
      ...(department && department !== 'all' ? { departmentId: department } : {}),
    };

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
      User.find(userFilter)
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

