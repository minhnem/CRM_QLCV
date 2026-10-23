import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Contract } from '../models/Contract.js';
import { Workspace } from '../models/Workspace.js';
import { Project } from '../models/Project.js';
import { Department } from '../models/Department.js';
import { User } from '../models/User.js';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm_qlcv';

const seedContracts = async () => {
  try {
    console.log('Connecting to MongoDB for seeding contracts...');
    await mongoose.connect(uri);

    const workspace = await Workspace.findOne();
    if (!workspace) {
      console.log('⚠️ No workspace found. Please run npm run seed first.');
      process.exit(1);
    }

    const admin = await User.findOne({ role: 'admin' });
    const manager = await User.findOne({ role: 'manager' }) || admin;
    const project = await Project.findOne();
    const department = await Department.findOne({ parent: { $ne: null } }) || await Department.findOne();

    console.log(`Found Workspace: ${workspace.name} (${workspace._id})`);

    // Xóa hợp đồng cũ nếu có
    await Contract.deleteMany({ workspace: workspace._id });

    const now = new Date();

    const sampleContracts = [
      {
        workspace: workspace._id,
        code: 'HD-2026/04-001',
        title: 'Hợp đồng Cung cấp giải pháp phần mềm CRM & Quản lý công việc',
        contractType: 'Hợp đồng Bán / Cung cấp dịch vụ',
        stage: 'active',
        totalValue: 250000000,
        taxPercent: 8,
        paidAmount: 100000000,
        partner: {
          name: 'Công ty Cổ phần Công nghệ TrueBrand',
          taxCode: '0108998877',
          representative: 'Ông Hoàng Anh Tuấn',
          role: 'Tổng Giám Đốc',
          phone: '0908889999',
          email: 'contact@truebrand.vn',
          address: 'Tầng 12, Tòa nhà Landmark 81, Bình Thạnh, TP.HCM',
          bankAccount: '190388889999',
          bankName: 'Techcombank Chi nhánh Sài Gòn',
        },
        paymentMilestones: [
          {
            name: 'Đợt 1 - Tạm ứng 40% khi ký HĐ',
            amount: 100000000,
            dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            paidDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
            status: 'paid',
            note: 'Đã nhận chuyển khoản qua Techcombank',
          },
          {
            name: 'Đợt 2 - Nghiệm thu Giai đoạn 1 (40%)',
            amount: 100000000,
            dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
            status: 'unpaid',
            note: 'Sau khi hoàn thành tích hợp Socket.IO và Kanban',
          },
          {
            name: 'Đợt 3 - Quyết toán & Bàn giao (20%)',
            amount: 50000000,
            dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            status: 'unpaid',
            note: 'Khi kết thúc giai đoạn đào tạo người dùng',
          },
        ],
        signDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000),
        isAutoRenew: true,
        project: project ? project._id : null,
        department: department ? department._id : null,
        assignedTo: manager ? manager._id : admin._id,
        creator: admin._id,
        description: 'Triển khai hệ thống CRM quản lý công việc và đường ống Deals theo chuẩn Bitrix24.',
        notes: 'Khách hàng yêu cầu hỗ trợ kỹ thuật 24/7 trong 3 tháng đầu tiên sau khi bàn giao.',
      },
      {
        workspace: workspace._id,
        code: 'HD-2026/04-002',
        title: 'Hợp đồng Thuê máy chủ Cloud & Hạ tầng Kubernetes',
        contractType: 'Hợp đồng Mua / Thuê ngoài từ nhà cung cấp',
        stage: 'active',
        totalValue: 85000000,
        taxPercent: 10,
        paidAmount: 85000000,
        partner: {
          name: 'Tập đoàn Viễn thông & Hạ tầng Viettel IDC',
          taxCode: '0102345678',
          representative: 'Bà Lê Thị Thu Hà',
          role: 'Giám đốc Kinh doanh Khối Doanh nghiệp',
          phone: '0988776655',
          email: 'cloud@viettelidc.com.vn',
          address: 'Số 1 Giang Văn Minh, Ba Đình, Hà Nội',
          bankAccount: '110022334455',
          bankName: 'MBBank Chi nhánh Hà Nội',
        },
        paymentMilestones: [
          {
            name: 'Thanh toán 100% trọn gói năm',
            amount: 85000000,
            dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            paidDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            status: 'paid',
            note: 'Đã thanh toán ủy nhiệm chi',
          },
        ],
        signDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 355 * 24 * 60 * 60 * 1000),
        isAutoRenew: true,
        project: project ? project._id : null,
        department: department ? department._id : null,
        assignedTo: admin._id,
        creator: admin._id,
        description: 'Cung cấp hạ tầng Cloud Server 32 Core, 64GB RAM, SSD NVMe 1TB.',
      },
      {
        workspace: workspace._id,
        code: 'HD-2026/04-003',
        title: 'Hợp đồng Hợp tác truyền thông & Xây dựng thương hiệu số',
        contractType: 'Hợp đồng Hợp tác kinh doanh',
        stage: 'pending_sign',
        totalValue: 420000000,
        taxPercent: 8,
        paidAmount: 0,
        partner: {
          name: 'Công ty TNHH Truyền thông Quốc tế Sao Mai',
          taxCode: '0314567890',
          representative: 'Ông Đặng Quốc Huy',
          role: 'Giám đốc Điều hành',
          phone: '0933445566',
          email: 'partner@saomaimedia.vn',
          address: '25 Lý Tự Trọng, Bến Nghé, Quận 1, TP.HCM',
          bankAccount: '0071001234567',
          bankName: 'Vietcombank Chi nhánh TP.HCM',
        },
        paymentMilestones: [
          {
            name: 'Đợt 1 - Cọc 30% khi ký kết',
            amount: 126000000,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: 'unpaid',
          },
          {
            name: 'Đợt 2 - Bàn giao chiến dịch đợt 1 (40%)',
            amount: 168000000,
            dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
            status: 'unpaid',
          },
          {
            name: 'Đợt 3 - Nghiệm thu tổng thể (30%)',
            amount: 126000000,
            dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            status: 'unpaid',
          },
        ],
        signDate: new Date(),
        startDate: new Date(),
        endDate: new Date(Date.now() + 95 * 24 * 60 * 60 * 1000),
        isAutoRenew: false,
        project: project ? project._id : null,
        department: department ? department._id : null,
        assignedTo: manager ? manager._id : admin._id,
        creator: admin._id,
        description: 'Sản xuất video clip giới thiệu sản phẩm và quảng bá đa kênh TikTok/Facebook.',
      },
      {
        workspace: workspace._id,
        code: 'HD-2026/04-004',
        title: 'Hợp đồng Thiết kế Website thương mại điện tử & App Mobile',
        contractType: 'Hợp đồng Dịch vụ / Phần mềm',
        stage: 'settlement',
        totalValue: 380000000,
        taxPercent: 8,
        paidAmount: 266000000,
        partner: {
          name: 'Chuỗi Bán lẻ Thời trang An Phước Group',
          taxCode: '0300123456',
          representative: 'Bà Trần Ngọc Lan',
          role: 'Phó Tổng Giám Đốc',
          phone: '0903332211',
          email: 'digital@anphuoc.com.vn',
          address: '100 Hai Bà Trưng, Phường Đa Kao, Quận 1, TP.HCM',
          bankAccount: '0181003456789',
          bankName: 'Vietcombank Chi nhánh Tân Định',
        },
        paymentMilestones: [
          {
            name: 'Đợt 1 - Tạm ứng ký hợp đồng (40%)',
            amount: 152000000,
            dueDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
            paidDate: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000),
            status: 'paid',
          },
          {
            name: 'Đợt 2 - Bàn giao bản Beta & UAT (30%)',
            amount: 114000000,
            dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            paidDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
            status: 'paid',
          },
          {
            name: 'Đợt 3 - Quyết toán & Bàn giao source code (30%)',
            amount: 114000000,
            dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            status: 'unpaid',
            note: 'Đang chờ ký biên bản nghiệm thu sản phẩm',
          },
        ],
        signDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        startDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Sắp hết hạn trong 15 ngày!
        isAutoRenew: false,
        project: project ? project._id : null,
        department: department ? department._id : null,
        assignedTo: manager ? manager._id : admin._id,
        creator: admin._id,
        description: 'Xây dựng website e-commerce chuẩn SEO và ứng dụng Flutter đa nền tảng.',
      },
      {
        workspace: workspace._id,
        code: 'HD-2026/03-010',
        title: 'Hợp đồng Cung cấp dịch vụ Bảo trì & Vận hành sàn TMĐT 2025-2026',
        contractType: 'Hợp đồng Dịch vụ / Bảo trì (SLA)',
        stage: 'completed',
        totalValue: 120000000,
        taxPercent: 8,
        paidAmount: 120000000,
        partner: {
          name: 'Công ty Cổ phần Thực phẩm Sạch GreenFarm',
          taxCode: '0109988112',
          representative: 'Ông Nguyễn Trọng Nghĩa',
          role: 'Giám đốc',
          phone: '0977889900',
          email: 'support@greenfarm.vn',
          address: 'Khu Công nghệ cao Láng Hòa Lạc, Thạch Thất, Hà Nội',
          bankAccount: '12345678901234',
          bankName: 'BIDV Chi nhánh Tây Hà Nội',
        },
        paymentMilestones: [
          {
            name: 'Đợt 1 - Kỳ 1 (50%)',
            amount: 60000000,
            dueDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            paidDate: new Date(Date.now() - 88 * 24 * 60 * 60 * 1000),
            status: 'paid',
          },
          {
            name: 'Đợt 2 - Quyết toán kết thúc hợp đồng (50%)',
            amount: 60000000,
            dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            paidDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
            status: 'paid',
          },
        ],
        signDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        startDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        isAutoRenew: false,
        project: project ? project._id : null,
        department: department ? department._id : null,
        assignedTo: admin._id,
        creator: admin._id,
        description: 'Bảo trì hệ thống máy chủ, fix lỗi và cập nhật bản vá bảo mật định kỳ.',
      },
      {
        workspace: workspace._id,
        code: 'HD-2026/04-005',
        title: 'Hợp đồng Triển khai hệ thống ERP nội bộ & Quản trị kho',
        contractType: 'Hợp đồng Nguyên tắc & Triển khai',
        stage: 'draft',
        totalValue: 650000000,
        taxPercent: 10,
        paidAmount: 0,
        partner: {
          name: 'Công ty Cổ phần Xây dựng & Vật liệu Nam Long',
          taxCode: '0308899123',
          representative: 'Ông Vũ Đình Trọng',
          role: 'Tổng Giám Đốc',
          phone: '0918882233',
          email: 'erp@namlongbuild.vn',
          address: 'Tòa nhà Nam Long, Số 6 Nguyễn Khắc Viện, Tân Phú, Q.7, TP.HCM',
          bankAccount: '060012345678',
          bankName: 'Sacombank Chi nhánh Chợ Lớn',
        },
        paymentMilestones: [
          {
            name: 'Đợt 1 - Ký hợp đồng tạm ứng (30%)',
            amount: 195000000,
            dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            status: 'unpaid',
          },
          {
            name: 'Đợt 2 - Triển khai phân hệ Kho & Kế toán (40%)',
            amount: 260000000,
            dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            status: 'unpaid',
          },
          {
            name: 'Đợt 3 - Go-live & Nghiệm thu tổng thể (30%)',
            amount: 195000000,
            dueDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
            status: 'unpaid',
          },
        ],
        signDate: null,
        startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 130 * 24 * 60 * 60 * 1000),
        isAutoRenew: false,
        project: project ? project._id : null,
        department: department ? department._id : null,
        assignedTo: manager ? manager._id : admin._id,
        creator: admin._id,
        description: 'Tư vấn và chuyển đổi số quy trình quản lý chuỗi cung ứng và kho bãi tập trung.',
      },
    ];

    await Contract.insertMany(sampleContracts);

    console.log(`🎉 Created ${sampleContracts.length} sample contracts successfully!`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding contracts failed:', error);
    process.exit(1);
  }
};

seedContracts();
