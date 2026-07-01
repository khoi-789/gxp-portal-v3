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
  console.log('Fetching mock items...');
  const { data: items, error } = await supabase
    .from('master_items')
    .select('item_code, item_name')
    .ilike('item_code', '%mock%');

  if (error) {
    console.error('Error fetching mock items:', error);
    return;
  }

  console.log(`Found ${items.length} mock items.`);
  if (items.length === 0) {
    console.log('No mock items found.');
    return;
  }

  const codes = items.map(x => x.item_code);
  console.log('Sample codes to delete:', codes.slice(0, 10));

  const tablesToClean = [
    'product_label_mappings',
    'imp_shipment_items',
    'awc_items',
    'bbsc_items',
    'cc_complaints', // Let's check cc_complaints column names
    'cc_items',
    'destruction_items',
    'int_items',
    'lbl_items',
    'ldg_items',
    'awc_records',
    'bbsc_incidents',
    'destruction_records',
    'int_records',
    'lbl_records',
    'ldg_records'
  ];

  for (const table of tablesToClean) {
    try {
      console.log(`Checking table ${table}...`);
      const { data: sample, error: sampleError } = await supabase.from(table).select('*').limit(1);
      if (sampleError) {
        console.log(`Skipping/No access to table ${table}: ${sampleError.message}`);
        continue;
      }
      if (sample.length === 0) {
        // Even if empty, we can still try to delete based on common column names
        const columnsToTry = ['item_code', 'product_item_code', 'label_item_code', 'product_code'];
        for (const col of columnsToTry) {
          const { error: delErr } = await supabase.from(table).delete().in(col, codes);
          if (!delErr) {
            console.log(`  Cleaned ${table} (column: ${col})`);
          }
        }
        continue;
      }

      const keys = Object.keys(sample[0]);
      const columnsToClean = keys.filter(k => 
        k.toLowerCase().includes('item_code') || 
        k.toLowerCase().includes('product_code') ||
        k.toLowerCase() === 'item' ||
        k.toLowerCase() === 'product'
      );

      for (const col of columnsToClean) {
        console.log(`  Deleting mock items from ${table} where ${col} is in mock codes...`);
        const { error: delErr } = await supabase.from(table).delete().in(col, codes);
        if (delErr) {
          console.error(`  Error cleaning ${table} (column: ${col}):`, delErr.message);
        } else {
          console.log(`  Successfully cleaned ${table} (column: ${col})`);
        }
      }
    } catch (e) {
      console.error(`Exception cleaning table ${table}:`, e.message);
    }
  }

  // Finally, delete from master_items
  console.log('Deleting from master_items...');
  const { error: deleteError } = await supabase
    .from('master_items')
    .delete()
    .in('item_code', codes);

  if (deleteError) {
    console.error('Error deleting master items:', deleteError.message);
  } else {
    console.log(`Successfully deleted ${items.length} mock items from master_items!`);
  }
}

run();
