/**
 * Script để thêm cột coa_status vào bảng imp_shipment_items
 * Chạy: node scratch/add_coa_column.js
 */
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const https = require('https');

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
  console.error('Error: missing env vars');
  process.exit(1);
}

// Extract project ref from URL
// e.g. https://slwpwztwgvixoatefbjv.supabase.co => slwpwztwgvixoatefbjv
const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
console.log('Project ref:', projectRef);

// Use Supabase Management API to run SQL
const sql = `
ALTER TABLE imp_shipment_items 
ADD COLUMN IF NOT EXISTS coa_status text DEFAULT 'Chưa có';
`;

const payload = JSON.stringify({ query: sql });

const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${projectRef}/database/query`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Length': Buffer.byteLength(payload),
  },
};

console.log('Sending SQL migration to Supabase Management API...');
const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Column coa_status added successfully!');
    } else {
      console.log('❌ Failed to add column. Check response above.');
    }
  });
});
req.on('error', (e) => console.error('Request error:', e));
req.write(payload);
req.end();
