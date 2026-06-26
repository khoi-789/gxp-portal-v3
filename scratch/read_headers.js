const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const preferenceDir = path.join(__dirname, '..', 'Preference');

function inspectFile(filename) {
  const filePath = path.join(preferenceDir, filename);
  console.log(`\n=== Inspecting ${filename} ===`);
  if (!fs.existsSync(filePath)) {
    console.log('File does not exist');
    return;
  }

  if (filename.endsWith('.csv')) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').slice(0, 5);
    lines.forEach((l, i) => console.log(`Line ${i}:`, l));
  } else {
    const workbook = xlsx.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    console.log('Sheets:', sheetNames);
    const firstSheet = workbook.Sheets[sheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(firstSheet, { header: 1 }).slice(0, 5);
    rows.forEach((r, i) => console.log(`Row ${i}:`, r));
  }
}

inspectFile('BBSC.csv');
inspectFile('Bien ban noi bo.xlsx');
inspectFile('CC.xlsx');
inspectFile('Nhan phu.xlsx');
inspectFile('LDG.xlsx');
inspectFile('Theo dõi thay đổi AW.xlsx');
