// Script to seed local JSON data to Supabase database
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Load env variables manually from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Lỗi: Không tìm thấy file .env.local!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const cleanLine = line.trim();
  if (!cleanLine || cleanLine.startsWith('#')) return;
  const eqIdx = cleanLine.indexOf('=');
  if (eqIdx > 0) {
    const key = cleanLine.substring(0, eqIdx).trim();
    const val = cleanLine.substring(eqIdx + 1).trim();
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Lỗi: Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong file .env.local!');
  process.exit(1);
}

console.log('Đang kết nối tới Supabase tại:', supabaseUrl);
// Sử dụng service role key để bypass RLS khi seed dữ liệu
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedMasterItems() {
  const masterDataPath = path.join(__dirname, '../public/master-data.json');
  if (!fs.existsSync(masterDataPath)) {
    console.warn('Cảnh báo: Không tìm thấy public/master-data.json');
    return;
  }

  console.log('Đang đọc danh mục sản phẩm từ master-data.json...');
  const json = JSON.parse(fs.readFileSync(masterDataPath, 'utf-8'));
  const items = json.items || [];
  console.log(`Tìm thấy ${items.length} sản phẩm. Đang xóa dữ liệu cũ và nạp mới...`);

  // Xóa sạch bảng cũ trước khi nạp
  const { error: deleteError } = await supabase.from('master_items').delete().neq('item_code', '');
  if (deleteError) {
    console.error('Lỗi xóa master_items:', deleteError.message);
    return;
  }

  // Nạp theo batch (100 sản phẩm một lượt)
  const batchSize = 100;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize).map(r => ({
      item_code: r.item_code,
      item_name: r.item_name,
      supplier_code: r.supplier_code,
      visa_no: r.visa_no || null,
      is_active: r.is_active !== false,
      gross_weight: r.gross_weight || 0,
      net_weight: r.net_weight || 0,
      cube: r.cube || 0,
      tare_weight: r.tare_weight || 0,
      pallet_qty: r.pallet_qty || 0,
      case_qty: r.case_qty || 0,
      inner_pack: r.inner_pack || 0,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('master_items').insert(batch);
    if (error) {
      console.error(`Lỗi nạp batch master_items tại dòng ${i}:`, error.message);
      return;
    }
    console.log(`Đã nạp ${Math.min(i + batchSize, items.length)}/${items.length} master_items...`);
  }
  console.log('✓ Hoàn thành nạp master_items!');
}

async function seedDestructionRecords() {
  const destructionPath = path.join(__dirname, '../public/destruction-data.json');
  if (!fs.existsSync(destructionPath)) {
    console.warn('Cảnh báo: Không tìm thấy public/destruction-data.json');
    return;
  }

  console.log('Đang đọc dữ liệu hủy hàng từ destruction-data.json...');
  const json = JSON.parse(fs.readFileSync(destructionPath, 'utf-8'));
  const records = json.data || [];
  console.log(`Tìm thấy ${records.length} dòng dữ liệu hủy. Đang xóa dữ liệu cũ và nạp mới...`);

  // Xóa sạch bảng cũ trước khi nạp
  const { error: deleteError } = await supabase.from('destruction_records').delete().gt('id', -1);
  if (deleteError) {
    console.error('Lỗi xóa destruction_records:', deleteError.message);
    return;
  }

  // Load existing decisions from localStorage (nếu có lưu ở local, nhưng đây là chạy ở terminal
  // nên chúng ta nạp dữ liệu sạch từ file JSON là chính).
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize).map(r => ({
      id: r.id,
      owner: r.owner,
      item: r.item,
      descr: r.descr,
      location: r.location,
      lpn: r.lpn,
      on_hand: r.onHand,
      available: r.available,
      status: r.status,
      visa: r.visa || null,
      lot_no: r.lotNo,
      exp_date: r.expDate,
      so_batch: r.soBatch,
      ly_do_hold: r.lyDoHold || null,
      loai_hold: r.loaiHold || null,
      ngay_hold: r.ngayHold || null,
      nguoi_hold: r.nguoiHold || null,
      ghi_chu: r.ghiChu || r.lyDoHold || null,
      gross_wgt: r.grossWgt || 0,
      net_wgt: r.netWgt || 0,
      tare: r.tare || 0,
      cube: r.cube || 0,
      inner_pack: r.innerPack || 0,
      case_cnt: r.caseCnt || 0,
      pallet: r.pallet || 0,
      uom: r.uom,
      decision: r.decision || '',
      so_luong_huy: r.soLuongHuy || 0,
      ly_do_qd: r.lyDoQD || '',
      nguoi_duyet: r.nguoiDuyet || null,
      ngay_duyet: r.ngayDuyet || null
    }));

    const { error } = await supabase.from('destruction_records').insert(batch);
    if (error) {
      console.error(`Lỗi nạp batch destruction_records tại dòng ${i}:`, error.message);
      return;
    }
    console.log(`Đã nạp ${Math.min(i + batchSize, records.length)}/${records.length} dòng hủy hàng...`);
  }
  console.log('✓ Hoàn thành nạp destruction_records!');
}

async function run() {
  try {
    await seedMasterItems();
    console.log('--------------------------------------------------');
    await seedDestructionRecords();
    console.log('=== QUÁ TRÌNH NẠP DỮ LIỆU HOÀN TẤT THÀNH CÔNG ===');
  } catch (err) {
    console.error('Lỗi chạy script:', err);
  }
}

run();
