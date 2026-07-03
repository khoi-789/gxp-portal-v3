'use client';

import React, { useState, useMemo } from 'react';
import { 
  Table, Card, Radio, Avatar, Input, Tag, Tabs, Button, message, Tooltip, 
  Select, Space, Row, Col, Divider, Switch, Popconfirm
} from 'antd';
import { 
  Users, ShieldAlert, Search, CheckCircle, XCircle, ArrowRight, UserPlus, 
  Settings, Key, Layers, Database, Lock, Unlock, Mail, FolderHeart 
} from 'lucide-react';

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
}

const INITIAL_USERS: MockUser[] = [
  {
    id: 'usr-00001-admin-qa',
    full_name: 'Nguyễn Quản Trị',
    email: 'admin@gxpportal.com',
    department_code: 'QA',
    system_role: 'admin',
    avatar_color: '#0d9488',
    status: 'active'
  },
  {
    id: 'usr-00002-staff-kho',
    full_name: 'Trần Kho Hàng',
    email: 'kho.nhanvien@company.com',
    department_code: 'KHO',
    system_role: 'staff',
    avatar_color: '#581c87',
    status: 'active'
  },
  {
    id: 'usr-00003-viewer',
    full_name: 'Phạm Người Xem',
    email: 'viewer.doc@company.com',
    department_code: 'DEV',
    system_role: 'viewer',
    avatar_color: '#9d174d',
    status: 'active'
  },
  {
    id: 'usr-00004-import-scm',
    full_name: 'Lê Nhập Khẩu',
    email: 'import.nhanvien@company.com',
    department_code: 'SCM',
    system_role: 'staff',
    avatar_color: '#1e3a8a',
    status: 'active'
  },
  {
    id: 'usr-00005-audit-sup',
    full_name: 'Vũ Giám Sát',
    email: 'audit.supervisor@company.com',
    department_code: 'QA',
    system_role: 'admin',
    avatar_color: '#78350f',
    status: 'active'
  },
  {
    id: 'usr-00006-staff-test',
    full_name: 'Đỗ Nhân Viên',
    email: 'staff.test@company.com',
    department_code: 'KHO',
    system_role: 'staff',
    avatar_color: '#0284c7',
    status: 'inactive'
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

export default function RbacManager() {
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

  // Handle toggle user status
  const handleToggleStatus = (userId: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const nextStatus = u.status === 'active' ? 'inactive' : 'active';
        message.success(`Đã chuyển trạng thái người dùng sang ${nextStatus === 'active' ? 'Hoạt động' : 'Tạm khóa'}`);
        return { ...u, status: nextStatus };
      }
      return u;
    }));
  };

  // Change permission handler
  const handlePermissionChange = (userId: string, moduleKey: string, newRole: 'none' | 'viewer' | 'qa_nk' | 'qa_kho' | 'admin') => {
    setPermissions(prev => {
      const idx = prev.findIndex(p => p.userId === userId && p.moduleKey === moduleKey);
      const targetUser = users.find(u => u.id === userId);
      const targetModule = MODULE_LIST.find(m => m.key === moduleKey);
      
      let nextPerms = [...prev];
      if (idx > -1) {
        nextPerms[idx] = { ...nextPerms[idx], role: newRole };
      } else {
        nextPerms.push({ userId, moduleKey, role: newRole });
      }

      message.success(`Đã cập nhật quyền [${newRole.toUpperCase()}] cho ${targetUser?.full_name} tại phân hệ ${targetModule?.name}`);
      return nextPerms;
    });
  };

  // Get current permission role for user/module
  const getPermissionRole = (userId: string, moduleKey: string): 'none' | 'viewer' | 'qa_nk' | 'qa_kho' | 'admin' => {
    const found = permissions.find(p => p.userId === userId && p.moduleKey === moduleKey);
    return found ? found.role : 'none';
  };

  // Switch to permission configuration for a specific user
  const handleConfigureUser = (userId: string) => {
    setSelectedUserId(userId);
    setActiveSubTab('matrix');
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
          onClick={() => message.info('Tính năng Thêm tài khoản mới (coming soon)')}
        >
          Thêm người dùng
        </Button>
      </div>

      {/* Main Tabs */}
      <Tabs
        activeKey={activeSubTab}
        onChange={setActiveSubTab}
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
              <Row gutter={[16, 0]} style={{ height: 'calc(100vh - 290px)', minHeight: 460 }}>
                {/* Sidebar Users list */}
                <Col span={7} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
                              onClick={() => setSelectedUserId(u.id)}
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

                {/* Right Matrix Config table */}
                <Col span={17} style={{ height: '100%' }}>
                  <div style={{ 
                    background: 'white', 
                    borderRadius: 12, 
                    border: '1px solid #e2e8f0', 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    padding: 12,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}>
                    {/* User profile brief */}
                    <div style={{ 
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', 
                      borderRadius: 10, 
                      padding: '10px 14px', 
                      marginBottom: 12, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 12,
                      border: '1px solid #e2e8f0'
                    }}>
                      <Avatar style={{ backgroundColor: selectedUser.avatar_color, fontSize: 16, fontWeight: 700 }} size="large">
                        {selectedUser.full_name.charAt(0).toUpperCase()}
                      </Avatar>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 750, color: '#1e293b' }}>{selectedUser.full_name}</span>
                          <Tag color="cyan" style={{ fontWeight: 600, fontSize: 10 }}>PB: {selectedUser.department_code}</Tag>
                          <Tag color={selectedUser.system_role === 'admin' ? 'orange' : selectedUser.system_role === 'viewer' ? 'purple' : 'blue'} style={{ fontWeight: 700, fontSize: 10 }}>
                            {selectedUser.system_role.toUpperCase()} (Hệ thống)
                          </Tag>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Mail size={12} /> {selectedUser.email}
                        </div>
                      </div>
                      
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 2 }}>Trạng thái tài khoản</span>
                        <Switch
                          checkedChildren="Đang hoạt động"
                          unCheckedChildren="Tạm khóa"
                          checked={selectedUser.status === 'active'}
                          onChange={() => handleToggleStatus(selectedUser.id)}
                          size="small"
                        />
                      </div>
                    </div>

                    <Divider style={{ margin: '4px 0 10px 0' }} />

                    {/* Permissions Matrix Grid */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, color: '#475569', width: '30%' }}>Phân hệ / Masterdata</th>
                            <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#ef4444', textAlign: 'center', width: '14%' }}>No Access</th>
                            <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#6366f1', textAlign: 'center', width: '14%' }}>Viewer (Xem)</th>
                            <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#0ea5e9', textAlign: 'center', width: '14%' }}>QA Nhập khẩu</th>
                            <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#a855f7', textAlign: 'center', width: '14%' }}>QA Kho</th>
                            <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#f59e0b', textAlign: 'center', width: '14%' }}>Admin (Toàn quyền)</th>
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
                                <td style={{ padding: '10px 10px' }}>
                                  <div style={{ fontWeight: 600, fontSize: 12, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {mod.type === 'Masterdata' ? (
                                      <Database size={13} color="#0d9488" />
                                    ) : (
                                      <Layers size={13} color="#3b82f6" />
                                    )}
                                    {mod.name}
                                  </div>
                                  <span style={{ fontSize: 9, color: '#94a3b8', display: 'block', marginLeft: 19 }}>
                                    Loại tài nguyên: {mod.type}
                                  </span>
                                </td>
                                
                                {/* No Access */}
                                <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                                  <Radio
                                    checked={currentRole === 'none'}
                                    onChange={() => handlePermissionChange(selectedUser.id, mod.key, 'none')}
                                  />
                                </td>
                                
                                {/* Viewer */}
                                <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                                  <Radio
                                    checked={currentRole === 'viewer'}
                                    onChange={() => handlePermissionChange(selectedUser.id, mod.key, 'viewer')}
                                  />
                                </td>
                                
                                {/* QA Nhập khẩu */}
                                <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                                  <Radio
                                    checked={currentRole === 'qa_nk'}
                                    disabled={mod.type === 'Masterdata'} // SCM usually only views masterdata or admin manages it
                                    onChange={() => handlePermissionChange(selectedUser.id, mod.key, 'qa_nk')}
                                  />
                                </td>
                                
                                {/* QA Kho */}
                                <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                                  <Radio
                                    checked={currentRole === 'qa_kho'}
                                    disabled={mod.type === 'Masterdata'}
                                    onChange={() => handlePermissionChange(selectedUser.id, mod.key, 'qa_kho')}
                                  />
                                </td>
                                
                                {/* Admin */}
                                <td style={{ padding: '10px 10px', textAlign: 'center' }}>
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
                minHeight: 460,
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
                            onClick={() => handleToggleStatus(r.id)}
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
                              onConfirm={() => handleToggleStatus(r.id)}
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
    </div>
  );
}
