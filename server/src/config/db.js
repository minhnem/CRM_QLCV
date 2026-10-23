import mongoose from 'mongoose';
import dns from 'dns';

// Fix DNS SRV lookup timeout on some Vietnamese ISPs (Viettel/VNPT/FPT)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // ignore if restricted
}

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm_qlcv';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.warn('⚠️ Server will continue running, but DB queries will fail until MongoDB is accessible.');
    console.warn('💡 Tip: Make sure MongoDB is running or update MONGODB_URI in server/.env');
  }
};
