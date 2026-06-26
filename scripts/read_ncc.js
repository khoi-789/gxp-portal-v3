const xlsx = require('xlsx');
const path = require('path');

try {
  const filePath = path.join(__dirname, '../Preference/NCC.xlsx');
  console.log('Reading file:', filePath);
  const workbook = xlsx.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  console.log('Sheet Names:', sheetNames);
  
  const sheet = workbook.Sheets[sheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);
  console.log('Total rows found:', rows.length);
  
  // Print first 5 rows to inspect structure
  console.log('First 10 rows:');
  console.log(JSON.stringify(rows.slice(0, 10), null, 2));
} catch (e) {
  console.error('Error reading excel:', e);
}
