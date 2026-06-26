'use client';

import { PortalApp } from '@/lib/types';
import {
  Link,
  Folder,
  FlaskConical,
  FileText,
  Box,
  Warehouse,
  Users,
  ClipboardList,
  Settings,
  BookOpen,
  Clock,
  ShieldCheck,
  BarChart2,
} from 'lucide-react';

/**
 * URS §4.2: <AppCard> Component
 * - Nền trắng kính (Glassmorphism)
 * - Icon góc giữa
 * - Tag phòng ban góc trái trên
 * - Dải ruy-băng đỏ "TESTING MODE" góc phải trên (nếu is_testing === true)
 */

interface AppCardProps {
  app: PortalApp;
  onClick: (app: PortalApp) => void;
}

// Map app_name → Icon
const APP_ICON_MAP: Record<string, React.ElementType> = {
  'COMP (Khiếu nại)': ShieldCheck,
  'INC (BBSC)': Warehouse,
  'DES (Hủy hàng)': FlaskConical,
  'Quản Lý Supplier': Box,
  'App Công Ty': Folder,
  'Chấm Công': Clock,
  'Đào Tạo GxP': BookOpen,
};

function getAppIcon(app: PortalApp): React.ElementType {
  if (app.type === 'folder') return Folder;
  return APP_ICON_MAP[app.app_name] ?? FileText;
}

// Hiển thị tối đa 2 phòng ban đầu tiên trên tag
function getDeptLabel(depts: string[]): string {
  if (depts.length === 0) return 'ALL';
  if (depts.length <= 2) return depts.join(' · ');
  return `${depts[0]} · ${depts[1]} +${depts.length - 2}`;
}

export default function AppCard({ app, onClick }: AppCardProps) {
  const Icon = getAppIcon(app);
  const isFolder = app.type === 'folder';

  return (
    <div
      className={`app-card ${isFolder ? 'app-card-folder' : ''}`}
      onClick={() => onClick(app)}
      role="button"
      tabIndex={0}
      aria-label={`Mở ${app.app_name}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick(app)}
    >
      {/* URS §4.2: Tag phòng ban góc trái trên */}
      <span className="dept-tag">{getDeptLabel(app.allowed_depts)}</span>

      {/* URS §4.2: Dải ruy-băng TESTING MODE nếu is_testing === true */}
      {app.is_testing && (
        <div className="testing-ribbon">Testing</div>
      )}

      {/* Card Body */}
      <div className="flex flex-col items-center justify-center px-4 pb-5 pt-10">
        {/* URS §4.2: Icon góc giữa */}
        <div className="app-card-icon">
          <Icon size={26} strokeWidth={1.8} />
        </div>

        {/* App Name */}
        <p
          className="text-center font-semibold text-slate-700 text-[13px] leading-tight"
          style={{ marginTop: 4 }}
        >
          {app.app_name}
        </p>

        {/* Type indicator */}
        <div className="flex items-center gap-1 mt-2">
          {isFolder ? (
            <Folder size={11} className="text-amber-500" />
          ) : (
            <Link size={11} className="text-teal-600" />
          )}
          <span className="text-[10px] text-slate-400 font-medium">
            {isFolder ? 'Thư mục' : 'Ứng dụng'}
          </span>
        </div>
      </div>
    </div>
  );
}
