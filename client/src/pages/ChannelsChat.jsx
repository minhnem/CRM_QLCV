import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Input,
  Button,
  Avatar,
  Tag,
  Badge,
  Spin,
  Empty,
  Tooltip,
  Modal,
  Form,
  Image,
  message,
} from 'antd';
import {
  SendOutlined,
  PaperClipOutlined,
  ApartmentOutlined,
  ProjectOutlined,
  SearchOutlined,
  SmileOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  LinkOutlined,
  ThunderboltFilled,
  FileTextOutlined,
  DownloadOutlined,
  CheckOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FileZipOutlined,
  LoadingOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { messageApi } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

const { TextArea } = Input;

export const ChannelsChat = () => {
  const { user, currentWorkspace } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryType = searchParams.get('type') || 'department';
  const queryId = searchParams.get('id');

  const [channels, setChannels] = useState({ departments: [], projects: [] });
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Mention (@tag) state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef(null);
  const mentionBoxRef = useRef(null);

  // Attachment state
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [attachForm] = Form.useForm();
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef(null);

  const messagesEndRef = useRef(null);
  const socket = getSocket();

  // Scroll to bottom smoothly
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch all channels for the active workspace
  const loadChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      const res = await messageApi.getChannels();
      if (res.data.success) {
        const depts = res.data.departments || [];
        const projs = res.data.projects || [];
        setChannels({
          departments: depts,
          projects: projs,
        });

        // Determine active channel
        let targetChannel = null;
        if (queryId) {
          if (queryType === 'project') {
            targetChannel = projs.find((p) => p._id === queryId);
          } else {
            targetChannel = depts.find((d) => d._id === queryId);
          }
        }

        // Fallback to first channel in this workspace
        if (!targetChannel) {
          targetChannel = depts[0] || projs[0] || null;
        }

        if (targetChannel) {
          setActiveChannel(targetChannel);
        } else {
          // Khi không có kênh nào trong không gian này, xóa sạch kênh và tin nhắn cũ
          setActiveChannel(null);
          setMessages([]);
        }
      } else {
        setChannels({ departments: [], projects: [] });
        setActiveChannel(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
      setChannels({ departments: [], projects: [] });
      setActiveChannel(null);
      setMessages([]);
    } finally {
      setLoadingChannels(false);
    }
  }, [queryId, queryType]);

  useEffect(() => {
    // Xóa sạch kênh và tin nhắn đang hiển thị ngay khi đổi không gian làm việc
    setActiveChannel(null);
    setMessages([]);
    loadChannels();

    const handleDeptChanged = () => {
      loadChannels();
    };

    socket.on('department:changed', handleDeptChanged);
    return () => {
      socket.off('department:changed', handleDeptChanged);
    };
  }, [currentWorkspace?._id, loadChannels]);

  // Fetch messages when active channel changes
  const loadMessages = async (channel) => {
    if (!channel) return;
    setLoadingMessages(true);
    try {
      const res = await messageApi.getMessages(channel.type, channel._id);
      if (res.data.success) {
        setMessages(res.data.messages || []);
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeChannel) {
      loadMessages(activeChannel);

      // Join socket room
      socket.emit('channel:join', {
        channelType: activeChannel.type,
        channelId: activeChannel._id,
      });

      return () => {
        socket.emit('channel:leave', {
          channelType: activeChannel.type,
          channelId: activeChannel._id,
        });
      };
    }
  }, [activeChannel?._id, activeChannel?.type]);

  // Real-time listener for incoming messages
  useEffect(() => {
    const handleNewMessage = (newMsg) => {
      if (
        activeChannel &&
        newMsg.channelType === activeChannel.type &&
        newMsg.channelId === activeChannel._id
      ) {
        setMessages((prev) => [...prev, newMsg]);
        setTimeout(scrollToBottom, 50);
      }

      // Update last message in channel list
      setChannels((prev) => {
        const updateList = (list, type) =>
          list.map((c) => {
            if (c._id === newMsg.channelId && type === newMsg.channelType) {
              return {
                ...c,
                lastMessage: {
                  content: newMsg.content,
                  sender: newMsg.sender?.name || 'Ai đó',
                  createdAt: newMsg.createdAt,
                },
              };
            }
            return c;
          });

        return {
          departments: updateList(prev.departments, 'department'),
          projects: updateList(prev.projects, 'project'),
        };
      });
    };

    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [activeChannel]);

  // Handle switching channel
  const handleSelectChannel = (channel) => {
    setActiveChannel(channel);
    setSearchParams({ type: channel.type, id: channel._id });
  };

  // Danh sách thành viên thuộc kênh hiện tại (CHỈ THUỘC PHÒNG BAN HOẶC DỰ ÁN ĐÓ)
  const channelMembers = activeChannel?.members || [];

  // Danh sách ứng viên khi tag:
  // 1. @all: Tất cả mọi người trong kênh này
  // 2. Từng thành viên trong kênh này
  const mentionCandidates = [
    {
      _id: 'all',
      name: 'all',
      displayName: 'Tất cả mọi người (@all)',
      isAll: true,
      role: 'all',
      desc: `Thông báo tới toàn bộ ${channelMembers.length} thành viên trong kênh này`,
    },
    ...channelMembers.map((m) => ({
      _id: m._id,
      name: m.name,
      displayName: m.name,
      email: m.email,
      role: m.role,
      department: m.department,
      avatar: m.avatar,
      isAll: false,
    })),
  ];

  // Lọc gợi ý theo từ khóa sau ký tự @
  const filteredSuggestions = mentionCandidates.filter((item) => {
    if (!mentionSearch) return true;
    const q = mentionSearch.toLowerCase();
    if (item.isAll) {
      return (
        'all'.includes(q) ||
        'tat ca'.includes(q) ||
        'tất cả'.includes(q) ||
        'moi nguoi'.includes(q) ||
        'mọi người'.includes(q)
      );
    }
    const nameMatch = item.name?.toLowerCase().includes(q);
    const emailMatch = item.email?.toLowerCase().includes(q);
    return nameMatch || emailMatch;
  });

  // Bắt sự kiện gõ phím trong ô chat để phát hiện @
  const handleInputChange = (e) => {
    const val = e.target.value;
    setTextInput(val);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);

    // Tìm ký tự @ cuối cùng trước con trỏ (không chứa dấu cách sau @)
    const match = textBeforeCursor.match(/@([^\s@]*)$/);
    if (match) {
      setMentionOpen(true);
      setMentionSearch(match[1]);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
      setMentionSearch('');
    }
  };

  // Chèn @Tên hoặc @all vào vị trí con trỏ
  const selectMention = (item) => {
    const textarea = textareaRef.current?.resizableTextArea?.textArea;
    const cursor = textarea ? textarea.selectionStart : textInput.length;
    const textBeforeCursor = textInput.slice(0, cursor);
    const textAfterCursor = textInput.slice(cursor);

    const match = textBeforeCursor.match(/@([^\s@]*)$/);
    let newText = '';
    let newCursorPos = 0;

    const tagText = item.isAll ? '@all ' : `@${item.name} `;

    if (match) {
      const startIdx = match.index;
      newText = textBeforeCursor.slice(0, startIdx) + tagText + textAfterCursor;
      newCursorPos = startIdx + tagText.length;
    } else {
      newText = textBeforeCursor + tagText + textAfterCursor;
      newCursorPos = textBeforeCursor.length + tagText.length;
    }

    setTextInput(newText);
    setMentionOpen(false);
    setMentionSearch('');

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 50);
  };

  // Nút bấm @ trên thanh công cụ
  const handleTriggerMention = () => {
    const textarea = textareaRef.current?.resizableTextArea?.textArea;
    const cursor = textarea ? textarea.selectionStart : textInput.length;
    const before = textInput.slice(0, cursor);
    const after = textInput.slice(cursor);

    const needAt = !before.endsWith('@');
    const insertChar = needAt ? (before.endsWith(' ') || before.length === 0 ? '@' : ' @') : '';
    const newText = before + insertChar + after;
    const newCursor = cursor + insertChar.length;

    setTextInput(newText);
    setMentionOpen(true);
    setMentionSearch('');
    setMentionIndex(0);

    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(newCursor, newCursor);
      }
    }, 50);
  };

  // Điều hướng bàn phím khi gợi ý tag đang mở
  const handleKeyDown = (e) => {
    if (mentionOpen && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(
          (prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredSuggestions[mentionIndex];
        if (selected) {
          selectMention(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Gửi tin nhắn có nhận diện tag @all và tag thành viên
  const handleSendMessage = async () => {
    const trimmed = textInput.trim();
    if (!trimmed && pendingAttachments.length === 0) return;
    if (!activeChannel) return;

    const isMentionAll = /@all\b/i.test(trimmed);
    const mentionedUserIds = (activeChannel.members || [])
      .filter((m) => trimmed.includes(`@${m.name}`))
      .map((m) => m._id);

    setSending(true);
    try {
      const payload = {
        content: trimmed,
        attachments: pendingAttachments,
        mentions: mentionedUserIds,
        isMentionAll,
      };

      const res = await messageApi.sendMessage(
        activeChannel.type,
        activeChannel._id,
        payload
      );

      if (res.data.success) {
        setTextInput('');
        setPendingAttachments([]);
        setMentionOpen(false);
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể gửi tin nhắn.');
    } finally {
      setSending(false);
    }
  };

  // Kiểm tra xem người dùng hiện tại có được nhắc đến không
  const isUserMentioned = (msg) => {
    if (!user) return false;
    const currentUserId = (user._id || user.id)?.toString();
    const senderId = (msg.sender?._id || msg.sender?.id || msg.sender)?.toString();

    // Nếu tin nhắn do chính mình gửi -> không bao giờ tự gắn tag "Nhắc bạn"
    if (currentUserId && senderId && currentUserId === senderId) return false;

    if (msg.isMentionAll) return true;
    if (msg.content && /@all\b/i.test(msg.content)) return true;
    if (
      msg.mentions &&
      msg.mentions.some((m) => {
        const mId = (m._id || m.id || m)?.toString();
        return mId === currentUserId;
      })
    ) {
      return true;
    }
    if (user.name && msg.content && msg.content.includes(`@${user.name}`)) {
      return true;
    }
    return false;
  };

  // Render nội dung tin nhắn với badge nổi bật cho @all và @Tên
  const renderMessageContent = (content, isMe) => {
    if (!content) return null;

    const names = (activeChannel?.members || []).map((m) => m.name).filter(Boolean);
    const sortedNames = [...names].sort((a, b) => b.length - a.length);

    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const memberPatterns = sortedNames.map((n) => `@${escapeRegExp(n)}\\b`).join('|');
    const patternStr = memberPatterns
      ? `(@all\\b|${memberPatterns}|@[\\p{L}\\w_]+)`
      : `(@all\\b|@[\\p{L}\\w_]+)`;

    const regex = new RegExp(patternStr, 'gu');
    const parts = content.split(regex);

    return parts.map((part, index) => {
      if (!part) return null;

      if (part.toLowerCase() === '@all') {
        return (
          <span
            key={index}
            className={`inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded-md text-xs mx-0.5 align-baseline shadow-2xs ${
              isMe
                ? 'bg-amber-300 text-amber-950 border border-amber-200'
                : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}
          >
            📢 @all
          </span>
        );
      }

      if (part.startsWith('@')) {
        const rawName = part.slice(1);
        const isChannelMember = names.some(
          (n) => n.toLowerCase() === rawName.toLowerCase()
        );
        const isMyName = user?.name && user.name.toLowerCase() === rawName.toLowerCase();

        return (
          <span
            key={index}
            className={`inline-flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded-md text-xs mx-0.5 align-baseline shadow-2xs ${
              isMyName
                ? isMe
                  ? 'bg-white text-blue-700 border border-white'
                  : 'bg-blue-600 text-white border border-blue-700 ring-2 ring-blue-300'
                : isChannelMember
                ? isMe
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                : isMe
                ? 'bg-white/10 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            @{rawName}
          </span>
        );
      }

      return part;
    });
  };

  // Format kích thước tệp (VD: 1 MB, 13 KB, 500 B)
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Upload file từ máy tính
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploadingFile(true);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await messageApi.uploadAttachment(formData);
        if (res.data.success && res.data.file) {
          setPendingAttachments((prev) => [...prev, res.data.file]);
          message.success(`Đã tải lên tệp: ${res.data.file.name}`);
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      message.error(err.response?.data?.message || 'Tải tệp lên thất bại. Vui lòng thử lại!');
    } finally {
      setUploadingFile(false);
    }
  };

  // Chọn file từ máy tính qua input file
  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
      e.target.value = '';
    }
  };

  // Dán file từ clipboard (Ctrl+V)
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      handleFileUpload(files);
    }
  };

  // Kéo thả tệp vào ô chat
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  // Render card đính kèm đẹp mắt (Chuẩn giao diện Zalo/Telegram như trong ảnh)
  const renderAttachmentCard = (att, isMe) => {
    const isImage =
      att.fileType === 'image' ||
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.name || att.url);
    const isDoc =
      att.fileType === 'doc' || /\.(doc|docx)$/i.test(att.name || att.url);
    const isPdf =
      att.fileType === 'pdf' || /\.(pdf)$/i.test(att.name || att.url);
    const isSheet =
      att.fileType === 'sheet' || /\.(xls|xlsx|csv)$/i.test(att.name || att.url);
    const isZip =
      att.fileType === 'zip' || /\.(zip|rar|7z|tar|gz)$/i.test(att.name || att.url);

    return (
      <div
        key={att.url || att.name}
        className="flex items-center gap-3 p-2.5 rounded-xl bg-white/95 hover:bg-white text-slate-800 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all group"
      >
        {/* Left Icon or Thumbnail */}
        {isImage ? (
          <div className="relative shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200/60 flex items-center justify-center">
            <Image
              src={att.url}
              alt={att.name}
              className="w-12 h-12 object-cover"
              preview={{
                mask: <EyeOutlined className="text-white text-xs" />,
              }}
            />
          </div>
        ) : isDoc ? (
          <div className="w-11 h-11 rounded-lg bg-blue-600 text-white font-extrabold text-[11px] flex flex-col items-center justify-center shrink-0 shadow-xs">
            <span className="text-[10px] tracking-wider font-black">DOC</span>
          </div>
        ) : isPdf ? (
          <div className="w-11 h-11 rounded-lg bg-rose-500 text-white font-extrabold text-[11px] flex flex-col items-center justify-center shrink-0 shadow-xs">
            <span className="text-[10px] tracking-wider font-black">PDF</span>
          </div>
        ) : isSheet ? (
          <div className="w-11 h-11 rounded-lg bg-emerald-600 text-white font-extrabold text-[11px] flex flex-col items-center justify-center shrink-0 shadow-xs">
            <span className="text-[10px] tracking-wider font-black">XLS</span>
          </div>
        ) : isZip ? (
          <div className="w-11 h-11 rounded-lg bg-amber-500 text-white font-extrabold text-[11px] flex flex-col items-center justify-center shrink-0 shadow-xs">
            <span className="text-[10px] tracking-wider font-black">ZIP</span>
          </div>
        ) : (
          <div className="w-11 h-11 rounded-lg bg-slate-600 text-white font-extrabold text-[11px] flex flex-col items-center justify-center shrink-0 shadow-xs">
            <FileTextOutlined className="text-sm" />
          </div>
        )}

        {/* Center Name & Size */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="font-bold text-xs sm:text-sm text-slate-800 truncate" title={att.name}>
            {att.name || 'Tệp đính kèm'}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">
            {formatFileSize(att.size) || 'Tài liệu'}
          </div>
        </div>

        {/* Right Download Button */}
        <a
          href={att.url}
          download={att.name || true}
          target="_blank"
          rel="noopener noreferrer"
          title={`Tải xuống ${att.name || ''}`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
        >
          <DownloadOutlined className="text-base" />
        </a>
      </div>
    );
  };

  // Render thẻ Task đính kèm trong tin nhắn kênh chat dự án
  const renderTaskCard = (taskRef, isMe) => {
    if (!taskRef) return null;
    const taskObj =
      typeof taskRef === 'object'
        ? taskRef
        : { _id: taskRef, title: 'Chi tiết công việc' };
    const taskId = taskObj._id || taskObj.id;
    const projectId = activeChannel?.type === 'project' ? activeChannel._id : null;

    const statusMap = {
      todo: { text: 'Cần làm', color: 'default' },
      in_progress: { text: 'Đang làm', color: 'processing' },
      review: { text: '⏳ Chờ duyệt', color: 'warning' },
      done: { text: '✅ Hoàn thành', color: 'success' },
    };

    const priorityMap = {
      urgent: { text: 'Khẩn cấp', color: 'error' },
      high: { text: 'Cao', color: 'warning' },
      medium: { text: 'Trung bình', color: 'blue' },
      low: { text: 'Thấp', color: 'default' },
    };

    const statusInfo = statusMap[taskObj.status] || { text: 'Công việc', color: 'blue' };
    const priorityInfo = priorityMap[taskObj.priority] || priorityMap.medium;

    const formattedDueDate = taskObj.dueDate
      ? new Date(taskObj.dueDate).toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : null;

    const handleOpenTask = (e) => {
      e.stopPropagation();
      if (projectId) {
        navigate(`/tasks?project=${projectId}&task=${taskId}`);
      } else {
        navigate(`/tasks?task=${taskId}`);
      }
    };

    return (
      <div
        onClick={handleOpenTask}
        className={`mt-2 p-3 rounded-xl border transition-all cursor-pointer select-none group text-left ${
          isMe
            ? 'bg-white/95 text-slate-800 border-blue-200/90 hover:bg-white shadow-xs'
            : 'bg-white text-slate-800 border-slate-200 hover:border-blue-400 hover:shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
              ✓
            </span>
            <span className="font-bold text-[11px] text-blue-600 uppercase tracking-wider">
              {activeChannel?.name ? `Task • ${activeChannel.name}` : 'Công việc dự án'}
            </span>
          </div>
          <Tag color={statusInfo.color} className="m-0 text-[10px] font-semibold">
            {statusInfo.text}
          </Tag>
        </div>

        <div className="font-bold text-xs sm:text-sm text-slate-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
          {taskObj.title || 'Công việc dự án'}
        </div>

        {/* Link sản phẩm nếu có */}
        {taskObj.submission?.url && (
          <div className="mb-2" onClick={(e) => e.stopPropagation()}>
            <a
              href={taskObj.submission.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors shadow-2xs"
            >
              <span>🎬 Xem sản phẩm nộp ↗</span>
            </a>
          </div>
        )}

        {/* Nội dung phản hồi nếu bị yêu cầu chỉnh sửa */}
        {taskObj.reviewFeedback?.action === 'changes_requested' && (
          <div className="mb-2 p-2 rounded-lg bg-rose-50/90 border border-rose-200 text-[11px] text-rose-900 leading-snug">
            <span className="font-bold text-rose-700">⚠️ Yêu cầu sửa:</span>{' '}
            <span>{taskObj.reviewFeedback.comment}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex-wrap">
          <div className="flex items-center gap-2">
            <Tag color={priorityInfo.color} className="m-0 text-[10px] font-semibold">
              {priorityInfo.text}
            </Tag>
            {formattedDueDate && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <CalendarOutlined />
                <span>Hạn: {formattedDueDate}</span>
              </span>
            )}
          </div>

          <div className="text-[11px] font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
            <span>Mở bảng Kanban</span>
            <span>&rarr;</span>
          </div>
        </div>
      </div>
    );
  };


  // Add attachment from modal (URL link)
  const handleAddAttachment = async () => {
    try {
      const values = await attachForm.validateFields();
      setPendingAttachments((prev) => [
        ...prev,
        {
          name: values.name,
          url: values.url,
          fileType: values.fileType || 'link',
        },
      ]);
      attachForm.resetFields();
      setIsAttachModalOpen(false);
      message.success('Đã đính kèm tệp/liên kết thành công!');
    } catch (err) {
      // validation error
    }
  };

  // Filter channels based on searchFilter
  const filteredDepartments = channels.departments.filter(
    (d) =>
      d.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.code?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredProjects = channels.projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.code?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col md:flex-row bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      {/* ============================================================== */}
      {/* LEFT COLUMN: CHANNELS LIST (SLACK/DISCORD STYLE)               */}
      {/* ============================================================== */}
      <div className="w-full md:w-80 lg:w-88 border-r border-slate-200 flex flex-col bg-slate-50/70 select-none">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Kênh Chat Nội Bộ
            </h2>
            <Badge count="Realtime" style={{ backgroundColor: '#10b981', fontSize: '10px' }} />
          </div>

          <Input
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Tìm kênh phòng ban, dự án..."
            allowClear
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="rounded-lg text-xs"
          />
        </div>

        {/* Channels List Scrollable */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {loadingChannels ? (
            <div className="py-12 text-center">
              <Spin tip="Đang tải danh sách kênh..." />
            </div>
          ) : filteredDepartments.length === 0 && filteredProjects.length === 0 ? (
            searchFilter ? (
              <div className="py-12 text-center">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span className="text-slate-400 text-xs">
                      Không tìm thấy kênh phù hợp với "{searchFilter}"
                    </span>
                  }
                />
              </div>
            ) : (
              <div className="py-10 px-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 mx-auto flex items-center justify-center text-xl mb-3 border border-amber-200/80 shadow-2xs">
                  🔒
                </div>
                <h4 className="font-bold text-slate-800 text-xs mb-1">
                  Chưa có Kênh Chat nào
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-[220px] mx-auto">
                  Không gian làm việc này chưa có phòng ban hoặc dự án nào.
                </p>
              </div>
            )
          ) : (
            <>
              {/* SECTION 1: KÊNH PHÒNG BAN */}
              {filteredDepartments.length > 0 && (
                <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <ApartmentOutlined /> Kênh Phòng Ban
                  </span>
                  <span>{filteredDepartments.length}</span>
                </div>

                <div className="space-y-1">
                  {filteredDepartments.map((dept) => {
                    const isActive =
                      activeChannel?.type === 'department' &&
                      activeChannel?._id === dept._id;

                    return (
                      <div
                        key={dept._id}
                        onClick={() => handleSelectChannel(dept)}
                        className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-start gap-2.5 ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'hover:bg-slate-200/60 text-slate-700'
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5"
                          style={{
                            backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : dept.color || '#2563eb',
                            color: '#ffffff',
                          }}
                        >
                          #
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs truncate">
                              {dept.name}
                            </span>
                            {dept.lastMessage && (
                              <span
                                className={`text-[10px] shrink-0 ${
                                  isActive ? 'text-blue-100' : 'text-slate-400'
                                }`}
                              >
                                {new Date(dept.lastMessage.createdAt).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>

                          <p
                            className={`text-[11px] truncate mt-0.5 ${
                              isActive ? 'text-blue-100' : 'text-slate-400'
                            }`}
                          >
                            {dept.lastMessage
                              ? `${dept.lastMessage.sender}: ${dept.lastMessage.content}`
                              : dept.description || 'Chưa có tin nhắn nào'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECTION 2: KÊNH DỰ ÁN */}
            {filteredProjects.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <ProjectOutlined /> Kênh Dự Án
                  </span>
                  <span>{filteredProjects.length}</span>
                </div>

                <div className="space-y-1">
                  {filteredProjects.map((proj) => {
                    const isActive =
                      activeChannel?.type === 'project' &&
                      activeChannel?._id === proj._id;

                    return (
                      <div
                        key={proj._id}
                        onClick={() => handleSelectChannel(proj)}
                        className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-start gap-2.5 ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'hover:bg-slate-200/60 text-slate-700'
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 uppercase"
                          style={{
                            backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : proj.color || '#10b981',
                            color: '#ffffff',
                          }}
                        >
                          {proj.code ? proj.code.slice(0, 3) : 'PRJ'}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs truncate">
                              {proj.name}
                            </span>
                            {proj.lastMessage && (
                              <span
                                className={`text-[10px] shrink-0 ${
                                  isActive ? 'text-blue-100' : 'text-slate-400'
                                }`}
                              >
                                {new Date(proj.lastMessage.createdAt).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>

                          <p
                            className={`text-[11px] truncate mt-0.5 ${
                              isActive ? 'text-blue-100' : 'text-slate-400'
                            }`}
                          >
                            {proj.lastMessage
                              ? `${proj.lastMessage.sender}: ${proj.lastMessage.content}`
                              : proj.description || 'Chưa có tin nhắn nào'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* RIGHT COLUMN: ACTIVE CHANNEL WORKSPACE                         */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col h-full bg-white">
        {activeChannel ? (
          <>
            {/* Channel Top Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white/80 backdrop-blur z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm shrink-0"
                  style={{ backgroundColor: activeChannel.color || '#2563eb' }}
                >
                  {activeChannel.type === 'department' ? '#' : (activeChannel.code || 'PRJ')}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900 truncate">
                      {activeChannel.name}
                    </h3>
                    <Tag
                      color={activeChannel.type === 'department' ? 'blue' : 'green'}
                      className="m-0 text-[10px] font-semibold"
                    >
                      {activeChannel.type === 'department' ? 'Phòng Ban' : 'Dự Án'}
                    </Tag>
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">
                    {activeChannel.description || 'Kênh thảo luận công việc thời gian thực'} • {activeChannel.membersCount || 1} nhân sự
                  </div>
                </div>
              </div>

              {/* Status info */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ThunderboltFilled className="text-emerald-500" />
                <span className="font-medium text-slate-600 hidden sm:inline">Lưu trữ đám mây • Mã hóa nội bộ</span>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/40">
              {/* Channel Welcome Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 mb-6 text-center">
                <div className="inline-flex w-10 h-10 rounded-full bg-blue-600 text-white items-center justify-center mb-2 shadow-sm font-bold">
                  {activeChannel.type === 'department' ? '#' : '🚀'}
                </div>
                <h4 className="font-bold text-slate-800 text-sm">
                  Chào mừng đến với Kênh {activeChannel.type === 'department' ? 'Phòng ban' : 'Dự án'} #{activeChannel.name}
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Mọi tài liệu, link duyệt file, biên bản và trao đổi phải được nộp tại đây để lưu vết vĩnh viễn trên hệ thống công ty.
                </p>
              </div>

              {loadingMessages ? (
                <div className="py-12 text-center">
                  <Spin tip="Đang tải lịch sử tin nhắn..." />
                </div>
              ) : messages.length === 0 ? (
                <div className="py-16 text-center">
                  <Empty description="Kênh này chưa có trao đổi nào. Hãy là người đầu tiên gửi tin nhắn!" />
                </div>
              ) : (
                messages.map((msg) => {
                  const currentUserId = (user?._id || user?.id)?.toString();
                  const senderId = (msg.sender?._id || msg.sender?.id || msg.sender)?.toString();
                  const isMe = Boolean(currentUserId && senderId && currentUserId === senderId);
                  const isMentioned = isUserMentioned(msg) && !isMe;

                  return (
                    <div
                      key={msg._id}
                      className={`flex items-start gap-3 group transition-all ${
                        isMe ? 'flex-row-reverse' : ''
                      }`}
                    >
                      {/* Avatar */}
                      <Avatar
                        size={36}
                        style={{
                          backgroundColor: isMe ? '#2563eb' : '#64748b',
                          fontWeight: 'bold',
                        }}
                      >
                        {msg.sender?.name ? msg.sender.name[0].toUpperCase() : '?'}
                      </Avatar>

                      {/* Bubble Container */}
                      <div className={`max-w-[80%] md:max-w-[70%] space-y-1 ${isMe ? 'items-end' : ''}`}>
                        {/* Sender info & time */}
                        <div
                          className={`flex items-center gap-2 text-[11px] text-slate-400 ${
                            isMe ? 'justify-end' : ''
                          }`}
                        >
                          <span className="font-bold text-slate-700">
                            {isMe ? 'Bạn' : msg.sender?.name || 'Nhân viên'}
                          </span>
                          {msg.sender?.role && (
                            <Tag className="m-0 text-[9px] px-1 py-0">
                              {msg.sender.role === 'admin'
                                ? 'Admin'
                                : msg.sender.role === 'manager'
                                ? 'Quản lý'
                                : 'Thành viên'}
                            </Tag>
                          )}
                          {isMentioned && (
                            <Tag color="gold" className="m-0 text-[9px] font-semibold py-0 px-1 border-amber-300">
                              🔔 Nhắc bạn
                            </Tag>
                          )}
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Content Box */}
                        <div
                          className={`p-3 rounded-2xl text-xs md:text-sm leading-relaxed shadow-2xs whitespace-pre-wrap break-words ${
                            isMe
                              ? 'bg-blue-600 text-white rounded-tr-xs shadow-xs'
                              : isMentioned
                              ? 'bg-amber-50/95 text-slate-800 border-2 border-amber-300 rounded-tl-xs shadow-xs ring-2 ring-amber-100'
                              : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-2xs'
                          }`}
                        >
                          {/* Attachments Cards (Zalo/Telegram Style) */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div
                              className={`space-y-2 ${
                                msg.content && msg.content !== 'Đã gửi một tệp đính kèm'
                                  ? 'mb-2'
                                  : ''
                              }`}
                            >
                              {msg.attachments.map((att, idx) =>
                                renderAttachmentCard(att, isMe)
                              )}
                            </div>
                          )}

                          {/* Text Message Content */}
                          {msg.content && msg.content !== 'Đã gửi một tệp đính kèm' && (
                            <div className="px-1 py-0.5">
                              {renderMessageContent(msg.content, isMe)}
                            </div>
                          )}

                          {/* Task Reference Interactive Card */}
                          {msg.taskRef && renderTaskCard(msg.taskRef, isMe)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Pending Attachments preview */}
            {(pendingAttachments.length > 0 || uploadingFile) && (
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center gap-2 overflow-x-auto text-xs">
                {uploadingFile && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-200 shrink-0 animate-pulse">
                    <LoadingOutlined />
                    <span>Đang tải tệp lên máy chủ...</span>
                  </div>
                )}
                {pendingAttachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs shrink-0 text-slate-700"
                  >
                    <span className="font-bold text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">
                      {att.fileType || 'FILE'}
                    </span>
                    <span className="font-medium text-xs truncate max-w-[150px]">
                      {att.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatFileSize(att.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-slate-400 hover:text-red-500 font-bold ml-1 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Input Area */}
            <div className="p-3 md:p-4 border-t border-slate-200 bg-white relative">
              {/* Mention Suggestions Floating Dropdown */}
              {mentionOpen && (
                <div
                  ref={mentionBoxRef}
                  className="absolute bottom-full mb-2 left-3 right-3 md:left-4 md:right-auto md:w-96 max-h-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 flex flex-col"
                  style={{ filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.15))' }}
                >
                  {/* Dropdown Header */}
                  <div className="px-3.5 py-2.5 bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border-b border-blue-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                        @
                      </span>
                      <span>Nhắc tên trong kênh #{activeChannel.name}</span>
                    </div>
                    <span className="text-[10px] text-blue-700 font-semibold bg-white px-2 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                      Chỉ nhân sự kênh này
                    </span>
                  </div>

                  {/* Suggestions List */}
                  <div className="overflow-y-auto max-h-60 p-1.5 divide-y divide-slate-100">
                    {filteredSuggestions.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        Không tìm thấy ai khớp với "@{mentionSearch}" trong {activeChannel.type === 'department' ? 'phòng ban' : 'dự án'} này
                      </div>
                    ) : (
                      filteredSuggestions.map((item, idx) => {
                        const isSelected = idx === mentionIndex;
                        if (item.isAll) {
                          return (
                            <div
                              key="all"
                              onMouseEnter={() => setMentionIndex(idx)}
                              onClick={() => selectMention(item)}
                              className={`p-2.5 rounded-xl cursor-pointer flex items-center gap-2.5 transition-all ${
                                isSelected
                                  ? 'bg-amber-100 text-amber-950 font-medium shadow-2xs'
                                  : 'hover:bg-amber-50 text-slate-800'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                                📢
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-xs text-amber-900">@all</span>
                                  <Tag color="gold" className="m-0 text-[10px] font-semibold py-0 px-1 border-amber-300">
                                    Toàn bộ kênh
                                  </Tag>
                                </div>
                                <div className="text-[11px] text-amber-700/90 truncate mt-0.5">
                                  Thông báo tới tất cả {channelMembers.length} thành viên trong kênh này
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={item._id}
                            onMouseEnter={() => setMentionIndex(idx)}
                            onClick={() => selectMention(item)}
                            className={`p-2 rounded-xl cursor-pointer flex items-center gap-2.5 transition-all ${
                              isSelected
                                ? 'bg-blue-50 text-blue-900 font-medium shadow-2xs'
                                : 'hover:bg-slate-100 text-slate-800'
                            }`}
                          >
                            <Avatar
                              size={32}
                              style={{
                                backgroundColor: '#2563eb',
                                fontWeight: 'bold',
                                fontSize: '12px',
                              }}
                              src={item.avatar}
                            >
                              {item.name ? item.name[0].toUpperCase() : '?'}
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs text-slate-900 truncate">
                                  {item.name}
                                </span>
                                {item.role && (
                                  <Tag className="m-0 text-[9px] py-0 px-1 shrink-0">
                                    {item.role === 'admin'
                                      ? 'Admin'
                                      : item.role === 'manager'
                                      ? 'Quản lý'
                                      : 'Thành viên'}
                                  </Tag>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                {item.email || (activeChannel.type === 'department' ? activeChannel.name : 'Thành viên dự án')}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Dropdown Footer hints */}
                  <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 select-none">
                    <span><b>↑</b> <b>↓</b> Di chuyển</span>
                    <span><b>Enter / Tab</b> Chọn</span>
                    <span><b>Esc</b> Đóng</span>
                  </div>
                </div>
              )}

              {/* Hidden File Input for Direct Upload */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                className="hidden"
              />

              {/* Drag & Drop Visual Overlay */}
              {isDraggingOver && (
                <div className="absolute inset-0 bg-blue-600/90 backdrop-blur-xs rounded-xl flex items-center justify-center text-white font-bold text-sm z-40 border-2 border-dashed border-white m-2 pointer-events-none">
                  📁 Thả tệp vào đây để tải lên ngay...
                </div>
              )}

              {/* Chat Input Box */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onPaste={handlePaste}
                className="flex items-end gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all"
              >
                {/* File Upload Button (Computer) */}
                <Tooltip title="Chọn tệp từ máy tính (Ảnh, Word, PDF, Excel, Zip...)">
                  <Button
                    type="text"
                    icon={<PaperClipOutlined style={{ fontSize: '17px' }} />}
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploadingFile}
                    className="text-slate-400 hover:text-blue-600 hover:bg-white shrink-0 mb-0.5"
                  />
                </Tooltip>

                {/* Link Attachment Button (Drive, Figma, OneDrive) */}
                <Tooltip title="Chèn liên kết tài liệu duyệt việc (Google Drive, Figma...)">
                  <Button
                    type="text"
                    icon={<LinkOutlined style={{ fontSize: '15px' }} />}
                    onClick={() => setIsAttachModalOpen(true)}
                    className="text-slate-400 hover:text-blue-600 hover:bg-white shrink-0 mb-0.5"
                  />
                </Tooltip>

                {/* Tag mention button */}
                <Tooltip title="Nhắc tên thành viên (@) hoặc @all trong kênh này">
                  <Button
                    type="text"
                    onClick={handleTriggerMention}
                    className="text-slate-500 hover:text-blue-600 hover:bg-white shrink-0 mb-0.5 font-bold text-sm px-2 h-8 w-8 flex items-center justify-center rounded-lg"
                  >
                    @
                  </Button>
                </Tooltip>

                {/* Textarea */}
                <TextArea
                  ref={textareaRef}
                  value={textInput}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={`Gõ @ để nhắc đến một người, một cuộc trò chuyện... (Enter gửi, Shift+Enter xuống dòng)`}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  className="bg-transparent border-none shadow-none text-xs md:text-sm focus:shadow-none p-1 resize-none"
                />

                {/* Send Button */}
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={sending || uploadingFile}
                  onClick={handleSendMessage}
                  disabled={!textInput.trim() && pendingAttachments.length === 0}
                  className="shrink-0 font-medium"
                >
                  Gửi
                </Button>
              </div>

              <div className="flex items-center justify-end text-[11px] text-slate-400 mt-1.5 px-1">
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Kênh lưu vết chính thức
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
            {channels.departments.length === 0 && channels.projects.length === 0 ? (
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mx-auto border border-blue-100 shadow-sm">
                  💬
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base mb-1">
                    Không gian làm việc mới chưa có Kênh Chat
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Kênh chat được tự động kích hoạt theo từng <b>Phòng Ban</b> và <b>Dự Án</b> trong Không gian làm việc <b>{currentWorkspace?.name || ''}</b>.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    type="primary"
                    icon={<ApartmentOutlined />}
                    onClick={() => navigate('/departments')}
                    className="font-medium text-xs"
                  >
                    Tạo Phòng Ban
                  </Button>
                  <Button
                    icon={<ProjectOutlined />}
                    onClick={() => navigate('/projects')}
                    className="font-medium text-xs"
                  >
                    Tạo Dự Án
                  </Button>
                </div>
              </div>
            ) : (
              <Empty description="Chọn một kênh bên trái để bắt đầu thảo luận công việc" />
            )}
          </div>
        )}
      </div>

      {/* Modal Đính kèm tệp / tài liệu */}
      <Modal
        title={<div className="font-bold text-base">Đính Kèm Tài Liệu / Liên Kết Duyệt Việc</div>}
        open={isAttachModalOpen}
        onOk={handleAddAttachment}
        onCancel={() => setIsAttachModalOpen(false)}
        okText="Thêm đính kèm"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form form={attachForm} layout="vertical" className="mt-4">
          <Form.Item
            label="Tên tài liệu / Tiêu đề liên kết"
            name="name"
            rules={[{ required: true, message: 'Vui lòng nhập tên tài liệu' }]}
          >
            <Input placeholder="VD: Banner_Flash_Sale_Q4.fig, Kế hoạch 11.11.pdf" />
          </Form.Item>

          <Form.Item
            label="Đường dẫn URL (Google Drive, Figma, OneDrive, Server...)"
            name="url"
            rules={[{ required: true, message: 'Vui lòng nhập đường dẫn' }]}
          >
            <Input placeholder="https://drive.google.com/... hoặc link tài liệu" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
