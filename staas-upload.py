import hashlib
import base64
import requests
import sys

API_TOKEN = sys.argv[1]  # Authorization token for the second argument
FILENAME = sys.argv[2]  # File path for the first argument
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
with open(FILENAME+".bundle", "w") as text_file:
    text_file.write(response.text)

print(response.status_code)