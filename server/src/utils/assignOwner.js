import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const assign = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const user = await db.collection('users').findOne({ email: 'namdm2003@gmail.com' });
    if (!user) {
      console.error('❌ Không tìm thấy user namdm2003@gmail.com');
      process.exit(1);
    }

    const ws = await db.collection('workspaces').findOne({ code: 'WS-TRUE' });
    if (!ws) {
      console.error('❌ Không tìm thấy workspace WS-TRUE');
      process.exit(1);
    }

    // 1. Cập nhật Workspace
    let members = (ws.members || []).filter(
      (m) => m.user.toString() !== user._id.toString()
    );
    members.unshift({
      user: user._id,
      role: 'owner',
      joinedAt: new Date(),
    });

    await db.collection('workspaces').updateOne(
      { _id: ws._id },
      {
        $set: {
          owner: user._id,
          members: members,
        },
      }
    );

    // 2. Tìm phòng ban cấp cao nhất (Root Company)
    const rootDept = await db.collection('departments').findOne({ parent: null });

    // 3. Cập nhật User
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          role: 'admin',
          currentWorkspace: ws._id,
          department: 'Ban Giám Đốc',
          departmentId: rootDept ? rootDept._id : null,
        },
      }
    );

    // 4. Thêm user vào tất cả phòng ban và gán làm Trưởng ban giám đốc
    await db.collection('departments').updateMany(
      {},
      {
        $addToSet: { members: user._id },
      }
    );

    if (rootDept) {
      await db.collection('departments').updateOne(
        { _id: rootDept._id },
        { $set: { head: user._id } }
      );
    }

    // 5. Thêm user vào tất cả dự án
    await db.collection('projects').updateMany(
      {},
      {
        $addToSet: { members: user._id },
      }
    );

    console.log('🎉 THÀNH CÔNG RỰC RỠ:');
    console.log(`- Tài khoản: ${user.name} (${user.email})`);
    console.log(`- Vai trò: OWNER & ADMIN toàn quyền`);
    console.log(`- Không gian trực thuộc: ${ws.name} (${ws.code})`);
    console.log('- Đã gia nhập toàn bộ phòng ban, dự án và ban giám đốc.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Lỗi:', error);
    process.exit(1);
  }
};

assign();
