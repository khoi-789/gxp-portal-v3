const { Client } = require('pg');

const connectionString = 'postgres://postgres.slwpwztwgvixoatefbjv:3o786IsHH6HxTuey@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    console.log('Connecting to Supabase database via pooler...');
    await client.connect();
    console.log('CONNECTED successfully!');

    const queries = [
      "ALTER TABLE public.imp_shipment_items ADD COLUMN IF NOT EXISTS coa_status TEXT DEFAULT 'Chưa có' NOT NULL;",
      "ALTER TABLE public.imp_shipment_items ADD COLUMN IF NOT EXISTS visa_no TEXT;",
      "ALTER TABLE public.imp_shipment_items ADD COLUMN IF NOT EXISTS decision_no TEXT;",
      "ALTER TABLE public.imp_shipment_items ADD COLUMN IF NOT EXISTS valid_until TEXT;"
    ];

    for (const q of queries) {
      console.log(`Executing: ${q}`);
      await client.query(q);
      console.log(' -> Success!');
    }

    console.log('Migrations completed successfully!');
  } catch (err) {
    console.error('Database migration error:', err);
  } finally {
    await client.end();
  }
}

run();
