import socket
import sys

# Set output encoding to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

host = "db.slwpwztwgvixoatefbjv.supabase.co"
port = 5432

print(f"Resolving {host}...")
try:
    infos = socket.getaddrinfo(host, port, socket.AF_UNSPEC, socket.SOCK_STREAM)
    for info in infos:
        family, type, proto, canonname, sockaddr = info
        print(f"Family: {family}, Sockaddr: {sockaddr}")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
