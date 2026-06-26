import pandas as pd
import requests
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

env_path = r"d:\Tool\21.Redo_Portal\.env.local"
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

url = f"{supabase_url}/rest/v1/master_items?select=item_code"
headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}"
}
res = requests.get(url, headers=headers)
if res.status_code == 200:
    db_items = set(r['item_code'] for r in res.json())
else:
    print("Error fetching master items:", res.text)
    exit(1)

file_path = r"D:\Tool\21.Redo_Portal\Module-Import\ItemTem.xlsx"
df = pd.read_excel(file_path)

excel_products = set(df['ITEMCODE'].dropna().astype(str).str.strip())
excel_labels = set(df['ITEM'].dropna().astype(str).str.strip())

print(f"Unique product item codes in excel: {len(excel_products)}")
print(f"Unique label item codes in excel: {len(excel_labels)}")
print(f"Total master items in DB: {len(db_items)}")

missing_products = excel_products - db_items
missing_labels = excel_labels - db_items

print(f"Product codes in Excel missing from DB: {len(missing_products)}")
print(f"Label codes in Excel missing from DB: {len(missing_labels)}")
print("Sample missing labels:")
print(list(missing_labels)[:10])
