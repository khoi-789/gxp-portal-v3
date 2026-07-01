/**
 * Create an RPC function in Supabase to execute SQL,
 * then use it to add missing columns to imp_shipment_items.
 * 
 * IMPORTANT: This requires your Supabase Personal Access Token (PAT).
 * Go to: https://app.supabase.com/account/tokens
 * Create a new token and replace SUPABASE_PAT below.
 */

const https = require('https');

const SUPABASE_PAT = 'PASTE_YOUR_PAT_HERE'; // <-- Replace with your PAT
const PROJECT_REF = 'slwpwztwgvixoatefbjv';

const SQL = `
ALTER TABLE public.imp_shipment_items ADD COLUMN IF NOT EXISTS coa_status TEXT DEFAULT 'Chưa có' NOT NULL;
ALTER TABLE public.imp_shipment_items ADD COLUMN IF NOT EXISTS visa_no TEXT;
ALTER TABLE public.imp_shipment_items ADD COLUMN IF NOT EXISTS decision_no TEXT;
ALTER TABLE public.imp_shipment_items ADD COLUMN IF NOT EXISTS valid_until TEXT;
`;

function runSQL(sql) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_PAT}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  if (SUPABASE_PAT === 'PASTE_YOUR_PAT_HERE') {
    console.log('Please set your Supabase PAT first.');
    console.log('Go to: https://app.supabase.com/account/tokens');
    process.exit(1);
  }

  console.log('Running SQL migration via Supabase Management API...');
  const result = await runSQL(SQL);
  console.log('Status:', result.status);
  console.log('Response:', result.body);

  if (result.status === 200 || result.status === 201) {
    console.log('✅ Migration completed successfully!');
  } else {
    console.log('❌ Migration failed.');
  }
}

main().catch(console.error);
