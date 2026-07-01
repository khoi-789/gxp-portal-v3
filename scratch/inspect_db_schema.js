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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const tables = ['master_suppliers', 'master_items', 'product_label_mappings'];
  for (const t of tables) {
    console.log(`\nInspecting table: ${t}`);
    const { data, error } = await supabase
      .from(t)
      .select('*')
      .limit(1);
    
    if (error) {
      console.error(`Error fetching table ${t}:`, error.message);
    } else {
      console.log(`Columns for ${t}:`, data.length > 0 ? Object.keys(data[0]) : 'No rows');
    }
  }
}

run();
