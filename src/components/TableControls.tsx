'use client';

/**
 * TableControls - Reusable toolbar for GxP Portal tables
 *
 * Includes:
 * 1. Filter toggle button  - show/hide the per-column search row
 * 2. Column manager button - popup to show/hide/reorder columns via drag-and-drop
 */

import React, { useState, useRef } from 'react';
import { Button, Popover, Checkbox, Tooltip, Divider } from 'antd';
import { Filter, MoreHorizontal, GripVertical, Eye, EyeOff } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  fixed?: boolean; // fixed columns cannot be hidden
}

interface TableControlsProps {
  showFilters: boolean;
  onToggleFilters: () => void;
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
}

// ── Column Manager Popup ───────────────────────────────────────────────────

function ColumnManager({
  columns,
  onChange,
}: {
  columns: ColumnConfig[];
  onChange: (cols: ColumnConfig[]) => void;
}) {
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  const handleDragStart = (idx: number) => {
    dragIndex.current = idx;
  };

  const handleDragEnter = (idx: number) => {
    dragOverIndex.current = idx;
  };

  const handleDragEnd = () => {
    const from = dragIndex.current;
    const to = dragOverIndex.current;
    if (from === null || to === null || from === to) {
      dragIndex.current = null;
      dragOverIndex.current = null;
      return;
    }
    const reordered = [...columns];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    dragIndex.current = null;
    dragOverIndex.current = null;
    onChange(reordered);
  };

  const toggleVisible = (key: string) => {
    onChange(columns.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  };

  const showAll = () => onChange(columns.map((c) => ({ ...c, visible: true })));
  const hideAll = () =>
    onChange(columns.map((c) => (c.fixed ? c : { ...c, visible: false })));

  return (
    <div style={{ width: 240, userSelect: 'none' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
          Tùy chỉnh cột
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={showAll}
            style={{
              fontSize: 11,
              color: '#0d9488',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: 4,
            }}
          >
            Hiện tất cả
          </button>
          <span style={{ color: '#d1d5db', fontSize: 11 }}>|</span>
          <button
            onClick={hideAll}
            style={{
              fontSize: 11,
              color: '#ef4444',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: 4,
            }}
          >
            Ẩn tất cả
          </button>
        </div>
      </div>

      <Divider style={{ margin: '6px 0' }} />

      {/* Column list */}
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {columns.map((col, idx) => (
          <div
            key={col.key}
            draggable={!col.fixed}
            onDragStart={() => !col.fixed && handleDragStart(idx)}
            onDragEnter={() => !col.fixed && handleDragEnter(idx)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 6px',
              borderRadius: 6,
              cursor: col.fixed ? 'default' : 'grab',
              transition: 'background 120ms ease',
              opacity: col.visible ? 1 : 0.5,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = '#f0fdfa')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'transparent')
            }
          >
            {/* Drag handle */}
            <GripVertical
              size={13}
              color={col.fixed ? '#d1d5db' : '#94a3b8'}
              style={{ flexShrink: 0 }}
            />

            {/* Visibility toggle */}
            <button
              onClick={() => !col.fixed && toggleVisible(col.key)}
              style={{
                background: 'none',
                border: 'none',
                cursor: col.fixed ? 'not-allowed' : 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
              title={col.fixed ? 'Cột cố định, không thể ẩn' : col.visible ? 'Ẩn cột' : 'Hiện cột'}
            >
              {col.visible ? (
                <Eye size={14} color="#0d9488" />
              ) : (
                <EyeOff size={14} color="#94a3b8" />
              )}
            </button>

            {/* Column label */}
            <span
              style={{
                fontSize: 12,
                color: col.fixed ? '#64748b' : '#1e293b',
                flex: 1,
                fontWeight: col.fixed ? 400 : 500,
              }}
            >
              {col.label}
              {col.fixed && (
                <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>
                  (cố định)
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <Divider style={{ margin: '8px 0 4px' }} />
      <p style={{ fontSize: 10, color: '#94a3b8', margin: 0, textAlign: 'center' }}>
        Kéo thả để đổi thứ tự · Nhấn mắt để ẩn/hiện
      </p>
    </div>
  );
}

// ── Main TableControls Component ──────────────────────────────────────────

export default function TableControls({
  showFilters,
  onToggleFilters,
  columns,
  onColumnsChange,
}: TableControlsProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const hasHiddenCols = columns.some((c) => !c.visible);

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {/* Filter Toggle Button */}
      <Tooltip title={showFilters ? 'Ẩn ô lọc' : 'Hiện ô lọc'} placement="top">
        <button
          onClick={onToggleFilters}
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            border: `1px solid ${showFilters ? '#0d9488' : '#e2e8f0'}`,
            background: showFilters ? '#f0fdfa' : 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 150ms ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!showFilters) e.currentTarget.style.borderColor = '#0d9488';
          }}
          onMouseLeave={(e) => {
            if (!showFilters) e.currentTarget.style.borderColor = '#e2e8f0';
          }}
        >
          <Filter
            size={14}
            color={showFilters ? '#0d9488' : '#64748b'}
            fill={showFilters ? 'rgba(13,148,136,0.15)' : 'none'}
          />
        </button>
      </Tooltip>

      {/* Column Manager Button */}
      <Popover
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        trigger="click"
        placement="bottomRight"
        content={
          <ColumnManager
            columns={columns}
            onChange={(cols) => {
              onColumnsChange(cols);
            }}
          />
        }
        overlayStyle={{ zIndex: 9999 }}
        overlayInnerStyle={{ padding: 12, borderRadius: 12 }}
      >
        <Tooltip title="Tùy chỉnh cột" placement="top">
          <button
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              border: `1px solid ${hasHiddenCols ? '#f59e0b' : '#e2e8f0'}`,
              background: hasHiddenCols ? '#fffbeb' : 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 150ms ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#0d9488';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = hasHiddenCols ? '#f59e0b' : '#e2e8f0';
            }}
          >
            <MoreHorizontal size={14} color={hasHiddenCols ? '#f59e0b' : '#64748b'} />
          </button>
        </Tooltip>
      </Popover>
    </div>
  );
}
