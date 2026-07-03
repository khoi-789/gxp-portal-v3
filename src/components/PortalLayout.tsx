'use client';

import { ReactNode, useState, useEffect } from 'react';
import { User } from '@/lib/types';
import {
  Settings,
  Search,
  Users,
  PlusSquare,
  Bell,
  ChevronDown,
  ShieldCheck,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { Tooltip, Segmented } from 'antd';

/**
 * URS §4.1: <PortalLayout> - Component bọc ngoài cùng (Wrapper)
 *
 * Thành phần:
 * 1. Top Header: Background xanh mòng két (Teal), Logo GxP Portal ở giữa,
 *    Global Search dạng mờ, góc phải là tên User + Icon Setting.
 * 2. Admin Toolbar: Nằm ngay dưới Header, background vàng/kem nhạt.
 *    CHỈ HIỂN THỊ nếu user.system_role === 'admin'.
 *    Nút: "QL Nhóm", "Thêm công cụ mới".
 */
interface PortalLayoutProps {
  children: ReactNode;
  currentUser: User;
  onOpenGroupManager?: () => void;
  onOpenAppManager?: () => void;
  fullWidth?: boolean;
  noScroll?: boolean;
  pilotSwitcher?: ReactNode;
}

const DEPT_COLORS: Record<string, string> = {
  QA: '#0d9488',
  KHO: '#7c3aed',
  SCM: '#0369a1',
  DEV: '#0891b2',
};

export default function PortalLayout({
  children,
  currentUser,
  onOpenGroupManager,
  onOpenAppManager,
  fullWidth = false,
  noScroll = false,
  pilotSwitcher,
}: PortalLayoutProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'staff' | 'viewer'>('admin');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pilot_selected_role');
      if (stored === 'staff' || stored === 'viewer' || stored === 'admin') {
        setSelectedRole(stored);
      }
    }
  }, []);

  const handleRoleChange = (role: 'admin' | 'staff' | 'viewer') => {
    setSelectedRole(role);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pilot_selected_role', role);
      window.location.reload();
    }
  };

  const deptColor = DEPT_COLORS[currentUser.department_code] ?? '#0d9488';
  const isAdmin = currentUser.system_role === 'admin';

  return (
    <div 
      style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        height: noScroll ? '100vh' : 'auto',
        overflow: noScroll ? 'hidden' : 'visible'
      }}
    >
      {/* =====================================================
          URS §4.1: Top Header - Background xanh mòng két (Teal)
         ===================================================== */}
      <header className="portal-header" id="portal-header">
        <div
          style={{
            maxWidth: 1400,
            margin: '0 auto',
            padding: '0 24px',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          {/* ---- Left: Logo + Bell ---- */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={18} color="white" strokeWidth={2} />
              </div>
              <h1
                className="gradient-text"
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: '-0.5px',
                }}
              >
                GxP Portal
              </h1>
            </div>

            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />

            {/* Notification Bell */}
            <Tooltip title="Thông báo">
              <button
                id="btn-notifications"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: 10,
                  width: 38,
                  height: 38,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')
                }
              >
                <Bell size={18} color="white" strokeWidth={1.8} />
              </button>
            </Tooltip>
          </div>

          {/* ---- Center: Global Search ---- */}
          <div
            style={{
              flex: 1.5,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {/* Global Search - dạng mờ §4.1 */}
            <div style={{ position: 'relative', width: '100%', maxWidth: 480 }}>
              <Search
                size={14}
                color="rgba(255,255,255,0.7)"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                id="global-search-input"
                className="global-search"
                type="text"
                placeholder="Tìm kiếm ứng dụng, tài liệu..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 14px 9px 36px',
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          {/* ---- Right: User Info + Settings ---- */}
          <div
            style={{
              flex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 12,
            }}
          >
            {/* Native Pilot Mode switcher in Header */}
            <div
              id="pilot-user-switcher-header"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '2px 8px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                height: 32,
              }}
            >
              <span style={{ fontSize: 9, color: '#fef08a', fontWeight: 800, letterSpacing: '0.05em' }}>
                PILOT MODE
              </span>
              <Segmented
                size="small"
                options={[
                  { label: <span style={{ fontSize: 10, fontWeight: 600, color: selectedRole === 'staff' ? '#0f766e' : 'rgba(255,255,255,0.85)' }}>Staff</span>, value: 'staff' },
                  { label: <span style={{ fontSize: 10, fontWeight: 600, color: selectedRole === 'viewer' ? '#0f766e' : 'rgba(255,255,255,0.85)' }}>Viewer</span>, value: 'viewer' },
                  { label: <span style={{ fontSize: 10, fontWeight: 600, color: selectedRole === 'admin' ? '#0f766e' : 'rgba(255,255,255,0.85)' }}>Admin</span>, value: 'admin' },
                ]}
                value={selectedRole}
                onChange={(val) => handleRoleChange(val as any)}
                style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: 1 }}
              />
            </div>

            {/* User Chip */}
            <button
              id="btn-user-menu"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 12,
                padding: '6px 12px 6px 8px',
                cursor: 'pointer',
                transition: 'background 150ms ease',
                position: 'relative',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')
              }
            >
              {/* Avatar */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: deptColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'white',
                }}
              >
                {currentUser.full_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ textAlign: 'left' }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'white',
                    lineHeight: 1.2,
                  }}
                >
                  {currentUser.full_name.split(' ').slice(-1)[0]}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.7)',
                    lineHeight: 1.2,
                  }}
                >
                  {currentUser.department_code} ·{' '}
                  {isAdmin ? (
                    <span style={{ color: '#fef08a' }}>Admin</span>
                  ) : (
                    'Staff'
                  )}
                </p>
              </div>
              <ChevronDown
                size={14}
                color="rgba(255,255,255,0.7)"
                style={{ transition: 'transform 150ms', transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />

              {/* User Dropdown */}
              {userMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: 14,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                    minWidth: 200,
                    overflow: 'hidden',
                    zIndex: 500,
                  }}
                >
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <p style={{ margin: 0, fontWeight: 700, color: '#1e293b', fontSize: 14 }}>
                      {currentUser.full_name}
                    </p>
                    <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>
                      {currentUser.email}
                    </p>
                  </div>
                  {[
                    { icon: <UserIcon size={15} />, label: 'Hồ sơ cá nhân', id: 'menu-profile' },
                    { icon: <Settings size={15} />, label: 'Cài đặt', id: 'menu-settings' },
                    { icon: <LogOut size={15} />, label: 'Đăng xuất', id: 'menu-logout', danger: true },
                  ].map((item) => (
                    <button
                      key={item.id}
                      id={item.id}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        fontSize: 13,
                        color: item.danger ? '#ef4444' : '#374151',
                        textAlign: 'left',
                        transition: 'background 100ms ease',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = item.danger ? '#fef2f2' : '#f8fafc')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'transparent')
                      }
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </button>

            {/* Settings Icon */}
            <Tooltip title="Cài đặt hệ thống">
              <button
                id="btn-system-settings"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: 10,
                  width: 38,
                  height: 38,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')
                }
              >
                <Settings size={18} color="white" strokeWidth={1.8} />
              </button>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* =====================================================
          URS §4.1: Admin Toolbar
          CHỈ HIỂN THỊ nếu user.system_role === 'admin'
         ===================================================== */}
      {isAdmin && (
        <div className="admin-toolbar" id="admin-toolbar">
          <div
            style={{
              maxWidth: 1400,
              margin: '0 auto',
              padding: '0 24px',
              height: 44,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {/* Admin Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px',
                background: '#fef08a',
                borderRadius: 20,
                border: '1px solid #fde047',
                marginRight: 4,
              }}
            >
              <ShieldCheck size={13} color="#92400e" strokeWidth={2} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#92400e',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Chế độ Admin
              </span>
            </div>

            {/* §4.1 Nút "QL Nhóm" */}
            <button
              id="btn-manage-groups"
              onClick={onOpenGroupManager}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                background: 'white',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                color: '#374151',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#0d9488';
                e.currentTarget.style.color = '#0d9488';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.color = '#374151';
              }}
            >
              <Users size={14} />
              QL Nhóm
            </button>

            {/* §4.1 Nút "Thêm công cụ mới" */}
            <button
              id="btn-add-new-tool"
              onClick={onOpenAppManager}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                background: '#0d9488',
                border: '1px solid #0d9488',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                color: 'white',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = '#0f766e')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = '#0d9488')
              }
            >
              <PlusSquare size={14} />
              Thêm công cụ mới
            </button>
          </div>
        </div>
      )}

      <main 
        style={{ 
          flex: 1, 
          maxWidth: fullWidth ? '95%' : 1400, 
          margin: '0 auto', 
          padding: fullWidth ? '12px 0' : '32px 24px', 
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          height: noScroll ? 'calc(100vh - 153px)' : 'auto',
          overflow: noScroll ? 'hidden' : 'visible'
        }}
      >
        {children}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid #e2e8f0',
          padding: '16px 24px',
          textAlign: 'center',
          fontSize: 12,
          color: '#94a3b8',
          background: 'rgba(255,255,255,0.5)',
        }}
      >
        © 2026 GxP Portal · Hệ thống quản lý chất lượng dược phẩm
      </footer>
    </div>
  );
}
