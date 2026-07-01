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
  const { data: suppliers, error } = await supabase
    .from('master_suppliers')
    .select('*');
  
  if (error) {
    console.error('Error fetching suppliers:', error);
    return;
  }

  console.log(`Total suppliers in DB: ${suppliers.length}`);
  const emptyTypeSuppliers = suppliers.filter(s => !s.business_type || s.business_type.length === 0 || s.business_type.every(t => !t.trim()));
  console.log(`Suppliers with empty business_type: ${emptyTypeSuppliers.length}`);
  emptyTypeSuppliers.forEach(s => {
    console.log(`- Code: ${s.supplier_code}, Name: ${s.supplier_name}, Type: ${JSON.stringify(s.business_type)}`);
  });
}

run();
