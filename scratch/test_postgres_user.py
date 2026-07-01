import pg8000.dbapi
import ssl
import sys

sys.stdout.reconfigure(encoding='utf-8')

host = "aws-0-ap-southeast-1.pooler.supabase.com"
user = "postgres"
password = "3o786IsHH6HxTuey"
database = "postgres"

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

try:
    print(f"Connecting to {host} as {user}...")
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
    conn.close()
except Exception as e:
    print(f"Error: {e}")
