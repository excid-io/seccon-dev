#!/usr/bin/python3
import hashlib
import base64
import requests
import sys
import argparse


def sign_image(image, token, comment, output, verbose):

    with open(image,"rb") as f:
        bytes = f.read() # read entire file as bytes
        artifact_digest = hashlib.sha256(bytes).digest()

    url="https://staas.excid.io/"
    headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + token
    }

    payload = f"""
    {{
        "HashBase64":"{base64.b64encode(artifact_digest).decode()}",
        "Comment":"{comment}"
    }} """

    if verbose:
        print(payload)

    response = requests.request("POST", url + "Api/Sign", headers=headers, data=payload)
    if verbose:
        print(response.text)
    print("Response code: " + str(response.status_code))

    print("Signed artifact " + image)
    with open(output, "w") as text_file:
        text_file.write(response.text)
    print("Wrote bundle to " + output)


def sign_blob(artifact, token, comment, output, verbose):

    with open(artifact,"rb") as f:
        bytes = f.read() # read entire file as bytes
        artifact_digest = hashlib.sha256(bytes).digest()

    url="https://staas.excid.io/"
    headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + token
    }

    payload = f"""
    {{
        "HashBase64":"{base64.b64encode(artifact_digest).decode()}",
        "Comment":"{comment}"
    }} """

    if verbose:
        print(payload)

    response = requests.request("POST", url + "Api/Sign", headers=headers, data=payload)
    if verbose:
        print(response.text)
    print("Response code: " + str(response.status_code))

    print("Signed artifact " + artifact)
    with open(output, "w") as text_file:
        text_file.write(response.text)
    print("Wrote bundle to " + output)


def main():

    parser = argparse.ArgumentParser(description="Sign an artifact using STaaS (https://staas.excid.io)\nA path to an artifact is provided, and its digest is sent to STaaS. STaaS then returns the signature in a bundle.")
    subparsers = parser.add_subparsers(dest='command')

    sign_image_parser = subparsers.add_parser('sign-image', help='Sign a container image')
    sign_image_parser.add_argument('-t','--token', type=str, metavar='', required=True, help='Authorization token to access STaaS API')
    sign_image_parser.add_argument('-c', '--comment', type=str, metavar='', required=False, default='Signing w/ STaaS', help='A comment to accompany the signing (staas-specific info, not related to signature)')
    sign_image_parser.add_argument('-o', '--output', type=str, metavar='', required=False, default='output.bundle', help='Name output file (default is output.bundle)')
    sign_image_parser.add_argument('image', type=str, metavar='', help='Image to sign. Provide full URL to container registry e.g., registry.gitlab.com/some/repository')

    sign_blob_parser = subparsers.add_parser('sign-blob', help='Sign a blob (arbitrary artifact)')
    sign_blob_parser.add_argument('-t','--token', type=str, metavar='', required=True, help='Authorization token to access STaaS API')
    sign_blob_parser.add_argument('-c', '--comment', type=str, metavar='', required=False, default='Signing w/ STaaS', help='A comment to accompany the signing (staas-specific info, not related to signature)')
    sign_blob_parser.add_argument('-o', '--output', type=str, metavar='', required=False, default='output.bundle', help='Name output file (default is output.bundle)')
    sign_blob_parser.add_argument('artifact', type=str, metavar='', help='Path to the artifact to sign')

    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')

    args = parser.parse_args()

    if args.command == 'sign-image':
        if not args.image:
            sign_image_parser.print_help()
            sys.exit(1)
        sign_image(args.image, args.token, args.comment, args.output, args.verbose)
    elif args.command == 'sign-blob':
        if not args.artifact:
            sign_blob_parser.print_help()
            sys.exit(1) 
        sign_blob(args.artifact, args.token, args.comment, args.output, args.verbose)
    else:
        parser.print_help()
        exit()



if __name__ == "__main__":
    main()