'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Table, Card, Radio, Avatar, Input, Tag, Tabs, Button, message, Tooltip, 
  Select, Space, Row, Col, Divider, Switch, Popconfirm, Modal
} from 'antd';
import { 
  Users, ShieldAlert, Search, CheckCircle, XCircle, ArrowRight, UserPlus, 
  Settings, Key, Layers, Database, Lock, Unlock, Mail, ShieldCheck, RefreshCw, Save, Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface UserPerm {
  userId: string;
  moduleKey: string;
  role: 'none' | 'viewer' | 'qa_nk' | 'qa_kho' | 'admin';
}

interface MockUser {
  id: string;
  full_name: string;
  email: string;
  department_code: string;
  system_role: 'admin' | 'staff' | 'viewer';
  avatar_color: string;
  status: 'active' | 'inactive';
  username?: string;
  password?: string;
}

const INITIAL_USERS: MockUser[] = [
  {
    id: 'usr-00001-admin-qa',
    full_name: 'Nguyễn Quản Trị',
    email: 'admin@gxpportal.com',
    department_code: 'QA',
    system_role: 'admin',
    avatar_color: '#0d9488',
    status: 'active',
    username: 'admin',
    password: 'Password123!'
  },
  {
    id: 'usr-00002-staff-kho',
    full_name: 'Trần Kho Hàng',
    email: 'kho.nhanvien@company.com',
    department_code: 'KHO',
    system_role: 'staff',
    avatar_color: '#581c87',
    status: 'active',
    username: 'khonv',
    password: 'Password123!'
  },
  {
    id: 'usr-00003-viewer',
    full_name: 'Phạm Người Xem',
    email: 'viewer.doc@company.com',
    department_code: 'DEV',
    system_role: 'viewer',
    avatar_color: '#9d174d',
    status: 'active',
    username: 'viewernv',
    password: 'Password123!'
  },
  {
    id: 'usr-00004-import-scm',
    full_name: 'Lê Nhập Khẩu',
    email: 'import.nhanvien@company.com',
    department_code: 'SCM',
    system_role: 'staff',
    avatar_color: '#1e3a8a',
    status: 'active',
    username: 'importnv',
    password: 'Password123!'
  },
  {
    id: 'usr-00005-audit-sup',
    full_name: 'Vũ Giám Sát',
    email: 'audit.supervisor@company.com',
    department_code: 'QA',
    system_role: 'admin',
    avatar_color: '#78350f',
    status: 'active',
    username: 'auditsup',
    password: 'Password123!'
  },
  {
    id: 'usr-00006-staff-test',
    full_name: 'Đỗ Nhân Viên',
    email: 'staff.test@company.com',
    department_code: 'KHO',
    system_role: 'staff',
    avatar_color: '#0284c7',
    status: 'inactive',
    username: 'stafftest',
    password: 'Password123!'
  }
];

const MODULE_LIST = [
  { key: 'imp', name: 'IMP (Nhập khẩu / Invoice)', type: 'Module' },
  { key: 'bbsc', name: 'BBSC (Báo cáo sự cố)', type: 'Module' },
  { key: 'cc', name: 'CC (Khiếu nại chất lượng)', type: 'Module' },
  { key: 'lbl', name: 'LBL (Nhãn phụ & COA)', type: 'Module' },
  { key: 'ldg', name: 'LDG (Lệnh đóng gói)', type: 'Module' },
  { key: 'master-items', name: 'Master Items (Sản phẩm)', type: 'Masterdata' },
  { key: 'master-suppliers', name: 'Master Suppliers (Nhà cung cấp)', type: 'Masterdata' },
  { key: 'master-label-mappings', name: 'Master Links (Liên kết nhãn)', type: 'Masterdata' }
];

const INITIAL_PERMISSIONS: UserPerm[] = [
  // Nguyễn Quản Trị (Admin)
  { userId: 'usr-00001-admin-qa', moduleKey: 'imp', role: 'admin' },
  { userId: 'usr-00001-admin-qa', moduleKey: 'bbsc', role: 'admin' },
  { userId: 'usr-00001-admin-qa', moduleKey: 'cc', role: 'admin' },
  { userId: 'usr-00001-admin-qa', moduleKey: 'lbl', role: 'admin' },
  { userId: 'usr-00001-admin-qa', moduleKey: 'ldg', role: 'admin' },
  { userId: 'usr-00001-admin-qa', moduleKey: 'master-items', role: 'admin' },
  { userId: 'usr-00001-admin-qa', moduleKey: 'master-suppliers', role: 'admin' },
  { userId: 'usr-00001-admin-qa', moduleKey: 'master-label-mappings', role: 'admin' },

  // Trần Kho Hàng (QA Kho)
  { userId: 'usr-00002-staff-kho', moduleKey: 'imp', role: 'qa_kho' },
  { userId: 'usr-00002-staff-kho', moduleKey: 'bbsc', role: 'qa_kho' },
  { userId: 'usr-00002-staff-kho', moduleKey: 'cc', role: 'viewer' },
  { userId: 'usr-00002-staff-kho', moduleKey: 'lbl', role: 'qa_kho' },
  { userId: 'usr-00002-staff-kho', moduleKey: 'ldg', role: 'qa_kho' },
  { userId: 'usr-00002-staff-kho', moduleKey: 'master-items', role: 'viewer' },
  { userId: 'usr-00002-staff-kho', moduleKey: 'master-suppliers', role: 'viewer' },
  { userId: 'usr-00002-staff-kho', moduleKey: 'master-label-mappings', role: 'viewer' },

  // Phạm Người Xem (Viewer)
  { userId: 'usr-00003-viewer', moduleKey: 'imp', role: 'viewer' },
  { userId: 'usr-00003-viewer', moduleKey: 'bbsc', role: 'viewer' },
  { userId: 'usr-00003-viewer', moduleKey: 'cc', role: 'viewer' },
  { userId: 'usr-00003-viewer', moduleKey: 'lbl', role: 'viewer' },
  { userId: 'usr-00003-viewer', moduleKey: 'ldg', role: 'viewer' },
  { userId: 'usr-00003-viewer', moduleKey: 'master-items', role: 'viewer' },
  { userId: 'usr-00003-viewer', moduleKey: 'master-suppliers', role: 'viewer' },
  { userId: 'usr-00003-viewer', moduleKey: 'master-label-mappings', role: 'viewer' },

  // Lê Nhập Khẩu (SCM QA NK)
  { userId: 'usr-00004-import-scm', moduleKey: 'imp', role: 'qa_nk' },
  { userId: 'usr-00004-import-scm', moduleKey: 'bbsc', role: 'viewer' },
  { userId: 'usr-00004-import-scm', moduleKey: 'cc', role: 'qa_nk' },
  { userId: 'usr-00004-import-scm', moduleKey: 'lbl', role: 'qa_nk' },
  { userId: 'usr-00004-import-scm', moduleKey: 'ldg', role: 'viewer' },
  { userId: 'usr-00004-import-scm', moduleKey: 'master-items', role: 'viewer' },
  { userId: 'usr-00004-import-scm', moduleKey: 'master-suppliers', role: 'viewer' },
  { userId: 'usr-00004-import-scm', moduleKey: 'master-label-mappings', role: 'viewer' },

  // Vũ Giám Sát (Admin)
  { userId: 'usr-00005-audit-sup', moduleKey: 'imp', role: 'admin' },
  { userId: 'usr-00005-audit-sup', moduleKey: 'bbsc', role: 'admin' },
  { userId: 'usr-00005-audit-sup', moduleKey: 'cc', role: 'admin' },
  { userId: 'usr-00005-audit-sup', moduleKey: 'lbl', role: 'admin' },
  { userId: 'usr-00005-audit-sup', moduleKey: 'ldg', role: 'admin' },
  { userId: 'usr-00005-audit-sup', moduleKey: 'master-items', role: 'admin' },
  { userId: 'usr-00005-audit-sup', moduleKey: 'master-suppliers', role: 'admin' },
  { userId: 'usr-00005-audit-sup', moduleKey: 'master-label-mappings', role: 'admin' }
];

export default function RbacManager({ onDirtyChange }: { onDirtyChange?: (isDirty: boolean) => void }) {
  const [activeSubTab, setActiveSubTab] = useState<string>('matrix');
  const [users, setUsers] = useState<MockUser[]>(INITIAL_USERS);
  const [permissions, setPermissions] = useState<UserPerm[]>(INITIAL_PERMISSIONS);
  const [selectedUserId, setSelectedUserId] = useState<string>('usr-00001-admin-qa');
  const [userSearchText, setUserSearchText] = useState<string>('');
  const [matrixSearchText, setMatrixSearchText] = useState<string>('');

  // Find currently selected user object
  const selectedUser = useMemo(() => {
    return users.find(u => u.id === selectedUserId) || users[0];
  }, [users, selectedUserId]);

  // Edit State copies
  const [editUserForm, setEditUserForm] = useState<MockUser | null>(null);
  const [editPermissions, setEditPermissions] = useState<UserPerm[]>([]);
  const [passwordInput, setPasswordInput] = useState<string>('');

  // Add User Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [addFormName, setAddFormName] = useState('');
  const [addFormUsername, setAddFormUsername] = useState('');
  const [addFormEmail, setAddFormEmail] = useState('');
  const [addFormDept, setAddFormDept] = useState('QA');
  const [addFormRole, setAddFormRole] = useState<'admin' | 'staff' | 'viewer'>('staff');
  const [addFormPassword, setAddFormPassword] = useState('');

  // Load initial data from DB or LocalStorage
  useEffect(() => {
    async function loadData() {
      try {
        const { data: dbUsers, error: usersErr } = await supabase
          .from('rbac_users')
          .select('*')
          .order('created_at', { ascending: true });

        const { data: dbPerms, error: permsErr } = await supabase
          .from('rbac_permissions')
          .select('*');

        if (!usersErr && dbUsers && dbUsers.length > 0) {
          setUsers(dbUsers.map(u => ({
            id: u.id,
            full_name: u.full_name,
            email: u.email,
            department_code: u.department_code,
            system_role: u.system_role as any,
            avatar_color: u.avatar_color,
            status: u.status as any,
            username: u.username,
            password: u.password
          })));

          if (!permsErr && dbPerms) {
            setPermissions(dbPerms.map(p => ({
              userId: p.user_id,
              moduleKey: p.module_key,
              role: p.role as any
            })));
          }
          console.log('Loaded RBAC data from Supabase successfully.');
          return;
        }
      } catch (err) {
        console.warn('Supabase not fully configured or tables missing. Falling back to LocalStorage.', err);
      }

      // Fallback: load from LocalStorage
      if (typeof window !== 'undefined') {
        const localUsers = localStorage.getItem('rbac_users');
        const localPerms = localStorage.getItem('rbac_permissions');

        if (localUsers) {
          try {
            setUsers(JSON.parse(localUsers));
          } catch (e) {}
        }
        if (localPerms) {
          try {
            setPermissions(JSON.parse(localPerms));
          } catch (e) {}
        }
      }
    }

    loadData();
  }, []);

  // Hydrate edit states when selected user changes
  useEffect(() => {
    if (selectedUser) {
      setEditUserForm({
        ...selectedUser,
        username: selectedUser.username || selectedUser.email.split('@')[0],
        password: selectedUser.password || '********',
      });
      // Copy current permissions for this user
      const userPerms = permissions.filter(p => p.userId === selectedUser.id);
      setEditPermissions(userPerms);
      setPasswordInput('');
    }
  }, [selectedUser, permissions]);

  // Compute dirty state
  const isDirty = useMemo(() => {
    if (!editUserForm || !selectedUser) return false;
    
    // Check if user info changed
    const infoChanged = 
      editUserForm.full_name !== selectedUser.full_name ||
      editUserForm.email !== selectedUser.email ||
      editUserForm.department_code !== selectedUser.department_code ||
      editUserForm.system_role !== selectedUser.system_role ||
      editUserForm.status !== selectedUser.status ||
      (editUserForm.username && editUserForm.username !== (selectedUser.username || selectedUser.email.split('@')[0])) ||
      (passwordInput !== '');

    if (infoChanged) return true;

    // Check if permissions changed
    for (const mod of MODULE_LIST) {
      const originalRole = permissions.find(p => p.userId === selectedUser.id && p.moduleKey === mod.key)?.role || 'none';
      const editingRole = editPermissions.find(p => p.userId === selectedUser.id && p.moduleKey === mod.key)?.role || 'none';
      if (originalRole !== editingRole) {
        return true;
      }
    }

    return false;
  }, [editUserForm, selectedUser, editPermissions, permissions, passwordInput]);

  // Report dirty state to parent
  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  // Filtered users in sidebar list
  const filteredSidebarUsers = useMemo(() => {
    return users.filter(u => 
      u.full_name.toLowerCase().includes(userSearchText.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchText.toLowerCase()) ||
      u.department_code.toLowerCase().includes(userSearchText.toLowerCase())
    );
  }, [users, userSearchText]);

  // Filtered users in main list tab
  const filteredUsersList = useMemo(() => {
    return users.filter(u => 
      u.full_name.toLowerCase().includes(matrixSearchText.toLowerCase()) ||
      u.email.toLowerCase().includes(matrixSearchText.toLowerCase()) ||
      u.department_code.toLowerCase().includes(matrixSearchText.toLowerCase())
    );
  }, [users, matrixSearchText]);

  // Handle select sidebar user with dirty warning
  const handleSelectUser = (nextUserId: string) => {
    if (isDirty) {
      Modal.confirm({
        title: 'Xác nhận rời khỏi',
        content: `Bạn đang có thay đổi chưa lưu cho người dùng [${selectedUser?.full_name}]. Bạn có chắc chắn muốn rời đi và hủy các thay đổi này?`,
        okText: 'Đồng ý',
        cancelText: 'Hủy',
        okButtonProps: { danger: true },
        onOk: () => {
          setSelectedUserId(nextUserId);
        }
      });
    } else {
      setSelectedUserId(nextUserId);
    }
  };

  // Handle sub-tab change with dirty warning
  const handleSubTabChange = (key: string) => {
    if (isDirty && key !== activeSubTab) {
      Modal.confirm({
        title: 'Xác nhận rời khỏi',
        content: `Bạn đang có thay đổi chưa lưu cho người dùng [${selectedUser?.full_name}]. Bạn có chắc chắn muốn chuyển tab và hủy các thay đổi này?`,
        okText: 'Đồng ý',
        cancelText: 'Hủy',
        okButtonProps: { danger: true },
        onOk: () => {
          setActiveSubTab(key);
        }
      });
    } else {
      setActiveSubTab(key);
    }
  };

  // Save changes
  const handleSaveAll = async () => {
    if (!editUserForm) return;

    if (!editUserForm.full_name.trim()) {
      message.error('Họ tên không được để trống!');
      return;
    }
    if (!editUserForm.email.trim()) {
      message.error('Email không được để trống!');
      return;
    }
    if (editUserForm.username && !editUserForm.username.trim()) {
      message.error('Tên đăng nhập không được để trống!');
      return;
    }

    const updatedUser = {
      ...editUserForm,
      password: passwordInput ? passwordInput : editUserForm.password,
    };

    // 1. Update React State
    const nextUsers = users.map(u => (u.id === selectedUserId ? updatedUser : u));
    setUsers(nextUsers);

    const nextPermissions = [
      ...permissions.filter(p => p.userId !== selectedUserId),
      ...editPermissions
    ];
    setPermissions(nextPermissions);

    // 2. Persist to LocalStorage (Always acts as cache/fallback)
    if (typeof window !== 'undefined') {
      localStorage.setItem('rbac_users', JSON.stringify(nextUsers));
      localStorage.setItem('rbac_permissions', JSON.stringify(nextPermissions));
    }

    // 3. Persist to Supabase
    try {
      const { error: userErr } = await supabase
        .from('rbac_users')
        .upsert({
          id: updatedUser.id,
          full_name: updatedUser.full_name,
          email: updatedUser.email,
          department_code: updatedUser.department_code,
          system_role: updatedUser.system_role,
          avatar_color: updatedUser.avatar_color,
          status: updatedUser.status,
          username: updatedUser.username,
          password: updatedUser.password
        });

      if (!userErr) {
        // Delete current permission rows for this user
        await supabase
          .from('rbac_permissions')
          .delete()
          .eq('user_id', selectedUserId);

        // Insert new permission rows
        const dbPermsPayload = editPermissions.map(p => ({
          user_id: p.userId,
          module_key: p.moduleKey,
          role: p.role
        }));

        if (dbPermsPayload.length > 0) {
          await supabase
            .from('rbac_permissions')
            .insert(dbPermsPayload);
        }
      }
    } catch (dbErr) {
      console.error('Failed to sync changes to Supabase:', dbErr);
    }

    setPasswordInput('');
    message.success(`Đã lưu toàn bộ thay đổi cho người dùng ${editUserForm.full_name} thành công!`);
  };

  // Revert/Discard changes
  const handleDiscardChanges = () => {
    if (selectedUser) {
      setEditUserForm({
        ...selectedUser,
        username: selectedUser.username || selectedUser.email.split('@')[0],
        password: selectedUser.password || '********',
      });
      const userPerms = permissions.filter(p => p.userId === selectedUser.id);
      setEditPermissions(userPerms);
      setPasswordInput('');
      message.info('Đã hủy bỏ toàn bộ các thay đổi chưa lưu.');
    }
  };

  // Quick Password Generator
  const handleGenerateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#';
    let newPass = 'GxP-';
    for (let i = 0; i < 8; i++) {
      newPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPasswordInput(newPass);
    message.success(`Đã tạo mật khẩu tạm thời mới: ${newPass}. Bấm "Lưu thay đổi" ở dưới để xác nhận!`);
  };

  // Toggle user status in form
  const handleToggleFormStatus = (checked: boolean) => {
    if (editUserForm) {
      setEditUserForm({
        ...editUserForm,
        status: checked ? 'active' : 'inactive'
      });
    }
  };

  // Form field update helper
  const updateFormKey = (key: keyof MockUser, val: any) => {
    if (editUserForm) {
      setEditUserForm({
        ...editUserForm,
        [key]: val
      });
    }
  };

  // Change permission handler in edit state
  const handlePermissionChange = (userId: string, moduleKey: string, newRole: 'none' | 'viewer' | 'qa_nk' | 'qa_kho' | 'admin') => {
    setEditPermissions(prev => {
      const idx = prev.findIndex(p => p.userId === userId && p.moduleKey === moduleKey);
      let nextPerms = [...prev];
      if (idx > -1) {
        nextPerms[idx] = { ...nextPerms[idx], role: newRole };
      } else {
        nextPerms.push({ userId, moduleKey, role: newRole });
      }
      return nextPerms;
    });
  };

  // Get current permission role in editing copy
  const getPermissionRole = (userId: string, moduleKey: string): 'none' | 'viewer' | 'qa_nk' | 'qa_kho' | 'admin' => {
    const found = editPermissions.find(p => p.userId === userId && p.moduleKey === moduleKey);
    return found ? found.role : 'none';
  };

  // Switch to permission configuration for a specific user from list tab
  const handleConfigureUser = (userId: string) => {
    setSelectedUserId(userId);
    setActiveSubTab('matrix');
  };

  // Table list lock/unlock status toggler
  const handleToggleListStatus = async (userId: string) => {
    if (isDirty && userId === selectedUserId) {
      message.warning('Vui lòng lưu hoặc hủy thay đổi hiện tại trước khi đổi trạng thái!');
      return;
    }
    
    let targetUser: MockUser | undefined;
    const nextUsers = users.map(u => {
      if (u.id === userId) {
        const nextStatus = u.status === 'active' ? 'inactive' : 'active';
        targetUser = { ...u, status: nextStatus };
        return targetUser;
      }
      return u;
    });

    if (!targetUser) return;

    setUsers(nextUsers);
    
    // Save to LocalStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('rbac_users', JSON.stringify(nextUsers));
    }

    // Save to Supabase
    try {
      await supabase
        .from('rbac_users')
        .update({ status: targetUser.status })
        .eq('id', userId);
    } catch (err) {}

    message.success(`Đã chuyển trạng thái người dùng sang ${targetUser.status === 'active' ? 'Hoạt động' : 'Tạm khóa'}`);
  };

  // Open Add User Modal with dirty check
  const handleOpenAddUser = () => {
    if (isDirty) {
      Modal.confirm({
        title: 'Cấu hình chưa lưu',
        content: `Bạn đang có thay đổi chưa lưu cho người dùng [${selectedUser?.full_name}]. Vui lòng lưu hoặc hủy bỏ thay đổi trước khi thêm người dùng mới.`,
        okText: 'Hiểu rồi',
        cancelButtonProps: { style: { display: 'none' } }
      });
      return;
    }
    
    // Reset form states
    setAddFormName('');
    setAddFormUsername('');
    setAddFormEmail('');
    setAddFormDept('QA');
    setAddFormRole('staff');
    setAddFormPassword('');
    setIsAddUserModalOpen(true);
  };

  // Convert name to initials/abbreviation for username and email suggestions
  const handleAddNameChange = (val: string) => {
    setAddFormName(val);
    const clean = val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9 ]/g, '');
    const parts = clean.split(' ').filter(Boolean);
    if (parts.length > 0) {
      const firstName = parts[parts.length - 1];
      const initials = parts.slice(0, parts.length - 1).map(p => p.charAt(0)).join('');
      const suggestedUsername = firstName + initials;
      
      setAddFormUsername(suggestedUsername);
      setAddFormEmail(`${suggestedUsername}@gxpportal.com`);
    }
  };

  // Generate random password for the Modal
  const handleGenerateAddPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#';
    let newPass = 'GxP-';
    for (let i = 0; i < 8; i++) {
      newPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAddFormPassword(newPass);
  };

  // Submit new user
  const handleAddUserSubmit = async () => {
    if (!addFormName.trim()) {
      message.error('Họ tên không được để trống!');
      return;
    }
    if (!addFormUsername.trim()) {
      message.error('Tên đăng nhập không được để trống!');
      return;
    }
    if (!addFormEmail.trim()) {
      message.error('Email không được để trống!');
      return;
    }
    
    // Check duplication
    if (users.some(u => u.username?.toLowerCase() === addFormUsername.trim().toLowerCase())) {
      message.error('Tên đăng nhập đã tồn tại!');
      return;
    }
    if (users.some(u => u.email.toLowerCase() === addFormEmail.trim().toLowerCase())) {
      message.error('Email đã tồn tại!');
      return;
    }

    const newId = `usr-${Math.random().toString(36).substr(2, 9)}`;
    const colors = ['#0d9488', '#581c87', '#9d174d', '#1e3a8a', '#78350f', '#0284c7', '#b91c1c', '#15803d'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newUser: MockUser = {
      id: newId,
      full_name: addFormName.trim(),
      email: addFormEmail.trim(),
      department_code: addFormDept,
      system_role: addFormRole,
      avatar_color: randomColor,
      status: 'active',
      username: addFormUsername.trim(),
      password: addFormPassword.trim() || 'Password123!',
    };

    // Add user to state
    const nextUsers = [...users, newUser];
    setUsers(nextUsers);

    // Initialize default permissions (none/viewer/admin based on role)
    const newPerms: UserPerm[] = MODULE_LIST.map(m => ({
      userId: newId,
      moduleKey: m.key,
      role: addFormRole === 'admin' ? 'admin' : addFormRole === 'viewer' ? 'viewer' : 'none'
    }));
    const nextPermissions = [...permissions, ...newPerms];
    setPermissions(nextPermissions);

    // 1. Save to LocalStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('rbac_users', JSON.stringify(nextUsers));
      localStorage.setItem('rbac_permissions', JSON.stringify(nextPermissions));
    }

    // 2. Save to Supabase
    try {
      const { error: userErr } = await supabase
        .from('rbac_users')
        .insert({
          id: newUser.id,
          full_name: newUser.full_name,
          email: newUser.email,
          department_code: newUser.department_code,
          system_role: newUser.system_role,
          avatar_color: newUser.avatar_color,
          status: newUser.status,
          username: newUser.username,
          password: newUser.password
        });

      if (!userErr) {
        const dbPermsPayload = newPerms.map(p => ({
          user_id: p.userId,
          module_key: p.moduleKey,
          role: p.role
        }));
        await supabase
          .from('rbac_permissions')
          .insert(dbPermsPayload);
      }
    } catch (err) {
      console.error('Failed to sync new user to Supabase:', err);
    }

    // Navigate to new user
    setSelectedUserId(newId);
    setIsAddUserModalOpen(false);
    message.success(`Đã thêm người dùng ${newUser.full_name} thành công!`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '4px 0' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 2px 0', fontSize: 16, fontWeight: 750, color: '#0f766e', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Key size={18} color="#0d9488" /> Quản Lý Phân Quyền Vai Trò (RBAC)
          </h2>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            Phân quyền chi tiết (Viewer, QA Nhập khẩu, QA Kho, Admin) cho từng người dùng theo từng Module và Masterdata.
          </span>
        </div>
        <Button 
          type="primary" 
          icon={<UserPlus size={14} />} 
          style={{ background: '#0d9488', borderColor: '#0d9488', borderRadius: 8, height: 32, fontSize: 12 }}
          onClick={handleOpenAddUser}
        >
          Thêm người dùng
        </Button>
      </div>

      {/* Main Tabs */}
      <Tabs
        activeKey={activeSubTab}
        onChange={handleSubTabChange}
        type="line"
        size="middle"
        items={[
          {
            key: 'matrix',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Layers size={14} /> Matrix Phân Quyền
              </span>
            ),
            children: (
              <Row gutter={[16, 0]} style={{ height: 'calc(100vh - 290px)', minHeight: 490 }}>
                {/* Sidebar Users list */}
                <Col span={6} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ 
                    background: 'white', 
                    borderRadius: 12, 
                    border: '1px solid #e2e8f0', 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    padding: 10,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}>
                    <Input
                      placeholder="Tìm kiếm tài khoản..."
                      prefix={<Search size={14} color="#64748b" />}
                      value={userSearchText}
                      onChange={(e) => setUserSearchText(e.target.value)}
                      style={{ marginBottom: 10, borderRadius: 6 }}
                      size="small"
                      allowClear
                    />
                    
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {filteredSidebarUsers.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 12 }}>
                          Không tìm thấy tài khoản
                        </div>
                      ) : (
                        filteredSidebarUsers.map(u => {
                          const isSelected = u.id === selectedUserId;
                          return (
                            <div
                              key={u.id}
                              onClick={() => handleSelectUser(u.id)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: 8,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                background: isSelected ? 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)' : 'transparent',
                                border: isSelected ? '1px solid #5dbeb4' : '1px solid transparent',
                                transition: 'all 0.15s ease',
                              }}
                              className="user-sidebar-item"
                            >
                              <Avatar style={{ backgroundColor: u.avatar_color, fontSize: 12, fontWeight: 700 }} size="small">
                                {u.full_name.charAt(0).toUpperCase()}
                              </Avatar>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: 12, fontWeight: isSelected ? 700 : 600, color: isSelected ? '#0f766e' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {u.full_name}
                                  </span>
                                  <Tag color={u.status === 'active' ? 'success' : 'error'} style={{ fontSize: 9, lineHeight: '14px', height: 16, padding: '0 4px', margin: 0, scale: '0.85', transformOrigin: 'right' }}>
                                    {u.status === 'active' ? 'Active' : 'Locked'}
                                  </Tag>
                                </div>
                                <div style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </Col>

                {/* Right Config Form + Matrix table */}
                <Col span={18} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ 
                    background: 'white', 
                    borderRadius: 12, 
                    border: '1px solid #e2e8f0', 
                    flex: 1,
                    display: 'flex', 
                    flexDirection: 'column',
                    padding: 12,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    overflow: 'hidden'
                  }}>
                    {/* User profile brief & EDITING FORM */}
                    {editUserForm && (
                      <div style={{ 
                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', 
                        borderRadius: 10, 
                        padding: '10px 14px', 
                        marginBottom: 12, 
                        border: '1px solid #e2e8f0',
                        flexShrink: 0
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <Avatar style={{ backgroundColor: selectedUser.avatar_color, fontSize: 14, fontWeight: 700 }} size="small">
                            {selectedUser.full_name.charAt(0).toUpperCase()}
                          </Avatar>
                          <span style={{ fontSize: 13, fontWeight: 750, color: '#334155' }}>
                            Thông tin tài khoản: <strong style={{ color: '#0f766e' }}>{selectedUser.full_name}</strong>
                          </span>
                          <span style={{ marginLeft: 'auto' }}>
                            <span style={{ fontSize: 11, color: '#64748b', marginRight: 6 }}>Trạng thái hoạt động:</span>
                            <Switch
                              checkedChildren="Active"
                              unCheckedChildren="Locked"
                              checked={editUserForm.status === 'active'}
                              onChange={handleToggleFormStatus}
                              size="small"
                            />
                          </span>
                        </div>

                        {/* Config Form Fields */}
                        <Row gutter={[10, 8]}>
                          {/* Full Name */}
                          <Col span={6}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', marginBottom: 2 }}>Họ và tên *</div>
                            <Input
                              value={editUserForm.full_name}
                              onChange={(e) => updateFormKey('full_name', e.target.value)}
                              size="small"
                              style={{ borderRadius: 6 }}
                              placeholder="Họ tên hiển thị..."
                            />
                          </Col>

                          {/* Username */}
                          <Col span={6}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', marginBottom: 2 }}>Tên đăng nhập *</div>
                            <Input
                              value={editUserForm.username}
                              onChange={(e) => updateFormKey('username', e.target.value)}
                              size="small"
                              style={{ borderRadius: 6 }}
                              placeholder="Tên đăng nhập..."
                            />
                          </Col>

                          {/* Email */}
                          <Col span={6}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', marginBottom: 2 }}>Email (Mail) *</div>
                            <Input
                              value={editUserForm.email}
                              onChange={(e) => updateFormKey('email', e.target.value)}
                              size="small"
                              style={{ borderRadius: 6 }}
                              placeholder="Địa chỉ email..."
                            />
                          </Col>

                          {/* Department select */}
                          <Col span={6}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', marginBottom: 2 }}>Phòng ban</div>
                            <Select
                              value={editUserForm.department_code}
                              onChange={(val) => updateFormKey('department_code', val)}
                              size="small"
                              style={{ width: '100%' }}
                              options={[
                                { value: 'QA', label: 'QA (Đảm bảo CL)' },
                                { value: 'KHO', label: 'KHO (Kho vận)' },
                                { value: 'SCM', label: 'SCM (Chuỗi cung ứng)' },
                                { value: 'DEV', label: 'DEV (Kỹ thuật/IT)' }
                              ]}
                            />
                          </Col>

                          {/* System role select */}
                          <Col span={10}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', marginBottom: 2 }}>Vai trò hệ thống</div>
                            <Select
                              value={editUserForm.system_role}
                              onChange={(val) => updateFormKey('system_role', val)}
                              size="small"
                              style={{ width: '100%' }}
                              options={[
                                { value: 'admin', label: 'ADMIN (Quản trị viên)' },
                                { value: 'staff', label: 'STAFF (Nhân viên vận hành)' },
                                { value: 'viewer', label: 'VIEWER (Người xem thông tin)' }
                              ]}
                            />
                          </Col>

                          {/* Password Reset Section */}
                          <Col span={14}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', marginBottom: 2 }}>Cấp mật khẩu mới</div>
                            <Space.Compact style={{ width: '100%' }}>
                              <Input.Password
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                size="small"
                                style={{ borderRadius: '6px 0 0 6px' }}
                                placeholder="Nhập mật khẩu mới hoặc bấm cấp ngẫu nhiên..."
                              />
                              <Button
                                size="small"
                                icon={<RefreshCw size={12} />}
                                onClick={handleGenerateRandomPassword}
                                style={{ borderRadius: '0 6px 6px 0', borderLeft: 0 }}
                              >
                                Cấp ngẫu nhiên
                              </Button>
                            </Space.Compact>
                          </Col>
                        </Row>
                      </div>
                    )}

                    {/* Permissions Matrix Grid */}
                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: 8, padding: 2 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
                            <th style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#475569', width: '32%' }}>Phân hệ / Masterdata</th>
                            <th style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#ef4444', textAlign: 'center', width: '13%' }}>No Access</th>
                            <th style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#6366f1', textAlign: 'center', width: '13%' }}>Viewer (Xem)</th>
                            <th style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#0ea5e9', textAlign: 'center', width: '14%' }}>QA Nhập khẩu</th>
                            <th style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#a855f7', textAlign: 'center', width: '14%' }}>QA Kho</th>
                            <th style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#f59e0b', textAlign: 'center', width: '14%' }}>Admin (Toàn quyền)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MODULE_LIST.map((mod, index) => {
                            const currentRole = getPermissionRole(selectedUser.id, mod.key);
                            return (
                              <tr 
                                key={mod.key} 
                                style={{ 
                                  borderBottom: '1px solid #f1f5f9',
                                  background: index % 2 === 1 ? '#fafafa' : 'transparent',
                                  transition: 'background 0.1s'
                                }}
                                className="rbac-row-hover"
                              >
                                <td style={{ padding: '6px 10px' }}>
                                  <div style={{ fontWeight: 600, fontSize: 11, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {mod.type === 'Masterdata' ? (
                                      <Database size={12} color="#0d9488" />
                                    ) : (
                                      <Layers size={12} color="#3b82f6" />
                                    )}
                                    {mod.name}
                                  </div>
                                </td>
                                
                                {/* No Access */}
                                <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                  <Radio
                                    checked={currentRole === 'none'}
                                    onChange={() => handlePermissionChange(selectedUser.id, mod.key, 'none')}
                                  />
                                </td>
                                
                                {/* Viewer */}
                                <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                  <Radio
                                    checked={currentRole === 'viewer'}
                                    onChange={() => handlePermissionChange(selectedUser.id, mod.key, 'viewer')}
                                  />
                                </td>
                                
                                {/* QA Nhập khẩu */}
                                <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                  <Radio
                                    checked={currentRole === 'qa_nk'}
                                    disabled={mod.type === 'Masterdata'}
                                    onChange={() => handlePermissionChange(selectedUser.id, mod.key, 'qa_nk')}
                                  />
                                </td>
                                
                                {/* QA Kho */}
                                <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                  <Radio
                                    checked={currentRole === 'qa_kho'}
                                    disabled={mod.type === 'Masterdata'}
                                    onChange={() => handlePermissionChange(selectedUser.id, mod.key, 'qa_kho')}
                                  />
                                </td>
                                
                                {/* Admin */}
                                <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                  <Radio
                                    checked={currentRole === 'admin'}
                                    onChange={() => handlePermissionChange(selectedUser.id, mod.key, 'admin')}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Bottom Save & Cancel Sticky Footer */}
                    <div style={{ 
                      marginTop: 8, 
                      padding: '8px 12px 2px 12px', 
                      background: '#f8fafc', 
                      borderRadius: 10, 
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexShrink: 0
                    }}>
                      <div>
                        {isDirty ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 4 }}>
                            ⚠️ Có thay đổi chưa lưu cho {editUserForm?.full_name}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#15803d', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={13} /> Đã lưu tất cả thay đổi
                          </span>
                        )}
                      </div>
                      <Space>
                        <Button 
                          size="small" 
                          onClick={handleDiscardChanges} 
                          disabled={!isDirty}
                          style={{ borderRadius: 6 }}
                        >
                          Hủy thay đổi
                        </Button>
                        <Button 
                          type="primary" 
                          size="small" 
                          icon={<Save size={13} />}
                          onClick={handleSaveAll}
                          disabled={!isDirty}
                          style={{ background: isDirty ? '#0d9488' : '#e2e8f0', borderColor: isDirty ? '#0d9488' : '#e2e8f0', borderRadius: 6 }}
                        >
                          Lưu thay đổi
                        </Button>
                      </Space>
                    </div>

                  </div>
                </Col>
              </Row>
            ),
          },
          {
            key: 'list',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Users size={14} /> Danh sách người dùng
              </span>
            ),
            children: (
              <div style={{ 
                background: 'white', 
                borderRadius: 12, 
                border: '1px solid #e2e8f0', 
                padding: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                height: 'calc(100vh - 290px)',
                minHeight: 490,
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'flex-end' }}>
                  <Input
                    placeholder="Tìm theo Tên, Email, Phòng ban..."
                    prefix={<Search size={14} color="#64748b" />}
                    value={matrixSearchText}
                    onChange={(e) => setMatrixSearchText(e.target.value)}
                    style={{ width: 280, borderRadius: 6 }}
                    size="small"
                    allowClear
                  />
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <Table
                    dataSource={filteredUsersList}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    className="portal-table"
                    columns={[
                      {
                        title: 'Người dùng',
                        key: 'user',
                        render: (_, r) => (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar style={{ backgroundColor: r.avatar_color, fontSize: 11, fontWeight: 700 }} size="small">
                              {r.full_name.charAt(0).toUpperCase()}
                            </Avatar>
                            <div>
                              <div style={{ fontWeight: 650, fontSize: 12, color: '#1e293b' }}>{r.full_name}</div>
                              <div style={{ fontSize: 10, color: '#64748b' }}>{r.id}</div>
                            </div>
                          </div>
                        )
                      },
                      {
                        title: 'Tên đăng nhập',
                        dataIndex: 'username',
                        key: 'username',
                        render: (text, r) => <span style={{ fontSize: 11, color: '#334155', fontFamily: 'monospace' }}>{text || r.email.split('@')[0]}</span>
                      },
                      {
                        title: 'Email',
                        dataIndex: 'email',
                        key: 'email',
                        render: (text) => <span style={{ fontSize: 11, color: '#334155' }}>{text}</span>
                      },
                      {
                        title: 'Phòng ban',
                        dataIndex: 'department_code',
                        key: 'department',
                        align: 'center',
                        render: (text) => <Tag color="blue" style={{ fontSize: 10, fontWeight: 600 }}>{text}</Tag>
                      },
                      {
                        title: 'Vai trò hệ thống',
                        dataIndex: 'system_role',
                        key: 'role',
                        align: 'center',
                        render: (role) => (
                          <Tag 
                            color={role === 'admin' ? 'orange' : role === 'viewer' ? 'purple' : 'blue'}
                            style={{ fontSize: 10, fontWeight: 700 }}
                          >
                            {role.toUpperCase()}
                          </Tag>
                        )
                      },
                      {
                        title: 'Trạng thái',
                        dataIndex: 'status',
                        key: 'status',
                        align: 'center',
                        render: (status, r) => (
                          <Tag 
                            color={status === 'active' ? 'success' : 'error'} 
                            style={{ 
                              fontSize: 10, 
                              fontWeight: 600, 
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3
                            }}
                            onClick={() => handleToggleListStatus(r.id)}
                          >
                            {status === 'active' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                            {status === 'active' ? 'Hoạt động' : 'Tạm khóa'}
                          </Tag>
                        )
                      },
                      {
                        title: 'Thao tác',
                        key: 'actions',
                        align: 'center',
                        render: (_, r) => (
                          <Space size={6}>
                            <Button 
                              type="text" 
                              size="small" 
                              icon={<Settings size={13} color="#0d9488" />}
                              onClick={() => handleConfigureUser(r.id)}
                            >
                              <span style={{ fontSize: 11, color: '#0d9488', fontWeight: 600 }}>Cấu hình quyền</span>
                            </Button>
                            
                            <Popconfirm
                              title={r.status === 'active' ? 'Khóa tài khoản này?' : 'Mở khóa tài khoản này?'}
                              description={r.status === 'active' ? 'Tài khoản bị khóa sẽ không thể truy cập portal.' : 'Mở khóa để tài khoản tiếp tục sử dụng portal.'}
                              onConfirm={() => handleToggleListStatus(r.id)}
                              okText="Xác nhận"
                              cancelText="Hủy"
                            >
                              <Button
                                type="text"
                                size="small"
                                danger={r.status === 'active'}
                                icon={r.status === 'active' ? <Lock size={13} /> : <Unlock size={13} />}
                              >
                                <span style={{ fontSize: 11, fontWeight: 600 }}>
                                  {r.status === 'active' ? 'Tạm khóa' : 'Mở khóa'}
                                </span>
                              </Button>
                            </Popconfirm>
                          </Space>
                        )
                      }
                    ]}
                  />
                </div>
              </div>
            )
          }
        ]}
      />

      {/* Modal Thêm người dùng mới */}
      <Modal
        title={
          <span style={{ fontSize: 15, fontWeight: 750, color: '#0f766e', display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserPlus size={18} /> Thêm người dùng mới
          </span>
        }
        open={isAddUserModalOpen}
        onCancel={() => setIsAddUserModalOpen(false)}
        onOk={handleAddUserSubmit}
        okText="Thêm mới"
        cancelText="Hủy bỏ"
        okButtonProps={{ style: { background: '#0d9488', borderColor: '#0d9488', borderRadius: 6 } }}
        cancelButtonProps={{ style: { borderRadius: 6 } }}
        width={500}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          {/* Họ tên */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Họ và tên *</div>
            <Input
              placeholder="Nhập họ và tên..."
              value={addFormName}
              onChange={(e) => handleAddNameChange(e.target.value)}
              style={{ borderRadius: 6 }}
            />
          </div>

          <Row gutter={12}>
            {/* Tên đăng nhập */}
            <Col span={12}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Tên đăng nhập *</div>
              <Input
                placeholder="Ví dụ: anhnt..."
                value={addFormUsername}
                onChange={(e) => setAddFormUsername(e.target.value)}
                style={{ borderRadius: 6 }}
              />
            </Col>
            {/* Phòng ban */}
            <Col span={12}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Phòng ban</div>
              <Select
                value={addFormDept}
                onChange={setAddFormDept}
                style={{ width: '100%' }}
                options={[
                  { value: 'QA', label: 'QA (Đảm bảo CL)' },
                  { value: 'KHO', label: 'KHO (Kho vận)' },
                  { value: 'SCM', label: 'SCM (Chuỗi cung ứng)' },
                  { value: 'DEV', label: 'DEV (Kỹ thuật/IT)' }
                ]}
              />
            </Col>
          </Row>

          {/* Email */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Email (Mail) *</div>
            <Input
              placeholder="Ví dụ: anhnt@company.com..."
              value={addFormEmail}
              onChange={(e) => setAddFormEmail(e.target.value)}
              style={{ borderRadius: 6 }}
            />
          </div>

          <Row gutter={12}>
            {/* Vai trò hệ thống */}
            <Col span={12}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Vai trò hệ thống</div>
              <Select
                value={addFormRole}
                onChange={setAddFormRole}
                style={{ width: '100%' }}
                options={[
                  { value: 'admin', label: 'ADMIN (Quản trị)' },
                  { value: 'staff', label: 'STAFF (Nhân viên)' },
                  { value: 'viewer', label: 'VIEWER (Người xem)' }
                ]}
              />
            </Col>
            {/* Mật khẩu khởi tạo */}
            <Col span={12}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Mật khẩu khởi tạo</div>
              <Space.Compact style={{ width: '100%' }}>
                <Input.Password
                  placeholder="Nhập mật khẩu..."
                  value={addFormPassword}
                  onChange={(e) => setAddFormPassword(e.target.value)}
                  style={{ borderRadius: '6px 0 0 6px' }}
                />
                <Button
                  icon={<RefreshCw size={12} />}
                  onClick={handleGenerateAddPassword}
                  style={{ borderRadius: '0 6px 6px 0', borderLeft: 0 }}
                />
              </Space.Compact>
            </Col>
          </Row>
          
          <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic', marginTop: 4 }}>
            * Sau khi tạo, người dùng mới sẽ được mặc định khởi tạo quyền hạn tùy theo Vai trò hệ thống. Bạn có thể thay đổi cụ thể tại bảng Matrix.
          </div>
        </div>
      </Modal>
    </div>
  );
}
