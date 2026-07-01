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

const targetCodes = [
  "P.Tem",
  "Astra",
  "Hyphens",
  "DR.REDDY'S",
  "VITABIOTIC - VE PHARMA",
  "MEGA (MAXXCARE)",
  "VE PHARMA"
];

const tablesToInspect = [
  'master_items',
  'imp_shipments',
  'awc_records',
  'bbsc_incidents',
  'cc_records',
  'int_records',
  'lbl_records',
  'ldg_records',
  'destruction_records',
  'product_label_mappings'
];

async function run() {
  for (const table of tablesToInspect) {
    try {
      // Fetch a sample row to check if columns contain supplier_code
      const { data: sample, error: sampleError } = await supabase.from(table).select('*').limit(1);
      if (sampleError) {
        console.log(`Skipping table ${table}: ${sampleError.message}`);
        continue;
      }
      if (sample.length === 0) {
        console.log(`Table ${table} is empty.`);
        continue;
      }
      
      const keys = Object.keys(sample[0]);
      let matchCol = null;
      if (keys.includes('supplier_code')) matchCol = 'supplier_code';
      else if (keys.includes('supplier_id')) matchCol = 'supplier_id';
      else if (keys.includes('supplier')) matchCol = 'supplier';

      if (matchCol) {
        const { data: matchingRows, error } = await supabase
          .from(table)
          .select('*')
          .in(matchCol, targetCodes);

        if (error) {
          console.error(`Error querying table ${table}:`, error.message);
        } else if (matchingRows.length > 0) {
          console.log(`Table "${table}" has ${matchingRows.length} rows referencing these suppliers (column: ${matchCol}):`);
          matchingRows.forEach(r => {
            console.log(`  - Row ID / Identifier: ${r.id || r.invoice_number || r.item_code || JSON.stringify(r)}`);
          });
        } else {
          console.log(`Table "${table}" has 0 references.`);
        }
      } else {
        console.log(`Table "${table}" does not have a supplier-related column.`);
      }
    } catch (e) {
      console.error(`Exception in table ${table}:`, e);
    }
  }
}

run();
