import pandas as pd
import numpy as np
import requests
import json
import os
import re

# 1. Load env variables manually from .env.local
env_path = r"d:\Tool\21.Redo_Portal\.env.local"
if not os.path.exists(env_path):
    print("Error: .env.local not found!")
    exit(1)

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
    exit(1)

# API Endpoint & Headers
url_shipments = f"{supabase_url}/rest/v1/imp_shipments"
url_items = f"{supabase_url}/rest/v1/imp_shipment_items"
headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

excel_path = r"d:\Tool\21.Redo_Portal\Module-Import\NHAP KHAU.xlsx"
print(f"Reading excel from {excel_path}...")
df = pd.read_excel(excel_path)
print(f"Total rows in Excel: {len(df)}")

def clean_string(val):
    if pd.isna(val):
        return None
    val_str = str(val).strip()
    if val_str.lower() in ["nan", "none", "null", ""]:
        return None
    return val_str

def parse_date(val):
    if pd.isna(val):
        return None, None
    try:
        dt = pd.to_datetime(val, errors='coerce')
        if pd.notna(dt):
            return dt.strftime("%Y-%m-%d"), None
        else:
            val_str = str(val).strip()
            if val_str:
                return None, val_str
            return None, None
    except:
        val_str = str(val).strip()
        if val_str:
            return None, val_str
        return None, None

def parse_number(val):
    if pd.isna(val):
        return 0
    try:
        return float(val)
    except:
        return 0

# Clear existing tables first (using TRUNCATE or DELETE)
print("Clearing existing shipments and items from Supabase...")
# Note: we use Cascade delete, so deleting shipments deletes items
res_del = requests.delete(f"{url_shipments}?invoice_number=not.is.null", headers=headers)
if res_del.status_code not in [200, 201, 204]:
    print("Warning during delete:", res_del.text)

shipments_batch = []
items_batch = []

# Fetch existing master_items from database to match item_name or item_code
url_master = f"{supabase_url}/rest/v1/master_items?select=item_code,item_name"
res_master = requests.get(url_master, headers=headers)
master_items = []
if res_master.status_code == 200:
    master_items = res_master.json()
print(f"Loaded {len(master_items)} master items from database for matching.")

def find_item_code(item_name_raw):
    if not item_name_raw:
        return None
    name_clean = item_name_raw.strip().lower()
    # Try exact match first
    for m in master_items:
        if m['item_name'].strip().lower() == name_clean:
            return m['item_code']
    # Try partial match (if master item name is in raw name or vice versa)
    for m in master_items:
        m_name = m['item_name'].strip().lower()
        if m_name in name_clean or name_clean in m_name:
            return m['item_code']
    return None

invoice_set = set()

for idx, row in df.iterrows():
    inv_raw = clean_string(row.get('INV No.'))
    if not inv_raw:
        continue
    
    # Check if duplicate invoice number in Excel
    if inv_raw in invoice_set:
        # Some invoices might have duplicate rows in Excel, we can append products or skip
        # Let's just append products to the existing invoice
        pass
    else:
        invoice_set.add(inv_raw)
        
        # Parse Dates
        created_date, _ = parse_date(row.get('STT'))
        if not created_date:
            created_date = pd.Timestamp.now().strftime("%Y-%m-%d")
            
        import_date_lh, import_date_lh_text = parse_date(row.get('Nhập Kho \nLong Hậu'))
        import_date_hn, import_date_hn_text = parse_date(row.get('Nhập Kho \nHà Nội'))
        
        # Temp Out of Range
        out_range_val = clean_string(row.get('DATA out of range'))
        temp_out_of_range = False
        temp_out_of_range_details = None
        if out_range_val:
            out_range_lower = out_range_val.lower()
            if out_range_lower not in ['ok', 'không', 'no', '0', 'none', 'false']:
                temp_out_of_range = True
                temp_out_of_range_details = out_range_val
                
        # Data Logger type
        logger_type = clean_string(row.get('DATA LOGGER'))
        has_data_logger = False
        if logger_type and logger_type.lower() not in ['không', 'no', 'none', '0', 'false']:
            has_data_logger = True
            
        shipment = {
            "invoice_number": inv_raw,
            "created_date": created_date,
            "supplier_code": clean_string(row.get('Hãng')) or "UNKNOWN",
            "coa_status": clean_string(row.get('COA')) or "Chưa có",
            "label_status": clean_string(row.get('Nhãn phụ')) or "Chưa có",
            "progress_status": clean_string(row.get('Tiến độ')) or "Created",
            "has_data_logger": has_data_logger,
            "data_logger_type": logger_type,
            "logger_qty": parse_number(row.get('Số lượng')),
            "temp_out_of_range": temp_out_of_range,
            "temp_out_of_range_details": temp_out_of_range_details,
            "import_date_lh": import_date_lh,
            "import_date_hn": import_date_hn,
            "import_date_lh_text": import_date_lh_text,
            "import_date_hn_text": import_date_hn_text,
            "invoice_link": clean_string(row.get('Link INV')),
            "supplier_link": clean_string(row.get('Link hãng'))
        }
        shipments_batch.append(shipment)
        
    # Products (split by newline)
    sp_raw = clean_string(row.get('Sản phẩm '))
    if sp_raw:
        products = [p.strip() for p in sp_raw.split('\n') if p.strip()]
        for i, prod_name in enumerate(products):
            # Check if we can find matching item_code
            item_code = find_item_code(prod_name)
            
            # Map issues and resolution notes. If there are multiple products,
            # we place the issues/resolution on the first product, or copy to all.
            # Usually issues in the Excel apply to the whole invoice or specific products.
            # We copy them to the items.
            item = {
                "invoice_number": inv_raw,
                "item_code": item_code,
                "item_name": prod_name,
                "issue_notes": clean_string(row.get('Vấn đề')) if i == 0 else None,
                "resolution_notes": clean_string(row.get('Ghi chú')) if i == 0 else None
            }
            items_batch.append(item)

# Sort descending by created_date and keep only 3 latest shipments
shipments_batch.sort(key=lambda s: s.get('created_date') or '', reverse=True)
shipments_batch = shipments_batch[:3]

# Filter items to only keep those belonging to the selected 3 shipments
selected_invoices = {s['invoice_number'] for s in shipments_batch}
items_batch = [item for item in items_batch if item['invoice_number'] in selected_invoices]

print(f"Total shipments parsed (keeping only 3 latest): {len(shipments_batch)}")
print(f"Total shipment items parsed: {len(items_batch)}")

# Upload shipments in batches of 100
batch_size = 100
for i in range(0, len(shipments_batch), batch_size):
    batch = shipments_batch[i:i+batch_size]
    res = requests.post(url_shipments, headers=headers, data=json.dumps(batch))
    if res.status_code not in [200, 201, 204]:
        print(f"Error inserting shipments batch {i}:", res.text)
        exit(1)
    print(f"Uploaded {min(i+batch_size, len(shipments_batch))}/{len(shipments_batch)} shipments...")

# Upload items in batches of 100
for i in range(0, len(items_batch), batch_size):
    batch = items_batch[i:i+batch_size]
    res = requests.post(url_items, headers=headers, data=json.dumps(batch))
    if res.status_code not in [200, 201, 204]:
        print(f"Error inserting items batch {i}:", res.text)
        exit(1)
    print(f"Uploaded {min(i+batch_size, len(items_batch))}/{len(items_batch)} shipment items...")

print("=== SEEDING COMPLETED SUCCESSFULLY ===")
