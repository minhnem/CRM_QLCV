import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function backfill() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const msgs = await db.collection('messages').find({
      $or: [{ workspace: { $exists: false } }, { workspace: null }]
    }).toArray();

    console.log(`Tìm thấy ${msgs.length} tin nhắn chưa có workspace. Bắt đầu gắn...`);

    let updatedCount = 0;
    for (const msg of msgs) {
      let wsId = null;
      if (msg.channelType === 'department') {
        const d = await db.collection('departments').findOne({ _id: msg.channelId });
        if (d && d.workspace) wsId = d.workspace;
      } else if (msg.channelType === 'project') {
        const p = await db.collection('projects').findOne({ _id: msg.channelId });
        if (p && p.workspace) wsId = p.workspace;
      }

      if (wsId) {
        await db.collection('messages').updateOne(
          { _id: msg._id },
          { $set: { workspace: wsId } }
        );
        updatedCount++;
      }
    }

    console.log(`✅ Đã cập nhật thành công ${updatedCount}/${msgs.length} tin nhắn về đúng Workspace.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Lỗi backfill:', err);
    process.exit(1);
  }
}

backfill();
