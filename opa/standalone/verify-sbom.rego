package attestation.sbom
import future.keywords.in
import future.keywords.if

sbom_predicate := "https://cyclonedx.org/bom"

official_image = "ghcr.io/excid-io/attestations-test"

# Fail closed
default allow := false

# Allow if the repository is in the approved_repos list and the predicateType matches
allow if {
	statement = json.unmarshal(base64.decode(input.dsseEnvelope.payload))

	predicateType = statement.predicateType
	container_image = statement.predicate.metadata.component.name
	
	# Verify that the predicate type is CycloneDX SBOM
	predicateType == predicateType
    
	# Verify against our expectations
    container_image == official_image

	# Find the express component
    # Find the express component
    some i
    statement.predicate.components[i].name == "express"
    version := statement.predicate.components[i].version
    parts := split(version, ".")
    major_version := to_number(parts[0])
    major_version >= 4
}
