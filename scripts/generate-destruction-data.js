/**
 * generate-destruction-data.js
 * Parse 4 Excel files → public/destruction-data.json
 * Run: node scripts/generate-destruction-data.js
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'Module-Destruction');
const OUT  = path.join(__dirname, '..', 'public', 'destruction-data.json');

/* ─── 1. Load all workbooks ──────────────────────────────────────── */
function loadSheet(file, sheetName) {
  const wb = XLSX.readFile(path.join(BASE, file));
  const sheet = sheetName
    ? wb.Sheets[sheetName]
    : wb.Sheets[wb.SheetNames[0]];
  return sheet;
}

/* ─── 2. Parse Q file (base list) ───────────────────────────────── */
function parseQ() {
  const sheet = loadSheet('Q 08.05.2026.xlsx');
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const header = rows[0]; // ["Owner","Item","Description","Location","LPN","On Hand","Available","Status","Lottable 02","Lottable 03","Expiration Date","Lottable 06"]

  const colIndex = (name) => header.indexOf(name);
  const iOwner    = colIndex('Owner');
  const iItem     = colIndex('Item');
  const iDescr    = colIndex('Description');
  const iLoc      = colIndex('Location');
  const iLPN      = colIndex('LPN');
  const iOnHand   = colIndex('On Hand');
  const iAvail    = colIndex('Available');
  const iStatus   = colIndex('Status');
  const iL02      = colIndex('Lottable 02');  // Visa / ASN
  const iL03      = colIndex('Lottable 03');  // Số lô (ASN/HSD)
  const iExpDate  = colIndex('Expiration Date');
  const iL06      = colIndex('Lottable 06');  // Số lô

  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row[iItem]) continue;

    // Excel serial → date string
    let expDate = '';
    if (row[iExpDate]) {
      const d = XLSX.SSF.parse_date_code(row[iExpDate]);
      if (d) {
        expDate = `${String(d.d).padStart(2,'0')}/${String(d.m).padStart(2,'0')}/${d.y}`;
      }
    }

    records.push({
      owner:      String(row[iOwner]  || '').trim(),
      item:       String(row[iItem]   || '').trim(),
      descr:      String(row[iDescr]  || '').trim(),
      location:   String(row[iLoc]    || '').trim(),
      lpn:        String(row[iLPN]    || '').trim(),
      onHand:     Number(row[iOnHand] || 0),
      available:  Number(row[iAvail]  || 0),
      status:     String(row[iStatus] || '').trim(),
      visa:       String(row[iL02]    || '').trim(),   // Lottable 02 = ASN/Visa
      lotNo:      String(row[iL03]    || '').trim(),   // Lottable 03
      expDate,
      soBatch:    String(row[iL06]    || '').trim(),   // Lottable 06
    });
  }
  return records;
}

/* ─── 3. Parse HOLD file (by LPN) ───────────────────────────────── */
function parseHold() {
  const sheet = loadSheet('HOLD.xlsx', 'Report');
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  // Row 0 = title, Row 1 = date, Row 2 = headers
  const header = rows[2];
  // STT|Owner|Tên công ty|Mã hàng|Tên hàng|ĐVT|Vị Trí|LPN|Số lượng|Lô|HSD|Lý do Hold|Loại Hold|Ngày Hold|Người Hold|Ghi chú
  const iLPN       = header.indexOf('LPN');
  const iItem      = header.indexOf('Mã hàng');
  const iLyDo      = header.indexOf('Lý do Hold');
  const iLoaiHold  = header.indexOf('Loại Hold');
  const iNgayHold  = header.indexOf('Ngày Hold');
  const iNguoiHold = header.indexOf('Người Hold');
  const iGhiChu    = header.indexOf('Ghi chú');

  // Map: LPN → hold info (may have multiple entries per LPN, keep first)
  const map = new Map();
  for (let r = 3; r < rows.length; r++) {
    const row = rows[r];
    const lpn = String(row[iLPN] || '').trim();
    if (!lpn) continue;
    if (!map.has(lpn)) {
      map.set(lpn, {
        lyDoHold:   String(row[iLyDo]      || '').trim(),
        loaiHold:   String(row[iLoaiHold]  || '').trim(),
        ngayHold:   String(row[iNgayHold]  || '').trim(),
        nguoiHold:  String(row[iNguoiHold] || '').trim(),
        ghiChu:     String(row[iGhiChu]    || '').trim(),
      });
    }
  }
  return map;
}

/* ─── 4. Parse Item file (by SKU) ───────────────────────────────── */
function parseItem() {
  const sheet = loadSheet('Item.xlsx', 'Data');
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const colNames = rows[0]; // Column Name row
  const iSKU      = colNames.indexOf('SKU');         // Item code
  const iGross    = colNames.indexOf('STDGROSSWGT'); // Gross Weight
  const iNet      = colNames.indexOf('STDNETWGT');   // Net Weight
  const iTare     = colNames.indexOf('TARE');        // Tare Weight
  const iCube     = colNames.indexOf('STDCUBE');     // Cube

  const map = new Map();
  for (let r = 2; r < rows.length; r++) { // skip row 0 (colnames) + row 1 (messages)
    const row = rows[r];
    const sku = String(row[iSKU] || '').trim();
    if (!sku) continue;
    if (!map.has(sku)) {
      map.set(sku, {
        grossWgt: Number(row[iGross] || 0),
        netWgt:   Number(row[iNet]   || 0),
        tare:     Number(row[iTare]  || 0),
        cube:     Number(row[iCube]  || 0),
      });
    }
  }
  return map;
}

/* ─── 5. Parse Pack file (by PACKKEY = Item code) ───────────────── */
function parsePack() {
  const sheet = loadSheet('Pack.xlsx', 'Data');
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const colNames = rows[0];
  const iPACKKEY   = colNames.indexOf('PACKKEY');  // Item code
  const iINNERPACK = colNames.indexOf('INNERPACK'); // Inner Pack Qty
  const iCASECNT   = colNames.indexOf('CASECNT');  // Case Qty
  const iPALLET    = colNames.indexOf('PALLET');   // Pallet Qty
  const iPACKUOM3  = colNames.indexOf('PACKUOM3'); // UOM3 (HOP/CAI...)
  const iPACKUOM2  = colNames.indexOf('PACKUOM2'); // UOM2
  const iPACKUOM1  = colNames.indexOf('PACKUOM1'); // UOM1

  const map = new Map();
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const packKey = String(row[iPACKKEY] || '').trim();
    if (!packKey) continue;
    if (!map.has(packKey)) {
      map.set(packKey, {
        innerPack: Number(row[iINNERPACK] || 0),
        caseCnt:   Number(row[iCASECNT]   || 0),
        pallet:    Number(row[iPALLET]    || 0),
        uom3:      String(row[iPACKUOM3]  || '').trim(),
        uom2:      String(row[iPACKUOM2]  || '').trim(),
        uom1:      String(row[iPACKUOM1]  || '').trim(),
      });
    }
  }
  return map;
}

/* ─── 6. Merge & write ───────────────────────────────────────────── */
function main() {
  console.log('⏳ Đang parse dữ liệu...');
  
  const qList   = parseQ();
  const holdMap = parseHold();
  const itemMap = parseItem();
  const packMap = parsePack();

  console.log(`  Q file: ${qList.length} dòng`);
  console.log(`  HOLD map: ${holdMap.size} LPN`);
  console.log(`  Item map: ${itemMap.size} SKU`);
  console.log(`  Pack map: ${packMap.size} PACKKEY`);

  const merged = qList.map((q, idx) => {
    const hold = holdMap.get(q.lpn) || {};
    const item = itemMap.get(q.item) || {};
    const pack = packMap.get(q.item) || {};

    return {
      id:         idx + 1,
      // --- Q fields ---
      owner:      q.owner,
      item:       q.item,
      descr:      q.descr,
      location:   q.location,
      lpn:        q.lpn,
      onHand:     q.onHand,
      available:  q.available,
      status:     q.status,
      visa:       q.visa,
      lotNo:      q.lotNo,
      expDate:    q.expDate,
      soBatch:    q.soBatch,
      // --- HOLD fields (by LPN) ---
      lyDoHold:   hold.lyDoHold   || '',
      loaiHold:   hold.loaiHold   || '',
      ngayHold:   hold.ngayHold   || '',
      nguoiHold:  hold.nguoiHold  || '',
      ghiChu:     hold.ghiChu     || '',
      // --- Item fields (by Item code) ---
      grossWgt:   item.grossWgt   || 0,
      netWgt:     item.netWgt     || 0,
      tare:       item.tare       || 0,
      cube:       item.cube       || 0,
      // --- Pack fields (by Item code) ---
      innerPack:  pack.innerPack  || 0,
      caseCnt:    pack.caseCnt    || 0,
      pallet:     pack.pallet     || 0,
      uom:        pack.uom3       || '',
      // --- Decision fields (initially empty, filled by user in UI) ---
      decision:   '',   // 'HUY' | 'GIU' | 'TRA'
      soLuongHuy: 0,
      lyDoQD:     '',
      nguoiDuyet: '',
      ngayDuyet:  '',
    };
  });

  // Ensure public dir exists
  const pubDir = path.dirname(OUT);
  if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });

  fs.writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalRecords: merged.length,
    data: merged,
  }, null, 2), 'utf8');

  console.log(`✅ Đã ghi ${merged.length} records → ${OUT}`);
}

main();
