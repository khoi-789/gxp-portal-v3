const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
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

console.log('Kết nối tới Supabase:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to parse dates
function parseExcelDate(val) {
  if (!val) return null;
  
  // Clean string from newlines and carriage returns first
  let str = String(val).split('\n')[0].split('\r')[0].trim();
  if (!str || str.toLowerCase() === 'na' || str.toLowerCase() === 'n/a') return null;

  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }

  // Handle dd/mm/yyyy or d/m/yyyy
  const parts = str.split('/');
  if (parts.length === 3) {
    const day = parts[0].trim().padStart(2, '0');
    const month = parts[1].trim().padStart(2, '0');
    const year = parts[2].trim();
    if (year.length === 4 && /^\d+$/.test(day) && /^\d+$/.test(month)) {
      return `${year}-${month}-${day}`;
    }
  }

  // Handle mm/yyyy or m/yyyy
  if (parts.length === 2) {
    const month = parts[0].trim().padStart(2, '0');
    const year = parts[1].trim();
    if (year.length === 4 && /^\d+$/.test(month)) {
      return `${year}-${month}-01`;
    }
  }

  // Handle yyyy-mm-dd directly if it matches
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Fallback to JS Date parser
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const iso = d.toISOString().split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        return iso;
      }
    }
  } catch (e) {}

  return null;
}

// Helper to clean up strings
function cleanStr(val) {
  if (!val) return '';
  return String(val).trim().replace(/\r\n/g, ' ').replace(/\n/g, ' ');
}

// Helper to parse numeric values
function parseNum(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Supplier prefix mappings
function getSupplierCodeFromItemCode(itemCode, supplierInRow) {
  if (supplierInRow) {
    const code = String(supplierInRow).trim().toUpperCase();
    if (code) return code;
  }
  if (!itemCode) return 'P.Tem';
  const prefix = String(itemCode).trim().substring(0, 2).toUpperCase();
  if (prefix === 'BS') return 'BESIN';
  if (prefix === 'SA') return 'SANOFI';
  if (prefix === 'HY') return 'HYPHENS';
  if (prefix === 'RD') return 'DR.REDDY';
  if (prefix === 'AZ') return 'ASTRA';
  if (prefix === 'DN') return 'DANONE';
  if (prefix === 'AL') return 'ALLEVIARE';
  if (prefix === 'AS') return 'ASCENSIA';
  return 'P.Tem';
}

async function run() {
  try {
    console.log('1. Đang tải danh sách items và suppliers hiện có để mapping...');
    const { data: dbSuppliers } = await supabase.from('master_suppliers').select('supplier_code');
    const { data: dbItems } = await supabase.from('master_items').select('item_code, item_name, supplier_code');

    // Case insensitive maps for existing records to preserve DB casing
    const supplierCaseMap = new Map(dbSuppliers.map(s => [s.supplier_code.toUpperCase(), s.supplier_code]));
    const itemCaseMap = new Map(dbItems.map(i => [i.item_code.toUpperCase(), i.item_code]));

    const missingSuppliers = new Map();
    const missingItems = new Map();

    function ensureSupplier(code, name) {
      if (!code) return 'P.Tem';
      const clean = code.trim();
      const upper = clean.toUpperCase();
      if (supplierCaseMap.has(upper)) {
        return supplierCaseMap.get(upper);
      }
      if (!missingSuppliers.has(upper)) {
        missingSuppliers.set(upper, {
          supplier_code: clean,
          supplier_name: name || clean
        });
      }
      return clean;
    }

    function ensureItem(code, name, supplierCode, visaNo = null) {
      if (!code) return null;
      const clean = code.trim();
      const upper = clean.toUpperCase();
      const finalSupplier = ensureSupplier(supplierCode || getSupplierCodeFromItemCode(clean));
      if (itemCaseMap.has(upper)) {
        return itemCaseMap.get(upper);
      }
      if (!missingItems.has(upper)) {
        missingItems.set(upper, {
          item_code: clean,
          item_name: name || `Sản phẩm ${clean}`,
          supplier_code: finalSupplier,
          visa_no: visaNo,
          is_active: true
        });
      }
      return clean;
    }

    // Fuzzy matching for item names (specifically for CC and LBL sheets)
    function findItemCodeByName(itemName) {
      if (!itemName) return null;
      const cleanName = itemName.trim().toLowerCase();
      // Try exact match on memory map
      for (const item of dbItems) {
        if (item.item_name.trim().toLowerCase() === cleanName) {
          return item.item_code;
        }
      }
      // Try substring match on memory map
      for (const item of dbItems) {
        const dbName = item.item_name.trim().toLowerCase();
        if (cleanName.includes(dbName) || dbName.includes(cleanName)) {
          return item.item_code;
        }
      }
      return null;
    }

    const prefDir = path.join(__dirname, '../Preference');

    // ==========================================
    // MODULE 1: BBSC (Biên bản Sự cố)
    // ==========================================
    console.log('\n--- XỬ LÝ MODULE BBSC ---');
    const bbscPath = path.join(prefDir, 'BBSC.csv');
    let bbscRecords = [];
    if (fs.existsSync(bbscPath)) {
      console.log('Đọc BBSC.csv...');
      const workbook = xlsx.readFile(bbscPath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet);
      console.log(`Đọc được ${rows.length} dòng. Tiến hành map dữ liệu...`);

      const bbscCodesSet = new Set();
      rows.forEach((row, idx) => {
        const itemCode = row['Mã hàng'] ? String(row['Mã hàng']).trim() : null;
        if (!itemCode) return;

        const supplier = row['Nhà cung cấp'] ? String(row['Nhà cung cấp']).trim() : 'P.Tem';
        const dateStr = parseExcelDate(row['Ngày lập']);
        
        const finalSupplier = ensureSupplier(supplier);
        const finalItemCode = ensureItem(itemCode, row['Tên sản phẩm'], supplier);

        const baseCode = row['Mã sự cố'] ? String(row['Mã sự cố']).trim() : `BBSC-MOCK-${idx}`;
        let code = baseCode;
        let count = 1;
        while (bbscCodesSet.has(code)) {
          code = `${baseCode}-${count++}`;
        }
        bbscCodesSet.add(code);

        bbscRecords.push({
          bbsc_code: code,
          created_at: dateStr ? `${dateStr}T00:00:00Z` : new Date().toISOString(),
          status: row['Trạng thái'] ? String(row['Trạng thái']).trim() : 'Khởi tạo',
          supplier_code: finalSupplier,
          department_id: row['Bộ phận'] ? String(row['Bộ phận']).trim() : 'Kho Nhập',
          item_code: finalItemCode,
          lot_number: row['Số lô'] ? String(row['Số lô']).trim() : 'N/A',
          exp_date: parseExcelDate(row['HSD']) || '2027-12-31',
          quantity: parseNum(row['SL']),
          lpn_code: row['LPN'] ? String(row['LPN']).trim() : null,
          defect_description: row['Mô tả lỗi chi tiết'] ? String(row['Mô tả lỗi chi tiết']).trim() : 'Lỗi cảm quan',
          resolution_action: row['Hành động khắc phục'] ? String(row['Hành động khắc phục']).trim() : null,
          custom_fields: {
            dvt: row['ĐVT'] || null,
            inv: row['Số HĐ (INV)'] || null,
            type: row['Loại sự cố'] || null,
            tags: row['Nhãn dán (Tags)'] || null,
            notes: row['Ghi chú chung'] || null
          }
        });
      });

      // Sắp xếp giảm dần theo ngày và lấy tối đa 500 bản ghi mới nhất
      bbscRecords.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      bbscRecords = bbscRecords.slice(0, 500);
      console.log(`Đã chọn được ${bbscRecords.length} sự cố BBSC mới nhất.`);
    }

    // ==========================================
    // MODULE 2: CC (Khiếu nại khách hàng)
    // ==========================================
    console.log('\n--- XỬ LÝ MODULE CC ---');
    const ccPath = path.join(prefDir, 'CC.xlsx');
    let ccRecords = [];
    if (fs.existsSync(ccPath)) {
      console.log('Đọc CC.xlsx...');
      const workbook = xlsx.readFile(ccPath);
      const sheet = workbook.Sheets['2025-New'] || workbook.Sheets['2025'];
      const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      
      // Headers are at Row 6 (index 5) or Row 3 (index 2)
      let headerRowIndex = 2; // Default for 2025-New row 3
      for (let r = 0; r < rawRows.length; r++) {
        if (rawRows[r] && rawRows[r].some(c => String(c).includes('Code \r\nCC-') || String(c).includes('Code CC-'))) {
          headerRowIndex = r;
          break;
        }
      }
      console.log(`Tìm thấy header của CC tại dòng ${headerRowIndex + 1}`);
      const headers = rawRows[headerRowIndex];
      const rows = rawRows.slice(headerRowIndex + 1);

      const ccCodesSet = new Set();
      rows.forEach((row, idx) => {
        if (!row || !row[2]) return; // Skip if no CC Code

        const complaintDate = parseExcelDate(row[1]) || new Date().toISOString().split('T')[0];
        const baseCcCode = cleanStr(row[2]);
        const customerName = cleanStr(row[3]);
        const customerAddress = cleanStr(row[4]);
        const productName = cleanStr(row[5]);
        const lotNumber = cleanStr(row[6]) || 'N/A';
        const mfgDate = parseExcelDate(row[7]);
        const expDate = parseExcelDate(row[8]) || '2027-12-31';
        const unit = cleanStr(row[9]) || 'Hộp';
        const quantity = parseNum(row[10]);
        const complaintReason = cleanStr(row[11]) || 'Không có mô tả chi tiết';
        const rootCause = cleanStr(row[12]);
        const status = cleanStr(row[13]) || 'Khởi tạo';
        const isInfoSecured = String(row[14]).toLowerCase() === 'x';
        const receiveMethod = cleanStr(row[15]);
        const supplierAction = cleanStr(row[16]);
        const receivedDate = parseExcelDate(row[17]);

        let ccCode = baseCcCode;
        let count = 1;
        while (ccCodesSet.has(ccCode)) {
          ccCode = `${baseCcCode}-${count++}`;
        }
        ccCodesSet.add(ccCode);

        // Attempt to find product code
        let itemCode = findItemCodeByName(productName);
        if (!itemCode) {
          // Generate a mock code based on product name/supplier
          let prefix = 'SA';
          if (productName.toUpperCase().includes('IMOJEV') || productName.toUpperCase().includes('VERORAB') || productName.toUpperCase().includes('VAXIGRIP') || productName.toUpperCase().includes('DEPAKINE')) {
            prefix = 'SA';
          } else if (productName.toUpperCase().includes('CERADAN') || productName.toUpperCase().includes('TDF') || productName.toUpperCase().includes('OCEAN HEALTH')) {
            prefix = 'HY';
          } else if (productName.toUpperCase().includes('CALQUENCE') || productName.toUpperCase().includes('NOLVADEX')) {
            prefix = 'AZ';
          }
          itemCode = `${prefix}-CC-MOCK-${idx}`;
          ensureSupplier(prefix === 'SA' ? 'SANOFI' : prefix === 'HY' ? 'HYPHENS' : 'ASTRA');
          ensureItem(itemCode, productName, prefix === 'SA' ? 'SANOFI' : prefix === 'HY' ? 'HYPHENS' : 'ASTRA');
        }

        const supplier = getSupplierCodeFromItemCode(itemCode);
        const finalSupplier = ensureSupplier(supplier);
        const finalItemCode = ensureItem(itemCode, productName, supplier);

        ccRecords.push({
          cc_code: ccCode,
          complaint_date: complaintDate,
          customer_name: customerName,
          customer_address: customerAddress,
          item_code: finalItemCode,
          supplier_code: finalSupplier,
          lot_number: lotNumber,
          mfg_date: mfgDate,
          exp_date: expDate,
          unit: unit,
          quantity: quantity,
          complaint_reason: complaintReason,
          root_cause: rootCause,
          status: status,
          is_info_secured: isInfoSecured,
          receive_method: receiveMethod,
          supplier_action: supplierAction,
          received_date: receivedDate
        });
      });

      // Sort and take 500
      ccRecords.sort((a, b) => new Date(b.complaint_date) - new Date(a.complaint_date));
      ccRecords = ccRecords.slice(0, 500);
      console.log(`Đã chọn được ${ccRecords.length} khiếu nại CC mới nhất.`);
    }

    // ==========================================
    // MODULE 3: INT (Biên bản nội bộ)
    // ==========================================
    console.log('\n--- XỬ LÝ MODULE INT ---');
    const intPath = path.join(prefDir, 'Bien ban noi bo.xlsx');
    let intRecords = [];
    if (fs.existsSync(intPath)) {
      console.log('Đọc Bien ban noi bo.xlsx...');
      const workbook = xlsx.readFile(intPath);
      const sheet = workbook.Sheets['Theo dõi 2024-2026'];
      const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      
      const headers = rawRows[0];
      const intCodesSet = new Set();
      const rows = rawRows.slice(1);

      rows.forEach((row, idx) => {
        if (!row || !row[1] || !row[3] || String(row[3]).trim() === '') return; // Skip if no code or no item_code

        const dateStr = parseExcelDate(row[0]) || new Date().toISOString().split('T')[0];
        const baseIntCode = cleanStr(row[1]);
        const category = cleanStr(row[2]) || 'Nội bộ kho xử lý';
        const itemCode = cleanStr(row[3]);
        const productName = cleanStr(row[4]);
        const lotNumber = cleanStr(row[5]) || 'N/A';
        const expDate = parseExcelDate(row[6]) || '2027-12-31';
        const lpnCode = cleanStr(row[7]) || 'N/A';
        const quantity = parseNum(row[8]);
        const incidentContent = cleanStr(row[9]) || 'Sự cố kho';
        const handlingStatus = cleanStr(row[10]) || 'Chờ xác định';
        const actionNotes = cleanStr(row[11]);
        const refLink = cleanStr(row[12]);
        const isInStock = String(row[14]).toLowerCase() !== 'không';

        let intCode = baseIntCode;
        let count = 1;
        while (intCodesSet.has(intCode)) {
          intCode = `${baseIntCode}-${count++}`;
        }
        intCodesSet.add(intCode);

        const supplier = getSupplierCodeFromItemCode(itemCode);
        const finalSupplier = ensureSupplier(supplier);
        const finalItemCode = ensureItem(itemCode, productName, supplier);

        intRecords.push({
          int_code: intCode,
          created_at: `${dateStr}T00:00:00Z`,
          category: category,
          item_code: finalItemCode,
          supplier_code: finalSupplier,
          lot_number: lotNumber,
          exp_date: expDate,
          lpn_code: lpnCode,
          quantity: quantity,
          incident_content: incidentContent,
          handling_status: handlingStatus,
          action_notes: actionNotes,
          ref_link: refLink,
          is_in_stock: isInStock
        });
      });

      intRecords.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      intRecords = intRecords.slice(0, 500);
      console.log(`Đã chọn được ${intRecords.length} biên bản nội bộ INT mới nhất.`);
    }

    // ==========================================
    // MODULE 4: LBL (Quản lý nhãn phụ)
    // ==========================================
    console.log('\n--- XỬ LÝ MODULE LBL ---');
    const lblPath = path.join(prefDir, 'Nhan phu.xlsx');
    let lblRecords = [];
    if (fs.existsSync(lblPath)) {
      console.log('Đọc Nhan phu.xlsx...');
      const workbook = xlsx.readFile(lblPath);
      const sheet = workbook.Sheets['2022-Nay'];
      const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      
      const rows = rawRows.slice(6); // Data starts after header on Row 6 (index 5)

      const lblKeysSet = new Set();
      rows.forEach((row, idx) => {
        if (!row || !row[2]) return; // Skip if no Mã hóa

        const productName = cleanStr(row[1]);
        const rawCode = cleanStr(row[2]);
        const effectiveDate = parseExcelDate(row[3]) || new Date().toISOString().split('T')[0];
        const changeReason = cleanStr(row[4]);
        const supplierInRow = cleanStr(row[5]);

        let productCategory = 'Thuốc';
        if (String(row[6]).toLowerCase() === 'x') productCategory = 'Thuốc';
        else if (String(row[7]).toLowerCase() === 'x') productCategory = 'TPCN';
        else if (String(row[8]).toLowerCase() === 'x') productCategory = 'TTBYT';
        else if (String(row[9]).toLowerCase() === 'x') productCategory = 'Mỹ phẩm';

        // Parse Code: e.g. "00370 - Ver01" -> base_label_code: "00370", version_number: "Ver01"
        const cleanCode = rawCode.split('\n')[0].split('\r')[0].trim();
        const codeParts = cleanCode.split('-');
        let baseLabelCode = cleanCode;
        let versionNumber = 'Ver01';

        if (codeParts.length >= 2) {
          baseLabelCode = codeParts[0].trim();
          versionNumber = codeParts[1].trim();
        }

        // Try mapping to a product item
        let itemCode = findItemCodeByName(productName);
        if (!itemCode) {
          // Fallback sequence
          itemCode = `LBL-MOCK-${baseLabelCode}`;
          ensureSupplier(supplierInRow || 'P.Tem');
          ensureItem(itemCode, productName, supplierInRow || 'P.Tem');
        }

        const supplier = getSupplierCodeFromItemCode(itemCode);
        const finalSupplier = ensureSupplier(supplierInRow || supplier);
        const finalItemCode = ensureItem(itemCode, productName, supplierInRow || supplier);

        const uniqueKey = `${finalItemCode.toUpperCase()}::${versionNumber.toUpperCase()}`;
        if (lblKeysSet.has(uniqueKey)) return;
        lblKeysSet.add(uniqueKey);

        lblRecords.push({
          item_code: finalItemCode,
          product_category: productCategory,
          supplier_code: finalSupplier,
          base_label_code: baseLabelCode,
          version_number: versionNumber,
          status: 'Active',
          effective_date: effectiveDate,
          change_reason: changeReason
        });
      });

      lblRecords.sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));
      lblRecords = lblRecords.slice(0, 500);
      console.log(`Đã chọn được ${lblRecords.length} nhãn phụ LBL mới nhất.`);
    }

    // ==========================================
    // MODULE 5 & 6: LDG (Lệnh đóng gói & LPNs)
    // ==========================================
    console.log('\n--- XỬ LÝ MODULE LDG ---');
    const ldgPath = path.join(prefDir, 'LDG.xlsx');
    let ldgOrders = [];
    let ldgLpns = [];
    if (fs.existsSync(ldgPath)) {
      console.log('Đọc LDG.xlsx...');
      const workbook = xlsx.readFile(ldgPath);
      const sheet = workbook.Sheets['Sheet1'];
      const rows = xlsx.utils.sheet_to_json(sheet);
      console.log(`Đọc được ${rows.length} dòng đóng gói. Đang nhóm theo Lệnh DG...`);

      // Group by Lệnh DG
      const groups = {};
      rows.forEach(row => {
        const ldgCode = row['Lệnh DG'] ? String(row['Lệnh DG']).trim() : null;
        if (!ldgCode) return;
        if (!groups[ldgCode]) {
          groups[ldgCode] = [];
        }
        groups[ldgCode].push(row);
      });

      const uniqueLdgCodes = Object.keys(groups);
      console.log(`Tìm thấy ${uniqueLdgCodes.length} mã Lệnh DG duy nhất.`);

      uniqueLdgCodes.forEach(ldgCode => {
        const groupRows = groups[ldgCode];
        const firstRow = groupRows[0];

        const dateStr = parseExcelDate(firstRow['Ngày']) || new Date().toISOString().split('T')[0];
        const itemCode = firstRow['Mã sản phẩm\r\n(Item code)'] ? String(firstRow['Mã sản phẩm\r\n(Item code)']).trim() : 'MOCK-ITEM';
        const productName = firstRow['Tên Sản phẩm\r\n(Item Description)'] ? String(firstRow['Tên Sản phẩm\r\n(Item Description)']).trim() : '';
        const supplierInRow = firstRow['Hãng'] ? String(firstRow['Hãng']).trim() : 'P.Tem';
        const lotNumber = firstRow['Số Lô\r\n(Batch)'] ? String(firstRow['Số Lô\r\n(Batch)']).trim() : 'N/A';
        const expDate = parseExcelDate(firstRow['HSD\r\n(Exp. Date)']) || '2027-12-31';
        const batchSize = parseNum(firstRow['Cỡ lô']) || groupRows.reduce((sum, r) => sum + parseNum(r['Số lượng\r\n(Qty)']), 0);
        const packagingReq = firstRow['Yêu cầu đóng gói'] ? String(firstRow['Yêu cầu đóng gói']).trim() : null;
        const sixSidesPhoto = firstRow['Chụp hình 6 mặt'] ? String(firstRow['Chụp hình 6 mặt']).trim() : null;
        const notes = firstRow['GHI CHÚ'] ? String(firstRow['GHI CHÚ']).trim() : null;

        const supplier = getSupplierCodeFromItemCode(itemCode);
        const finalSupplier = ensureSupplier(supplierInRow || supplier);
        const finalItemCode = ensureItem(itemCode, productName, supplierInRow || supplier);

        ldgOrders.push({
          ldg_code: ldgCode,
          created_date: dateStr,
          item_code: finalItemCode,
          supplier_code: finalSupplier,
          lot_number: lotNumber,
          exp_date: expDate,
          batch_size: batchSize,
          packaging_req: packagingReq,
          six_sides_photo: sixSidesPhoto,
          status: 'Released',
          general_notes: notes,
          updated_at: `${dateStr}T00:00:00Z`
        });

        // Add LPNs
        groupRows.forEach(row => {
          const lpnCode = row['LPN'] ? String(row['LPN']).trim() : null;
          if (!lpnCode) return;

          ldgLpns.push({
            ldg_code: ldgCode,
            lpn_code: lpnCode,
            quantity: parseNum(row['Số lượng\r\n(Qty)']),
            released_qty: row['Số lượng release'] ? parseNum(row['Số lượng release']) : null,
            incident_note: row['Sự cố'] ? String(row['Sự cố']).trim() : null,
            incident_ref: row['INV'] ? String(row['INV']).trim() : null
          });
        });
      });

      // Sort and take 500 Lệnh DG
      ldgOrders.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      ldgOrders = ldgOrders.slice(0, 500);

      // Filter LPNs to only contain LPNs belonging to the selected 500 orders
      const selectedLdgCodes = new Set(ldgOrders.map(o => o.ldg_code));
      ldgLpns = ldgLpns.filter(l => selectedLdgCodes.has(l.ldg_code));

      console.log(`Đã chọn được ${ldgOrders.length} Lệnh DG và ${ldgLpns.length} LPNs liên quan.`);
    }

    // ==========================================
    // MODULE 7: AWC (Thay đổi Artwork)
    // ==========================================
    console.log('\n--- XỬ LÝ MODULE AWC ---');
    const awcPath = path.join(prefDir, 'Theo dõi thay đổi AW.xlsx');
    let awcRecords = [];
    if (fs.existsSync(awcPath)) {
      console.log('Đọc Theo dõi thay đổi AW.xlsx...');
      const workbook = xlsx.readFile(awcPath);
      const sheet = workbook.Sheets['Change'];
      const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      
      const headers = rawRows[0];
      const awcCodesSet = new Set();
      const rows = rawRows.slice(1);

      rows.forEach((row, idx) => {
        if (!row || !row[1]) return; // Skip if no code

        const dateStr = parseExcelDate(row[0]) || new Date().toISOString().split('T')[0];
        const baseAwcCode = cleanStr(row[1]);
        const itemCode = cleanStr(row[2]);
        const productName = cleanStr(row[3]);
        const changeInfo = cleanStr(row[4]);
        const expectedBatch = cleanStr(row[5]);
        const estReceive = parseExcelDate(row[6]);
        const actualBatch = cleanStr(row[7]);
        const actReceive = parseExcelDate(row[8]);
        const evidenceUrl = cleanStr(row[9]);
        const oldInfo = cleanStr(row[10]);

        let awcCode = baseAwcCode;
        let count = 1;
        while (awcCodesSet.has(awcCode)) {
          awcCode = `${baseAwcCode}-${count++}`;
        }
        awcCodesSet.add(awcCode);

        const supplier = getSupplierCodeFromItemCode(itemCode);
        const finalSupplier = ensureSupplier(supplier);
        const finalItemCode = ensureItem(itemCode, productName, supplier);

        awcRecords.push({
          awc_code: awcCode,
          notice_date: dateStr,
          item_code: finalItemCode,
          supplier_code: finalSupplier,
          status: actualBatch ? 'Verified' : 'Alerted',
          old_info: oldInfo,
          new_change_info: changeInfo,
          expected_batch: expectedBatch,
          estimated_receive: estReceive,
          actual_batch: actualBatch,
          actual_receive: actReceive,
          evidence_url: evidenceUrl
        });
      });

      awcRecords.sort((a, b) => new Date(b.notice_date) - new Date(a.notice_date));
      awcRecords = awcRecords.slice(0, 500);
      console.log(`Đã chọn được ${awcRecords.length} thay đổi Artwork AWC mới nhất.`);
    }

    // ==========================================
    // 2. THỰC HIỆN BATCH INSERT/UPSERT LÊN SUPABASE
    // ==========================================
    console.log('\n==================================================');
    console.log('TIẾN HÀNH NẠP DỮ LIỆU LÊN SUPABASE...');

    // Nạp missing suppliers
    if (missingSuppliers.size > 0) {
      const suppliersToInsert = Array.from(missingSuppliers.values());
      console.log(`Đang nạp ${suppliersToInsert.length} Nhà cung cấp mới...`);
      const { error } = await supabase.from('master_suppliers').upsert(suppliersToInsert, { onConflict: 'supplier_code' });
      if (error) throw new Error(`Lỗi nạp suppliers: ${error.message}`);
      console.log('✓ Nạp suppliers thành công.');
    }

    // Nạp missing items
    if (missingItems.size > 0) {
      const itemsToInsert = Array.from(missingItems.values());
      console.log(`Đang nạp ${itemsToInsert.length} Sản phẩm mới vào Master Items...`);
      // Chunk nạp vì số lượng có thể lớn
      const chunkSize = 100;
      for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
        const chunk = itemsToInsert.slice(i, i + chunkSize);
        const { error } = await supabase.from('master_items').upsert(chunk, { onConflict: 'item_code' });
        if (error) {
          console.error(`Thất bại tại chunk ${i}:`, chunk);
          throw new Error(`Lỗi nạp items chunk ${i}: ${error.message}`);
        }
      }
      console.log('✓ Nạp items thành công.');
    }

    // Seed BBSC
    if (bbscRecords.length > 0) {
      console.log(`Đang xóa dữ liệu cũ và nạp ${bbscRecords.length} dòng bbsc_incidents...`);
      await supabase.from('bbsc_incidents').delete().neq('lot_number', '');
      const { error } = await supabase.from('bbsc_incidents').insert(bbscRecords);
      if (error) console.error('Lỗi BBSC:', error.message);
      else console.log('✓ Hoàn thành nạp BBSC.');
    }

    // Seed CC
    if (ccRecords.length > 0) {
      console.log(`Đang xóa dữ liệu cũ và nạp ${ccRecords.length} dòng cc_complaints...`);
      await supabase.from('cc_complaints').delete().neq('lot_number', '');
      const { error } = await supabase.from('cc_complaints').insert(ccRecords);
      if (error) console.error('Lỗi CC:', error.message);
      else console.log('✓ Hoàn thành nạp CC.');
    }

    // Seed INT
    if (intRecords.length > 0) {
      console.log(`Đang xóa dữ liệu cũ và nạp ${intRecords.length} dòng int_records...`);
      await supabase.from('int_records').delete().neq('lot_number', '');
      const { error } = await supabase.from('int_records').insert(intRecords);
      if (error) console.error('Lỗi INT:', error.message);
      else console.log('✓ Hoàn thành nạp INT.');
    }

    // Seed LBL
    if (lblRecords.length > 0) {
      console.log(`Đang xóa dữ liệu cũ và nạp ${lblRecords.length} dòng lbl_labels...`);
      await supabase.from('lbl_labels').delete().neq('version_number', '');
      const { error } = await supabase.from('lbl_labels').insert(lblRecords);
      if (error) console.error('Lỗi LBL:', error.message);
      else console.log('✓ Hoàn thành nạp LBL.');
    }

    // Seed LDG Orders & LPNs
    if (ldgOrders.length > 0) {
      console.log(`Đang xóa dữ liệu cũ và nạp ${ldgOrders.length} dòng ldg_orders...`);
      // Delete child LPNs first
      await supabase.from('ldg_lpns').delete().neq('lpn_code', '');
      await supabase.from('ldg_orders').delete().neq('lot_number', '');

      const { error: orderErr } = await supabase.from('ldg_orders').insert(ldgOrders);
      if (orderErr) {
        console.error('Lỗi LDG Orders:', orderErr.message);
      } else {
        console.log('✓ Hoàn thành nạp LDG Orders.');
        if (ldgLpns.length > 0) {
          console.log(`Đang nạp ${ldgLpns.length} dòng ldg_lpns...`);
          const { error: lpnErr } = await supabase.from('ldg_lpns').insert(ldgLpns);
          if (lpnErr) console.error('Lỗi LDG LPNs:', lpnErr.message);
          else console.log('✓ Hoàn thành nạp LDG LPNs.');
        }
      }
    }

    // Seed AWC
    if (awcRecords.length > 0) {
      console.log(`Đang xóa dữ liệu cũ và nạp ${awcRecords.length} dòng awc_changes...`);
      await supabase.from('awc_changes').delete().neq('awc_code', '');
      const { error } = await supabase.from('awc_changes').insert(awcRecords);
      if (error) console.error('Lỗi AWC:', error.message);
      else console.log('✓ Hoàn thành nạp AWC.');
    }

    console.log('\n==================================================');
    console.log('=== SEEDING HOÀN TẤT THÀNH CÔNG THUẬN LỢI! ===');

  } catch (err) {
    console.error('Lỗi nghiêm trọng trong quá trình seed:', err.message || err);
  }
}

run();
