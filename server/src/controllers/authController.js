import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/User.js';
import { signToken } from '../config/jwt.js';
import { sendPasswordResetEmail } from '../config/mail.js';

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail }).select('+password');

    if (existingUser) {
      // Nếu tài khoản trước đó tạo qua Google và chưa từng thiết lập mật khẩu
      if (!existingUser.password) {
        existingUser.password = password;
        if (name && name.trim()) existingUser.name = name.trim();
        await existingUser.save();

        const token = signToken({ id: existingUser._id, role: existingUser.role });
        return res.status(200).json({
          success: true,
          message: 'Đã thiết lập mật khẩu thành công cho tài khoản!',
          token,
          user: {
            _id: existingUser._id,
            id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            role: existingUser.role,
            department: existingUser.department,
            avatar: existingUser.avatar,
          },
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Email này đã có tài khoản. Vui lòng chuyển sang tab Đăng nhập.',
      });
    }

    // Role can only be set to admin if specified by existing admin, default to member or requested non-admin role
    const assignedRole = role && ['manager', 'member'].includes(role) ? role : 'member';

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      role: assignedRole,
      department: department || 'Engineering',
    });

    const token = signToken({ id: user._id, role: user.role });

    res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        departmentId: user.departmentId || null,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email và mật khẩu.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác.',
      });
    }

    // Nếu tài khoản được tạo bằng Google và chưa từng thiết lập mật khẩu riêng
    if (!user.password) {
      return res.status(400).json({
        success: false,
        isGoogleAccountWithoutPassword: true,
        message:
          'Tài khoản này được đăng ký thông qua Google và chưa thiết lập mật khẩu riêng. Bạn vui lòng bấm "Đăng nhập với Google" hoặc bấm "Quên mật khẩu" để tạo mật khẩu đăng nhập.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không chính xác.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact your administrator.',
      });
    }

    const token = signToken({ id: user._id, role: user.role });

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        departmentId: user.departmentId || null,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, department, avatar } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (department) user.department = department;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate with Google OAuth2 or Firebase Auth Token
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = async (req, res, next) => {
  try {
    const { credential, idToken, user: clientUser } = req.body;
    const tokenToVerify = idToken || credential;

    if (!tokenToVerify && !clientUser?.email) {
      return res.status(400).json({
        success: false,
        message: 'Google credential hoặc Firebase idToken là bắt buộc.',
      });
    }

    let email = null;
    let name = null;
    let picture = null;
    let googleId = null;

    // 1. Nếu token là JWT (3 phần phân tách bởi dấu chấm)
    if (tokenToVerify && typeof tokenToVerify === 'string' && tokenToVerify.includes('.')) {
      try {
        const parts = tokenToVerify.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));

          // Kiểm tra xem có phải Firebase Token (iss: https://securetoken.google.com/<projectId>)
          if (payload.iss && payload.iss.includes('securetoken.google.com')) {
            // Kiểm tra hạn token
            if (payload.exp && payload.exp * 1000 < Date.now()) {
              return res.status(401).json({
                success: false,
                message: 'Phiên xác thực Google Firebase đã hết hạn. Vui lòng đăng nhập lại.',
              });
            }

            email = payload.email || clientUser?.email;
            name = payload.name || clientUser?.displayName;
            picture = payload.picture || clientUser?.photoURL;
            googleId = payload.sub || payload.user_id || clientUser?.uid;
          } else if (process.env.GOOGLE_CLIENT_ID) {
            // Xác thực với Google OAuth2Client nếu cấu hình GOOGLE_CLIENT_ID
            const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
            const ticket = await client.verifyIdToken({
              idToken: tokenToVerify,
              audience: process.env.GOOGLE_CLIENT_ID,
            });
            const p = ticket.getPayload();
            email = p.email;
            name = p.name;
            picture = p.picture;
            googleId = p.sub;
          }
        }
      } catch (err) {
        console.warn('Lỗi giải mã token, chuyển sang dùng thông tin client:', err.message);
      }
    }

    // 2. Dự phòng thông tin clientUser từ Firebase SDK khi xác thực popup
    if (!email && clientUser?.email) {
      email = clientUser.email;
      name = clientUser.displayName;
      picture = clientUser.photoURL;
      googleId = clientUser.uid;
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản Google không cung cấp email hợp lệ.',
      });
    }

    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Quản trị viên.',
        });
      }

      let modified = false;
      if (!user.googleId && googleId) {
        user.googleId = googleId;
        modified = true;
      }
      if (!user.avatar && picture) {
        user.avatar = picture;
        modified = true;
      }
      if (modified) {
        await user.save();
      }
    } else {
      user = await User.create({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        googleId: googleId || '',
        avatar: picture || '',
        authType: 'google',
        role: 'member',
        department: 'Engineering',
      });
    }

    const token = signToken({ id: user._id, role: user.role });

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        departmentId: user.departmentId || null,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Request password reset email
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp địa chỉ email.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Phản hồi an toàn, tránh lộ danh sách email
      return res.json({
        success: true,
        message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư.',
      });
    }

    // Tạo token ngẫu nhiên 32 bytes (64 hex characters)
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Lưu token đã mã hoá sha256 vào database kèm hạn 30 phút
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 30 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    await sendPasswordResetEmail(user.email, resetUrl, user.name);

    res.json({
      success: true,
      message: 'Liên kết đặt lại mật khẩu đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư đến (hoặc thư mục Spam).',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Mã xác thực không hợp lệ.',
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.',
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn (30 phút). Vui lòng yêu cầu gửi lại email mới.',
      });
    }

    // Cập nhật mật khẩu mới (kích hoạt pre-save hook mã hóa bcrypt)
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // Nếu trước đó là tài khoản chỉ Google, giờ đây có thể đăng nhập bằng mật khẩu
    if (user.authType === 'google') {
      user.authType = 'local';
    }

    await user.save();

    const jwtToken = signToken({ id: user._id, role: user.role });

    res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công! Bạn có thể sử dụng mật khẩu mới ngay bây giờ.',
      token: jwtToken,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Kiểm tra email xem đã liên kết với tài khoản xã hội (Google) hay chưa
// @route   POST /api/auth/check-email
// @access  Public
export const checkEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail }).select('+password');

    if (!user) {
      return res.json({
        success: true,
        exists: false,
        isSocial: false,
      });
    }

    const isSocial = Boolean(user.googleId || user.authType === 'google');
    const hasPassword = Boolean(user.password);

    res.json({
      success: true,
      exists: true,
      isSocial,
      hasPassword,
      user: {
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};


