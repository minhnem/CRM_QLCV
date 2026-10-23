import { useState, useEffect, useCallback } from 'react';
import { roleApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';

let permissionsCache = null;

const getSavedPermissions = () => {
  if (permissionsCache) return permissionsCache;
  try {
    const saved = localStorage.getItem('crm_permissions');
    if (saved) {
      permissionsCache = JSON.parse(saved);
      return permissionsCache;
    }
  } catch (e) {
    console.warn('Lỗi đọc crm_permissions từ localStorage:', e);
  }
  return null;
};

export const usePermission = () => {
  const { user, currentWorkspace } = useAuth();
  const [permissionsData, setPermissionsData] = useState(getSavedPermissions);
  const [loading, setLoading] = useState(() => !getSavedPermissions());

  const fetchPermissions = useCallback(async () => {
    if (!user) return;
    try {
      const res = await roleApi.getMyPermissions();
      if (res.data?.success) {
        permissionsCache = res.data;
        setPermissionsData(res.data);
        try {
          localStorage.setItem('crm_permissions', JSON.stringify(res.data));
        } catch (e) {}
      }
    } catch (err) {
      console.error('Lỗi tải ma trận quyền hạn người dùng:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermissions();

    const socket = getSocket();
    if (socket) {
      const handleRoleUpdate = () => {
        fetchPermissions();
      };
      socket.on('role:permissions_updated', handleRoleUpdate);
      return () => {
        socket.off('role:permissions_updated', handleRoleUpdate);
      };
    }
  }, [user?.role, currentWorkspace?._id, fetchPermissions]);

  const isAdmin = user?.role === 'admin' || permissionsData?.isAdmin === true;
  const isManager = isAdmin || user?.role === 'manager' || permissionsData?.isManager === true;

  /**
   * Kiểm tra xem user có quyền thực hiện action trên module không
   * @param {string} resource 'contracts' | 'projects' | 'tasks' | 'departments' | 'team' | 'settings'
   * @param {string} action 'view' | 'create' | 'edit' | 'delete' | 'assign' | 'viewValue'
   */
  const can = (resource, action = 'view') => {
    if (isAdmin) return true;
    if (!permissionsData?.permissions) return false;

    const resPerm = permissionsData.permissions[resource];
    if (!resPerm) return false;

    if (action === 'view') {
      return resPerm.view && resPerm.view !== 'none';
    }
    if (action === 'create') {
      return Boolean(resPerm.create);
    }
    if (action === 'edit') {
      return resPerm.edit && resPerm.edit !== 'none';
    }
    if (action === 'delete') {
      return Boolean(resPerm.delete);
    }
    if (action === 'assign') {
      return Boolean(resPerm.assign);
    }
    if (action === 'viewValue') {
      return resPerm.viewValue !== false;
    }
    return Boolean(resPerm[action]);
  };

  /**
   * Lấy phạm vi quyền hạn ('all' | 'dept' | 'own' | 'none')
   */
  const getScope = (resource, action = 'view') => {
    if (isAdmin) return 'all';
    const resPerm = permissionsData?.permissions?.[resource];
    if (!resPerm) return 'none';
    return resPerm[action] || 'none';
  };

  /**
   * Quyền xem giá trị tiền ($) trong hợp đồng / dự án
   */
  const canViewValue = (resource = 'contracts') => {
    if (isAdmin) return true;
    const resPerm = permissionsData?.permissions?.[resource];
    if (!resPerm) return false;
    return resPerm.viewValue !== false;
  };

  return {
    permissions: permissionsData?.permissions || {},
    role: permissionsData?.role || user?.role || 'member',
    roleName: permissionsData?.roleName || user?.role || 'Thành viên',
    color: permissionsData?.color || '#3b82f6',
    isAdmin,
    isManager,
    can,
    getScope,
    canViewValue,
    loading,
    refreshPermissions: fetchPermissions,
  };
};
