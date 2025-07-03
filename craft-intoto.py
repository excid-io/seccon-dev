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
parser.add_argument('-n', '--image_name', type=str, metavar='', required=True, help='Name of the container image')
parser.add_argument('-d', '--image_digest', type=str, metavar='', required=True, help='Digest (hash) of the container image')
parser.add_argument('-s', '--sbom_file', type=str, metavar='', required=True, help='Path to the SBOM file')

args = parser.parse_args()


schemaFile = args.file
imageName = args.image_name
imageHash = args.image_digest
predicateFile = args.sbom_file

# Load sbom-intoto.json
with open(schemaFile, 'r') as intoto_file:
    intoto_data = json.load(intoto_file)

# Load sbom into predicate field
with open(predicateFile, 'r') as sbom_file:
    sbom_data = json.load(sbom_file)

# Update the predicate field
intoto_data['predicate'] = sbom_data

intoto_data['subject'][0]['name'] = imageName
intoto_data['subject'][0]['digest']['sha256'] = imageHash

# Write the updated data to a new file
with open('sbom-intoto.json', 'w') as updated_file:
    json.dump(intoto_data, updated_file, indent=4)

print("Done")