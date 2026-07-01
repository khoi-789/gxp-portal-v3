const xlsx = require('xlsx');
const filePath = 'd:\\Tool\\21.Redo_Portal\\Reference\\NHAP KHAU.xlsx';
const workbook = xlsx.readFile(filePath);
const rbacSheet = workbook.Sheets['RBAC'];
const rows = xlsx.utils.sheet_to_json(rbacSheet);
console.log('RBAC rows:');
rows.forEach(r => {
  console.log(`- ${r['Nhóm (điều chỉnh)']} | ${r['Trường dữ liệu hiện tại']} | QA Nhập khẩu: ${r['QA Nhập khẩu']} | QA Kho: ${r['QA Kho']} | Note: ${r['Note']}`);
});
