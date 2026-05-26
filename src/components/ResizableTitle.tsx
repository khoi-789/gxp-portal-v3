'use client';

/**
 * ResizableTitle - Custom <th> component for Ant Design Table
 *
 * Usage: Add `components={{ header: { cell: ResizableTitle } }}` to <Table>
 * and set `onHeaderCell: (col) => ({ onResize: (w) => ..., columnKey: col.key })`
 * on each column definition.
 */

import React, { useRef, useState } from 'react';

interface ResizableTitleProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  onResize?: (width: number) => void;
}

export default function ResizableTitle({
  onResize,
  children,
  style,
  ...rest
}: ResizableTitleProps) {
  const startX = useRef(0);
  const startWidth = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!onResize) return;
    e.preventDefault();
    e.stopPropagation();

    startX.current = e.clientX;
    // Get actual rendered TH width
    const th = (e.currentTarget as HTMLElement).closest('th');
    startWidth.current = th ? th.getBoundingClientRect().width : 100;

    setDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX.current;
      onResize(Math.max(40, Math.round(startWidth.current + delta)));
    };

    const handleMouseUp = () => {
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <th
      {...rest}
      style={{ ...style, position: 'relative', overflow: 'visible' }}
    >
      {children}

      {/* Resize handle */}
      {onResize && (
        <div
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => { if (!dragging) setHovered(false); }}
          style={{
            position: 'absolute',
            right: -3,
            top: 0,
            bottom: 0,
            width: 8,
            cursor: 'col-resize',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Visual indicator */}
          <div
            style={{
              width: 2,
              height: (hovered || dragging) ? '70%' : '0%',
              borderRadius: 2,
              background: dragging ? '#0d9488' : 'rgba(13,148,136,0.5)',
              transition: dragging ? 'none' : 'height 150ms ease',
              boxShadow: dragging ? '0 0 6px rgba(13,148,136,0.6)' : 'none',
            }}
          />
        </div>
      )}
    </th>
  );
}
