import http.client
import json

url = "lvcqsdfhzlfdpspewpsc.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Y3FzZGZoemxmZHBzcGV3cHNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDI4MjAsImV4cCI6MjA4MjM3ODgyMH0._7ltMS7Dumpjv3bxy46LPd-gzdvqPgGpAXj7y9QiBXU"

headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}'
}

conn = http.client.HTTPSConnection(url)
conn.request("GET", "/rest/v1/schools?limit=1", headers=headers)
res = conn.getresponse()
data = res.read()
print(f"Status: {res.status} {res.reason}")
if res.status == 200:
    record = json.loads(data.decode("utf-8"))
    if record:
        print("Schema columns for schools:")
        for k in record[0].keys():
            print(f"- {k}")
    else:
        print("No records found in schools.")
else:
    print(data.decode("utf-8"))
