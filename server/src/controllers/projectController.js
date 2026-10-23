import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { Contract } from '../models/Contract.js';
import { Department } from '../models/Department.js';

// @desc    Get all projects
// @route   GET /api/projects
// @access  Private
export const getProjects = async (req, res, next) => {
  try {
    const { status, search, contract, department } = req.query;
    const workspaceId = req.workspaceId || req.user.currentWorkspace;
    const conditions = [];

    if (workspaceId) {
      conditions.push({ workspace: workspaceId });
    }

    if (status && status !== 'all') {
      conditions.push({ status });
    }

    if (department && department !== 'all') {
      conditions.push({ departments: department });
    }

    if (contract && contract !== 'all') {
      if (contract === 'none') {
        // Dự án chưa gắn hợp đồng nào
        const contractsWithProjects = await Contract.find({
          $or: [
            { projects: { $exists: true, $ne: [] } },
            { project: { $ne: null } },
          ],
        }).select('projects project');

        const linkedProjectIds = new Set();
        contractsWithProjects.forEach((c) => {
          if (Array.isArray(c.projects)) {
            c.projects.forEach((pid) => linkedProjectIds.add(pid.toString()));
          }
          if (c.project) {
            linkedProjectIds.add(c.project.toString());
          }
        });

        conditions.push({
          _id: { $nin: Array.from(linkedProjectIds) },
          $or: [{ contracts: { $exists: false } }, { contracts: { $size: 0 } }],
        });
      } else {
        // Dự án thuộc một hợp đồng cụ thể
        const contractDoc = await Contract.findById(contract).select('projects project');
        const linkedProjectIds = new Set();
        if (contractDoc) {
          if (Array.isArray(contractDoc.projects)) {
            contractDoc.projects.forEach((pid) => linkedProjectIds.add(pid.toString()));
          }
          if (contractDoc.project) {
            linkedProjectIds.add(contractDoc.project.toString());
          }
        }
        conditions.push({
          $or: [
            { _id: { $in: Array.from(linkedProjectIds) } },
            { contracts: contract },
          ],
        });
      }
    }

    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      conditions.push({
        $or: [
          { name: searchRegex },
          { code: searchRegex },
          { description: searchRegex },
        ],
      });
    }

    // Phạm vi quyền hạn xem dự án (Permission Scope)
    if (req.permissionScope?.scope === 'own') {
      const ownConditions = [
        { owner: req.user._id },
        { manager: req.user._id },
        { supervisor: req.user._id },
        { members: req.user._id },
      ];

      // Nếu user là Trưởng phòng của phòng ban phụ trách dự án, tự động có quyền xem dự án đó
      const headDepts = await Department.find({
        workspace: workspaceId,
        head: req.user._id,
      }).select('_id');
      if (headDepts.length > 0) {
        const headDeptIds = headDepts.map((d) => d._id);
        ownConditions.push({ departments: { $in: headDeptIds } });
      }

      // Thêm dự án mà user có công việc được giao
      const userTaskProjects = await Task.find({
        workspace: workspaceId,
        $or: [
          { assignee: req.user._id },
          { members: req.user._id },
          { reviewer: req.user._id },
          { creator: req.user._id },
        ],
      }).distinct('project');
      if (userTaskProjects.length > 0) {
        ownConditions.push({ _id: { $in: userTaskProjects } });
      }

      conditions.push({ $or: ownConditions });
    } else if (req.permissionScope?.scope === 'dept') {
      const userDeptIds = [];
      if (req.user.departmentId) {
        userDeptIds.push(req.user.departmentId);
      }
      // Tìm các phòng ban mà user là thành viên hoặc trưởng phòng
      const userDepts = await Department.find({
        workspace: workspaceId,
        $or: [
          { members: req.user._id },
          { head: req.user._id },
          ...(req.user.department ? [{ name: req.user.department }] : []),
        ],
      }).select('_id parent');
      userDepts.forEach((d) => {
        userDeptIds.push(d._id);
        if (d.parent) userDeptIds.push(d.parent);
      });

      const deptConditions = [
        { owner: req.user._id },
        { manager: req.user._id },
        { supervisor: req.user._id },
        { members: req.user._id },
      ];
      if (userDeptIds.length > 0) {
        deptConditions.push({ departments: { $in: userDeptIds } });
      }

      const userTaskProjects = await Task.find({
        workspace: workspaceId,
        $or: [
          { assignee: req.user._id },
          { members: req.user._id },
          { reviewer: req.user._id },
          { creator: req.user._id },
        ],
      }).distinct('project');
      if (userTaskProjects.length > 0) {
        deptConditions.push({ _id: { $in: userTaskProjects } });
      }

      conditions.push({ $or: deptConditions });
    } else if (req.user.role === 'member') {
      const userDeptIds = [];
      if (req.user.departmentId) {
        userDeptIds.push(req.user.departmentId);
      }
      const userDepts = await Department.find({
        workspace: workspaceId,
        $or: [
          { members: req.user._id },
          { head: req.user._id },
          ...(req.user.department ? [{ name: req.user.department }] : []),
        ],
      }).select('_id parent');
      userDepts.forEach((d) => {
        userDeptIds.push(d._id);
        if (d.parent) userDeptIds.push(d.parent);
      });

      const userTaskProjects = await Task.find({
        workspace: workspaceId,
        $or: [
          { assignee: req.user._id },
          { members: req.user._id },
          { reviewer: req.user._id },
          { creator: req.user._id },
        ],
      }).distinct('project');

      const memberConditions = [
        { owner: req.user._id },
        { manager: req.user._id },
        { supervisor: req.user._id },
        { members: req.user._id },
      ];
      if (userDeptIds.length > 0) {
        memberConditions.push({ departments: { $in: userDeptIds } });
      }
      if (userTaskProjects.length > 0) {
        memberConditions.push({ _id: { $in: userTaskProjects } });
      }

      conditions.push({ $or: memberConditions });
    }

    const query = conditions.length > 0 ? { $and: conditions } : {};

    const projects = await Project.find(query)
      .populate('owner', 'name email avatar department role')
      .populate('manager', 'name email avatar department role')
      .populate('supervisor', 'name email avatar department role')
      .populate('members', 'name email avatar department role')
      .populate('departments', 'name code color')
      .populate('contracts', 'code title partner stage totalValue')
      .sort({ updatedAt: -1 });

    // Fetch contracts for these projects to guarantee complete contract mapping
    const projectIds = projects.map((p) => p._id);
    const contractsList = await Contract.find({
      $or: [
        { projects: { $in: projectIds } },
        { project: { $in: projectIds } },
      ],
    }).select('_id code title partner stage totalValue projects project');

    // Áp dụng che giấu giá trị tiền ($) nếu vai trò không có quyền xem giá tiền
    const canViewVal = req.permissionScope?.canViewValue !== false;

    // Attach task summary counts and linked contracts to each project
    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const totalTasks = await Task.countDocuments({ project: project._id });
        const completedTasks = await Task.countDocuments({ project: project._id, status: 'done' });

        // Map contracts linked to this project (from both Contract and Project models)
        const linkedMap = new Map();
        if (project.contracts && project.contracts.length > 0) {
          project.contracts.forEach((c) => {
            if (c && c._id) linkedMap.set(c._id.toString(), c);
          });
        }
        contractsList.forEach((c) => {
          const isLinked =
            (c.projects && c.projects.some((pid) => pid.toString() === project._id.toString())) ||
            (c.project && c.project.toString() === project._id.toString());
          if (isLinked) {
            linkedMap.set(c._id.toString(), {
              _id: c._id,
              code: c.code,
              title: c.title,
              partner: c.partner,
              stage: c.stage,
              totalValue: c.totalValue,
            });
          }
        });

        const plainProject = project.toObject();
        if (!canViewVal) {
          plainProject.budget = 0;
          plainProject.budgetMasked = true;
        }

        const sanitizedContracts = Array.from(linkedMap.values()).map((c) => {
          const item = typeof c.toObject === 'function' ? c.toObject() : { ...c };
          if (!canViewVal) {
            item.totalValue = 0;
            item.valueMasked = true;
          }
          return item;
        });

        return {
          ...plainProject,
          contracts: sanitizedContracts,
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
      count: projectsWithStats.length,
      projects: projectsWithStats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single project
// @route   GET /api/projects/:id
// @access  Private
export const getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email avatar department role')
      .populate('manager', 'name email avatar department role')
      .populate('supervisor', 'name email avatar department role')
      .populate('members', 'name email avatar department role')
      .populate('departments', 'name code color')
      .populate('contracts', 'code title partner stage totalValue');

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const totalTasks = await Task.countDocuments({ project: project._id });
    const completedTasks = await Task.countDocuments({ project: project._id, status: 'done' });

    // Fetch contracts linked to this project
    const contractsList = await Contract.find({
      $or: [
        { projects: project._id },
        { project: project._id },
      ],
    }).select('_id code title partner stage totalValue');

    const linkedMap = new Map();
    if (project.contracts && project.contracts.length > 0) {
      project.contracts.forEach((c) => {
        if (c && c._id) linkedMap.set(c._id.toString(), c);
      });
    }
    contractsList.forEach((c) => {
      linkedMap.set(c._id.toString(), c);
    });

    const canViewVal = req.permissionScope?.canViewValue !== false;
    const plainProject = project.toObject();
    if (!canViewVal) {
      plainProject.budget = 0;
      plainProject.budgetMasked = true;
    }

    const sanitizedContracts = Array.from(linkedMap.values()).map((c) => {
      const item = typeof c.toObject === 'function' ? c.toObject() : { ...c };
      if (!canViewVal) {
        item.totalValue = 0;
        item.valueMasked = true;
      }
      return item;
    });

    res.json({
      success: true,
      project: {
        ...plainProject,
        contracts: sanitizedContracts,
        stats: {
          totalTasks,
          completedTasks,
          progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new project
// @route   POST /api/projects
// @access  Private (Admin, Manager)
export const createProject = async (req, res, next) => {
  try {
    const { name, code, description, status, manager, supervisor, members, departments, contracts, startDate, endDate, budget, color } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Please provide project name' });
    }

    const projectManager = manager || req.user._id;
    const initialMembers = Array.isArray(members) ? [...members] : [req.user._id];
    if (projectManager && !initialMembers.some(m => m.toString() === projectManager.toString())) {
      initialMembers.push(projectManager);
    }
    if (supervisor && !initialMembers.some(m => m.toString() === supervisor.toString())) {
      initialMembers.push(supervisor);
    }

    const canViewVal = req.user.role === 'admin' || req.permissionScope?.canViewValue !== false;
    const workspaceId = req.workspaceId || req.user.currentWorkspace;

    const project = await Project.create({
      name,
      code,
      description,
      workspace: workspaceId,
      status: status || 'active',
      color: color || '#2563eb',
      owner: projectManager,
      manager: projectManager,
      supervisor: supervisor || null,
      members: initialMembers,
      departments: departments || [],
      contracts: Array.isArray(contracts) ? contracts : [],
      startDate,
      endDate,
      budget: canViewVal ? (budget || 0) : 0,
    });

    // Đồng bộ ngược sang Contract model nếu có chọn contracts
    if (Array.isArray(contracts) && contracts.length > 0) {
      await Contract.updateMany(
        { _id: { $in: contracts } },
        { $addToSet: { projects: project._id } }
      );
    }

    await ActivityLog.create({
      user: req.user._id,
      action: 'CREATED_PROJECT',
      targetType: 'project',
      targetId: project._id.toString(),
      details: { projectName: project.name },
      workspace: workspaceId,
    });

    const populatedProject = await Project.findById(project._id)
      .populate('owner', 'name email avatar department role')
      .populate('manager', 'name email avatar department role')
      .populate('supervisor', 'name email avatar department role')
      .populate('members', 'name email avatar department role')
      .populate('departments', 'name code color')
      .populate('contracts', 'code title partner stage totalValue');

    const projectResult = populatedProject.toObject();
    if (!canViewVal) {
      projectResult.budget = 0;
      projectResult.budgetMasked = true;
    }

    res.status(201).json({
      success: true,
      project: projectResult,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private
export const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Only owner, manager, supervisor, admin or system manager can edit
    const isOwner = project.owner && project.owner.toString() === req.user._id.toString();
    const isManager = project.manager && project.manager.toString() === req.user._id.toString();
    const isSupervisor = project.supervisor && project.supervisor.toString() === req.user._id.toString();

    if (!isOwner && !isManager && !isSupervisor && !['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this project' });
    }

    const updatePayload = { ...req.body };
    const canViewVal = req.user.role === 'admin' || req.permissionScope?.canViewValue !== false;
    if (!canViewVal) {
      delete updatePayload.budget;
    }
    if (updatePayload.manager) {
      updatePayload.owner = updatePayload.manager;
    }

    if (Array.isArray(updatePayload.members)) {
      if (updatePayload.manager && !updatePayload.members.some(m => m.toString() === updatePayload.manager.toString())) {
        updatePayload.members.push(updatePayload.manager);
      }
      if (updatePayload.supervisor && !updatePayload.members.some(m => m.toString() === updatePayload.supervisor.toString())) {
        updatePayload.members.push(updatePayload.supervisor);
      }
    }

    // Đồng bộ hai chiều với Contract model
    if (updatePayload.contracts !== undefined) {
      const selectedContracts = Array.isArray(updatePayload.contracts) ? updatePayload.contracts : [];
      // Thêm dự án vào các hợp đồng được chọn
      await Contract.updateMany(
        { _id: { $in: selectedContracts } },
        { $addToSet: { projects: project._id } }
      );
      // Rút dự án khỏi các hợp đồng bị bỏ chọn
      await Contract.updateMany(
        { _id: { $nin: selectedContracts }, projects: project._id },
        { $pull: { projects: project._id } }
      );
    }

    const updated = await Project.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true,
    })
      .populate('owner', 'name email avatar department role')
      .populate('manager', 'name email avatar department role')
      .populate('supervisor', 'name email avatar department role')
      .populate('members', 'name email avatar department role')
      .populate('departments', 'name code color')
      .populate('contracts', 'code title partner stage totalValue');

    const updatedObj = updated.toObject();
    if (!canViewVal) {
      updatedObj.budget = 0;
      updatedObj.budgetMasked = true;
    }

    res.json({
      success: true,
      message: 'Project updated successfully',
      project: updatedObj,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private (Admin, Project Owner)
export const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (
      project.owner.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this project' });
    }

    await Project.findByIdAndDelete(req.params.id);
    // Delete associated tasks
    await Task.deleteMany({ project: req.params.id });

    res.json({
      success: true,
      message: 'Project and associated tasks deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
