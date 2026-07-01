import pg8000.dbapi
import os
import sys

# Set output encoding to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

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
project_ref = supabase_url.split("//")[1].split(".")[0]
db_password = "3o786IsHH6HxTuey"

print(f"Connecting to direct Postgres DB host db.{project_ref}.supabase.co...")
conn = pg8000.dbapi.connect(
    host=f"db.{project_ref}.supabase.co",
    database="postgres",
    user="postgres",
    password=db_password,
    port=5432
)
cursor = conn.cursor()

# Run SQL changes
sql_statements = [
    # 1. Add updated_at columns
    "ALTER TABLE public.master_suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL",
    "ALTER TABLE public.product_label_mappings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL",
    "ALTER TABLE public.master_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL",
    
    # 2. Create trigger function
    """
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = timezone('utc'::text, now());
        RETURN NEW;
    END;
    $$ language 'plpgsql';
    """,
    
    # 3. Add triggers
    "DROP TRIGGER IF EXISTS update_master_suppliers_updated_at ON public.master_suppliers",
    """
    CREATE TRIGGER update_master_suppliers_updated_at
        BEFORE UPDATE ON public.master_suppliers
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """,
    
    "DROP TRIGGER IF EXISTS update_master_items_updated_at ON public.master_items",
    """
    CREATE TRIGGER update_master_items_updated_at
        BEFORE UPDATE ON public.master_items
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """,
    
    "DROP TRIGGER IF EXISTS update_product_label_mappings_updated_at ON public.product_label_mappings",
    """
    CREATE TRIGGER update_product_label_mappings_updated_at
        BEFORE UPDATE ON public.product_label_mappings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """
]

print("Executing SQL migrations to setup updated_at...")
for stmt in sql_statements:
    try:
        cursor.execute(stmt)
        print("Success executing statement.")
    except Exception as e:
        print(f"Error executing statement: {e}")

conn.commit()
print("Database migrated successfully!")
cursor.close()
conn.close()
