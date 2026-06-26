import pandas as pd
import pg8000.dbapi
import os
import sys

# Set output encoding to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

# 1. Read db password and project details
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
# Extract project ref from URL (e.g. https://slwpwztwgvixoatefbjv.supabase.co -> slwpwztwgvixoatefbjv)
project_ref = supabase_url.split("//")[1].split(".")[0]
db_password = "3o786IsHH6HxTuey"  # From Pass_Supabase.txt

print(f"Connecting to pooler Postgres DB for project: {project_ref}...")
conn = pg8000.dbapi.connect(
    host="aws-0-ap-southeast-1.pooler.supabase.com",
    database="postgres",
    user=f"postgres.{project_ref}",
    password=db_password,
    port=6543
)
cursor = conn.cursor()

# 2. Run SQL migration
sql_path = r"d:\Tool\21.Redo_Portal\scripts\create_product_label_mappings.sql"
print(f"Running SQL migrations from {sql_path}...")
with open(sql_path, "r", encoding="utf-8") as f:
    sql_script = f.read()

# Split statements by semicolon and run
for statement in sql_script.split(";"):
    stmt = statement.strip()
    if stmt:
        cursor.execute(stmt)
conn.commit()
print("Table created and RLS configured successfully!")

# 3. Read Excel Data
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

# 4. Upsert Items to master_items (both products and label items)
print("Upserting items to master_items...")
inserted_count = 0

for idx, row in df.iterrows():
    # A. Product Item
    prod_code = clean_str(row.get('ITEMCODE'))
    prod_name = clean_str(row.get('TÊN HÀNG'))
    supplier = clean_str(row.get('HÃNG')) or "UNKNOWN"
    case_qty = parse_num(row.get('QUY CÁCH THÙNG'))
    pallet_qty = parse_num(row.get('QUY CÁCH PALLET'))

    if prod_code and prod_name:
        cursor.execute("""
            INSERT INTO public.master_items (item_code, item_name, supplier_code, case_qty, pallet_qty, is_active, updated_at)
            VALUES (%s, %s, %s, %s, %s, true, now())
            ON CONFLICT (item_code) DO UPDATE SET
                item_name = EXCLUDED.item_name,
                supplier_code = EXCLUDED.supplier_code,
                case_qty = COALESCE(NULLIF(EXCLUDED.case_qty, 0), public.master_items.case_qty),
                pallet_qty = COALESCE(NULLIF(EXCLUDED.pallet_qty, 0), public.master_items.pallet_qty),
                updated_at = now()
        """, [prod_code, prod_name, supplier, case_qty, pallet_qty])
        inserted_count += 1

    # B. Label Item
    label_code = clean_str(row.get('ITEM'))
    label_name = clean_str(row.get('DESCRIPTION'))
    label_supplier = "P.Tem" # From prefix rules

    if label_code and label_name:
        cursor.execute("""
            INSERT INTO public.master_items (item_code, item_name, supplier_code, is_active, updated_at)
            VALUES (%s, %s, %s, true, now())
            ON CONFLICT (item_code) DO UPDATE SET
                item_name = EXCLUDED.item_name,
                supplier_code = EXCLUDED.supplier_code,
                updated_at = now()
        """, [label_code, label_name, label_supplier])
        inserted_count += 1

conn.commit()
print(f"Upserted {inserted_count} rows in master_items.")

# 5. Upsert Product-Label Mappings
print("Upserting mappings to product_label_mappings...")
mappings_count = 0

for idx, row in df.iterrows():
    prod_code = clean_str(row.get('ITEMCODE'))
    label_code = clean_str(row.get('ITEM'))
    task_qty = parse_num(row.get('TASK'))

    if prod_code and label_code:
        cursor.execute("""
            INSERT INTO public.product_label_mappings (product_item_code, label_item_code, quantity_per_unit)
            VALUES (%s, %s, %s)
            ON CONFLICT (product_item_code, label_item_code) DO UPDATE SET
                quantity_per_unit = EXCLUDED.quantity_per_unit
        """, [prod_code, label_code, task_qty])
        mappings_count += 1

conn.commit()
print(f"Upserted {mappings_count} mapping entries.")

cursor.close()
conn.close()
print("=== DATABASE MIGRATION AND SEEDING COMPLETED SUCCESSFULLY ===")
