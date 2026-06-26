const xlsx = require('xlsx');
const path = require('path');
const preferenceDir = path.join(__dirname, '..', 'Preference');
const workbook = xlsx.readFile(path.join(preferenceDir, 'Bien ban noi bo.xlsx'));
const sheet = workbook.Sheets['Theo dõi 2024-2026'];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }).slice(0, 10);
rows.forEach((r, i) => console.log(`Row ${i}:`, r));
