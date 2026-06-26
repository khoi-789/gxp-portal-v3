import pg8000.dbapi
import ssl
import sys

sys.stdout.reconfigure(encoding='utf-8')

host = "aws-ap-southeast-1.pooler.supabase.com"
user = "postgres.slwpwztwgvixoatefbjv"
password = "3o786IsHH6HxTuey"
database = "postgres"

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

tests = [
    {"port": 6543, "ssl": True, "desc": "Port 6543, SSL enabled"},
    {"port": 6543, "ssl": False, "desc": "Port 6543, SSL disabled"},
    {"port": 5432, "ssl": True, "desc": "Port 5432, SSL enabled"},
    {"port": 5432, "ssl": False, "desc": "Port 5432, SSL disabled"},
]

for t in tests:
    print(f"Testing: {t['desc']}...")
    try:
        if t["ssl"]:
            conn = pg8000.dbapi.connect(
                host=host,
                port=t["port"],
                user=user,
                password=password,
                database=database,
                ssl_context=ssl_context
            )
        else:
            conn = pg8000.dbapi.connect(
                host=host,
                port=t["port"],
                user=user,
                password=password,
                database=database
            )
        print(" -> SUCCESS!")
        conn.close()
    except Exception as e:
        print(f" -> FAILED: {e}")
