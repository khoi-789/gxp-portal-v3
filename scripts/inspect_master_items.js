const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const cleanLine = line.trim();
  if (!cleanLine || cleanLine.startsWith('#')) return;
  const eqIdx = cleanLine.indexOf('=');
  if (eqIdx > 0) {
    env[cleanLine.substring(0, eqIdx).trim()] = cleanLine.substring(eqIdx + 1).trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: items } = await supabase.from('master_items').select('*').limit(20);
  console.log('Sample master items:', items);

  const { data: mappings } = await supabase.from('product_label_mappings').select('*').limit(10);
  console.log('Sample product_label_mappings:', mappings);
}

run();
