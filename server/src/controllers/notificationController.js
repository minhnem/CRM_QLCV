import { Notification } from '../models/Notification.js';

// @desc    Lấy danh sách thông báo của người dùng hiện tại
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: userId })
        .populate('sender', 'name email avatar')
        .populate('task', 'title status priority')
        .populate('project', 'name code color')
        .sort({ createdAt: -1 })
        .limit(40),
      Notification.countDocuments({ recipient: userId, isRead: false }),
    ]);

    res.json({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Đánh dấu 1 thông báo là đã đọc
// @route   PATCH /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông báo',
      });
    }

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    res.json({
      success: true,
      notification,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Đánh dấu tất cả thông báo là đã đọc
// @route   PATCH /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    );

    res.json({
      success: true,
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
      unreadCount: 0,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Xóa một thông báo
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông báo để xóa',
      });
    }

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    res.json({
      success: true,
      message: 'Đã xóa thông báo thành công',
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};
