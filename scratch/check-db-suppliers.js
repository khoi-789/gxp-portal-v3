const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    env[key] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Connecting to:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  try {
    // Check master_items
    const { data: items, error: itemsError } = await supabase
      .from('master_items')
      .select('supplier_code')
      .limit(100);
    
    if (itemsError) {
      console.error('Error fetching master_items:', itemsError);
    } else {
      const suppliers = [...new Set(items.map(i => i.supplier_code).filter(Boolean))];
      console.log('Unique supplier codes in master_items:', suppliers);
    }

    // Check if master_suppliers exists
    const { data: suppliersData, error: suppliersError } = await supabase
      .from('master_suppliers')
      .select('*')
      .limit(10);
    
    if (suppliersError) {
      console.log('master_suppliers table does not exist yet (or error):', suppliersError.message);
    } else {
      console.log('master_suppliers exists! Count:', suppliersData.length);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

check();
