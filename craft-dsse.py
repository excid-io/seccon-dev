#!/usr/bin/python3
import json
import argparse

"""
This file sets the subject's name and hash fields to
the appropriate ones. It inserts the sbom generated earlier
in the pipeline in the predicate field. 
Fields _type and predicateType are predefined since this is
specifically for creating the sbom in-toto statement.
"""

parser = argparse.ArgumentParser(description="Create in-toto JSON statement for SBOM")
parser.add_argument('-f','--file', type=str, metavar='', required=True, default='intoto-schema.json', help='File to modify (schema file)')
parser.add_argument('-p', '--payload', type=str, metavar='', required=True, help='Path to base64 encoded in-toto statement of SBOM or SLSA provenance file')
parser.add_argument('-s', '--signature', type=str, metavar='', required=True, help='Path to base64 encoded signature')

media_type_group = parser.add_mutually_exclusive_group()
media_type_group.add_argument("--slsa-provenance", dest="provenance", action="store_true", help="DSSE envelope must include the SLSA provenance media type")
media_type_group.add_argument("--sbom", action="store_true", help="DSSE envelope must include the SBOM media type")

args = parser.parse_args()

if not (args.provenance ^ args.sbom):  # XOR operation
    parser.error("Exactly one of --slsa-provenance or --sbom must be provided.")

media_type_slsa = "application/vnd.in-toto.provenance+dsse"
media_type_sbom = "application/vnd.in-toto.spdx+dsse"

schemaFile = args.file
payloadFile = args.payload
signatureFile = args.signature

with open(schemaFile, 'r') as dsse_file:
    dsse_data = json.load(dsse_file)

if args.sbom:
    dsse_data['payloadType'] = media_type_sbom
elif args.provenance:
    dsse_data['payloadType'] = media_type_slsa

with open(payloadFile, 'r') as payload_file:
    payload_data = payload_file.read()

dsse_data['payload'] = payload_data

with open(signatureFile, 'r') as signature_file:
    signature_data = signature_file.read()

dsse_data['signatures'][0]['sig'] = signature_data
dsse_data['signatures'][0]['keyid'] = ""

# Write the updated data to a new file
outputFile = 'sbom.att' if args.sbom else 'slsa-prov.att'
with open(outputFile, 'w') as updated_file:
    json.dump(dsse_data, updated_file, indent=4)

print("Created dsse envelope: " + outputFile)