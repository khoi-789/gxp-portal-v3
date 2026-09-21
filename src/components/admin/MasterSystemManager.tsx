'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Card, Table, Tabs, Button, Tag, Space, Modal, Form, Input,
  Select, Switch, message, Popconfirm, Tooltip, InputNumber, Row, Col, Alert
} from 'antd';
import {
  Building, Warehouse, Thermometer, Tag as TagIcon,
  FileCode, FileSpreadsheet, Plus, Edit, Trash2, CheckCircle,
  XCircle, RefreshCw, Upload, Download, Search, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { useMasterPerms } from '@/lib/useMasterPerms';

export default function MasterSystemManager({
  defaultTab = 'departments',
  hideTabBar = false,
  forcedTab,
  currentRole,
}: {
  defaultTab?: string;
  hideTabBar?: boolean;
  forcedTab?: string;
  currentRole?: string;
}) {
  const [activeTab, setActiveTab] = useState(forcedTab || defaultTab);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Read current Pilot role from prop or localStorage (reactive)
  const [simulatedRole, setSimulatedRole] = useState<string>(() =>
    currentRole || (typeof window !== 'undefined' ? (localStorage.getItem('pilot_selected_role') || 'Viewer') : 'Viewer')
  );

  useEffect(() => {
    if (currentRole) {
      setSimulatedRole(currentRole);
    }
  }, [currentRole]);

  useEffect(() => {
    const onPilotRole = (e: any) => {
      if (e.detail) setSimulatedRole(e.detail);
    };
    window.addEventListener('pilot_role_change', onPilotRole);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pilot_selected_role') setSimulatedRole(e.newValue || 'Viewer');
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('pilot_role_change', onPilotRole);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const effectiveRole = currentRole || simulatedRole;

  // Permission hook — loads from Supabase master_roles, falls back to defaults
  const { canEdit: _canEdit, canView: _canView } = useMasterPerms();

  // Map active tab or action type to the relevant master_* tableKey for permission lookup
  const TAB_TO_TABLE_KEY: Record<string, string> = {
    departments: 'master_departments',
    department: 'master_departments',
    warehouses: 'master_warehouses',
    warehouse: 'master_warehouses',
    loggers: 'master_loggers',
    logger: 'master_loggers',
    label_types: 'master_label_types',
    label_type: 'master_label_types',
    numbering: 'master_numbering_rules',
    templates: 'master_form_templates',
    template: 'master_form_templates',
  };

  // Helper: can the current role view rows in the given tab?
  const canViewTab = (tabKey: string): boolean => {
    const tableKey = TAB_TO_TABLE_KEY[tabKey];
    if (!tableKey) return true;
    return _canView(effectiveRole, tableKey);
  };

  // Helper: can the current role edit rows in the given tab?
  const canEditTab = (tabKey: string): boolean => {
    const tableKey = TAB_TO_TABLE_KEY[tabKey];
    if (!tableKey) return false;
    return _canEdit(effectiveRole, tableKey);
  };

  // Modal form states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<string>('department'); // department | warehouse | logger | label_type | numbering | template
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [form] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync forcedTab if provided
  useEffect(() => {
    if (forcedTab) setActiveTab(forcedTab);
  }, [forcedTab]);

  // Data States
  const [departments, setDepartments] = useState<any[]>([
    { id: '1', department_code: 'QA_OFFICE', department_name: 'Phòng Đảm bảo Chất lượng (QA)', short_name: 'QA VP', is_active: true },
    { id: '2', department_code: 'KHO_NHAP', department_name: 'Kho Tiếp nhận & Nhập khẩu', short_name: 'Kho Nhập', is_active: true },
    { id: '3', department_code: 'TEAM_DGC2', department_name: 'Tổ Đóng gói cấp 2', short_name: 'ĐGC2', is_active: true },
    { id: '4', department_code: 'XNK', department_name: 'Phòng Xuất Nhập Khẩu & Logistics', short_name: 'XNK', is_active: true },
    { id: '5', department_code: 'PLANNING', department_name: 'Phòng Kế hoạch Cung ứng', short_name: 'Planning', is_active: true },
    { id: '6', department_code: 'CSKH', department_name: 'Phòng Chăm sóc Khách hàng', short_name: 'CSKH', is_active: true },
  ]);

  const [warehouses, setWarehouses] = useState<any[]>([
    { id: '1', warehouse_code: 'KHO_LONG_HAU', warehouse_name: 'Kho GxP Long Hậu', address: 'KCN Long Hậu, Cần Giuộc, Long An', is_active: true },
    { id: '2', warehouse_code: 'KHO_HA_NOI', warehouse_name: 'Kho Phân Phối Hà Nội', address: 'KCN Quang Minh, Mê Linh, Hà Nội', is_active: true },
    { id: '3', warehouse_code: 'KHO_TRUNG_CHUYEN', warehouse_name: 'Kho Trung Chuyển TSN', address: 'Tân Bình, TP.HCM', is_active: true },
  ]);

  const [loggers, setLoggers] = useState<any[]>([
    { id: '1', logger_code: 'TT_ULTRA', logger_name: 'TempTale Ultra', model: 'Single-Use USB', temp_range: '2°C - 8°C', is_active: true },
    { id: '2', logger_code: 'LIBERO_PDF', logger_name: 'Elpro Libero PDF', model: 'Multi-Use PDF', temp_range: '15°C - 25°C', is_active: true },
    { id: '3', logger_code: 'TESTO_174T', logger_name: 'Testo 174T Mini', model: 'Display Logger', temp_range: '-30°C to +70°C', is_active: true },
  ]);

  const [labelTypes, setLabelTypes] = useState<any[]>([
    { id: '1', label_type_code: 'TT1300023', label_type_name: 'Nhãn DNNK 1x2.5cm', description: 'Dán ngoài hộp cho thuốc nhập khẩu', is_active: true },
    { id: '2', label_type_code: 'HDSD', label_type_name: 'Tờ Hướng Dẫn Sử Dụng tiếng Việt', description: 'Đính kèm hộp thuốc khi lưu hành', is_active: true },
    { id: '3', label_type_code: 'TEM_KIEM_SOAT', label_type_name: 'Tem Niêm Phong / Kiểm Soát QA', description: 'Dán nắp thùng sau khi kiểm nhập', is_active: true },
  ]);

  const [numberingRules, setNumberingRules] = useState<any[]>([
    { id: '1', module_code: 'IMP', prefix: 'IMP-', date_format: 'YYMM', seq_digits: 4, current_seq: 6, sample_output: 'IMP-2609-0007' },
    { id: '2', module_code: 'COMP', prefix: 'CC-', date_format: 'YYYY-', seq_digits: 4, current_seq: 12, sample_output: 'CC-2026-0013' },
    { id: '3', module_code: 'INC', prefix: 'BBSC-', date_format: 'YYYY-', seq_digits: 3, current_seq: 5, sample_output: 'BBSC-2026-006' },
  ]);

  const [formTemplates, setFormTemplates] = useState<any[]>([
    { id: '1', module_code: 'IMP', form_code: 'BM-QA-IMP-01', version: 'v3.2', effective_from: '2026-01-01', is_current: true, change_notes: 'Cập nhật theo Schema V1.9 (bỏ SL, tích hợp Visa)' },
    { id: '2', module_code: 'INC', form_code: 'BM-QA-BBSC-02', version: 'v2.0', effective_from: '2025-06-15', is_current: true, change_notes: 'Chuẩn hóa biên bản sự cố nhập' },
    { id: '3', module_code: 'COMP', form_code: 'BM-QA-CC-01', version: 'v1.5', effective_from: '2025-09-01', is_current: true, change_notes: 'Quy trình khiếu nại nhà sản xuất' },
  ]);

  // Load from Supabase on mount
  useEffect(() => {
    async function loadData() {
      try {
        const { data: deptData } = await supabase.from('master_departments').select('*');
        if (deptData && deptData.length > 0) setDepartments(deptData);

        const { data: whData } = await supabase.from('master_warehouses').select('*');
        if (whData && whData.length > 0) setWarehouses(whData);

        const { data: logData } = await supabase.from('master_loggers').select('*');
        if (logData && logData.length > 0) setLoggers(logData);

        const { data: lblData } = await supabase.from('master_label_types').select('*');
        if (lblData && lblData.length > 0) setLabelTypes(lblData);

        const { data: numData } = await supabase.from('master_numbering_rules').select('*');
        if (numData && numData.length > 0) setNumberingRules(numData);

        const { data: tmplData } = await supabase.from('master_form_templates').select('*');
        if (tmplData && tmplData.length > 0) setFormTemplates(tmplData);
      } catch (err) {
        console.warn('Load system master data error:', err);
      }
    }
    loadData();
  }, []);

  // Open Modal Add
  const handleOpenAdd = (type: string) => {
    setModalType(type);
    setEditingItem(null);
    form.resetFields();
    if (type === 'numbering') {
      form.setFieldsValue({ seq_digits: 4, current_seq: 0 });
    } else if (type === 'template') {
      form.setFieldsValue({ version: 'v1.0', effective_from: new Date().toISOString().split('T')[0], is_current: true });
    } else {
      form.setFieldsValue({ is_active: true });
    }
    setModalOpen(true);
  };

  // Open Modal Edit
  const handleOpenEdit = (type: string, item: any) => {
    setModalType(type);
    setEditingItem(item);
    form.setFieldsValue(item);
    setModalOpen(true);
  };

  // Save Modal Form
  const handleSaveItem = async () => {
    try {
      const values = await form.validateFields();
      const id = editingItem ? editingItem.id : `tmp-${Date.now()}`;
      const newItem = { ...editingItem, ...values, id };

      if (modalType === 'department') {
        setDepartments(prev => editingItem ? prev.map(x => x.id === id ? newItem : x) : [newItem, ...prev]);
        await supabase.from('master_departments').upsert({
          department_code: newItem.department_code,
          department_name: newItem.department_name,
          short_name: newItem.short_name,
          is_active: newItem.is_active ?? true,
        }, { onConflict: 'department_code' });
      } else if (modalType === 'warehouse') {
        setWarehouses(prev => editingItem ? prev.map(x => x.id === id ? newItem : x) : [newItem, ...prev]);
        await supabase.from('master_warehouses').upsert({
          warehouse_code: newItem.warehouse_code,
          warehouse_name: newItem.warehouse_name,
          address: newItem.address || '',
          is_active: newItem.is_active ?? true,
        }, { onConflict: 'warehouse_code' });
      } else if (modalType === 'logger') {
        setLoggers(prev => editingItem ? prev.map(x => x.id === id ? newItem : x) : [newItem, ...prev]);
        await supabase.from('master_loggers').upsert({
          logger_code: newItem.logger_code,
          logger_name: newItem.logger_name,
          model: newItem.model || '',
          temp_range: newItem.temp_range || '',
          is_active: newItem.is_active ?? true,
        }, { onConflict: 'logger_code' });
      } else if (modalType === 'label_type') {
        setLabelTypes(prev => editingItem ? prev.map(x => x.id === id ? newItem : x) : [newItem, ...prev]);
        await supabase.from('master_label_types').upsert({
          label_type_code: newItem.label_type_code,
          label_type_name: newItem.label_type_name,
          description: newItem.description || '',
          is_active: newItem.is_active ?? true,
        }, { onConflict: 'label_type_code' });
      } else if (modalType === 'numbering') {
        setNumberingRules(prev => editingItem ? prev.map(x => x.id === id ? newItem : x) : [newItem, ...prev]);
        await supabase.from('master_numbering_rules').upsert({
          module_code: newItem.module_code,
          prefix: newItem.prefix,
          date_format: newItem.date_format,
          seq_digits: newItem.seq_digits,
          current_seq: newItem.current_seq,
          sample_output: `${newItem.prefix}${newItem.date_format || '2609'}-${String(newItem.current_seq + 1).padStart(newItem.seq_digits || 4, '0')}`,
        }, { onConflict: 'module_code' });
      } else if (modalType === 'template') {
        setFormTemplates(prev => editingItem ? prev.map(x => x.id === id ? newItem : x) : [newItem, ...prev]);
        await supabase.from('master_form_templates').upsert({
          module_code: newItem.module_code,
          form_code: newItem.form_code,
          version: newItem.version,
          effective_from: newItem.effective_from,
          is_current: newItem.is_current ?? true,
          change_notes: newItem.change_notes || '',
        });
      }

      message.success('Lưu dữ liệu danh mục thành công!');
      setModalOpen(false);
    } catch (err: any) {
      message.error('Lỗi khi lưu: ' + err.message);
    }
  };

  // Delete Item
  const handleDeleteItem = async (type: string, item: any) => {
    try {
      if (type === 'department') {
        setDepartments(prev => prev.filter(x => x.id !== item.id));
        await supabase.from('master_departments').delete().eq('department_code', item.department_code);
      } else if (type === 'warehouse') {
        setWarehouses(prev => prev.filter(x => x.id !== item.id));
        await supabase.from('master_warehouses').delete().eq('warehouse_code', item.warehouse_code);
      } else if (type === 'logger') {
        setLoggers(prev => prev.filter(x => x.id !== item.id));
        await supabase.from('master_loggers').delete().eq('logger_code', item.logger_code);
      } else if (type === 'label_type') {
        setLabelTypes(prev => prev.filter(x => x.id !== item.id));
        await supabase.from('master_label_types').delete().eq('label_type_code', item.label_type_code);
      } else if (type === 'numbering') {
        setNumberingRules(prev => prev.filter(x => x.id !== item.id));
        await supabase.from('master_numbering_rules').delete().eq('module_code', item.module_code);
      } else if (type === 'template') {
        setFormTemplates(prev => prev.filter(x => x.id !== item.id));
        await supabase.from('master_form_templates').delete().eq('form_code', item.form_code);
      }
      message.success('Đã xóa dòng dữ liệu thành công!');
    } catch (err: any) {
      message.error('Lỗi khi xóa: ' + err.message);
    }
  };

  // Export Excel
  const handleExportExcel = (type: string) => {
    let dataToExport: any[] = [];
    let fileName = 'Master_Data.xlsx';

    if (type === 'departments') {
      fileName = 'Danh_Sach_Phong_Ban.xlsx';
      dataToExport = departments.map(d => ({
        'Mã phòng ban': d.department_code,
        'Tên phòng ban': d.department_name,
        'Tên viết tắt': d.short_name,
        'Trạng thái': d.is_active ? 'Đang dùng' : 'Khóa'
      }));
    } else if (type === 'warehouses') {
      fileName = 'Danh_Sach_Kho.xlsx';
      dataToExport = warehouses.map(w => ({
        'Mã kho': w.warehouse_code,
        'Tên kho': w.warehouse_name,
        'Địa chỉ': w.address || '',
        'Trạng thái': w.is_active ? 'Đang dùng' : 'Khóa'
      }));
    } else if (type === 'loggers') {
      fileName = 'Danh_Sach_Thiet_Bi_Nhiet.xlsx';
      dataToExport = loggers.map(l => ({
        'Mã thiết bị': l.logger_code,
        'Tên thiết bị': l.logger_name,
        'Dòng model': l.model || '',
        'Dải nhiệt độ': l.temp_range || '',
        'Trạng thái': l.is_active ? 'Hoạt động' : 'Khóa'
      }));
    } else if (type === 'label_types') {
      fileName = 'Danh_Sach_Loai_Tem.xlsx';
      dataToExport = labelTypes.map(t => ({
        'Mã tem': t.label_type_code,
        'Tên loại tem': t.label_type_name,
        'Mục đích': t.description || '',
        'Trạng thái': t.is_active ? 'Áp dụng' : 'Khóa'
      }));
    } else if (type === 'numbering') {
      fileName = 'Quy_Tac_Sinh_So.xlsx';
      dataToExport = numberingRules.map(n => ({
        'Module': n.module_code,
        'Tiền tố': n.prefix,
        'Định dạng ngày': n.date_format,
        'Số chữ số': n.seq_digits,
        'Số hiện tại': n.current_seq,
        'Mẫu hiển thị': n.sample_output
      }));
    } else if (type === 'templates') {
      fileName = 'Bieu_Mau_SOP.xlsx';
      dataToExport = formTemplates.map(t => ({
        'Module': t.module_code,
        'Mã biểu mẫu': t.form_code,
        'Phiên bản': t.version,
        'Ngày hiệu lực': t.effective_from,
        'Ghi chú thay đổi': t.change_notes || '',
        'Hiệu lực': t.is_current ? 'Đang áp dụng' : 'Hết hạn'
      }));
    }

    if (dataToExport.length === 0) {
      message.warning('Không có dữ liệu để xuất Excel');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master Data');
    XLSX.writeFile(wb, fileName);
    message.success(`Đã xuất file ${fileName} thành công!`);
  };

  // Download Template Excel
  const handleDownloadTemplate = (type: string) => {
    let sampleData: any[] = [];
    let fileName = 'Template_Import.xlsx';

    if (type === 'departments') {
      fileName = 'Template_Phong_Ban.xlsx';
      sampleData = [
        { 'Mã phòng ban': 'QA_OFFICE', 'Tên phòng ban': 'Phòng Đảm bảo Chất lượng', 'Tên viết tắt': 'QA VP', 'Trạng thái (1/0)': 1 },
        { 'Mã phòng ban': 'KHO_NHAP', 'Tên phòng ban': 'Kho Tiếp nhận & Nhập khẩu', 'Tên viết tắt': 'Kho Nhập', 'Trạng thái (1/0)': 1 },
      ];
    } else if (type === 'warehouses') {
      fileName = 'Template_Kho.xlsx';
      sampleData = [
        { 'Mã kho': 'KHO_LONG_HAU', 'Tên kho': 'Kho GxP Long Hậu', 'Địa chỉ': 'KCN Long Hậu, Cần Giuộc', 'Trạng thái (1/0)': 1 },
      ];
    } else if (type === 'loggers') {
      fileName = 'Template_Thiet_Bi_Nhiet.xlsx';
      sampleData = [
        { 'Mã thiết bị': 'TT_ULTRA', 'Tên thiết bị': 'TempTale Ultra', 'Dòng model': 'USB Single', 'Dải nhiệt độ': '2°C - 8°C', 'Trạng thái (1/0)': 1 },
      ];
    } else if (type === 'label_types') {
      fileName = 'Template_Loai_Tem.xlsx';
      sampleData = [
        { 'Mã tem': 'TT1300023', 'Tên loại tem': 'Nhãn DNNK 1x2.5cm', 'Mục đích': 'Dán hộp', 'Trạng thái (1/0)': 1 },
      ];
    } else if (type === 'numbering') {
      fileName = 'Template_Quy_Tac_Sinh_So.xlsx';
      sampleData = [
        { 'Module': 'IMP', 'Tiền tố': 'IMP-', 'Định dạng ngày': 'YYMM', 'Số chữ số': 4, 'Số hiện tại': 0 },
      ];
    } else if (type === 'templates') {
      fileName = 'Template_Bieu_Mau_SOP.xlsx';
      sampleData = [
        { 'Module': 'IMP', 'Mã biểu mẫu': 'BM-QA-IMP-01', 'Phiên bản': 'v1.0', 'Ngày hiệu lực': '2026-01-01', 'Ghi chú': 'Ban hành mới' },
      ];
    }

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, fileName);
    message.success(`Đã tải xuống template mẫu: ${fileName}`);
  };

  // Trigger Import Excel
  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  // Process Imported File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wsName]);

        if (!rows || rows.length === 0) {
          message.warning('File Excel không có dữ liệu!');
          return;
        }

        if (activeTab === 'departments') {
          const mapped = rows.map((r, i) => ({
            id: `imp-dept-${Date.now()}-${i}`,
            department_code: r['Mã phòng ban'] || r['department_code'],
            department_name: r['Tên phòng ban'] || r['department_name'],
            short_name: r['Tên viết tắt'] || r['short_name'] || '',
            is_active: r['Trạng thái (1/0)'] === 0 ? false : true,
          })).filter(x => x.department_code && x.department_name);

          setDepartments(prev => [...mapped, ...prev]);
          await supabase.from('master_departments').upsert(mapped.map(m => ({
            department_code: m.department_code,
            department_name: m.department_name,
            short_name: m.short_name,
            is_active: m.is_active
          })), { onConflict: 'department_code' });
          message.success(`Đã import thành công ${mapped.length} phòng ban!`);
        } else if (activeTab === 'warehouses') {
          const mapped = rows.map((r, i) => ({
            id: `imp-wh-${Date.now()}-${i}`,
            warehouse_code: r['Mã kho'] || r['warehouse_code'],
            warehouse_name: r['Tên kho'] || r['warehouse_name'],
            address: r['Địa chỉ'] || r['address'] || '',
            is_active: r['Trạng thái (1/0)'] === 0 ? false : true,
          })).filter(x => x.warehouse_code && x.warehouse_name);

          setWarehouses(prev => [...mapped, ...prev]);
          await supabase.from('master_warehouses').upsert(mapped.map(m => ({
            warehouse_code: m.warehouse_code,
            warehouse_name: m.warehouse_name,
            address: m.address,
            is_active: m.is_active
          })), { onConflict: 'warehouse_code' });
          message.success(`Đã import thành công ${mapped.length} kho!`);
        } else if (activeTab === 'loggers') {
          const mapped = rows.map((r, i) => ({
            id: `imp-log-${Date.now()}-${i}`,
            logger_code: r['Mã thiết bị'] || r['logger_code'],
            logger_name: r['Tên thiết bị'] || r['logger_name'],
            model: r['Dòng model'] || r['model'] || '',
            temp_range: r['Dải nhiệt độ'] || r['temp_range'] || '',
            is_active: r['Trạng thái (1/0)'] === 0 ? false : true,
          })).filter(x => x.logger_code && x.logger_name);

          setLoggers(prev => [...mapped, ...prev]);
          await supabase.from('master_loggers').upsert(mapped.map(m => ({
            logger_code: m.logger_code,
            logger_name: m.logger_name,
            model: m.model,
            temp_range: m.temp_range,
            is_active: m.is_active
          })), { onConflict: 'logger_code' });
          message.success(`Đã import thành công ${mapped.length} thiết bị nhiệt!`);
        } else if (activeTab === 'label_types') {
          const mapped = rows.map((r, i) => ({
            id: `imp-lbl-${Date.now()}-${i}`,
            label_type_code: r['Mã tem'] || r['label_type_code'],
            label_type_name: r['Tên loại tem'] || r['label_type_name'],
            description: r['Mục đích'] || r['description'] || '',
            is_active: r['Trạng thái (1/0)'] === 0 ? false : true,
          })).filter(x => x.label_type_code && x.label_type_name);

          setLabelTypes(prev => [...mapped, ...prev]);
          await supabase.from('master_label_types').upsert(mapped.map(m => ({
            label_type_code: m.label_type_code,
            label_type_name: m.label_type_name,
            description: m.description,
            is_active: m.is_active
          })), { onConflict: 'label_type_code' });
          message.success(`Đã import thành công ${mapped.length} loại tem nhãn!`);
        } else {
          message.info(`Đã đọc ${rows.length} dòng từ file Excel.`);
        }
      } catch (err: any) {
        message.error('Lỗi khi đọc file Excel: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Render Toolbar for a table
  const renderToolbar = (type: string, count: number) => {
    const canAdd = canEditTab(type);
    return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
      <Space>
        <Input
          placeholder="Tìm kiếm nhanh..."
          prefix={<Search size={14} color="#94a3b8" />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 220, borderRadius: 8 }}
          allowClear
        />
        <Tag color="teal" style={{ fontWeight: 600, borderRadius: 6 }}>
          Tổng cộng: {count} dòng
        </Tag>
        {!canAdd && (
          <Tag color="orange" style={{ fontWeight: 500, borderRadius: 6 }}>
            {simulatedRole}: Chỉ xem
          </Tag>
        )}
      </Space>

      <Space wrap>
        {canAdd && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => handleOpenAdd(type === 'departments' ? 'department' : type === 'warehouses' ? 'warehouse' : type === 'loggers' ? 'logger' : type === 'label_types' ? 'label_type' : type === 'numbering' ? 'numbering' : 'template')}
            style={{ background: '#0d9488', borderColor: '#0d9488', fontWeight: 600, borderRadius: 8 }}
          >
            Thêm mới
          </Button>
        )}

        <Button
          icon={<FileSpreadsheet size={14} />}
          onClick={() => handleDownloadTemplate(type)}
          style={{ fontWeight: 500, borderRadius: 8 }}
        >
          Tải Template Mẫu
        </Button>

        {canAdd && (
          <Button
            icon={<Upload size={14} />}
            onClick={handleTriggerImport}
            style={{ fontWeight: 500, borderRadius: 8 }}
          >
            Nhập Excel
          </Button>
        )}

        <Button
          icon={<Download size={14} />}
          onClick={() => handleExportExcel(type)}
          style={{ fontWeight: 500, borderRadius: 8 }}
        >
          Xuất Excel
        </Button>
      </Space>
    </div>
    );
  };

  const actionCol = (type: string) => ({
    title: 'Thao tác',
    key: 'actions',
    width: 120,
    align: 'center' as const,
    render: (_: any, r: any) => {
      const canAct = canEditTab(type);
      if (!canAct) {
        return (
          <Tooltip title="Vai trò hiện tại chỉ có quyền xem">
            <Tag color="default" style={{ fontSize: 11, borderRadius: 4, padding: '2px 8px' }}>Chỉ xem</Tag>
          </Tooltip>
        );
      }
      return (
        <Space size="small">
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              size="small"
              icon={<Edit size={14} color="#0d9488" />}
              onClick={() => handleOpenEdit(type, r)}
              style={{ color: '#0d9488', fontWeight: 600 }}
            >
              Sửa
            </Button>
          </Tooltip>
          <Popconfirm
            title="Xác nhận xóa?"
            description="Dòng này sẽ bị xóa khỏi danh mục Master Data."
            onConfirm={() => handleDeleteItem(type, r)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" icon={<Trash2 size={14} color="#ef4444" />} />
          </Popconfirm>
        </Space>
      );
    },
  });

  const tabItems = [
    {
      key: 'departments',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building size={14} /> Phòng ban ({departments.length})
        </span>
      ),
      children: (
        <div>
          {renderToolbar('departments', departments.length)}
          <Table
            dataSource={departments.filter(d => !searchText || d.department_code?.toLowerCase().includes(searchText.toLowerCase()) || d.department_name?.toLowerCase().includes(searchText.toLowerCase()))}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            columns={[
              { title: 'Mã phòng ban', dataIndex: 'department_code', width: 150, render: (t: string) => <Tag color="teal" style={{ fontWeight: 700 }}>{t}</Tag> },
              { title: 'Tên phòng ban / Bộ phận', dataIndex: 'department_name', render: (t: string) => <span style={{ fontWeight: 600 }}>{t}</span> },
              { title: 'Tên viết tắt', dataIndex: 'short_name', width: 130 },
              {
                title: 'Trạng thái',
                dataIndex: 'is_active',
                width: 130,
                render: (a: boolean) => a ? <Tag color="success">Đang dùng</Tag> : <Tag color="default">Khóa</Tag>,
              },
              actionCol('department'),
            ]}
          />
        </div>
      ),
    },
    {
      key: 'warehouses',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Warehouse size={14} /> Danh mục Kho ({warehouses.length})
        </span>
      ),
      children: (
        <div>
          {renderToolbar('warehouses', warehouses.length)}
          <Table
            dataSource={warehouses.filter(w => !searchText || w.warehouse_code?.toLowerCase().includes(searchText.toLowerCase()) || w.warehouse_name?.toLowerCase().includes(searchText.toLowerCase()))}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            columns={[
              { title: 'Mã kho', dataIndex: 'warehouse_code', width: 160, render: (t: string) => <Tag color="purple" style={{ fontWeight: 700 }}>{t}</Tag> },
              { title: 'Tên kho bãi', dataIndex: 'warehouse_name', render: (t: string) => <span style={{ fontWeight: 600 }}>{t}</span> },
              { title: 'Địa chỉ kho', dataIndex: 'address' },
              {
                title: 'Trạng thái',
                dataIndex: 'is_active',
                width: 130,
                render: (a: boolean) => a ? <Tag color="success">Đang dùng</Tag> : <Tag color="default">Khóa</Tag>,
              },
              actionCol('warehouse'),
            ]}
          />
        </div>
      ),
    },
    {
      key: 'loggers',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Thermometer size={14} /> Thiết bị nhiệt ({loggers.length})
        </span>
      ),
      children: (
        <div>
          {renderToolbar('loggers', loggers.length)}
          <Table
            dataSource={loggers.filter(l => !searchText || l.logger_code?.toLowerCase().includes(searchText.toLowerCase()) || l.logger_name?.toLowerCase().includes(searchText.toLowerCase()))}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            columns={[
              { title: 'Mã thiết bị', dataIndex: 'logger_code', width: 140, render: (t: string) => <Tag color="blue" style={{ fontWeight: 700 }}>{t}</Tag> },
              { title: 'Tên thiết bị nhiệt độ', dataIndex: 'logger_name', render: (t: string) => <span style={{ fontWeight: 600 }}>{t}</span> },
              { title: 'Dòng model / Loại', dataIndex: 'model' },
              { title: 'Dải nhiệt độ theo dõi', dataIndex: 'temp_range', render: (t: string) => <Tag color="cyan">{t}</Tag> },
              {
                title: 'Trạng thái',
                dataIndex: 'is_active',
                width: 130,
                render: (a: boolean) => a ? <Tag color="success">Hoạt động</Tag> : <Tag color="default">Khóa</Tag>,
              },
              actionCol('logger'),
            ]}
          />
        </div>
      ),
    },
    {
      key: 'label_types',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TagIcon size={14} /> Loại tem nhãn ({labelTypes.length})
        </span>
      ),
      children: (
        <div>
          {renderToolbar('label_types', labelTypes.length)}
          <Table
            dataSource={labelTypes.filter(lt => !searchText || lt.label_type_code?.toLowerCase().includes(searchText.toLowerCase()) || lt.label_type_name?.toLowerCase().includes(searchText.toLowerCase()))}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            columns={[
              { title: 'Mã loại tem', dataIndex: 'label_type_code', width: 140, render: (t: string) => <Tag color="orange" style={{ fontWeight: 700 }}>{t}</Tag> },
              { title: 'Tên loại nhãn phụ', dataIndex: 'label_type_name', render: (t: string) => <span style={{ fontWeight: 600 }}>{t}</span> },
              { title: 'Mục đích sử dụng', dataIndex: 'description' },
              {
                title: 'Trạng thái',
                dataIndex: 'is_active',
                width: 130,
                render: (a: boolean) => a ? <Tag color="success">Áp dụng</Tag> : <Tag color="default">Khóa</Tag>,
              },
              actionCol('label_type'),
            ]}
          />
        </div>
      ),
    },
    {
      key: 'numbering',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileCode size={14} /> Quy tắc sinh số ({numberingRules.length})
        </span>
      ),
      children: (
        <div>
          {renderToolbar('numbering', numberingRules.length)}
          <Table
            dataSource={numberingRules.filter(nr => !searchText || nr.module_code?.toLowerCase().includes(searchText.toLowerCase()) || nr.prefix?.toLowerCase().includes(searchText.toLowerCase()))}
            rowKey="id"
            pagination={false}
            columns={[
              { title: 'Module', dataIndex: 'module_code', width: 110, render: (t: string) => <Tag color="geekblue" style={{ fontWeight: 700 }}>{t}</Tag> },
              { title: 'Tiền tố (Prefix)', dataIndex: 'prefix', width: 120, render: (t: string) => <code style={{ color: '#0d9488' }}>{t}</code> },
              { title: 'Định dạng ngày', dataIndex: 'date_format', width: 140 },
              { title: 'Số chữ số thứ tự', dataIndex: 'seq_digits', width: 150 },
              { title: 'Số hiện tại', dataIndex: 'current_seq', width: 120, render: (n: number) => <b>#{n}</b> },
              {
                title: 'Mẫu số phiếu tự sinh tiếp theo',
                dataIndex: 'sample_output',
                render: (s: string) => (
                  <Tag color="magenta" style={{ fontWeight: 700, padding: '3px 8px', fontSize: 13 }}>
                    {s}
                  </Tag>
                ),
              },
              actionCol('numbering'),
            ]}
          />
        </div>
      ),
    },
    {
      key: 'templates',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileSpreadsheet size={14} /> Biểu mẫu SOP ({formTemplates.length})
        </span>
      ),
      children: (
        <div>
          {renderToolbar('templates', formTemplates.length)}
          <Table
            dataSource={formTemplates.filter(ft => !searchText || ft.module_code?.toLowerCase().includes(searchText.toLowerCase()) || ft.form_code?.toLowerCase().includes(searchText.toLowerCase()))}
            rowKey="id"
            pagination={false}
            columns={[
              { title: 'Module', dataIndex: 'module_code', width: 100, render: (t: string) => <Tag color="geekblue" style={{ fontWeight: 700 }}>{t}</Tag> },
              { title: 'Mã biểu mẫu SOP', dataIndex: 'form_code', width: 160, render: (t: string) => <code style={{ fontWeight: 600 }}>{t}</code> },
              { title: 'Phiên bản hiệu lực', dataIndex: 'version', width: 140, render: (v: string) => <Tag color="green" style={{ fontWeight: 700 }}>{v}</Tag> },
              { title: 'Ngày hiệu lực', dataIndex: 'effective_from', width: 140 },
              { title: 'Ghi chú thay đổi', dataIndex: 'change_notes' },
              {
                title: 'Hiệu lực',
                dataIndex: 'is_current',
                width: 120,
                render: (c: boolean) => c ? <Tag color="success">Đang áp dụng</Tag> : <Tag>Hết hạn</Tag>,
              },
              actionCol('template'),
            ]}
          />
        </div>
      ),
    },
  ];

  const visibleTabItems = tabItems.filter((t) => canViewTab(t.key));
  const currentTabItem = visibleTabItems.find((t) => t.key === activeTab) || visibleTabItems[0];

  if (!canViewTab(activeTab)) {
    // Ẩn hoàn toàn giao diện nếu vai trò không có quyền truy cập tab này
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hidden file input for Excel import */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".xlsx, .xls, .csv"
        onChange={handleFileUpload}
      />

      {hideTabBar ? (
        currentTabItem?.children
      ) : (
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={visibleTabItems} type="line" size="middle" />
      )}

      {/* Dynamic Modal Add/Edit */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Edit size={16} color="#0d9488" />
            <span>
              {editingItem ? 'Chỉnh sửa' : 'Thêm mới'}{' '}
              {modalType === 'department' ? 'Phòng ban' :
               modalType === 'warehouse' ? 'Kho bãi' :
               modalType === 'logger' ? 'Thiết bị nhiệt độ' :
               modalType === 'label_type' ? 'Loại tem nhãn' :
               modalType === 'numbering' ? 'Quy tắc sinh số' : 'Biểu mẫu SOP'}
            </span>
          </div>
        }
        open={modalOpen}
        onOk={handleSaveItem}
        onCancel={() => setModalOpen(false)}
        okText="Lưu thông tin"
        cancelText="Hủy"
        okButtonProps={{ style: { background: '#0d9488', borderColor: '#0d9488', fontWeight: 600 } }}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {modalType === 'department' && (
            <>
              <Form.Item name="department_code" label="Mã phòng ban" rules={[{ required: true }]}>
                <Input placeholder="ví dụ: QA_OFFICE" disabled={!!editingItem} />
              </Form.Item>
              <Form.Item name="department_name" label="Tên phòng ban / Bộ phận" rules={[{ required: true }]}>
                <Input placeholder="ví dụ: Phòng Đảm bảo Chất lượng" />
              </Form.Item>
              <Form.Item name="short_name" label="Tên viết tắt" rules={[{ required: true }]}>
                <Input placeholder="ví dụ: QA VP" />
              </Form.Item>
              <Form.Item name="is_active" valuePropName="checked" label="Trạng thái sử dụng">
                <Switch checkedChildren="Đang dùng" unCheckedChildren="Khóa" />
              </Form.Item>
            </>
          )}

          {modalType === 'warehouse' && (
            <>
              <Form.Item name="warehouse_code" label="Mã kho" rules={[{ required: true }]}>
                <Input placeholder="ví dụ: KHO_LONG_HAU" disabled={!!editingItem} />
              </Form.Item>
              <Form.Item name="warehouse_name" label="Tên kho bãi" rules={[{ required: true }]}>
                <Input placeholder="ví dụ: Kho GxP Long Hậu" />
              </Form.Item>
              <Form.Item name="address" label="Địa chỉ kho">
                <Input placeholder="ví dụ: KCN Long Hậu, Cần Giuộc, Long An" />
              </Form.Item>
              <Form.Item name="is_active" valuePropName="checked" label="Trạng thái sử dụng">
                <Switch checkedChildren="Đang dùng" unCheckedChildren="Khóa" />
              </Form.Item>
            </>
          )}

          {modalType === 'logger' && (
            <>
              <Form.Item name="logger_code" label="Mã thiết bị" rules={[{ required: true }]}>
                <Input placeholder="ví dụ: TT_ULTRA" disabled={!!editingItem} />
              </Form.Item>
              <Form.Item name="logger_name" label="Tên thiết bị nhiệt độ" rules={[{ required: true }]}>
                <Input placeholder="ví dụ: TempTale Ultra" />
              </Form.Item>
              <Form.Item name="model" label="Dòng sản phẩm / Loại model">
                <Input placeholder="ví dụ: Single-Use USB" />
              </Form.Item>
              <Form.Item name="temp_range" label="Dải nhiệt độ theo dõi">
                <Input placeholder="ví dụ: 2°C - 8°C" />
              </Form.Item>
              <Form.Item name="is_active" valuePropName="checked" label="Trạng thái kích hoạt">
                <Switch checkedChildren="Hoạt động" unCheckedChildren="Khóa" />
              </Form.Item>
            </>
          )}

          {modalType === 'label_type' && (
            <>
              <Form.Item name="label_type_code" label="Mã loại tem nhãn" rules={[{ required: true }]}>
                <Input placeholder="ví dụ: TT1300023" disabled={!!editingItem} />
              </Form.Item>
              <Form.Item name="label_type_name" label="Tên loại tem nhãn" rules={[{ required: true }]}>
                <Input placeholder="ví dụ: Nhãn DNNK 1x2.5cm" />
              </Form.Item>
              <Form.Item name="description" label="Mục đích / Ghi chú">
                <Input placeholder="Dán ngoài hộp cho thuốc nhập khẩu" />
              </Form.Item>
              <Form.Item name="is_active" valuePropName="checked" label="Trạng thái áp dụng">
                <Switch checkedChildren="Áp dụng" unCheckedChildren="Khóa" />
              </Form.Item>
            </>
          )}

          {modalType === 'numbering' && (
            <>
              <Form.Item name="module_code" label="Mã Module" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'IMP (Nhập khẩu)', value: 'IMP' },
                    { label: 'COMP (Khiếu nại)', value: 'COMP' },
                    { label: 'INC (Sự cố BBSC)', value: 'INC' },
                    { label: 'LBL (Nhãn phụ)', value: 'LBL' },
                    { label: 'INT (Nội bộ)', value: 'INT' },
                  ]}
                  disabled={!!editingItem}
                />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="prefix" label="Tiền tố (Prefix)" rules={[{ required: true }]}>
                    <Input placeholder="IMP-" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="date_format" label="Định dạng ngày">
                    <Input placeholder="YYMM hoặc YYYY-" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="seq_digits" label="Số chữ số thứ tự" rules={[{ required: true }]}>
                    <InputNumber min={2} max={6} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="current_seq" label="Số thứ tự hiện tại" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {modalType === 'template' && (
            <>
              <Form.Item name="module_code" label="Mã Module" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'IMP (Nhập khẩu)', value: 'IMP' },
                    { label: 'COMP (Khiếu nại)', value: 'COMP' },
                    { label: 'INC (Sự cố BBSC)', value: 'INC' },
                    { label: 'LBL (Nhãn phụ)', value: 'LBL' },
                  ]}
                />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="form_code" label="Mã biểu mẫu SOP" rules={[{ required: true }]}>
                    <Input placeholder="BM-QA-IMP-01" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="version" label="Phiên bản hiệu lực" rules={[{ required: true }]}>
                    <Input placeholder="v3.2" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="effective_from" label="Ngày bắt đầu hiệu lực" rules={[{ required: true }]}>
                <Input type="date" />
              </Form.Item>
              <Form.Item name="change_notes" label="Ghi chú thay đổi">
                <Input.TextArea rows={2} placeholder="Nội dung cập nhật so với phiên bản trước" />
              </Form.Item>
              <Form.Item name="is_current" valuePropName="checked" label="Đang áp dụng hiện tại">
                <Switch checkedChildren="Có" unCheckedChildren="Không" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
