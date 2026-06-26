const xlsx = require('xlsx');
const path = require('path');

const prefDir = path.join(__dirname, '../Preference');

function inspectFile(filename, sheetName, startRow = 0, numRows = 15) {
  try {
    const filePath = path.join(prefDir, filename);
    const workbook = xlsx.readFile(filePath);
    console.log(`\n=================== FILE: ${filename} - SHEET: ${sheetName} ===================`);
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    for (let i = startRow; i < Math.min(startRow + numRows, data.length); i++) {
      console.log(`Row ${i + 1}:`, data[i]);
    }
  } catch (e) {
    console.error(`Error inspecting ${filename}:`, e.message);
  }
}

inspectFile('CC.xlsx', '2025-New', 0, 15);
inspectFile('CC.xlsx', '2025-New', 15, 10);
inspectFile('Nhan phu.xlsx', '2022-Nay', 0, 20);
inspectFile('Nhan phu.xlsx', '2022-Nay', 20, 15);
