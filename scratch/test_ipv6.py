import pg8000.dbapi
import socket
import ssl
import sys

sys.stdout.reconfigure(encoding='utf-8')

host = "db.slwpwztwgvixoatefbjv.supabase.co"
user = "postgres"
password = "3o786IsHH6HxTuey"
database = "postgres"

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

print(f"Resolving socket addresses for {host}...")
try:
    infos = socket.getaddrinfo(host, 5432)
    for info in infos:
        print(f"Address Info: {info}")
except Exception as e:
    print(f"Resolution failed: {e}")
    sys.exit(1)

print("\nAttempting direct IPv6 connection to port 5432...")
try:
    conn = pg8000.dbapi.connect(
        host=host,
        port=5432,
        user=user,
        password=password,
        database=database,
        ssl_context=ssl_context,
        timeout=10
    )
    print(" -> SUCCESS! Connected directly via IPv6!")
    conn.close()
except Exception as e:
    print(f" -> CONNECTION FAILED: {e}")
