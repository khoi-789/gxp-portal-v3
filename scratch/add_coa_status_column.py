import pg8000.dbapi
import os
import sys
import ssl

# Set output encoding to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

# Read db password and project details
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
db_password = "3o786IsHH6HxTuey"  # From Pass_Supabase.txt

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

print(f"Connecting to pooler Postgres DB for project: {project_ref}...")
conn = pg8000.dbapi.connect(
    host="aws-0-ap-southeast-1.pooler.supabase.com",
    database="postgres",
    user=f"postgres.{project_ref}",
    password=db_password,
    port=6543,
    ssl_context=ssl_context
)
cursor = conn.cursor()

# Run SQL to add coa_status column
stmt = "ALTER TABLE public.imp_shipment_items ADD COLUMN IF NOT EXISTS coa_status TEXT DEFAULT 'Chưa có' NOT NULL;"

print(f"Executing: {stmt}")
try:
    cursor.execute(stmt)
    conn.commit()
    print("Column coa_status added successfully to imp_shipment_items!")
except Exception as e:
    print(f"Error executing statement: {e}")

cursor.close()
conn.close()
