import pg8000.dbapi
import ssl
import sys

sys.stdout.reconfigure(encoding='utf-8')

regions = [
    "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-northeast-3",
    "ap-south-1", "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3", "sa-east-1", "ca-central-1",
    "eu-north-1", "me-central-1"
]

user = "postgres.slwpwztwgvixoatefbjv"
password = "3o786IsHH6HxTuey"
database = "postgres"

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

for r in regions:
    host = f"aws-0-{r}.pooler.supabase.com"
    print(f"Testing {r} ({host})...")
    try:
        conn = pg8000.dbapi.connect(
            host=host,
            port=6543,
            user=user,
            password=password,
            database=database,
            ssl_context=ssl_context,
            timeout=3
        )
        print(f" -> SUCCESS on region: {r}!")
        conn.close()
        break
    except Exception as e:
        print(f" -> Error in {r}: {e}")
