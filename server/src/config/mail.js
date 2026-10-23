import nodemailer from 'nodemailer';

// Khởi tạo transporter với Gmail SMTP hoặc custom SMTP
const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn(
      '⚠️ [Mail Warning] SMTP_USER hoặc SMTP_PASS chưa được cấu hình trong server/.env. Mail sẽ được ghi log ra console.'
    );
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: {
      user,
      pass,
    },
  });
};

/**
 * Gửi email chung
 */
export const sendMail = async ({ to, subject, html, text }) => {
  const transporter = createTransporter();
  const from = process.env.EMAIL_FROM || `"CRM Quản Lý Công Việc" <${process.env.SMTP_USER || 'no-reply@crm.local'}>`;

  if (!transporter) {
    console.log('----------------------------------------------------');
    console.log(`📧 [MOCK EMAIL SENT]`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content:\n${text || html}`);
    console.log('----------------------------------------------------');
    return { mock: true, success: true };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: text || '',
      html: html || '',
    });
    console.log(`✅ Email đã gửi thành công tới ${to} (MessageID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Lỗi gửi email tới ${to}:`, error.message);
    throw error;
  }
};

/**
 * Template & Gửi Email Khôi phục Mật khẩu
 */
export const sendPasswordResetEmail = async (email, resetUrl, userName = 'Bạn') => {
  const subject = '🔐 [CRM] Yêu cầu đặt lại mật khẩu tài khoản';
  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 32px 28px; line-height: 1.6; font-size: 15px; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; margin: 20px 0; text-align: center; }
    .footer { padding: 20px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
    .alert { background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 12px; font-size: 13px; color: #991b1b; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>CRM & Quản Lý Công Việc</h1>
      <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">Bảo mật & Quản lý tài khoản</p>
    </div>
    <div class="content">
      <p>Xin chào <strong>${userName}</strong>,</p>
      <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>${email}</strong> trên hệ thống.</p>
      <p>Để tạo mật khẩu mới, vui lòng nhấn vào nút bên dưới (liên kết có hiệu lực trong vòng <strong>30 phút</strong>):</p>
      <div style="text-align: center;">
        <a href="${resetUrl}" class="btn" target="_blank">Đặt lại mật khẩu</a>
      </div>
      <p style="font-size: 13px; color: #64748b; word-break: break-all;">
        Hoặc copy đường dẫn sau dán vào trình duyệt:<br>
        <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
      </p>
      <div class="alert">
        ⚠️ Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email. Mật khẩu hiện tại của bạn vẫn an toàn tuyệt đối.
      </div>
    </div>
    <div class="footer">
      © 2026 CRM Quản Lý Công Việc. MERN Stack Real-time Platform.
    </div>
  </div>
</body>
</html>
  `;

  return sendMail({
    to: email,
    subject,
    html,
    text: `Xin chào ${userName},\n\nBạn vừa yêu cầu đặt lại mật khẩu. Vui lòng truy cập liên kết sau (hết hạn trong 30 phút):\n${resetUrl}\n\nNếu bạn không yêu cầu, vui lòng bỏ qua email này.`,
  });
};

/**
 * Template & Gửi Email Mời tham gia Không gian làm việc (Bitrix24 Style)
 */
export const sendWorkspaceInviteEmail = async ({
  email,
  inviteUrl,
  workspaceName,
  inviterName = 'Quản trị viên',
  code = '',
  role = 'member',
}) => {
  const roleName = role === 'admin' ? 'Quản trị viên (Admin)' : 'Thành viên (Member)';
  const subject = `📬 Lời mời tham gia Không gian làm việc: ${workspaceName}`;

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 36px 28px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 36px 32px; line-height: 1.6; font-size: 15px; color: #334155; }
    .invite-box { background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0; }
    .invite-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .invite-row:last-child { margin-bottom: 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 700; text-decoration: none; padding: 14px 34px; border-radius: 10px; margin: 24px 0; text-align: center; font-size: 16px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); }
    .footer { padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5; }
    .tip { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; font-size: 13px; color: #1e40af; border-radius: 0 8px 8px 0; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Tham Gia Không Gian Làm Việc</h1>
    </div>
    <div class="content">
      <p style="font-size: 16px;">Xin chào <strong>${email}</strong>,</p>
      <p>
        <strong>${inviterName}</strong> vừa mời bạn tham gia vào Không gian làm việc <strong>"${code}"</strong> trên hệ thống <strong>CRM Quản Lý Công Việc</strong>.
      </p>

      <div class="invite-box">
        <div style="margin-bottom: 8px;"><strong>🏢 Không gian:</strong> <span style="color: #1e293b; font-weight: 600;">${workspaceName}</span></div>
        <div style="margin-bottom: 8px;"><strong>👤 Người mời:</strong> <span style="color: #1e293b;">${inviterName}</span></div>
        <div style="margin-bottom: 8px;"><strong>🎯 Vai trò chỉ định:</strong> <span style="color: #2563eb; font-weight: 600;">${roleName}</span></div>
        ${code ? `<div><strong>🔑 Mã Không gian:</strong> <span style="font-family: monospace; font-size: 15px; font-weight: 700; color: #0f172a; background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">${code}</span></div>` : ''}
      </div>

      <p style="text-align: center; margin: 28px 0 10px;">
        <a href="${inviteUrl}" class="btn" target="_blank">Tham gia Không gian làm việc &rarr;</a>
      </p>
      <div style="text-align: center; font-size: 13px; color: #64748b;">
        Liên kết này có hiệu lực trong vòng <strong>7 ngày</strong>.
      </div>

      <div class="tip">
        💡 <strong>Bạn chưa có tài khoản?</strong> Đừng lo lắng! Khi bấm vào liên kết trên, bạn có thể đăng nhập ngay chỉ bằng <strong>1-Click với Google</strong> hoặc tạo mật khẩu nhanh chỉ trong 5 giây mà không cần cấu hình phức tạp.
      </div>

      <p style="font-size: 12px; color: #94a3b8; word-break: break-all; margin-top: 24px;">
        Nếu nút bấm không hoạt động, hãy copy đường dẫn sau và mở trong trình duyệt:<br>
        <a href="${inviteUrl}" style="color: #2563eb;">${inviteUrl}</a>
      </p>
    </div>
    <div class="footer">
      Email này được gửi tự động từ hệ thống CRM & Quản Lý Công Việc Doanh Nghiệp.<br>
      © 2026 CRM Workspace Platform.
    </div>
  </div>
</body>
</html>
  `;

  return sendMail({
    to: email,
    subject,
    html,
    text: `Xin chào ${email},\n\n${inviterName} vừa mời bạn gia nhập Không gian làm việc "${workspaceName}" với vai trò ${roleName}.\n\nVui lòng truy cập liên kết sau để tham gia (hết hạn trong 7 ngày):\n${inviteUrl}\n\nNếu bạn chưa có tài khoản, bạn có thể đăng nhập bằng Google hoặc đăng ký nhanh tại liên kết trên.`,
  });
};

/**
 * Template & Gửi Email thông báo khi được gán Task mới
 */
export const sendTaskAssignedEmail = async ({
  to,
  taskTitle,
  projectName = 'Dự án',
  assignerName = 'Quản trị viên',
  priority = 'medium',
  dueDate = null,
  taskLink = 'http://localhost:5173/tasks',
}) => {
  const priorityLabels = {
    urgent: { text: 'Khẩn cấp', color: '#ef4444', bg: '#fef2f2' },
    high: { text: 'Cao', color: '#f97316', bg: '#fff7ed' },
    medium: { text: 'Trung bình', color: '#3b82f6', bg: '#eff6ff' },
    low: { text: 'Thấp', color: '#10b981', bg: '#f0fdf4' },
  };

  const pInfo = priorityLabels[priority] || priorityLabels.medium;
  const formattedDueDate = dueDate
    ? new Date(dueDate).toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Chưa đặt hạn chót';

  const subject = `📋 [CRM] Bạn vừa được phân công công việc: ${taskTitle}`;

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #1e40af, #2563eb); padding: 32px 28px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 32px 28px; line-height: 1.6; font-size: 15px; color: #334155; }
    .task-box { background: #f8fafc; border-radius: 14px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0; }
    .task-title { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 12px; line-height: 1.4; }
    .info-row { margin-bottom: 8px; font-size: 14px; }
    .info-row:last-child { margin-bottom: 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 700; text-decoration: none; padding: 14px 34px; border-radius: 10px; margin: 24px 0 10px; text-align: center; font-size: 15px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); }
    .footer { padding: 20px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 6px; font-weight: 700; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Phân Công Công Việc Mới</h1>
      <p style="margin: 6px 0 0; opacity: 0.9; font-size: 13px;">Hệ thống CRM & Quản Lý Công Việc</p>
    </div>
    <div class="content">
      <p style="font-size: 15px;">Xin chào,</p>
      <p>
        <strong>${assignerName}</strong> vừa giao một công việc mới cho bạn trên hệ thống.
      </p>

      <div class="task-box">
        <div class="task-title">📌 ${taskTitle}</div>
        <div class="info-row"><strong>📁 Dự án:</strong> <span style="color: #2563eb; font-weight: 600;">${projectName}</span></div>
        <div class="info-row"><strong>👤 Người giao việc:</strong> <span style="color: #1e293b;">${assignerName}</span></div>
        <div class="info-row">
          <strong>⚡ Mức độ ưu tiên:</strong>
          <span class="badge" style="background: ${pInfo.bg}; color: ${pInfo.color}; border: 1px solid ${pInfo.color}30;">
            ${pInfo.text}
          </span>
        </div>
        <div class="info-row"><strong>⏰ Hạn chót (Deadline):</strong> <span style="color: #b91c1c; font-weight: 600;">${formattedDueDate}</span></div>
      </div>

      <div style="text-align: center;">
        <a href="${taskLink}" class="btn" target="_blank">Xem Chi Tiết Công Việc &rarr;</a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 16px;">
        Vui lòng kiểm tra và cập nhật tiến độ công việc trên bảng Kanban hoặc Kênh trao đổi dự án.
      </p>
    </div>
    <div class="footer">
      Email thông báo tự động từ CRM Doanh Nghiệp.<br>
      © 2026 CRM Workspace Platform.
    </div>
  </div>
</body>
</html>
  `;

  return sendMail({
    to,
    subject,
    html,
    text: `Xin chào,\n\n${assignerName} vừa giao công việc mới cho bạn: "${taskTitle}" (Dự án: ${projectName}).\nMức độ ưu tiên: ${pInfo.text}\nHạn chót: ${formattedDueDate}\n\nXem chi tiết tại:\n${taskLink}`,
  });
};

/**
 * Template & Gửi Email thông báo Kết quả duyệt công việc (Yêu cầu chỉnh sửa lại hoặc Phê duyệt đạt)
 */
export const sendReviewFeedbackEmail = async ({
  to,
  recipientName = 'Bạn',
  taskTitle,
  projectName = 'Dự án',
  reviewerName = 'Người duyệt',
  action = 'request_changes', // 'request_changes' | 'approve'
  comment = '',
  deliverableUrl = '',
  taskLink = 'http://localhost:5173/tasks',
}) => {
  const isChangesRequested = action === 'request_changes';
  const subject = isChangesRequested
    ? `⚠️ [CRM] Yêu cầu chỉnh sửa công việc: ${taskTitle}`
    : `🎉 [CRM] Công việc đã được phê duyệt hoàn thành: ${taskTitle}`;

  const headerBg = isChangesRequested
    ? 'linear-gradient(135deg, #e11d48, #be123c)'
    : 'linear-gradient(135deg, #059669, #10b981)';

  const headerTitle = isChangesRequested
    ? 'Yêu Cầu Chỉnh Sửa Công Việc'
    : 'Công Việc Đã Được Phê Duyệt!';

  const headerSubtitle = isChangesRequested
    ? 'Vui lòng kiểm tra phản hồi và hoàn thiện lại sản phẩm'
    : 'Chúc mừng bạn đã hoàn thành xuất sắc công việc';

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
    .header { background: ${headerBg}; padding: 32px 28px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 32px 28px; line-height: 1.6; font-size: 15px; color: #334155; }
    .task-box { background: #f8fafc; border-radius: 14px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0; }
    .task-title { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 12px; line-height: 1.4; }
    .info-row { margin-bottom: 8px; font-size: 14px; }
    .info-row:last-child { margin-bottom: 0; }
    .feedback-box { background: ${isChangesRequested ? '#fff1f2' : '#f0fdf4'}; border-left: 4px solid ${isChangesRequested ? '#e11d48' : '#10b981'}; border-radius: 0 12px 12px 0; padding: 16px 20px; margin: 20px 0; font-size: 14px; color: ${isChangesRequested ? '#9f1239' : '#065f46'}; }
    .btn { display: inline-block; background-color: ${isChangesRequested ? '#e11d48' : '#059669'}; color: #ffffff !important; font-weight: 700; text-decoration: none; padding: 14px 34px; border-radius: 10px; margin: 20px 0 10px; text-align: center; font-size: 15px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
    .footer { padding: 20px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${headerTitle}</h1>
      <p style="margin: 6px 0 0; opacity: 0.95; font-size: 13px;">${headerSubtitle}</p>
    </div>
    <div class="content">
      <p style="font-size: 15px;">Xin chào <strong>${recipientName}</strong>,</p>
      <p>
        <strong>${reviewerName}</strong> vừa đánh giá sản phẩm nghiệm thu cho công việc của bạn trên hệ thống CRM.
      </p>

      <div class="task-box">
        <div class="task-title">📌 ${taskTitle}</div>
        <div class="info-row"><strong>📁 Dự án:</strong> <span style="color: #2563eb; font-weight: 600;">${projectName}</span></div>
        <div class="info-row"><strong>👤 Người kiểm duyệt:</strong> <span style="color: #1e293b; font-weight: 600;">${reviewerName}</span></div>
        <div class="info-row">
          <strong>📊 Trạng thái:</strong>
          <span style="font-weight: 700; color: ${isChangesRequested ? '#e11d48' : '#059669'};">
            ${isChangesRequested ? '⚠️ Cần chỉnh sửa lại (In Progress)' : '✅ Đã hoàn thành (Done)'}
          </span>
        </div>
        ${deliverableUrl ? `<div class="info-row"><strong>🎬 Link sản phẩm:</strong> <a href="${deliverableUrl}" style="color: #2563eb; word-break: break-all;" target="_blank">${deliverableUrl}</a></div>` : ''}
      </div>

      <div class="feedback-box">
        <div style="font-weight: 800; margin-bottom: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
          ${isChangesRequested ? '💬 Chi tiết nội dung cần chỉnh sửa:' : '💬 Nhận xét từ người duyệt:'}
        </div>
        <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${comment || (isChangesRequested ? 'Vui lòng kiểm tra lại sản phẩm và làm theo hướng dẫn' : 'Đạt yêu cầu')}</div>
      </div>

      <div style="text-align: center;">
        <a href="${taskLink}" class="btn" target="_blank">${isChangesRequested ? 'Mở Chi Tiết Để Sửa Lại &rarr;' : 'Xem Chi Tiết Công Việc &rarr;'}</a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 16px;">
        ${isChangesRequested ? 'Sau khi chỉnh sửa xong, bạn hãy cập nhật lại link và chuyển sang Chờ duyệt.' : 'Cảm ơn bạn đã nỗ lực hoàn thành công việc đúng tiến độ và chất lượng.'}
      </p>
    </div>
    <div class="footer">
      Email thông báo tự động từ Hệ Thống CRM Quản Lý Công Việc Doanh Nghiệp.<br>
      © 2026 CRM Workspace Platform.
    </div>
  </div>
</body>
</html>
  `;

  return sendMail({
    to,
    subject,
    html,
    text: `Xin chào ${recipientName},\n\n${reviewerName} vừa đánh giá công việc "${taskTitle}" (Dự án: ${projectName}).\nKết quả: ${isChangesRequested ? 'YÊU CẦU SỬA ĐỔI' : 'ĐÃ PHÊ DUYỆT'}\nNhận xét: ${comment}\n\nXem chi tiết tại:\n${taskLink}`,
  });
};


