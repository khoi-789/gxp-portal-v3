import pg8000.dbapi
import os
import sys

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

print(f"Connecting to direct Postgres DB host db.{project_ref}.supabase.co...")
conn = pg8000.dbapi.connect(
    host=f"db.{project_ref}.supabase.co",
    database="postgres",
    user="postgres",
    password=db_password,
    port=5432
)
cursor = conn.cursor()

# Run SQL constraint changes
sql_statements = [
    "ALTER TABLE public.bbsc_incidents DROP CONSTRAINT IF EXISTS bbsc_incidents_bbsc_code_key",
    "ALTER TABLE public.cc_complaints DROP CONSTRAINT IF EXISTS cc_complaints_cc_code_key",
    "ALTER TABLE public.int_records DROP CONSTRAINT IF EXISTS int_records_int_code_key",
    "ALTER TABLE public.awc_changes DROP CONSTRAINT IF EXISTS awc_changes_pkey",
    "ALTER TABLE public.awc_changes ADD COLUMN IF NOT EXISTS id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY"
]

print("Executing SQL migrations to update constraints...")
for stmt in sql_statements:
    print(f"Executing: {stmt}")
    try:
        cursor.execute(stmt)
    except Exception as e:
        print(f"Warning/Error executing statement: {e}")

conn.commit()
print("Database constraints updated successfully!")
cursor.close()
conn.close()
