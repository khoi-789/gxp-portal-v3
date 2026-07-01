import socket
import pg8000.dbapi
import ssl
import sys

sys.stdout.reconfigure(encoding='utf-8')

original_getaddrinfo = socket.getaddrinfo

# We will test all IPs resolved for aws-0-ap-south-1.pooler.supabase.com
ips = ["13.235.109.117", "65.0.195.55"]
user = "postgres.slwpwztwgvixoatefbjv"
password = "3o786IsHH6HxTuey"
database = "postgres"

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

for ip in ips:
    print(f"\nTesting IP: {ip}...")
    def patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        if host == "db.slwpwztwgvixoatefbjv.supabase.co":
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (ip, port))]
        return original_getaddrinfo(host, port, family, type, proto, flags)
    
    socket.getaddrinfo = patched_getaddrinfo
    
    try:
        conn = pg8000.dbapi.connect(
            host="db.slwpwztwgvixoatefbjv.supabase.co",
            port=6543,
            user=user,
            password=password,
            database=database,
            ssl_context=ssl_context,
            timeout=5
        )
        print(f" -> SUCCESS! Connected to {ip}!")
        conn.close()
    except Exception as e:
        print(f" -> FAILED: {e}")
