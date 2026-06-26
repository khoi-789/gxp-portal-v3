const xlsx = require('xlsx');
const path = require('path');
const preferenceDir = path.join(__dirname, '..', 'Preference');
const workbook = xlsx.readFile(path.join(preferenceDir, 'Nhan phu.xlsx'));
const sheet = workbook.Sheets['2022-Nay'];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }).slice(0, 10);
rows.forEach((r, i) => console.log(`Row ${i}:`, r));
