import os
import pg8000.dbapi

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
project_ref = supabase_url.split("//")[1].split(".")[0]
db_password = "3o786IsHH6HxTuey"

print(f"Connecting to database to add required_labels column...")
conn = pg8000.dbapi.connect(
    host="aws-0-ap-southeast-1.pooler.supabase.com",
    database="postgres",
    user=f"postgres.{project_ref}",
    password=db_password,
    port=6543
)
cursor = conn.cursor()
try:
    cursor.execute("ALTER TABLE public.imp_shipment_items ADD COLUMN required_labels JSONB DEFAULT NULL;")
    conn.commit()
    print("Column required_labels added successfully!")
except Exception as e:
    print("Error or column already exists:", str(e))
finally:
    cursor.close()
    conn.close()
