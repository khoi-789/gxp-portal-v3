const { Client } = require('pg');

const regions = [
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-south-1",
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3"
];

const projectRef = "slwpwztwgvixoatefbjv";
const password = "3o786IsHH6HxTuey";

async function testRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const ports = [6543, 5432];
  
  for (const port of ports) {
    const connStr = `postgres://postgres.${projectRef}:${password}@${host}:${port}/postgres`;
    console.log(`Testing ${region} on port ${port}...`);
    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000
    });
    
    try {
      await client.connect();
      console.log(`  🎉 SUCCESS on ${region} port ${port}!`);
      await client.end();
      return true;
    } catch (err) {
      console.log(`  ❌ Failed: ${err.message}`);
    }
  }
  return false;
}

async function run() {
  for (const region of regions) {
    const success = await testRegion(region);
    if (success) {
      console.log(`Found working region: ${region}`);
      break;
    }
  }
  console.log('Test finished.');
}

run();
