const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '../.env.local');
let supabaseUrl = '';
let supabaseServiceKey = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
  const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
  if (keyMatch) supabaseServiceKey = keyMatch[1].trim();
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data: item, error } = await supabase
    .from('master_items')
    .select('*')
    .eq('item_code', 'TT1300023')
    .maybeSingle();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Item TT1300023:', item);
  }

  const { data: product } = await supabase
    .from('master_items')
    .select('*')
    .eq('item_code', 'AV1100002')
    .maybeSingle();
  console.log('Product AV1100002:', product);
}

run();
