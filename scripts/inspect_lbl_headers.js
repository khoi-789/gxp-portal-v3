const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../Preference/Nhan phu.xlsx');
const workbook = xlsx.readFile(filePath);
const sheet = workbook.Sheets['2022-Nay'];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

for (let i = 0; i < 15; i++) {
  console.log(`Row ${i + 1}:`, data[i]);
}
