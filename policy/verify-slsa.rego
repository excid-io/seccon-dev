package attestation.slsa1
import future.keywords.in
import future.keywords.if

slsa_predicate := "https://slsa.dev/provenance/v1"

approved_repos := [
    "https://github.com/excid-io/attestations-test"
]
approved_runners := [
    "https://actions.github.io/buildtypes/workflow/v1"
]

# Fail closed
default allow := false

# Allow if the repository is in the approved_repos list and the predicateType matches
allow if {
	statement = json.unmarshal(base64.decode(input.dsseEnvelope.payload))

	predicateType = statement.predicateType
	runner := statement.predicate.buildDefinition.buildType
	repo := statement.predicate.buildDefinition.externalParameters.workflow.repository

	# Verify that the predicate type is SLSA Provenance
	predicateType == slsa_predicate
    
	# Verify against our expectations
    repo == approved_repos[_]
    runner == approved_runners[_]
}
