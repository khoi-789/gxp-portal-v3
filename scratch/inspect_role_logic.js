const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/ImportModule.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('simulatedRole') || line.includes('QA_KHO') || line.includes('QA_NHAP_KHAU')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
