const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
let supabaseUrl = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
}

async function run() {
  console.log('Sending request to:', supabaseUrl);
  const res = await fetch(supabaseUrl);
  console.log('Status:', res.status);
  console.log('Headers:');
  for (const [key, value] of res.headers.entries()) {
    console.log(`${key}: ${value}`);
  }
}

run();
