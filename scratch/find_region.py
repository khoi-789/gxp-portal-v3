import pg8000.dbapi
import ssl
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
    print(f"Testing region {r} ({host})...")
    try:
        conn = pg8000.dbapi.connect(
            host=host,
            port=6543,
            user=user,
            password=password,
            database=database,
            ssl_context=ssl_context,
            timeout=5
        )
        print(f" -> SUCCESS! Found region: {r}")
        conn.close()
        break
    except Exception as e:
        err_msg = str(e)
        if "not found" in err_msg:
            # Tenant not found, keep looking
            pass
        elif "password authentication failed" in err_msg or "password" in err_msg.lower():
            print(f" -> FOUND! Region is {r}, but password failed: {err_msg}")
            break
        else:
            print(f" -> Other error in {r}: {err_msg}")
else:
    print("Scan finished. No region matched.")
