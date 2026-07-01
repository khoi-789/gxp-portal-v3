const xlsx = require('xlsx');
const path = require('path');

try {
  const filePath = 'd:\\Tool\\21.Redo_Portal\\Reference\\NHAP KHAU.xlsx';
  const workbook = xlsx.readFile(filePath);
  console.log('All Sheet Names:', workbook.SheetNames);
  
  workbook.SheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    const rows = xlsx.utils.sheet_to_json(sheet);
    console.log(`\n--- Sheet: ${name} (Total rows: ${rows.length}) ---`);
    if (rows.length > 0) {
      console.log('Columns:', Object.keys(rows[0]));
      console.log('Sample Row 1:', JSON.stringify(rows[0], null, 2));
    }
  });
} catch (e) {
  console.error('Error reading excel:', e);
}
