import http.client
import json

url = "lvcqsdfhzlfdpspewpsc.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Y3FzZGZoemxmZHBzcGV3cHNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDI4MjAsImV4cCI6MjA4MjM3ODgyMH0._7ltMS7Dumpjv3bxy46LPd-gzdvqPgGpAXj7y9QiBXU"

headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
}

school_id = "9d298913-8d1b-4eb9-b41b-d1a56b16cffd"

# Testing sending empty strings for columns that might be numeric or expect null
update_payload = {
    "name": "Nome Teste",
    "region": "Urbano",
    "description": "",
    "director_name": "",
    "vice_director_name": "",
    "codigo_escola": "",
    "telefone_diretor": ""
}

conn = http.client.HTTPSConnection(url)
conn.request("PATCH", f"/rest/v1/schools?id=eq.{school_id}", json.dumps(update_payload), headers=headers)
res = conn.getresponse()
data = res.read().decode("utf-8")
print(f"Update Result Status: {res.status} {res.reason}")
print(data)
