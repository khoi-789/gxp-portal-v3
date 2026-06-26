const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
let supabaseUrl = '';
let supabaseServiceKey = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
  const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
  if (keyMatch) supabaseServiceKey = keyMatch[1].trim();
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function generateSupplierCode(name) {
  if (!name) return '';
  // Chuyển sang không dấu
  const nonAccent = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Chuyển sang chữ hoa, thay thế ký tự đặc biệt bằng gạch dưới, giữ chữ và số
  const code = nonAccent.toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return code || `NCC_${Date.now()}`;
}

async function run() {
  try {
    const excelPath = path.join(__dirname, '../Preference/NCC.xlsx');
    console.log('Đang đọc file Excel:', excelPath);
    const workbook = xlsx.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    console.log(`Đọc được ${rows.length} nhà cung cấp từ Excel.`);

    const suppliersToUpsert = rows.map(row => {
      const name = String(row['NCC']).trim();
      const typeRaw = String(row['Loại hình']).trim();
      
      // Chuẩn hóa loại hình
      let business_type = [];
      if (typeRaw.toLowerCase().includes('nhập khẩu')) {
        business_type = ['Nhập Khẩu'];
      } else if (typeRaw.toLowerCase().includes('trong nước')) {
        business_type = ['Trong nước'];
      } else if (typeRaw.toLowerCase().includes('tự doanh')) {
        business_type = ['Tự doanh'];
      } else if (typeRaw) {
        business_type = [typeRaw];
      }

      return {
        supplier_code: generateSupplierCode(name),
        supplier_name: name,
        business_type: business_type,
      };
    });

    console.log('Danh sách mã NCC được sinh ra:');
    console.log(suppliersToUpsert.map(s => `${s.supplier_name} -> ${s.supplier_code}`));

    // 1. Upsert 42 nhà cung cấp vào database
    console.log('\nTiến hành Upsert 42 nhà cung cấp vào Supabase...');
    const { data: upsertedData, error: upsertError } = await supabase
      .from('master_suppliers')
      .upsert(suppliersToUpsert)
      .select();

    if (upsertError) {
      throw upsertError;
    }
    console.log(`Đã upsert thành công ${upsertedData.length} nhà cung cấp.`);

    // 2. Dọn dẹp các nhà cung cấp cũ không nằm trong danh sách 42 NCC mới
    const activeCodes = suppliersToUpsert.map(s => s.supplier_code);
    console.log('\nTiến hành dọn dẹp các nhà cung cấp cũ không nằm trong danh sách 42 NCC...');
    
    // Lấy tất cả nhà cung cấp hiện có trong DB
    const { data: allDbSuppliers, error: fetchError } = await supabase
      .from('master_suppliers')
      .select('supplier_code, supplier_name');

    if (fetchError) throw fetchError;

    const toDelete = allDbSuppliers.filter(s => !activeCodes.includes(s.supplier_code));
    console.log(`Phát hiện ${toDelete.length} nhà cung cấp dư thừa cần xóa.`);

    let deleteSuccessCount = 0;
    let deleteFailCount = 0;

    for (const s of toDelete) {
      console.log(`Đang thử xóa: [${s.supplier_code}] ${s.supplier_name}...`);
      const { error: deleteError } = await supabase
        .from('master_suppliers')
        .delete()
        .eq('supplier_code', s.supplier_code);

      if (deleteError) {
        console.warn(`⚠️ Không thể xóa NCC ${s.supplier_name} do đang có ràng buộc dữ liệu: ${deleteError.message}`);
        deleteFailCount++;
      } else {
        console.log(`✅ Đã xóa thành công: ${s.supplier_name}`);
        deleteSuccessCount++;
      }
    }

    console.log(`\nHoàn tất dọn dẹp: Đã xóa ${deleteSuccessCount} NCC dư thừa, bỏ qua ${deleteFailCount} NCC do có ràng buộc dữ liệu.`);
    console.log('Quá trình đồng bộ danh mục nhà cung cấp hoàn tất thành công!');

  } catch (e) {
    console.error('Lỗi khi chạy script:', e.message);
  }
}

run();
