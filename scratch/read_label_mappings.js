const xlsx = require('xlsx');
const path = require('path');

try {
  const filePath = 'd:\\Tool\\21.Redo_Portal\\Reference\\NHAP KHAU.xlsx';
  const workbook = xlsx.readFile(filePath);
  console.log('Sheet Names:', workbook.SheetNames.map(x => ({ name: x, length: x.length, codes: [...x].map(c => c.charCodeAt(0)) })));
  
  const sheetName = workbook.SheetNames.find(n => n.includes('SP-tem') || n.includes('Liên kết'));
  if (sheetName) {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);
    console.log(`\nFound sheet: "${sheetName}"`);
    console.log(`Total rows: ${rows.length}`);
    console.log('First 5 rows:');
    console.log(JSON.stringify(rows.slice(0, 5), null, 2));
  } else {
    console.log('Sheet not found by fuzzy match.');
  }
} catch (e) {
  console.error('Error reading excel:', e);
}
