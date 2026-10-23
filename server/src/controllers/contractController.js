import mongoose from 'mongoose';
import { Contract } from '../models/Contract.js';
import { Department } from '../models/Department.js';
import { getIO } from '../config/socket.js';

// Helper phát sự kiện Socket.IO
const emitContractEvent = (eventName, data, workspaceId) => {
  const io = getIO();
  if (!io) return;
  if (workspaceId) {
    io.to(`workspace:${workspaceId}`).emit(eventName, data);
  }
  io.emit(eventName, data);
  io.emit('contract:changed', data);
};

// @desc    Lấy danh sách Hợp đồng
// @route   GET /api/contracts
// @access  Private
export const getContracts = async (req, res, next) => {
  try {
    const {
      workspaceId,
      stage,
      contractType,
      project,
      department,
      assignedTo,
      search,
      expiring,
      sortBy = '-createdAt',
    } = req.query;

    const currentWs = workspaceId || req.user.currentWorkspace;
    const conditions = [];

    if (currentWs) {
      conditions.push({ workspace: currentWs });
    }

    if (stage) {
      conditions.push({ stage });
    }

    if (contractType) {
      conditions.push({ contractType: { $regex: contractType, $options: 'i' } });
    }

    if (project) {
      conditions.push({
        $or: [{ projects: project }, { project: project }],
      });
    }

    if (department) {
      conditions.push({
        $or: [{ departments: department }, { department: department }],
      });
    }

    if (assignedTo) {
      conditions.push({ assignedTo });
    }

    if (expiring === '30' || expiring === 'true') {
      const now = new Date();
      const next30Days = new Date();
      next30Days.setDate(next30Days.getDate() + 30);
      conditions.push({
        endDate: { $gte: now, $lte: next30Days },
        stage: { $nin: ['completed', 'cancelled'] },
      });
    }

    if (search && search.trim()) {
      const term = search.trim();
      conditions.push({
        $or: [
          { code: { $regex: term, $options: 'i' } },
          { title: { $regex: term, $options: 'i' } },
          { 'partner.name': { $regex: term, $options: 'i' } },
          { 'partner.taxCode': { $regex: term, $options: 'i' } },
          { 'partner.representative': { $regex: term, $options: 'i' } },
          { contractType: { $regex: term, $options: 'i' } },
        ],
      });
    }

    // Áp dụng phạm vi quyền hạn (Permission Scope)
    if (req.permissionScope?.scope === 'own') {
      const ownConditions = [
        { assignedTo: req.user._id },
        { creator: req.user._id },
      ];

      // Nếu user là Trưởng phòng của phòng ban phụ trách hợp đồng, tự động có quyền xem
      const headDepts = await Department.find({ head: req.user._id }).select('_id');
      if (headDepts.length > 0) {
        const headDeptIds = headDepts.map((d) => d._id);
        ownConditions.push({ departments: { $in: headDeptIds } });
        ownConditions.push({ department: { $in: headDeptIds } });
      }

      conditions.push({ $or: ownConditions });
    } else if (req.permissionScope?.scope === 'dept') {
      const userDeptIds = [];
      if (req.user.departmentId) userDeptIds.push(req.user.departmentId);
      const userDepts = await Department.find({
        $or: [
          { members: req.user._id },
          { head: req.user._id },
          ...(req.user.department ? [{ name: req.user.department }] : []),
        ],
      }).select('_id');
      userDepts.forEach((d) => userDeptIds.push(d._id));

      const deptConditions = [
        { assignedTo: req.user._id },
        { creator: req.user._id },
      ];
      if (userDeptIds.length > 0) {
        deptConditions.push(
          { departments: { $in: userDeptIds } },
          { department: { $in: userDeptIds } }
        );
      }
      conditions.push({ $or: deptConditions });
    }

    const filter = conditions.length > 0 ? { $and: conditions } : {};

    let contracts = await Contract.find(filter)
      .populate('projects', 'name code color status')
      .populate('project', 'name code color status')
      .populate('departments', 'name code color head')
      .populate('department', 'name code color head')
      .populate('assignedTo', 'name email avatar role department')
      .populate('creator', 'name email avatar')
      .sort(sortBy);

    // Nếu vai trò không được xem giá trị tiền ($), ẩn giá trị thực tế
    if (req.permissionScope?.canViewValue === false) {
      contracts = contracts.map((c) => {
        const plain = c.toObject();
        plain.value = 0;
        plain.valueMasked = true;
        plain.paidAmount = 0;
        return plain;
      });
    }

    res.json({
      success: true,
      count: contracts.length,
      contracts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy thống kê tổng quan (KPIs & Doanh thu theo giai đoạn cho Kanban)
// @route   GET /api/contracts/summary
// @access  Private
export const getContractSummary = async (req, res, next) => {
  try {
    const currentWs = req.query.workspaceId || req.user.currentWorkspace;
    const matchQuery = {};

    if (currentWs) {
      matchQuery.workspace = new mongoose.Types.ObjectId(currentWs);
    }

    const contracts = await Contract.find(matchQuery);

    const now = new Date();
    const next30Days = new Date();
    next30Days.setDate(next30Days.getDate() + 30);

    let totalValue = 0;
    let totalPaid = 0;
    let expiringSoonCount = 0;

    const stagesConfig = [
      'draft',
      'pending_sign',
      'active',
      'settlement',
      'completed',
      'cancelled',
    ];

    const stageSummary = {};
    stagesConfig.forEach((s) => {
      stageSummary[s] = { count: 0, totalValue: 0, totalPaid: 0 };
    });

    contracts.forEach((c) => {
      const val = Number(c.totalValue) || 0;
      const paid = Number(c.paidAmount) || 0;

      totalValue += val;
      totalPaid += paid;

      if (stageSummary[c.stage]) {
        stageSummary[c.stage].count += 1;
        stageSummary[c.stage].totalValue += val;
        stageSummary[c.stage].totalPaid += paid;
      }

      if (
        c.endDate &&
        new Date(c.endDate) >= now &&
        new Date(c.endDate) <= next30Days &&
        !['completed', 'cancelled'].includes(c.stage)
      ) {
        expiringSoonCount += 1;
      }
    });

    const totalRemaining = Math.max(0, totalValue - totalPaid);
    const canViewVal = req.permissionScope?.canViewValue !== false;

    res.json({
      success: true,
      summary: {
        totalContracts: contracts.length,
        totalValue: canViewVal ? totalValue : 0,
        totalPaid: canViewVal ? totalPaid : 0,
        totalRemaining: canViewVal ? totalRemaining : 0,
        valueMasked: !canViewVal,
        expiringSoonCount,
        stages: canViewVal
          ? stageSummary
          : Object.fromEntries(
              Object.entries(stageSummary).map(([k, v]) => [
                k,
                { ...v, totalValue: 0, totalPaid: 0 },
              ])
            ),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy chi tiết một Hợp đồng
// @route   GET /api/contracts/:id
// @access  Private
export const getContractById = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('projects', 'name code color status manager supervisor startDate endDate budget')
      .populate('project', 'name code color status manager supervisor startDate endDate budget')
      .populate('departments', 'name code color head')
      .populate('department', 'name code color head')
      .populate('assignedTo', 'name email avatar role department phone')
      .populate('creator', 'name email avatar');

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hợp đồng',
      });
    }

    res.json({
      success: true,
      contract,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Tạo Hợp đồng mới
// @route   POST /api/contracts
// @access  Private
export const createContract = async (req, res, next) => {
  try {
    const {
      workspace,
      code,
      title,
      contractType,
      stage,
      totalValue,
      taxPercent,
      partner,
      paymentMilestones,
      signDate,
      startDate,
      endDate,
      isAutoRenew,
      projects,
      project,
      departments,
      department,
      assignedTo,
      attachments,
      description,
      notes,
    } = req.body;

    const targetWs = workspace || req.user.currentWorkspace;
    if (!targetWs) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn Không gian làm việc trước khi tạo hợp đồng',
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên hợp đồng',
      });
    }

    if (!partner || !partner.name || !partner.name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đối tác / khách hàng',
      });
    }

    // Tự sinh mã hợp đồng nếu không nhập
    let contractCode = code ? code.trim().toUpperCase() : '';
    if (!contractCode) {
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const rand = Math.floor(100 + Math.random() * 900);
      contractCode = `HD-${year}/${month}-${rand}`;
    }

    // Tính toán số tiền đã thanh toán từ các đợt trả
    let computedPaid = 0;
    if (Array.isArray(paymentMilestones)) {
      computedPaid = paymentMilestones
        .filter((m) => m.status === 'paid')
        .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    }

    // Chuẩn hóa mảng dự án và phòng ban
    let projList = [];
    if (Array.isArray(projects)) {
      projList = projects.filter(Boolean);
    } else if (Array.isArray(project)) {
      projList = project.filter(Boolean);
    } else if (project) {
      projList = [project];
    }

    let deptList = [];
    if (Array.isArray(departments)) {
      deptList = departments.filter(Boolean);
    } else if (Array.isArray(department)) {
      deptList = department.filter(Boolean);
    } else if (department) {
      deptList = [department];
    }

    const newContract = await Contract.create({
      workspace: targetWs,
      code: contractCode,
      title: title.trim(),
      contractType: contractType ? contractType.trim() : 'Hợp đồng dịch vụ',
      stage: stage || 'draft',
      totalValue: Number(totalValue) || 0,
      taxPercent: Number(taxPercent) || 0,
      paidAmount: computedPaid,
      partner: {
        name: partner.name.trim(),
        taxCode: partner.taxCode ? partner.taxCode.trim() : '',
        representative: partner.representative ? partner.representative.trim() : '',
        role: partner.role ? partner.role.trim() : '',
        phone: partner.phone ? partner.phone.trim() : '',
        email: partner.email ? partner.email.trim() : '',
        address: partner.address ? partner.address.trim() : '',
        bankAccount: partner.bankAccount ? partner.bankAccount.trim() : '',
        bankName: partner.bankName ? partner.bankName.trim() : '',
      },
      paymentMilestones: Array.isArray(paymentMilestones) ? paymentMilestones : [],
      signDate: signDate || null,
      startDate: startDate || null,
      endDate: endDate || null,
      isAutoRenew: Boolean(isAutoRenew),
      projects: projList,
      project: projList[0] || null,
      departments: deptList,
      department: deptList[0] || null,
      assignedTo: assignedTo || null,
      creator: req.user._id,
      attachments: Array.isArray(attachments) ? attachments : [],
      description: description ? description.trim() : '',
      notes: notes ? notes.trim() : '',
    });

    const populated = await Contract.findById(newContract._id)
      .populate('projects', 'name code color status')
      .populate('project', 'name code color status')
      .populate('departments', 'name code color')
      .populate('department', 'name code color')
      .populate('assignedTo', 'name email avatar role department')
      .populate('creator', 'name email avatar');

    emitContractEvent('contract:created', populated, targetWs);

    res.status(201).json({
      success: true,
      message: 'Tạo hợp đồng thành công',
      contract: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cập nhật Hợp đồng
// @route   PUT /api/contracts/:id
// @access  Private
export const updateContract = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hợp đồng',
      });
    }

    const {
      code,
      title,
      contractType,
      stage,
      totalValue,
      taxPercent,
      partner,
      paymentMilestones,
      signDate,
      startDate,
      endDate,
      isAutoRenew,
      projects,
      project,
      departments,
      department,
      assignedTo,
      attachments,
      description,
      notes,
    } = req.body;

    if (code) contract.code = code.trim().toUpperCase();
    if (title) contract.title = title.trim();
    if (contractType !== undefined) contract.contractType = contractType.trim();
    if (stage) contract.stage = stage;
    if (totalValue !== undefined) contract.totalValue = Number(totalValue) || 0;
    if (taxPercent !== undefined) contract.taxPercent = Number(taxPercent) || 0;

    if (partner) {
      contract.partner = {
        ...contract.partner.toObject(),
        ...partner,
      };
    }

    if (Array.isArray(paymentMilestones)) {
      contract.paymentMilestones = paymentMilestones;
      contract.paidAmount = paymentMilestones
        .filter((m) => m.status === 'paid')
        .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    }

    if (signDate !== undefined) contract.signDate = signDate || null;
    if (startDate !== undefined) contract.startDate = startDate || null;
    if (endDate !== undefined) contract.endDate = endDate || null;
    if (isAutoRenew !== undefined) contract.isAutoRenew = Boolean(isAutoRenew);

    if (projects !== undefined || project !== undefined) {
      let projList = [];
      if (Array.isArray(projects)) {
        projList = projects.filter(Boolean);
      } else if (Array.isArray(project)) {
        projList = project.filter(Boolean);
      } else if (project) {
        projList = [project];
      }
      contract.projects = projList;
      contract.project = projList[0] || null;
    }

    if (departments !== undefined || department !== undefined) {
      let deptList = [];
      if (Array.isArray(departments)) {
        deptList = departments.filter(Boolean);
      } else if (Array.isArray(department)) {
        deptList = department.filter(Boolean);
      } else if (department) {
        deptList = [department];
      }
      contract.departments = deptList;
      contract.department = deptList[0] || null;
    }

    if (assignedTo !== undefined) contract.assignedTo = assignedTo || null;
    if (Array.isArray(attachments)) contract.attachments = attachments;

    if (description !== undefined) contract.description = description.trim();
    if (notes !== undefined) contract.notes = notes.trim();

    await contract.save();

    const populated = await Contract.findById(contract._id)
      .populate('projects', 'name code color status')
      .populate('project', 'name code color status')
      .populate('departments', 'name code color')
      .populate('department', 'name code color')
      .populate('assignedTo', 'name email avatar role department')
      .populate('creator', 'name email avatar');

    emitContractEvent('contract:updated', populated, contract.workspace);

    res.json({
      success: true,
      message: 'Cập nhật hợp đồng thành công',
      contract: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cập nhật nhanh giai đoạn Hợp đồng (Kanban drag & drop)
// @route   PATCH /api/contracts/:id/stage
// @access  Private
export const updateContractStage = async (req, res, next) => {
  try {
    const { stage } = req.body;
    const validStages = [
      'draft',
      'pending_sign',
      'active',
      'settlement',
      'completed',
      'cancelled',
    ];

    if (!validStages.includes(stage)) {
      return res.status(400).json({
        success: false,
        message: 'Giai đoạn hợp đồng không hợp lệ',
      });
    }

    const contract = await Contract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hợp đồng',
      });
    }

    const oldStage = contract.stage;
    contract.stage = stage;
    await contract.save();

    const populated = await Contract.findById(contract._id)
      .populate('project', 'name code color status')
      .populate('department', 'name code color')
      .populate('assignedTo', 'name email avatar role department')
      .populate('creator', 'name email avatar');

    emitContractEvent(
      'contract:stageChanged',
      {
        contractId: contract._id,
        oldStage,
        newStage: stage,
        contract: populated,
      },
      contract.workspace
    );

    res.json({
      success: true,
      message: `Đã chuyển sang giai đoạn mới`,
      contract: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cập nhật trạng thái đợt thanh toán (Đánh dấu đã thu / chưa thu)
// @route   PATCH /api/contracts/:id/milestones/:milestoneId
// @access  Private
export const updateMilestoneStatus = async (req, res, next) => {
  try {
    const { id, milestoneId } = req.params;
    const { status, paidDate, note } = req.body;

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hợp đồng',
      });
    }

    const milestone = contract.paymentMilestones.id(milestoneId);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đợt thanh toán',
      });
    }

    if (status) milestone.status = status;
    if (paidDate !== undefined) {
      milestone.paidDate = paidDate ? new Date(paidDate) : null;
    } else if (status === 'paid' && !milestone.paidDate) {
      milestone.paidDate = new Date();
    } else if (status === 'unpaid') {
      milestone.paidDate = null;
    }

    if (note !== undefined) milestone.note = note;

    // Tính lại paidAmount
    contract.paidAmount = contract.paymentMilestones
      .filter((m) => m.status === 'paid')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

    await contract.save();

    const populated = await Contract.findById(contract._id)
      .populate('project', 'name code color status')
      .populate('department', 'name code color')
      .populate('assignedTo', 'name email avatar role department')
      .populate('creator', 'name email avatar');

    emitContractEvent('contract:updated', populated, contract.workspace);

    res.json({
      success: true,
      message: 'Cập nhật tiến độ thanh toán thành công',
      contract: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Xóa Hợp đồng
// @route   DELETE /api/contracts/:id
// @access  Private
export const deleteContract = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hợp đồng',
      });
    }

    const ws = contract.workspace;
    await Contract.findByIdAndDelete(req.params.id);

    emitContractEvent(
      'contract:deleted',
      {
        contractId: req.params.id,
      },
      ws
    );

    res.json({
      success: true,
      message: 'Đã xóa hợp đồng thành công',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Tải file đính kèm hợp đồng (scan, phụ lục...)
// @route   POST /api/contracts/upload
// @access  Private
export const uploadContractAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn tệp để tải lên',
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const ext = req.file.originalname.split('.').pop().toLowerCase();

    let fileType = 'file';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      fileType = 'image';
    } else if (['pdf'].includes(ext)) {
      fileType = 'pdf';
    } else if (['doc', 'docx'].includes(ext)) {
      fileType = 'doc';
    } else if (['xls', 'xlsx'].includes(ext)) {
      fileType = 'sheet';
    }

    res.status(201).json({
      success: true,
      attachment: {
        name: req.file.originalname,
        url: fileUrl,
        fileType,
        size: req.file.size,
        uploadedAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};
