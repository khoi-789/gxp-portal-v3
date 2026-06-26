import socket
import ssl
import pg8000.dbapi
import sys

sys.stdout.reconfigure(encoding='utf-8')

regions = [
    "ap-southeast-1", # Singapore
    "ap-southeast-2", # Sydney
    "ap-northeast-1", # Tokyo
    "ap-northeast-2", # Seoul
    "ap-northeast-3", # Osaka
    "ap-south-1",     # Mumbai
    "us-east-1",      # N. Virginia
    "us-east-2",      # Ohio
    "us-west-1",      # N. California
    "us-west-2",      # Oregon
    "eu-central-1",   # Frankfurt
    "eu-west-1",      # Ireland
    "eu-west-2",      # London
    "eu-west-3",      # Paris
    "sa-east-1",      # Sao Paulo
    "ca-central-1",   # Canada Central
]

user = "postgres.slwpwztwgvixoatefbjv"
password = "3o786IsHH6HxTuey"
database = "postgres"

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

for r in regions:
    host = f"aws-0-{r}.pooler.supabase.com"
    try:
        # Try resolving host first
        ip = socket.gethostbyname(host)
        print(f"Region {r}: resolved to {ip}")
        # Try connecting
        conn = pg8000.dbapi.connect(
            host=host,
            port=6543,
            user=user,
            password=password,
            database=database,
            ssl_context=ssl_context,
            timeout=3
        )
        print(f" -> SUCCESS CONNECTED TO {r}!")
        conn.close()
    except Exception as e:
        print(f" -> ERROR in {r}: {e}")
