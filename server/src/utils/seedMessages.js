import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Project } from '../models/Project.js';
import { Message } from '../models/Message.js';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm_qlcv';

const seedMessages = async () => {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB. Seeding initial channel discussions...');

    const [admin, manager, member, opsUser] = await Promise.all([
      User.findOne({ email: 'admin@crm.local' }),
      User.findOne({ email: 'manager@crm.local' }),
      User.findOne({ email: 'member@crm.local' }),
      User.findOne({ email: 'ops@crm.local' }),
    ]);

    const [teamWeb, teamMedia, teamOps, rootCompany] = await Promise.all([
      Department.findOne({ name: 'Team Web' }),
      Department.findOne({ name: 'Team Media' }),
      Department.findOne({ name: 'Team vận hành sàn' }),
      Department.findOne({ name: 'Công Ty A' }),
    ]);

    const [projectCRM, projectMKT] = await Promise.all([
      Project.findOne({ code: 'CRM24' }),
      Project.findOne({ code: 'MKT24' }),
    ]);

    // Check if messages already exist
    const count = await Message.countDocuments();
    if (count > 0) {
      console.log(`Already have ${count} messages. Skipping seed.`);
      process.exit(0);
    }

    const sampleMessages = [];

    // Kênh Team Web
    if (teamWeb && member && admin) {
      sampleMessages.push(
        {
          sender: member._id,
          channelType: 'department',
          channelId: teamWeb._id,
          content: 'Chào cả team! Chức năng phân cấp phòng ban và sơ đồ cây Org Chart đã hoàn thành và deploy lên môi trường dev.',
          attachments: [],
        },
        {
          sender: admin._id,
          channelType: 'department',
          channelId: teamWeb._id,
          content: 'Tốt lắm Dev, kiểm tra thêm phần lọc nhân viên theo phòng ban khi tạo tác vụ nhé. Cần đảm bảo dữ liệu chuẩn 100%.',
          attachments: [],
        }
      );
    }

    // Kênh Team Media
    if (teamMedia && manager && admin) {
      sampleMessages.push(
        {
          sender: manager._id,
          channelType: 'department',
          channelId: teamMedia._id,
          content: 'Team Media đang hoàn thiện 10 banner Flash Sale và 2 video short TikTok cho chiến dịch Q4. Dự kiến chiều mai bàn giao cho bên Sàn.',
          attachments: [
            {
              name: 'Q4_Media_Guidelines.pdf',
              url: 'https://example.com/files/Q4_Media_Guidelines.pdf',
              fileType: 'doc',
              size: 2450000,
            },
          ],
        }
      );
    }

    // Kênh Team Vận hành sàn
    if (teamOps && opsUser && admin) {
      sampleMessages.push(
        {
          sender: opsUser._id,
          channelType: 'department',
          channelId: teamOps._id,
          content: 'Team Sàn đã chuẩn bị xong khung giá voucher và đăng ký slot Flash Sale Shopee ngày 11.11. Đang đợi media bàn giao banner để setup.',
          attachments: [],
        }
      );
    }

    // Kênh Kế hoạch toàn công ty
    if (rootCompany && admin) {
      sampleMessages.push(
        {
          sender: admin._id,
          channelType: 'department',
          channelId: rootCompany._id,
          content: 'Thông báo: Toàn bộ các phòng ban lưu ý mọi trao đổi, link duyệt file công việc bắt buộc phải nhắn trong kênh riêng này để lưu vết, cấm nhắn Zalo cá nhân!',
          attachments: [],
        }
      );
    }

    // Kênh Dự án MKT24
    if (projectMKT && manager && opsUser && admin) {
      sampleMessages.push(
        {
          sender: admin._id,
          channelType: 'project',
          channelId: projectMKT._id,
          content: 'Dự án MKT24: Nhắc nhở Team Media và Team Sàn phối hợp chặt chẽ. Hạn chót bàn giao nội dung là 17h00 ngày 19/10.',
          attachments: [],
        },
        {
          sender: manager._id,
          channelType: 'project',
          channelId: projectMKT._id,
          content: 'Team Media đã ghi nhận. Bộ ảnh đã render xong 70%, tối nay sẽ gửi link drive lên đây cho Team Sàn xem trước.',
          attachments: [],
        },
        {
          sender: opsUser._id,
          channelType: 'project',
          channelId: projectMKT._id,
          content: 'OK bên Sàn sẵn sàng nhận file là up ngay lên Shopee Mall!',
          attachments: [],
        }
      );
    }

    // Kênh Dự án CRM24
    if (projectCRM && admin && member) {
      sampleMessages.push(
        {
          sender: admin._id,
          channelType: 'project',
          channelId: projectCRM._id,
          content: 'Dự án CRM24: Đã tích hợp Socket.IO đồng bộ thời gian thực cho bảng Kanban. Các bạn test kỹ nhé.',
          attachments: [],
        },
        {
          sender: member._id,
          channelType: 'project',
          channelId: projectCRM._id,
          content: 'Em đã test kéo thả thẻ công việc giữa các cột, socket bắt sự kiện rất mượt anh nhé!',
          attachments: [],
        }
      );
    }

    await Message.create(sampleMessages);
    console.log(`✅ Successfully seeded ${sampleMessages.length} initial channel messages!`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed messages:', err);
    process.exit(1);
  }
};

seedMessages();
