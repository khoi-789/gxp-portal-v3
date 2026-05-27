import pandas as pd
import requests
import json
import os
import sys

# Set output encoding to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

# 1. Load env variables manually from .env.local
env_path = r"d:\Tool\21.Redo_Portal\.env.local"
if not os.path.exists(env_path):
    print("Error: .env.local not found!")
    sys.exit(1)

env = {}
with open(env_path, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            parts = line.split("=", 1)
            env[parts[0].strip()] = parts[1].strip()

supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = env.get("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    print("Error: Missing Supabase credentials in .env.local!")
    sys.exit(1)

# API Endpoints
url_master = f"{supabase_url}/rest/v1/master_items"
url_mappings = f"{supabase_url}/rest/v1/product_label_mappings"

headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

# 2. Read Excel Data
excel_path = r"D:\Tool\21.Redo_Portal\Module-Import\ItemTem.xlsx"
print(f"Reading excel data from {excel_path}...")
df = pd.read_excel(excel_path)
print(f"Total rows in Excel: {len(df)}")

def clean_str(val):
    if pd.isna(val):
        return None
    val_str = str(val).strip()
    if val_str.lower() in ["nan", "none", "null", ""]:
        return None
    return val_str

def parse_num(val):
    if pd.isna(val):
        return 0
    try:
        return float(val)
    except:
        return 0

# 3. Process master items (products and labels)
print("Processing master items...")
items_dict = {}

for idx, row in df.iterrows():
    # A. Product
    prod_code = clean_str(row.get('ITEMCODE'))
    prod_name = clean_str(row.get('TÊN HÀNG'))
    supplier = clean_str(row.get('HÃNG')) or "UNKNOWN"
    case_qty = parse_num(row.get('QUY CÁCH THÙNG'))
    pallet_qty = parse_num(row.get('QUY CÁCH PALLET'))

    if prod_code and prod_name:
        items_dict[prod_code] = {
            "item_code": prod_code,
            "item_name": prod_name,
            "supplier_code": supplier,
            "case_qty": case_qty,
            "pallet_qty": pallet_qty,
            "is_active": True
        }

    # B. Label
    label_code = clean_str(row.get('ITEM'))
    label_name = clean_str(row.get('DESCRIPTION'))
    label_supplier = "P.Tem"

    if label_code and label_name:
        items_dict[label_code] = {
            "item_code": label_code,
            "item_name": label_name,
            "supplier_code": label_supplier,
            "case_qty": None,
            "pallet_qty": None,
            "is_active": True
        }

items_payload = list(items_dict.values())
print(f"Total unique items to upsert: {len(items_payload)}")

# 4. Process mappings
print("Processing product-label mappings...")
mappings_list = []
seen_mappings = set()

for idx, row in df.iterrows():
    prod_code = clean_str(row.get('ITEMCODE'))
    label_code = clean_str(row.get('ITEM'))
    task_qty = parse_num(row.get('TASK'))

    if prod_code and label_code:
        map_key = (prod_code, label_code)
        if map_key not in seen_mappings:
            seen_mappings.add(map_key)
            mappings_list.append({
                "product_item_code": prod_code,
                "label_item_code": label_code,
                "quantity_per_unit": task_qty
            })

print(f"Total unique mappings to upsert: {len(mappings_list)}")

# 5. REST Call: Upsert master items
print("Upserting items to master_items via REST API...")
batch_size = 100
for i in range(0, len(items_payload), batch_size):
    batch = items_payload[i:i+batch_size]
    res = requests.post(url_master, headers=headers, data=json.dumps(batch))
    if res.status_code not in [200, 201, 204]:
        print(f"Error upserting items batch {i}:", res.text)
        sys.exit(1)
    print(f"Uploaded {min(i+batch_size, len(items_payload))}/{len(items_payload)} items...")

# 6. REST Call: Upsert mappings
print("Upserting mappings to product_label_mappings via REST API...")
for i in range(0, len(mappings_list), batch_size):
    batch = mappings_list[i:i+batch_size]
    res = requests.post(url_mappings, headers=headers, data=json.dumps(batch))
    if res.status_code not in [200, 201, 204]:
        print(f"Error upserting mappings batch {i}:", res.text)
        print("Note: Make sure you have created the product_label_mappings table in Supabase SQL Editor first!")
        sys.exit(1)
    print(f"Uploaded {min(i+batch_size, len(mappings_list))}/{len(mappings_list)} mappings...")

print("=== SEEDING COMPLETED SUCCESSFULLY VIA REST ===")
