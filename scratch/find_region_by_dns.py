import socket
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

original_getaddrinfo = socket.getaddrinfo

for r in regions:
    pooler_host = f"aws-0-{r}.pooler.supabase.com"
    print(f"Testing region {r} ({pooler_host})...")
    
    # Resolve pooler_host to IPv4
    try:
        ips = socket.getaddrinfo(pooler_host, 6543, socket.AF_INET, socket.SOCK_STREAM)
        if not ips:
            print(f" -> Could not resolve {pooler_host} to IPv4")
            continue
        pooler_ipv4 = ips[0][4][0]
        print(f" -> Pooler IPv4: {pooler_ipv4}")
    except Exception as e:
        print(f" -> Resolution error: {e}")
        continue

    # Monkey patch getaddrinfo to redirect db.slwpwztwgvixoatefbjv.supabase.co to pooler_ipv4
    def patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        if host == "db.slwpwztwgvixoatefbjv.supabase.co":
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (pooler_ipv4, port))]
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
            timeout=3
        )
        print(f" -> SUCCESS! Region {r} is the correct region!")
        conn.close()
        break
    except Exception as e:
        err_msg = str(e)
        if "not found" in err_msg:
            print(f" -> Not found in {r}")
        else:
            print(f" -> Other error in {r}: {e}")

# Restore getaddrinfo
socket.getaddrinfo = original_getaddrinfo
