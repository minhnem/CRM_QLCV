import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Workspace } from '../models/Workspace.js';
import { Department } from '../models/Department.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { ActivityLog } from '../models/ActivityLog.js';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm_qlcv';

const seed = async () => {
  try {
    console.log('Connecting to MongoDB for seeding...');
    await mongoose.connect(uri);
    console.log('Connected! Clearing existing data...');

    await Promise.all([
      Workspace.deleteMany(),
      User.deleteMany(),
      Department.deleteMany(),
      Project.deleteMany(),
      Task.deleteMany(),
      ActivityLog.deleteMany(),
    ]);

    console.log('Creating initial users...');
    const admin = await User.create({
      name: 'Nguyen Van Admin',
      email: 'admin@crm.local',
      password: 'admin123',
      role: 'admin',
      department: 'Ban Giám Đốc',
      phone: '0901234567',
    });

    const manager = await User.create({
      name: 'Tran Thi Manager',
      email: 'manager@crm.local',
      password: 'manager123',
      role: 'manager',
      department: 'Team Media',
      phone: '0912345678',
    });

    const member = await User.create({
      name: 'Le Van Dev',
      email: 'member@crm.local',
      password: 'member123',
      role: 'member',
      department: 'Team Web',
      phone: '0923456789',
    });

    const opsUser = await User.create({
      name: 'Pham Van Ops',
      email: 'ops@crm.local',
      password: 'ops123',
      role: 'member',
      department: 'Team vận hành sàn',
      phone: '0934567890',
    });

    console.log('Creating initial Workspace (Bitrix24 Vietnam Corp)...');
    const defaultWorkspace = await Workspace.create({
      name: 'Bitrix24 Vietnam Corp',
      code: 'WS-TRUE',
      description: 'Không gian làm việc trung tâm Tập đoàn Bitrix24 Vietnam',
      owner: admin._id,
      members: [
        { user: admin._id, role: 'owner', joinedAt: new Date() },
        { user: manager._id, role: 'admin', joinedAt: new Date() },
        { user: member._id, role: 'member', joinedAt: new Date() },
        { user: opsUser._id, role: 'member', joinedAt: new Date() },
      ],
      settings: {
        autoApproveJoinCode: false,
        allowMemberInvite: true,
      },
    });

    // Cập nhật currentWorkspace cho toàn bộ users
    await Promise.all([
      User.findByIdAndUpdate(admin._id, { currentWorkspace: defaultWorkspace._id }),
      User.findByIdAndUpdate(manager._id, { currentWorkspace: defaultWorkspace._id }),
      User.findByIdAndUpdate(member._id, { currentWorkspace: defaultWorkspace._id }),
      User.findByIdAndUpdate(opsUser._id, { currentWorkspace: defaultWorkspace._id }),
    ]);

    console.log('Creating hierarchical departments (Company Structure)...');
    // Root Department: "Công Ty A"
    const rootCompany = await Department.create({
      name: 'Công Ty A',
      code: 'CTA',
      description: 'Tổng công ty - Trụ sở chính',
      parent: null,
      head: admin._id,
      members: [admin._id, manager._id, member._id, opsUser._id],
      color: '#2563eb',
      order: 0,
    });

    // Child 1: "Team Web"
    const teamWeb = await Department.create({
      name: 'Team Web',
      code: 'WEB',
      description: 'Phát triển Frontend, Backend và Sản phẩm Web',
      parent: rootCompany._id,
      head: member._id,
      members: [member._id, admin._id],
      color: '#3b82f6',
      order: 1,
    });

    // Child 2: "Team Media"
    const teamMedia = await Department.create({
      name: 'Team Media',
      code: 'MEDIA',
      description: 'Sáng tạo nội dung, hình ảnh, video và quảng cáo số',
      parent: rootCompany._id,
      head: manager._id,
      members: [manager._id, member._id],
      color: '#8b5cf6',
      order: 2,
    });

    // Child 3: "Team vận hành sàn"
    const teamOps = await Department.create({
      name: 'Team vận hành sàn',
      code: 'OPS',
      description: 'Quản lý gian hàng sàn thương mại điện tử, xử lý đơn hàng và CSKH',
      parent: rootCompany._id,
      head: opsUser._id,
      members: [opsUser._id],
      color: '#10b981',
      order: 3,
    });

    // Link users to their departments
    await User.findByIdAndUpdate(admin._id, { departmentId: rootCompany._id, department: 'Công Ty A' });
    await User.findByIdAndUpdate(manager._id, { departmentId: teamMedia._id, department: 'Team Media' });
    await User.findByIdAndUpdate(member._id, { departmentId: teamWeb._id, department: 'Team Web' });
    await User.findByIdAndUpdate(opsUser._id, { departmentId: teamOps._id, department: 'Team vận hành sàn' });

    console.log('Creating initial projects with departments...');
    const project1 = await Project.create({
      name: 'Bitrix24 CRM Core & Workflow',
      code: 'CRM24',
      description: 'Hệ thống Quản lý Khách hàng, Dự án và Phân chia công việc theo chuẩn MERN Stack.',
      status: 'active',
      color: '#3b82f6',
      owner: manager._id,
      members: [admin._id, manager._id, member._id],
      departments: [rootCompany._id, teamWeb._id],
      budget: 150000000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    });

    const project2 = await Project.create({
      name: 'Chiến Dịch Truyền Thông & Sàn TMĐT Q4',
      code: 'MKT24',
      description: 'Triển khai chiến dịch truyền thông đa kênh kết hợp vận hành sàn Shopee, TikTok Shop.',
      status: 'active',
      color: '#10b981',
      owner: admin._id,
      members: [admin._id, manager._id, opsUser._id],
      departments: [teamMedia._id, teamOps._id],
      budget: 95000000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    });

    console.log('Creating initial tasks assigned to departments and members...');
    await Task.create([
      {
        title: 'Thiết kế sơ đồ cơ cấu tổ chức & phòng ban (Org Chart)',
        description: 'Tạo cây phân cấp cha con, gán trưởng phòng và hiển thị dạng thẻ Bitrix24.',
        project: project1._id,
        department: teamWeb._id,
        assignee: member._id,
        creator: manager._id,
        status: 'done',
        priority: 'urgent',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        estimatedHours: 8,
        actualHours: 6,
        tags: ['OrgChart', 'Department', 'Frontend'],
        order: 0,
      },
      {
        title: 'Phân quyền gán việc theo phòng ban',
        description: 'Cho phép trưởng phòng quản lý và theo dõi toàn bộ tác vụ của nhân viên trong phòng.',
        project: project1._id,
        department: teamWeb._id,
        assignee: member._id,
        creator: admin._id,
        status: 'in_progress',
        priority: 'high',
        dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        estimatedHours: 10,
        actualHours: 3,
        tags: ['Workflow', 'RBAC'],
        order: 0,
      },
      {
        title: 'Sản xuất bộ banner & video ra mắt sản phẩm',
        description: 'Thiết kế 10 banner và 2 short video cho chiến dịch truyền thông.',
        project: project2._id,
        department: teamMedia._id,
        assignee: manager._id,
        creator: admin._id,
        status: 'in_progress',
        priority: 'urgent',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        estimatedHours: 16,
        actualHours: 8,
        tags: ['Media', 'Design'],
        order: 1,
      },
      {
        title: 'Tối ưu gian hàng TikTok Shop & Shopee Mall',
        description: 'Cập nhật hình ảnh, SEO tiêu đề sản phẩm và thiết lập flash sale cuối tuần.',
        project: project2._id,
        department: teamOps._id,
        assignee: opsUser._id,
        creator: admin._id,
        status: 'todo',
        priority: 'medium',
        dueDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        estimatedHours: 12,
        actualHours: 0,
        tags: ['Ecommerce', 'Operations'],
        order: 0,
      },
      {
        title: 'Họp giao ban tuần các trưởng phòng',
        description: 'Đánh giá KPI và phân bổ ngân sách dự án giữa Team Web, Media và Vận Hành Sàn.',
        project: project1._id,
        department: rootCompany._id,
        assignee: admin._id,
        creator: admin._id,
        status: 'review',
        priority: 'high',
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        estimatedHours: 2,
        actualHours: 2,
        tags: ['Meeting', 'Management'],
        order: 0,
      },
    ]);

    console.log('🎉 Database seeded successfully with Company Structure!');
    console.log('--------------------------------------------------');
    console.log('Cơ cấu phòng ban đã tạo:');
    console.log('🏢 [Công Ty A] (Root - Trưởng phòng: Nguyen Van Admin)');
    console.log('  ├── 💻 [Team Web] (Trưởng phòng: Le Van Dev)');
    console.log('  ├── 🎬 [Team Media] (Trưởng phòng: Tran Thi Manager)');
    console.log('  └── 📦 [Team vận hành sàn] (Trưởng phòng: Pham Van Ops)');
    console.log('--------------------------------------------------');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seed();
