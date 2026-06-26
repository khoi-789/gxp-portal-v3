const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const prefDir = path.join(__dirname, '../Preference');
const files = fs.readdirSync(prefDir);

console.log('Preference Directory Files:', files);

files.forEach(file => {
  if (file.endsWith('.xlsx')) {
    try {
      const filePath = path.join(prefDir, file);
      const workbook = xlsx.readFile(filePath);
      console.log(`\n=== File: ${file} ===`);
      console.log('Sheets:', workbook.SheetNames);
      
      // Let's print first row of the first sheet (or specific sheets if known)
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        if (data.length > 0) {
          console.log(`  Sheet: ${sheetName} - First 2 rows:`);
          console.log('    Row 1:', data[0]);
          if (data[1]) {
            console.log('    Row 2:', data[1]);
          }
        }
      });
    } catch (e) {
      console.error(`Error reading ${file}:`, e.message);
    }
  } else if (file.endsWith('.csv')) {
    console.log(`\n=== File: ${file} (CSV) ===`);
    try {
      const filePath = path.join(prefDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').slice(0, 3);
      lines.forEach((line, idx) => {
        console.log(`  Line ${idx + 1}:`, line);
      });
    } catch (e) {
      console.error(`Error reading CSV ${file}:`, e.message);
    }
  }
});
