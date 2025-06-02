package attestation.slsa1
import future.keywords.in
import future.keywords.if

slsa_predicate := "https://slsa.dev/provenance/v1"

approved_repos := [
    "https://gitlab.com/excid-io/excid-cicd-demo-project"
]
approved_runners := [
    "https://gitlab.com/gitlab-org/gitlab-runner/-/blob/5c23fd8e/PROVENANCE.md"
]

gl_commits := http.send({"method": "get", "url": "https://gitlab.com/api/v4/projects/excid-demo%2Fexcid-cicd-demo-project/repository/commits?ref_name=main"})


# Fail closed
default allow := false

# Allow if the repository is in the approved_repos list and the predicateType matches
allow if {

	# get latest hash of GL repo
	statement = json.unmarshal(base64.decode(input.payload))

	predicateType = statement.predicateType
	runner := statement.predicate.buildDefinition.buildType
	repo := statement.predicate.buildDefinition.externalParameters.workflow.repository
	ref := statement.predicate.resolvedDependencies[0].digest.sha256

	# Verify that the predicate type is SLSA Provenance
	predicateType == slsa_predicate
    
	# Verify against our expectations
    repo == approved_repos[_]
    runner == approved_runners[_]
	ref == gl_commits.body[0].id
}

# get latest hash of GH repo: curl -s https://api.github.com/repos/{owner}/{repo}/commits/main | jq -r .sha

# get latest hash of GL repo: curl -s curl -s "https://gitlab.com/api/v4/projects/{project_id}/repository/commits?ref_name=main" | jq -r '.[0].id'
# OR instead of project id: curl -s "https://gitlab.com/api/v4/projects/{namespace}%2F{project_name}/repository/commits?ref_name=main" | jq -r '.[0].id' (must be url encoded)

