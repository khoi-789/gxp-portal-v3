/**
 * generate-master-data.js
 * Parse Item.xlsx and Pack.xlsx → public/master-data.json
 * Merges by SKU / PACKKEY
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'Module-Destruction');
const OUT  = path.join(__dirname, '..', 'public', 'master-data.json');

function loadSheet(file, sheetName) {
  const filePath = path.join(BASE, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return null;
  }
  const wb = XLSX.readFile(filePath);
  const sheet = sheetName
    ? wb.Sheets[sheetName]
    : wb.Sheets[wb.SheetNames[0]];
  return sheet;
}

function parseItem() {
  const sheet = loadSheet('Item.xlsx', 'Data');
  if (!sheet) return new Map();
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const colNames = rows[0];
  const iSKU      = colNames.indexOf('SKU');
  const iDescr    = colNames.indexOf('DESCR');
  const iOwner    = colNames.indexOf('STORERKEY');
  const iGross    = colNames.indexOf('STDGROSSWGT');
  const iNet      = colNames.indexOf('STDNETWGT');
  const iCube     = colNames.indexOf('STDCUBE');

  const map = new Map();
  // Skip row 0 (colnames) and row 1 (messages/empty)
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const sku = String(row[iSKU] || '').trim();
    if (!sku) continue;
    if (!map.has(sku)) {
      map.set(sku, {
        item_code: sku,
        item_name: String(row[iDescr] || '').trim(),
        supplier_code: String(row[iOwner] || '').trim(),
        gross_weight: Number(row[iGross] || 0),
        net_weight: Number(row[iNet] || 0),
        cube: Number(row[iCube] || 0),
        is_active: true
      });
    }
  }
  return map;
}

function parsePack() {
  const sheet = loadSheet('Pack.xlsx', 'Data');
  if (!sheet) return new Map();
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const colNames = rows[0];
  const iPACKKEY   = colNames.indexOf('PACKKEY');
  const iINNERPACK = colNames.indexOf('INNERPACK');
  const iCASECNT   = colNames.indexOf('CASECNT');
  const iPALLET    = colNames.indexOf('PALLET');
  const iUOM1      = colNames.indexOf('PACKUOM1');
  const iUOM2      = colNames.indexOf('PACKUOM2');
  const iUOM3      = colNames.indexOf('PACKUOM3');

  const map = new Map();
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const sku = String(row[iPACKKEY] || '').trim();
    if (!sku) continue;
    if (!map.has(sku)) {
      map.set(sku, {
        inner_pack: Number(row[iINNERPACK] || 0),
        case_qty: Number(row[iCASECNT] || 0),
        pallet_qty: Number(row[iPALLET] || 0),
        uom1: String(row[iUOM1] || '').trim(),
        uom2: String(row[iUOM2] || '').trim(),
        uom3: String(row[iUOM3] || '').trim(),
      });
    }
  }
  return map;
}

function main() {
  console.log('⏳ Generating Master Data...');
  const itemMap = parseItem();
  const packMap = parsePack();

  const finalData = [];
  itemMap.forEach((item, sku) => {
    const pack = packMap.get(sku) || {};
    finalData.push({
      ...item,
      inner_pack: pack.inner_pack || 0,
      case_qty: pack.case_qty || 0,
      pallet_qty: pack.pallet_qty || 0,
      uom1: pack.uom1 || '',
      uom2: pack.uom2 || '',
      uom3: pack.uom3 || '',
    });
  });

  const pubDir = path.dirname(OUT);
  if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });

  fs.writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    total: finalData.length,
    items: finalData
  }, null, 2), 'utf8');

  console.log(`✅ Success! Written ${finalData.length} items to ${OUT}`);
}

main();
