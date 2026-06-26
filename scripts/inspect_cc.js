const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../Preference/CC.xlsx');
const workbook = xlsx.readFile(filePath);
const sheet = workbook.Sheets['2025-New'];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log('Total rows in CC.xlsx 2025-New:', data.length);
data.forEach((row, idx) => {
  if (row && row.some(cell => cell !== null && cell !== '')) {
    if (idx < 50) {
      console.log(`Row ${idx + 1}:`, row.slice(0, 10));
    }
  }
});
