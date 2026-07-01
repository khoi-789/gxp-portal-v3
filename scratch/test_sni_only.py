import socket
import pg8000.dbapi
import ssl
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Save original getaddrinfo
original_getaddrinfo = socket.getaddrinfo

# Define monkey-patched getaddrinfo
def patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if host == "db.slwpwztwgvixoatefbjv.supabase.co":
        # Resolve to pooler IPv4 of ap-southeast-1
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('52.77.146.31', port))]
    return original_getaddrinfo(host, port, family, type, proto, flags)

# Apply patch
socket.getaddrinfo = patched_getaddrinfo

host = "db.slwpwztwgvixoatefbjv.supabase.co"
# Try using just "postgres" as the user (SNI provides the tenant ID)
user = "postgres.slwpwztwgvixoatefbjv"
password = "3o786IsHH6HxTuey"
database = "postgres"

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

try:
    print(f"Connecting to {host}:6543 as {user}...")
    conn = pg8000.dbapi.connect(
        host=host,
        port=6543,
        user=user,
        password=password,
        database=database,
        ssl_context=ssl_context,
        timeout=5
    )
    print("SUCCESS!")
    cursor = conn.cursor()
    cursor.execute("SELECT version();")
    print("Version:", cursor.fetchone())
    conn.close()
except Exception as e:
    print(f"Error: {e}")
