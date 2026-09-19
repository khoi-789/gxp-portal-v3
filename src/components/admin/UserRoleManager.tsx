'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Table, Button, Tag, Avatar, Space, Modal, Form, Input,
  Select, Switch, message, Popconfirm, Tooltip, Divider, Row, Col, Badge
} from 'antd';
import {
  Users, UserPlus, Edit, Trash2, Shield, Key, Search, Mail,
  CheckCircle, XCircle, Star, Building, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface UserAccount {
  id: string;
  username: string;
  full_name: string;
  short_name: string;
  email: string;
  department_code: string;
  system_role: 'admin' | 'staff' | 'viewer';
  is_active: boolean;
  module_roles: {
    module_code: string;
    role_code: 'Viewer' | 'Draft' | 'PIC-1' | 'PIC-2' | 'Admin';
    is_primary_pic: boolean;
  }[];
}

const INITIAL_USERS: UserAccount[] = [
  {
    id: 'usr-admin-01',
    username: 'admin',
    full_name: 'Nguyễn Quản Trị',
    short_name: 'QA-ADMIN',
    email: 'admin@gxpportal.com',
    department_code: 'QA',
    system_role: 'admin',
    is_active: true,
    module_roles: [
      { module_code: 'IMP', role_code: 'Admin', is_primary_pic: true },
    ],
  },
  {
    id: 'usr-pic1-02',
    username: 'lenk',
    full_name: 'Lê Nhập Khẩu (QA VP)',
    short_name: 'QA-NK',
    email: 'nhapkhau@company.com',
    department_code: 'QA',
    system_role: 'staff',
    is_active: true,
    module_roles: [
      { module_code: 'IMP', role_code: 'PIC-1', is_primary_pic: true },
    ],
  },
  {
    id: 'usr-pic2-03',
    username: 'trankho',
    full_name: 'Trần Kho Hàng (QA Nhập)',
    short_name: 'KHO-LH',
    email: 'kho.longhau@company.com',
    department_code: 'KHO',
    system_role: 'staff',
    is_active: true,
    module_roles: [
      { module_code: 'IMP', role_code: 'PIC-2', is_primary_pic: false },
    ],
  },
  {
    id: 'usr-viewer-04',
    username: 'viewer',
    full_name: 'Phạm Người Xem',
    short_name: 'DEV-VIEW',
    email: 'viewer@company.com',
    department_code: 'DEV',
    system_role: 'viewer',
    is_active: true,
    module_roles: [
      { module_code: 'IMP', role_code: 'Viewer', is_primary_pic: false },
    ],
  },
];

export default function UserRoleManager() {
  const [users, setUsers] = useState<UserAccount[]>(INITIAL_USERS);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [form] = Form.useForm();

  // Load from Supabase on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data: dbUsers, error } = await supabase
          .from('master_users')
          .select('*, department:master_departments(department_code, department_name)')
          .order('created_at', { ascending: true });

        if (!error && dbUsers && dbUsers.length > 0) {
          // Fetch module roles
          const { data: rolesData } = await supabase
            .from('user_module_roles')
            .select('*, role:master_roles(role_code)');

          const mapped: UserAccount[] = dbUsers.map((u: any) => {
            const userRoles = (rolesData || [])
              .filter((r: any) => r.user_id === u.id)
              .map((r: any) => ({
                module_code: r.module_code,
                role_code: r.role?.role_code || 'Viewer',
                is_primary_pic: r.is_primary_pic,
              }));

            return {
              id: u.id,
              username: u.username,
              full_name: u.full_name,
              short_name: u.short_name,
              email: u.email,
              department_code: u.department?.department_code || 'QA',
              system_role: u.username === 'admin' ? 'admin' : 'staff',
              is_active: u.is_active ?? true,
              module_roles: userRoles.length > 0 ? userRoles : [
                { module_code: 'IMP', role_code: 'Viewer', is_primary_pic: false }
              ],
            };
          });
          setUsers(mapped);
        }
      } catch (err) {
        console.warn('Cannot load users from master_users, using initial seed:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchText) return users;
    const q = searchText.toLowerCase();
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department_code.toLowerCase().includes(q)
    );
  }, [users, searchText]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({
      department_code: 'QA',
      system_role: 'staff',
      imp_role: 'PIC-1',
      is_primary_pic: false,
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (u: UserAccount) => {
    setEditingUser(u);
    const impRole = u.module_roles.find((r) => r.module_code === 'IMP');
    form.setFieldsValue({
      username: u.username,
      full_name: u.full_name,
      short_name: u.short_name,
      email: u.email,
      department_code: u.department_code,
      system_role: u.system_role,
      imp_role: impRole?.role_code || 'Viewer',
      is_primary_pic: impRole?.is_primary_pic || false,
      is_active: u.is_active,
    });
    setModalOpen(true);
  };

  const handleSaveUser = async () => {
    try {
      const values = await form.validateFields();
      const updatedAccount: UserAccount = {
        id: editingUser ? editingUser.id : `usr-${Date.now()}`,
        username: values.username,
        full_name: values.full_name,
        short_name: values.short_name || values.username.toUpperCase(),
        email: values.email,
        department_code: values.department_code,
        system_role: values.system_role,
        is_active: values.is_active,
        module_roles: [
          {
            module_code: 'IMP',
            role_code: values.imp_role,
            is_primary_pic: values.is_primary_pic,
          },
        ],
      };

      if (editingUser) {
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? updatedAccount : u)));
        message.success('Đã cập nhật thông tin nhân sự thành công!');
      } else {
        setUsers((prev) => [updatedAccount, ...prev]);
        message.success('Đã thêm nhân sự mới thành công!');
      }

      // Try syncing to DB in background
      try {
        await supabase.from('master_users').upsert({
          username: updatedAccount.username,
          full_name: updatedAccount.full_name,
          short_name: updatedAccount.short_name,
          email: updatedAccount.email,
          is_active: updatedAccount.is_active,
        }, { onConflict: 'username' });
      } catch (e) {
        console.warn('Sync master_users background error:', e);
      }

      setModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    message.success('Đã xóa nhân sự khỏi danh sách!');
  };

  const columns = [
    {
      title: 'Nhân sự',
      key: 'user',
      render: (_: any, r: UserAccount) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            style={{
              backgroundColor: r.department_code === 'QA' ? '#0d9488' : r.department_code === 'KHO' ? '#7c3aed' : '#0284c7',
              fontWeight: 700,
            }}
          >
            {r.short_name.substring(0, 2)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 700, color: '#1e293b' }}>
              {r.full_name}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              @{r.username} • {r.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Phòng ban',
      dataIndex: 'department_code',
      key: 'dept',
      width: 120,
      render: (code: string) => (
        <Tag color={code === 'QA' ? 'teal' : code === 'KHO' ? 'purple' : 'blue'} style={{ fontWeight: 600 }}>
          {code}
        </Tag>
      ),
    },
    {
      title: 'Vai trò Hệ thống',
      dataIndex: 'system_role',
      key: 'sys_role',
      width: 140,
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'red' : 'geekblue'} style={{ fontWeight: 600 }}>
          {role.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Phân quyền Module IMP (Nhập khẩu)',
      key: 'imp_role',
      render: (_: any, r: UserAccount) => {
        const imp = r.module_roles.find((m) => m.module_code === 'IMP');
        if (!imp) return <Tag>Chưa phân quyền</Tag>;

        const colorMap: Record<string, string> = {
          'Admin': 'red',
          'PIC-1': 'teal',
          'PIC-2': 'purple',
          'Draft': 'orange',
          'Viewer': 'default',
        };

        return (
          <Space>
            <Tag color={colorMap[imp.role_code] || 'default'} style={{ fontWeight: 700, borderRadius: 6 }}>
              {imp.role_code}
            </Tag>
            {imp.is_primary_pic && (
              <Tag color="gold" icon={<Star size={12} />} style={{ fontWeight: 600 }}>
                Primary PIC
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_active',
      key: 'status',
      width: 120,
      render: (active: boolean) =>
        active ? (
          <Tag color="success" icon={<CheckCircle size={12} />} style={{ fontWeight: 600 }}>
            Hoạt động
          </Tag>
        ) : (
          <Tag color="error" icon={<XCircle size={12} />} style={{ fontWeight: 600 }}>
            Đã khóa
          </Tag>
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_: any, r: UserAccount) => (
        <Space size="small">
          <Tooltip title="Chỉnh sửa thông tin & quyền">
            <Button
              type="text"
              size="small"
              icon={<Edit size={14} color="#0d9488" />}
              onClick={() => handleOpenEdit(r)}
            />
          </Tooltip>
          {r.username !== 'admin' && (
            <Popconfirm
              title="Xác nhận xóa tài khoản?"
              description="Thao tác này sẽ gỡ toàn bộ vai trò và quyền hạn của nhân sự."
              onConfirm={() => handleDeleteUser(r.id)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" size="small" icon={<Trash2 size={14} color="#ef4444" />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card
        style={{
          borderRadius: 16,
          background: 'linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)',
          border: '1px solid #ccfbf1',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Users size={22} color="#0d9488" />
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f766e' }}>
                Quản lý Nhân sự & Gán vai trò Module (master_users & user_module_roles)
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Danh mục nhân viên toàn hệ thống, trực thuộc phòng ban và được phân định rõ vai trò PIC-1, PIC-2 hoặc Admin trong từng Module.
            </p>
          </div>

          <Space>
            <Input
              placeholder="Tìm kiếm nhân sự..."
              prefix={<Search size={15} color="#94a3b8" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 220, borderRadius: 10 }}
              allowClear
            />
            <Button
              type="primary"
              icon={<UserPlus size={15} />}
              onClick={handleOpenAdd}
              style={{ background: '#0d9488', borderColor: '#0d9488', fontWeight: 600, borderRadius: 10 }}
            >
              Thêm Nhân sự
            </Button>
          </Space>
        </div>
      </Card>

      <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0' }} bodyStyle={{ padding: 0 }}>
        <Table
          dataSource={filteredUsers}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8, showTotal: (total) => `Tổng cộng ${total} nhân sự` }}
        />
      </Card>

      {/* Modal Add / Edit User */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="#0d9488" />
            <span>{editingUser ? 'Chỉnh sửa Nhân sự & Quyền Module' : 'Thêm mới Nhân sự Hệ thống'}</span>
          </div>
        }
        open={modalOpen}
        onOk={handleSaveUser}
        onCancel={() => setModalOpen(false)}
        okText="Lưu thông tin"
        cancelText="Hủy"
        okButtonProps={{ style: { background: '#0d9488', borderColor: '#0d9488', fontWeight: 600 } }}
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true, message: 'Vui lòng nhập username' }]}>
                <Input placeholder="ví dụ: lanqa" disabled={!!editingUser} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="short_name" label="Tên viết tắt (Short Name)">
                <Input placeholder="ví dụ: QA-LAN" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
            <Input placeholder="ví dụ: Nguyễn Thị Lan" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="email" label="Email công vụ" rules={[{ required: true, type: 'email' }]}>
                <Input placeholder="lan.nguyen@company.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department_code" label="Phòng ban" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'QA (Đảm bảo chất lượng)', value: 'QA' },
                    { label: 'KHO (Kho vận Long Hậu / HN)', value: 'KHO' },
                    { label: 'SCM (Chuỗi cung ứng / XNK)', value: 'SCM' },
                    { label: 'DEV (Công nghệ thông tin)', value: 'DEV' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0' }}>Phân vai trò Nghiệp vụ</Divider>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="imp_role" label="Vai trò tại Module IMP" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'PIC-1 (QA Văn phòng / Kiểm hồ sơ)', value: 'PIC-1' },
                    { label: 'PIC-2 (QA Kiểm hàng / Kho nhập)', value: 'PIC-2' },
                    { label: 'Admin (Toàn quyền quản trị)', value: 'Admin' },
                    { label: 'Draft (Chỉ soạn thảo ban đầu)', value: 'Draft' },
                    { label: 'Viewer (Chỉ xem dữ liệu)', value: 'Viewer' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="system_role" label="Cấp bậc Hệ thống" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'Staff (Nhân viên thao tác)', value: 'staff' },
                    { label: 'Admin (Quản trị viên hệ thống)', value: 'admin' },
                    { label: 'Viewer (Người xem chỉ đọc)', value: 'viewer' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="is_primary_pic" valuePropName="checked" label="Người phụ trách chính (Primary PIC)">
                <Switch checkedChildren="Có" unCheckedChildren="Không" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_active" valuePropName="checked" label="Trạng thái kích hoạt">
                <Switch checkedChildren="Đang hoạt động" unCheckedChildren="Tạm khóa" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
