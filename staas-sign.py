#!/usr/bin/python3
import hashlib
import base64
import requests
import sys
import argparse

parser = argparse.ArgumentParser(description="Sign an artifact using STaaS (https://staas.excid.io)\nA path to an artifact is provided, and its digest is sent to STaaS. STaaS then returns the signature in a bundle.")
parser.add_argument('-t','--token', type=str, metavar='', required=True, help='Authorization token to access STaaS API')
parser.add_argument('-a', '--artifact', type=str, metavar='', required=True, help='Path to the artifact to sign')
parser.add_argument('-c', '--comment', type=str, metavar='', required=False, default='Signing w/ STaaS', help='A comment to accompany the signing (staas-specific info, not related to signature)')
parser.add_argument('-o', '--output', type=str, metavar='', required=False, default='output.bundle', help='Name output file (default is output.bundle)')
parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')

args = parser.parse_args()

API_TOKEN = args.token  # Authorization token for the second argument
FILENAME = args.artifact  # File path for the first argument
COMMENT = args.comment  # Comment

with open(FILENAME,"rb") as f:
    bytes = f.read() # read entire file as bytes
    artifact_digest = hashlib.sha256(bytes).digest()

url="https://staas.excid.io/"
headers = {
'Content-Type': 'application/json',
'Authorization': 'Basic ' + API_TOKEN
}

payload = f"""
{{
    "HashBase64":"{base64.b64encode(artifact_digest).decode()}",
    "Comment":"{COMMENT}"
}} """

if args.verbose:
    print(payload)

response = requests.request("POST", url + "Api/Sign", headers=headers, data=payload)
if args.verbose:
    print(response.text)

print("Signed artifact " + FILENAME)
print("Response code: " + str(response.status_code))

with open(args.output, "w") as text_file:
    text_file.write(response.text)
