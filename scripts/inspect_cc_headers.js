const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../Preference/CC.xlsx');
const workbook = xlsx.readFile(filePath);
const sheet = workbook.Sheets['2025-New'];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

for (let i = 0; i < 10; i++) {
  console.log(`Row ${i + 1}:`, data[i]);
}
