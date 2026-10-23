import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { authApi, workspaceApi } from '../services/api';
import { getSocket } from '../services/socket';

const AuthContext = createContext(null);

const normalizeUser = (u) => {
  if (!u) return null;
  const id = u._id || u.id;
  return {
    ...u,
    _id: id,
    id: id,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('crm_user');
    return saved ? normalizeUser(JSON.parse(saved)) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('crm_token'));
  const [currentWorkspace, setCurrentWorkspace] = useState(() => {
    const saved = localStorage.getItem('crm_workspace');
    return saved ? JSON.parse(saved) : null;
  });
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  // Refresh danh sách workspaces của user
  const refreshWorkspaces = useCallback(async () => {
    if (!localStorage.getItem('crm_token')) return [];
    try {
      setLoadingWorkspaces(true);
      const res = await workspaceApi.getMyWorkspaces();
      if (res.data.success) {
        const list = res.data.workspaces || [];
        setWorkspaces(list);

        // Lấy active workspace
        const activeId = res.data.currentWorkspaceId;
        let activeWs = list.find((w) => w._id === activeId && !w.isPending);

        // Nếu chưa có active ws nhưng có ít nhất 1 ws đã được duyệt
        if (!activeWs) {
          activeWs = list.find((w) => !w.isPending) || null;
        }

        if (activeWs) {
          setCurrentWorkspace(activeWs);
          localStorage.setItem('crm_workspace', JSON.stringify(activeWs));
        } else {
          setCurrentWorkspace(null);
          localStorage.removeItem('crm_workspace');
        }

        return list;
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách Không gian làm việc:', err);
    } finally {
      setLoadingWorkspaces(false);
    }
    return [];
  }, []);

  // Check token on initial load
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('crm_token');
      if (storedToken) {
        try {
          const res = await authApi.getMe();
          if (res.data.success) {
            const normalized = normalizeUser(res.data.user);
            setUser(normalized);
            localStorage.setItem('crm_user', JSON.stringify(normalized));

            // Join socket user room
            const socket = getSocket();
            socket.emit('join_user', normalized._id);

            // Tải danh sách workspaces
            await refreshWorkspaces();
          }
        } catch (error) {
          console.error('Session expired or invalid token:', error);
          logout();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [refreshWorkspaces]);

  // Đảm bảo socket luôn join vào user room kể cả khi reconnect
  useEffect(() => {
    if (!user?._id) return;
    const socket = getSocket();
    socket.emit('join_user', user._id);

    const onConnect = () => {
      socket.emit('join_user', user._id);
    };

    socket.on('connect', onConnect);
    return () => {
      socket.off('connect', onConnect);
    };
  }, [user?._id]);

  // Lắng nghe sự kiện socket liên quan tới Workspace
  useEffect(() => {
    const socket = getSocket();

    // Nhận yêu cầu xin gia nhập mới (dành cho Owner / Admin)
    const handleNewJoinRequest = (data) => {
      message.info(`🔔 ${data.applicant?.name || 'Có người'} vừa gửi yêu cầu tham gia không gian "${data.workspaceName}"!`);
      refreshWorkspaces();
    };

    // Khi yêu cầu của chính user được duyệt
    const handleRequestApproved = (data) => {
      message.success(`🎉 Yêu cầu gia nhập không gian "${data.workspaceName}" của bạn đã được phê duyệt!`);
      refreshWorkspaces();
    };

    // Khi yêu cầu bị từ chối
    const handleRequestRejected = (data) => {
      message.warning(`Yêu cầu gia nhập không gian "${data.workspaceName}" đã bị từ chối.`);
      refreshWorkspaces();
    };

    socket.on('workspace:join_request', handleNewJoinRequest);
    socket.on('workspace:request_approved', handleRequestApproved);
    socket.on('workspace:request_rejected', handleRequestRejected);

    return () => {
      socket.off('workspace:join_request', handleNewJoinRequest);
      socket.off('workspace:request_approved', handleRequestApproved);
      socket.off('workspace:request_rejected', handleRequestRejected);
    };
  }, [refreshWorkspaces]);

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    if (res.data.success) {
      const normalized = normalizeUser(res.data.user);
      setToken(res.data.token);
      setUser(normalized);
      localStorage.setItem('crm_token', res.data.token);
      localStorage.setItem('crm_user', JSON.stringify(normalized));

      const socket = getSocket();
      socket.emit('join_user', normalized._id);

      // Tải danh sách workspace ngay sau khi đăng nhập
      const wsList = await refreshWorkspaces();
      return { user: normalized, workspaces: wsList };
    }
  };

  const register = async (userData) => {
    const res = await authApi.register(userData);
    if (res.data.success) {
      const normalized = normalizeUser(res.data.user);
      setToken(res.data.token);
      setUser(normalized);
      localStorage.setItem('crm_token', res.data.token);
      localStorage.setItem('crm_user', JSON.stringify(normalized));

      const socket = getSocket();
      socket.emit('join_user', normalized._id);

      const wsList = await refreshWorkspaces();
      return { user: normalized, workspaces: wsList };
    }
  };

  const switchWorkspace = async (workspaceId) => {
    try {
      const res = await workspaceApi.switchWorkspace(workspaceId);
      if (res.data.success) {
        const ws = res.data.currentWorkspace;
        setCurrentWorkspace(ws);
        localStorage.setItem('crm_workspace', JSON.stringify(ws));
        message.success(res.data.message || 'Đã chuyển Không gian làm việc');
        await refreshWorkspaces();
        return ws;
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể chuyển Không gian làm việc');
      throw err;
    }
  };

  const loginWithGoogle = async (googleData) => {
    const payload =
      typeof googleData === 'string'
        ? { idToken: googleData, credential: googleData }
        : googleData;
    const res = await authApi.googleLogin(payload);
    if (res.data.success) {
      const normalized = normalizeUser(res.data.user);
      setToken(res.data.token);
      setUser(normalized);
      localStorage.setItem('crm_token', res.data.token);
      localStorage.setItem('crm_user', JSON.stringify(normalized));

      const socket = getSocket();
      socket.emit('join_user', normalized._id);

      const wsList = await refreshWorkspaces();
      return { user: normalized, workspaces: wsList };
    }
  };

  const handleResetPasswordSuccess = (tokenStr, userObj) => {
    const normalized = normalizeUser(userObj);
    setToken(tokenStr);
    setUser(normalized);
    localStorage.setItem('crm_token', tokenStr);
    localStorage.setItem('crm_user', JSON.stringify(normalized));

    const socket = getSocket();
    socket.emit('join_user', normalized._id);
    refreshWorkspaces();
    return normalized;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setCurrentWorkspace(null);
    setWorkspaces([]);
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    localStorage.removeItem('crm_workspace');
    localStorage.removeItem('crm_permissions');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        currentWorkspace,
        workspaces,
        loading,
        loadingWorkspaces,
        isAuthenticated: !!token,
        hasWorkspace: !!currentWorkspace,
        login,
        register,
        loginWithGoogle,
        handleResetPasswordSuccess,
        logout,
        refreshWorkspaces,
        switchWorkspace,
        setCurrentWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
