/**
 * Tiện ích tìm kiếm theo cột với hỗ trợ wildcard
 *
 * Quy tắc:
 *  - Gõ bình thường (VD: "Fero")   => tìm dữ liệu CHỨA "Fero" (case-insensitive)
 *  - Gõ với "%" (VD: "Stamlo%")    => "%" thay cho chuỗi ký tự bất kỳ (như SQL LIKE)
 *  - Gõ với "?" (VD: "Stam?o")     => "?" thay cho đúng 1 ký tự bất kỳ
 */

import React, { useState } from 'react';
import { Input } from 'antd';
import { Search } from 'lucide-react';

// ── Core match function ──────────────────────────────────────────────────────

/**
 * Chuyển đổi pattern (có thể chứa % và ?) sang RegExp, rồi kiểm tra với value.
 * Nếu pattern không có % hay ?, fallback về .includes() (contains).
 */
export function matchPattern(value: string, pattern: string): boolean {
  if (!pattern) return true;

  const hasWildcard = pattern.includes('%') || pattern.includes('?');
  const v = value.toLowerCase();
  const p = pattern.toLowerCase();

  if (!hasWildcard) {
    // Contains match
    return v.includes(p);
  }

  // Build regex: escape special chars, then replace % -> .* and ? -> .
  const escaped = p.replace(/[.*+^${}()|[\]\\]/g, '\\$&'); // escape regex specials except % ?
  const regexStr = escaped
    .replace(/%/g, '.*')  // % = zero-or-more chars
    .replace(/\?/g, '.');  // ? = exactly one char

  try {
    const regex = new RegExp('^' + regexStr + '$');
    return regex.test(v);
  } catch {
    return v.includes(p);
  }
}

/**
 * Lọc mảng data theo map { fieldKey: pattern }
 */
export function applyColumnFilters<T extends Record<string, unknown>>(
  data: T[],
  filters: Record<string, string>
): T[] {
  return data.filter((row) =>
    Object.entries(filters).every(([key, pattern]) => {
      if (!pattern) return true;
      const val = String(row[key] ?? '');
      return matchPattern(val, pattern);
    })
  );
}

// ── Column Header with built-in search input ─────────────────────────────────

interface ColumnSearchHeaderProps {
  title: string;
  dataKey: string;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  align?: 'left' | 'center' | 'right';
  showFilters?: boolean; // controlled externally by the Filter toggle button
}

export function ColumnSearchHeader({
  title,
  dataKey,
  filters,
  onFilterChange,
  align = 'left',
  showFilters = true,
}: ColumnSearchHeaderProps) {
  const [focused, setFocused] = useState(false);
  const value = filters[dataKey] ?? '';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        alignItems: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        width: '100%',
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{title}</span>
      {showFilters && (
        <Input
          size="small"
          placeholder="🔍"
          value={value}
          onChange={(e) => onFilterChange(dataKey, e.target.value)}
          allowClear
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: 11,
            height: 22,
            borderRadius: 4,
            borderColor: focused ? '#0d9488' : value ? '#0d9488' : '#e2e8f0',
            background: value ? '#f0fdfa' : 'white',
            width: '100%',
            minWidth: 40,
            boxShadow: focused ? '0 0 0 2px rgba(13,148,136,0.15)' : 'none',
            transition: 'all 150ms ease',
          }}
        />
      )}
    </div>
  );
}
