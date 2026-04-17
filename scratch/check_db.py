import http.client
import json

url = "lvcqsdfhzlfdpspewpsc.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Y3FzZGZoemxmZHBzcGV3cHNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDI4MjAsImV4cCI6MjA4MjM3ODgyMH0._7ltMS7Dumpjv3bxy46LPd-gzdvqPgGpAXj7y9QiBXU"

headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}'
}

tables = ['students', 'schools', 'classes', 'staff', 'allotments']

for table in tables:
    conn = http.client.HTTPSConnection(url)
    conn.request("GET", f"/rest/v1/{table}?select=count", headers=headers)
    res = conn.getresponse()
    data = res.read()
    print(f"{table}: {res.status} {res.reason}")
    print(data.decode("utf-8"))
