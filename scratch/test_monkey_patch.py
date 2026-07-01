import socket
import pg8000.dbapi
import ssl
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Save the original getaddrinfo
original_getaddrinfo = socket.getaddrinfo

# Define the monkey-patched getaddrinfo
def patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if host == "db.slwpwztwgvixoatefbjv.supabase.co":
        # Resolve to the IPv4 address of aws-0-ap-southeast-1.pooler.supabase.com
        # 52.77.146.31 is the AP-Southeast-1 pooler IPv4
        print(f"[DNS Patch] Resolving {host} -> 52.77.146.31")
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('52.77.146.31', port))]
    return original_getaddrinfo(host, port, family, type, proto, flags)

# Apply the patch
socket.getaddrinfo = patched_getaddrinfo

# Now try to connect using pg8000
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
        timeout=5
    )
    print("SUCCESS! Connected to Supabase via patched DNS!")
    cursor = conn.cursor()
    cursor.execute("SELECT version();")
    print("Version:", cursor.fetchone())
    conn.close()
except Exception as e:
    print(f"Error: {e}")
