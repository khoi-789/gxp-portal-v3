const xlsx = require('xlsx');
const path = require('path');

try {
  const filePath = 'd:\\Tool\\21.Redo_Portal\\Reference\\NHAP KHAU.xlsx';
  console.log('Reading file:', filePath);
  const workbook = xlsx.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  console.log('All Sheet Names:', sheetNames);
  
  sheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    const rows = xlsx.utils.sheet_to_json(sheet);
    console.log(`\n--- Sheet: ${name} (Total rows: ${rows.length}) ---`);
    if (rows.length > 0) {
      console.log(JSON.stringify(rows.slice(0, 30), null, 2));
    }
  });
} catch (e) {
  console.error('Error reading excel:', e);
}
