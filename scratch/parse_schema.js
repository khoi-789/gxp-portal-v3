const fs = require('fs');
const path = require('path');

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));

console.log('--- RPC PATHS ---');
const paths = Object.keys(schema.paths || {});
for (const p of paths) {
  if (p.startsWith('/rpc/')) {
    console.log(p);
  }
}

console.log('\n--- imp_shipment_items properties ---');
const itemsDef = schema.definitions && schema.definitions.imp_shipment_items;
if (itemsDef && itemsDef.properties) {
  console.log(Object.keys(itemsDef.properties));
} else {
  console.log('imp_shipment_items not found in definitions');
}
