import http.client
import json

url = "lvcqsdfhzlfdpspewpsc.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Y3FzZGZoemxmZHBzcGV3cHNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MDI4MjAsImV4cCI6MjA4MjM3ODgyMH0._7ltMS7Dumpjv3bxy46LPd-gzdvqPgGpAXj7y9QiBXU"

headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}'
}

# PostgREST doesn't easily allow querying information_schema directly via REST unless exposed.
# But we can try to guess or use a RPC if available.
# Alternatively, I'll just try to update a test school via Python and see the error.

test_data = {
    "name": "TEste Escola " + str(json.dumps("temp")),
    "region": "Urbano"
}

conn = http.client.HTTPSConnection(url)
# Let's try to update the first school's name to see the error.
# First get one school ID
conn.request("GET", "/rest/v1/schools?limit=1", headers=headers)
res = conn.getresponse()
schools = json.loads(res.read().decode("utf-8"))

if schools:
    school_id = schools[0]['id']
    print(f"Attempting to update school ID: {school_id}")
    
    update_payload = {
        "name": schools[0]['name'] + " (Editado)"
    }
    
    conn.request("PATCH", f"/rest/v1/schools?id=eq.{school_id}", json.dumps(update_payload), headers={**headers, 'Content-Type': 'application/json', 'Prefer': 'return=representation'})
    res = conn.getresponse()
    print(f"Update Result Status: {res.status} {res.reason}")
    print(res.read().decode("utf-8"))
else:
    print("No schools to test update.")
