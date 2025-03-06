import hashlib
import base64
import requests
import sys

FILENAME = sys.argv[1]  # File path for the first argument
API_TOKEN = sys.argv[2]  # Authorization token for the second argument
COMMENT = sys.argv[3]  # Comment
 
with open(FILENAME,"rb") as f:
   bytes = f.read() # read entire file as bytes
   artifact_hash = hashlib.sha256(bytes).digest()
 
url="https://staas.excid.io/"
headers = {
'Content-Type': 'application/json',
'Authorization': 'Basic ' + API_TOKEN
}

payload = f"""
{{
    "HashBase64":"{base64.b64encode(artifact_hash).decode()}",
    "Comment":"{COMMENT}"
}} """
 
print(payload)
response = requests.request("POST", url + "Api/Sign", headers=headers, data=payload)
print(response.text)
print(response.status_code)