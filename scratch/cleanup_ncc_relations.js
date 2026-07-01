const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const targetSuppliers = [
  "P.Tem",
  "Astra",
  "Hyphens",
  "DR.REDDY'S",
  "VITABIOTIC - VE PHARMA",
  "MEGA (MAXXCARE)",
  "VE PHARMA"
];

async function run() {
  console.log('--- BƯỚC 1: Tìm thông tin các sản phẩm (master_items) thuộc về 7 nhà cung cấp này ---');
  const { data: items, error: itemsError } = await supabase
    .from('master_items')
    .select('item_code, item_name, supplier_code')
    .in('supplier_code', targetSuppliers);
  
  if (itemsError) {
    console.error('Lỗi lấy danh sách sản phẩm:', itemsError.message);
    return;
  }
  
  const itemCodes = items.map(it => it.item_code).filter(Boolean);
  console.log(`Tìm thấy ${items.length} sản phẩm thuộc 7 NCC này:`, itemCodes);

  console.log('\n--- BƯỚC 2: Tìm các mã LDG liên kết để xóa LPNs trước ---');
  let ldgCodesToDelete = [];
  
  // Lấy các ldg_code liên kết qua supplier_code hoặc item_code
  const { data: ldgOrders, error: ldgError } = await supabase
    .from('ldg_orders')
    .select('ldg_code')
    .or(`supplier_code.in.(${targetSuppliers.map(s => `"${s}"`).join(',')})${itemCodes.length > 0 ? `,item_code.in.(${itemCodes.map(i => `"${i}"`).join(',')})` : ''}`);

  if (ldgError) {
    console.error('Lỗi lấy danh sách ldg_orders:', ldgError.message);
  } else if (ldgOrders && ldgOrders.length > 0) {
    ldgCodesToDelete = ldgOrders.map(o => o.ldg_code).filter(Boolean);
    console.log(`Tìm thấy ${ldgCodesToDelete.length} mã LDG cần xóa:`, ldgCodesToDelete);
    
    // Xóa ldg_lpns trước
    const { data: delLpns, error: errLpns } = await supabase
      .from('ldg_lpns')
      .delete()
      .in('ldg_code', ldgCodesToDelete)
      .select();
    if (errLpns) console.error('Lỗi xóa ldg_lpns:', errLpns.message);
    else console.log(`Đã xóa ${delLpns ? delLpns.length : 0} hàng trong ldg_lpns`);
  }

  console.log('\n--- BƯỚC 3: Xóa dữ liệu liên quan ở các bảng nghiệp vụ (Module) liên kết qua item_code ---');
  
  // 3.1 product_label_mappings
  if (itemCodes.length > 0) {
    const { data: deletedMappings, error: errMap } = await supabase
      .from('product_label_mappings')
      .delete()
      .or(`product_item_code.in.(${itemCodes.map(i => `"${i}"`).join(',')}),label_item_code.in.(${itemCodes.map(i => `"${i}"`).join(',')})`)
      .select();
    if (errMap) console.error('Lỗi xóa product_label_mappings:', errMap.message);
    else console.log(`Đã xóa ${deletedMappings ? deletedMappings.length : 0} hàng trong product_label_mappings`);
  }

  // 3.2 lbl_labels
  if (itemCodes.length > 0) {
    const { data: deletedLbls, error: errLbl } = await supabase
      .from('lbl_labels')
      .delete()
      .in('item_code', itemCodes)
      .select();
    if (errLbl) console.error('Lỗi xóa lbl_labels:', errLbl.message);
    else console.log(`Đã xóa ${deletedLbls ? deletedLbls.length : 0} hàng trong lbl_labels`);
  }

  // 3.3 ldg_orders
  if (ldgCodesToDelete.length > 0) {
    const { data: deletedLdgs, error: errLdg } = await supabase
      .from('ldg_orders')
      .delete()
      .in('ldg_code', ldgCodesToDelete)
      .select();
    if (errLdg) console.error('Lỗi xóa ldg_orders:', errLdg.message);
    else console.log(`Đã xóa ${deletedLdgs ? deletedLdgs.length : 0} hàng trong ldg_orders`);
  } else if (itemCodes.length > 0) {
    const { data: deletedLdgs, error: errLdg } = await supabase
      .from('ldg_orders')
      .delete()
      .in('item_code', itemCodes)
      .select();
    if (errLdg) console.error('Lỗi xóa ldg_orders bằng item_code:', errLdg.message);
    else console.log(`Đã xóa ${deletedLdgs ? deletedLdgs.length : 0} hàng trong ldg_orders`);
  }

  // 3.4 imp_shipment_items (dùng cột item_code)
  if (itemCodes.length > 0) {
    const { data: deletedShipItems, error: errShipItems } = await supabase
      .from('imp_shipment_items')
      .delete()
      .in('item_code', itemCodes)
      .select();
    if (errShipItems) console.error('Lỗi xóa imp_shipment_items:', errShipItems.message);
    else console.log(`Đã xóa ${deletedShipItems ? deletedShipItems.length : 0} hàng trong imp_shipment_items`);
  }

  console.log('\n--- BƯỚC 4: Xóa dữ liệu liên quan ở các bảng nghiệp vụ (Module) liên kết qua supplier_code ---');

  // 4.1 bbsc_incidents
  const { data: delBBSC, error: errBBSC } = await supabase
    .from('bbsc_incidents')
    .delete()
    .in('supplier_code', targetSuppliers)
    .select();
  if (errBBSC) console.error('Lỗi xóa bbsc_incidents:', errBBSC.message);
  else console.log(`Đã xóa ${delBBSC ? delBBSC.length : 0} hàng trong bbsc_incidents`);

  // 4.2 int_records
  const { data: delINT, error: errINT } = await supabase
    .from('int_records')
    .delete()
    .in('supplier_code', targetSuppliers)
    .select();
  if (errINT) console.error('Lỗi xóa int_records:', errINT.message);
  else console.log(`Đã xóa ${delINT ? delINT.length : 0} hàng trong int_records`);

  // 4.3 awc_changes
  const { data: delAWC, error: errAWC } = await supabase
    .from('awc_changes')
    .delete()
    .in('supplier_code', targetSuppliers)
    .select();
  if (errAWC) console.error('Lỗi xóa awc_changes:', errAWC.message);
  else console.log(`Đã xóa ${delAWC ? delAWC.length : 0} hàng trong awc_changes`);

  // 4.4 cc_complaints
  const { data: delCC, error: errCC } = await supabase
    .from('cc_complaints')
    .delete()
    .in('supplier_code', targetSuppliers)
    .select();
  if (errCC) console.error('Lỗi xóa cc_complaints:', errCC.message);
  else console.log(`Đã xóa ${delCC ? delCC.length : 0} hàng trong cc_complaints`);

  // 4.5 imp_shipments
  const { data: delShipments, error: errShipments } = await supabase
    .from('imp_shipments')
    .delete()
    .in('supplier_code', targetSuppliers)
    .select();
  if (errShipments) console.error('Lỗi xóa imp_shipments:', errShipments.message);
  else console.log(`Đã xóa ${delShipments ? delShipments.length : 0} hàng trong imp_shipments`);

  console.log('\n--- BƯỚC 5: Xóa sản phẩm (master_items) thuộc về các nhà cung cấp này ---');
  const { data: delItems, error: errDelItems } = await supabase
    .from('master_items')
    .delete()
    .in('supplier_code', targetSuppliers)
    .select();
  if (errDelItems) console.error('Lỗi xóa master_items:', errDelItems.message);
  else console.log(`Đã xóa ${delItems ? delItems.length : 0} sản phẩm trong master_items`);

  console.log('\n--- BƯỚC 6: Xóa nhà cung cấp (master_suppliers) không có Loại hình ---');
  const { data: delSuppliers, error: errDelSuppliers } = await supabase
    .from('master_suppliers')
    .delete()
    .in('supplier_code', targetSuppliers)
    .select();
  if (errDelSuppliers) console.error('Lỗi xóa master_suppliers:', errDelSuppliers.message);
  else console.log(`Đã xóa thành công ${delSuppliers ? delSuppliers.length : 0} nhà cung cấp.`);
}

run();
