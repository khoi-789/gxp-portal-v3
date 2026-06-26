const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env variables manually from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Lỗi: Không tìm thấy file .env.local!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const cleanLine = line.trim();
  if (!cleanLine || cleanLine.startsWith('#')) return;
  const eqIdx = cleanLine.indexOf('=');
  if (eqIdx > 0) {
    const key = cleanLine.substring(0, eqIdx).trim();
    const val = cleanLine.substring(eqIdx + 1).trim();
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const newNames = [
  { id: "187f3364-0d4a-4946-944d-cef45f77f99f", name: "IMP (Nhập khẩu)" },
  { id: "87288cfc-9734-4b82-92b1-57be89c3a341", name: "DES (Hủy hàng)" },
  { id: "26325870-6d9f-47ca-8a03-a2e6b91e4e90", name: "INC (BBSC)" },
  { id: "75467a9c-657c-4fd0-aad1-eace51e9d7da", name: "COMP (Khiếu nại)" },
  { id: "ddcb955e-9bd8-4068-b5e9-b757230e3aae", name: "INT (Nội bộ)" },
  { id: "d5ec4864-851e-4691-860c-48902fb0c9e4", name: "LBL (Nhãn phụ)" },
  { id: "55258a02-19af-4e06-a2ee-a42122e8ddad", name: "LDG (Lệnh ĐG)" },
  { id: "35768f7d-f776-4910-9b28-4e4cefc5e0b5", name: "AWC (Thay đổi AW)" }
];

async function update() {
  for (const item of newNames) {
    console.log(`Updating ${item.id} to name "${item.name}"...`);
    const { data, error } = await supabase
      .from('portal_apps')
      .update({ app_name: item.name })
      .eq('app_id', item.id)
      .select();
    
    if (error) {
      console.error(`Error updating ${item.id}:`, error);
    } else {
      console.log(`Successfully updated:`, data);
    }
  }
}

update();
