const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../Preference/Theo dõi thay đổi AW.xlsx');
const workbook = xlsx.readFile(filePath);
const sheet = workbook.Sheets['Change'];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

data.forEach((row, rIdx) => {
  if (row) {
    row.forEach((cell, cIdx) => {
      if (cell && String(cell).includes('SO: May')) {
        console.log(`Found string at Row ${rIdx + 1}, Col ${cIdx + 1}:`, cell);
        console.log('Whole Row:', row);
      }
    });
  }
});
