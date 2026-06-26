const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables manually from .env.local
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Lỗi: Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong file .env.local!');
  process.exit(1);
}

console.log('Kết nối tới Supabase:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const suppliersToSeed = [
  { code: 'ABBOTT', name: 'ABBOTT' },
  { code: 'ALLEVIARE', name: 'ALLEVIARE' },
  { code: 'ASCENCIA', name: 'ASCENCIA' },
  { code: 'ASPIRO', name: 'ASPIRO' },
  { code: 'ASTRAZENECA', name: 'ASTRAZENECA' },
  { code: 'BESIN', name: 'BESIN' },
  { code: 'BIOTRONIK', name: 'BIOTRONIK' },
  { code: 'CPC1', name: 'CPC1' },
  { code: 'DANONE', name: 'DANONE' },
  { code: 'DAVIPHARM', name: 'DAVIPHARM' },
  { code: 'DKSH', name: 'DKSH' },
  { code: 'DR.REDDY', name: "Dr.Reddy's" }, // Match existing code 'DR.REDDY'
  { code: 'ELOVI', name: 'ELOVI' },
  { code: 'GETZ', name: 'GETZ' },
  { code: 'HAPHARCO', name: 'HAPHARCO' },
  { code: 'HETERO', name: 'HETERO' },
  { code: 'HOE', name: 'HOE' },
  { code: 'HYPHENS', name: 'HYPHENS' },
  { code: 'IMEXPHARM', name: 'IMEXPHARM' },
  { code: 'J&J', name: 'J&J' },
  { code: 'LUYE', name: 'LUYE' },
  { code: 'MAYOLY', name: 'MAYOLY' },
  { code: 'MEGA (MAXXCARE)', name: 'MEGA (MAXXCARE)' },
  { code: 'NOVARTIS', name: 'NOVARTIS' },
  { code: 'NUMED', name: 'NUMED' },
  { code: 'ORIENT', name: 'ORIENT' },
  { code: 'OTSUKA', name: 'OTSUKA' },
  { code: 'PARADIGM', name: 'PARADIGM' },
  { code: 'ROHTO', name: 'ROHTO' },
  { code: 'RXILIENT', name: 'RXILIENT' },
  { code: 'SANDOZ', name: 'SANDOZ' },
  { code: 'SANG', name: 'SANG' },
  { code: 'SANOFI', name: 'SANOFI' },
  { code: 'SIV', name: 'SIV' },
  { code: 'TORRENT', name: 'TORRENT' },
  { code: 'TRƯỜNG SƠN', name: 'TRƯỜNG SƠN' },
  { code: 'UNITED', name: 'UNITED' },
  { code: 'UPJOHN', name: 'UPJOHN' },
  { code: 'VE PHARMA', name: 'VE PHARMA' },
  { code: 'VIATRIS', name: 'VIATRIS' },
  { code: 'WW', name: 'WW' },
  { code: 'YHV', name: 'YHV' }
];

async function seed() {
  try {
    const dbPayloads = suppliersToSeed.map(s => ({
      supplier_code: s.code,
      supplier_name: s.name,
      notes: '',
      business_type: []
    }));

    console.log(`Tiến hành upsert ${dbPayloads.length} nhà cung cấp...`);
    const { data, error } = await supabase
      .from('master_suppliers')
      .upsert(dbPayloads, { onConflict: 'supplier_code' });

    if (error) {
      throw error;
    }

    console.log('✓ Hoàn tất nạp dữ liệu nhà cung cấp thành công!');
  } catch (err) {
    console.error('Lỗi khi nạp dữ liệu:', err.message || err);
  }
}

seed();
