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
  const { data: mappings, error } = await supabase
    .from('product_label_mappings')
    .select('*')
    .eq('product_item_code', 'RD1200021');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Mappings for RD1200021:', mappings);
  }

  // Also query master_items for RD1200021
  const { data: item } = await supabase
    .from('master_items')
    .select('*')
    .eq('item_code', 'RD1200021')
    .maybeSingle();
  console.log('Item RD1200021:', item);
}

run();
