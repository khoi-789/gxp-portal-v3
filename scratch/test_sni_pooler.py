import pg8000.dbapi
import ssl
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Resolve IPv4 for aws-0-ap-southeast-1.pooler.supabase.com
# We can use the IP address 52.77.146.31 directly
pooler_ip = "52.77.146.31"
sni_host = "db.slwpwztwgvixoatefbjv.supabase.co"
user = "postgres"
password = "3o786IsHH6HxTuey"
database = "postgres"

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = True
# Set server_hostname to the direct DB host for SNI routing
ssl_context.verify_mode = ssl.CERT_REQUIRED

print(f"Connecting to {pooler_ip}:6543 with SNI hostname {sni_host}...")
try:
    # We can connect using pg8000.
    # Note: we need to pass the socket with the wrapped SSL context
    import socket
    sock = socket.create_connection((pooler_ip, 6543), timeout=5)
    ssl_sock = ssl_context.wrap_socket(sock, server_hostname=sni_host)
    
    conn = pg8000.dbapi.connect(
        user=user,
        password=password,
        database=database,
        sock=ssl_sock
    )
    print("SUCCESS! Connected to Supabase via SNI over IPv4!")
    cursor = conn.cursor()
    cursor.execute("SELECT version();")
    print("Version:", cursor.fetchone())
    conn.close()
except Exception as e:
    print(f"Error: {e}")
