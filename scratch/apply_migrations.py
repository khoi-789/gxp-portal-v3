import socket
import pg8000.dbapi
import ssl
import sys

sys.stdout.reconfigure(encoding='utf-8')

original_getaddrinfo = socket.getaddrinfo

# Resolve the pooler host dynamically
pooler_host = "aws-0-ap-southeast-1.pooler.supabase.com"
try:
    pooler_ipv4 = socket.gethostbyname(pooler_host)
    print(f"Dynamically resolved {pooler_host} -> {pooler_ipv4}")
except Exception as e:
    print(f"Failed to resolve {pooler_host}: {e}")
    sys.exit(1)

def patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if host == "db.slwpwztwgvixoatefbjv.supabase.co":
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (pooler_ipv4, port))]
    return original_getaddrinfo(host, port, family, type, proto, flags)

socket.getaddrinfo = patched_getaddrinfo

host = "db.slwpwztwgvixoatefbjv.supabase.co"
user = "postgres.slwpwztwgvixoatefbjv"
password = "3o786IsHH6HxTuey"
database = "postgres"

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

try:
    print(f"Connecting to {host}:6543...")
    conn = pg8000.dbapi.connect(
        host=host,
        port=6543,
        user=user,
        password=password,
        database=database,
        ssl_context=ssl_context,
        timeout=10
    )
    print("SUCCESS! Connected to Supabase!")
    cursor = conn.cursor()
    
    # 1. Add coa_status to imp_shipment_items
    print("Adding coa_status to imp_shipment_items...")
    cursor.execute("ALTER TABLE public.imp_shipment_items ADD COLUMN IF NOT EXISTS coa_status TEXT DEFAULT 'Chưa có' NOT NULL;")
    
    # 2. Add visa_no to imp_shipment_items
    print("Adding visa_no to imp_shipment_items...")
    cursor.execute("ALTER TABLE public.imp_shipment_items ADD COLUMN IF NOT EXISTS visa_no TEXT;")
    
    # 3. Add decision_no to imp_shipment_items
    print("Adding decision_no to imp_shipment_items...")
    cursor.execute("ALTER TABLE public.imp_shipment_items ADD COLUMN IF NOT EXISTS decision_no TEXT;")
    
    # 4. Add valid_until to imp_shipment_items
    print("Adding valid_until to imp_shipment_items...")
    cursor.execute("ALTER TABLE public.imp_shipment_items ADD COLUMN IF NOT EXISTS valid_until TEXT;")
    
    conn.commit()
    print("All migrations completed successfully!")
    
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
