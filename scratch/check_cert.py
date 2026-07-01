import socket
import ssl
import sys

sys.stdout.reconfigure(encoding='utf-8')

host = "slwpwztwgvixoatefbjv.supabase.co"
port = 443

print(f"Connecting to {host}:{port} via SSL...")
context = ssl.create_default_context()
try:
    with socket.create_connection((host, port)) as sock:
        with context.wrap_socket(sock, server_hostname=host) as ssock:
            cert = ssock.getpeercert()
            print("Certificate details:")
            print(cert)
except Exception as e:
    print(f"Error: {e}")
