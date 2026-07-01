import socket
import pg8000.dbapi
import ssl
import sys

sys.stdout.reconfigure(encoding='utf-8')

pooler_ips = ["52.77.146.31", "54.255.219.82", "52.74.252.201"]
project_ref = "slwpwztwgvixoatefbjv"
password = "3o786IsHH6HxTuey"
database = "postgres"

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# We want to test different combinations of ports, IPs, and usernames
tests = [
    # Port 6543 (Transaction mode)
    {"port": 6543, "user": f"postgres.{project_ref}"},
    {"port": 6543, "user": f"postgres"},
    # Port 5432 (Session mode)
    {"port": 5432, "user": f"postgres.{project_ref}"},
    {"port": 5432, "user": f"postgres"},
]

for ip in pooler_ips:
    for t in tests:
        port = t["port"]
        user = t["user"]
        print(f"Testing IP={ip}, Port={port}, User={user}...")
        try:
            conn = pg8000.dbapi.connect(
                host=ip,
                port=port,
                user=user,
                password=password,
                database=database,
                ssl_context=ssl_context,
                timeout=4
            )
            print(f" -> SUCCESS!!!")
            conn.close()
            sys.exit(0)
        except Exception as e:
            print(f" -> Failed: {e}")
print("All combinations failed.")
