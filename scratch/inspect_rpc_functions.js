const https = require('https');
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
  console.error('Error: missing env vars');
  process.exit(1);
}

const options = {
  headers: {
    'apikey': supabaseServiceKey,
    'Authorization': `Bearer ${supabaseServiceKey}`
  }
};

https.get(`${supabaseUrl}/rest/v1/`, options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const spec = JSON.parse(data);
      console.log('Paths available in PostgREST:');
      const paths = Object.keys(spec.paths);
      console.log(paths.filter(p => p.startsWith('/rpc/')));
    } catch (e) {
      console.error('Failed to parse json:', e.message);
      console.log(data);
    }
  });
}).on('error', (e) => console.error(e));
