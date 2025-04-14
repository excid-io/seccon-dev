## Attack scenarios & Mitigations using Open Policy Agent

In this repo we also consider how attestations protect from specific attack scenarios. This is why we showcase two different yaml files:
- one for normal operating conditions (devprivsecops.gitlab-ci.yml)
- one which is vulnerable (.gitlab-ci.yml)

*Note*: GitLab CI can only have **one** `.gitlab-ci.yml` file in the repo which runs the pipeline, so rename the file you want to run accordingly.

The purpose is to show how a vulnerable `.gitlab-ci.yml` file can be exploited by an adversary. By doing this, we emphasize the importance of the verification of attestations. We use `Open Policy Agent (OPA)` and write policies in REGO to verify the attestations. More details about `opa` and its functionality see the `policy` folder in the repo.

For example, if our repo's name is `excid-cicd-demo-project`, the attacker can create another repo which is typosquatted, like `excid-civd-demo-project`, and upload a pipeline whici executes `docker build excid-civd-demo-project`, and thus, builds and pushes a malicious copy of our project.

Attacks covered in this repo are related to the threats mentioned in the [SLSA specification threat list](https://slsa.dev/spec/v1.0/threats-overview), plus some dependency attacks just to showcase how the SBOM attestation can protect from vulnerable dependencies, typosquatted dependencies etc.

Scenarios:

| Scenario                                         | Description                                                                                                                                                            | Remediation                                                                                                                 |
|--------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| Build from malicious source (another repository) | We have a typosquatted version of the project as mentioned above, which just disables the https server (only serves http) and output a message "Malicious" in the HTML | In the verification policy, we need to explicitly check if the repo in the predicate is equal to the official repo          |
| Build from previous commit hash                  | Instead of building from the current commit, the pipeline builds from a previous version which is vulnerable.                                                          | Always check that the package/container image built, corresponds to the latest commit hash                                  |
| Build from non-registered/malicious runner       | Build with a runner that is not registered in my infrastructure (mostly for cases including self-hosted runners)                                                       | Give OPA some data input, which is a list of registered runners (their tokens)                                              |
| Build with compromised dependency                | Import a malicious dependency                                                                                                                                          | Generate SBOM attestation, and check against names and versions of dependencies that are highly significant for the project |
|                                                  |                                                                                                                                                                        |                                                                                                                             |
Other possible scenarios (out of scope):

- Submit unauthorized changes in source code -> two-person review
- Compromise source repo -> branch protection, harden VCS

### Scenario 1

Build from malicious source (different repository than the intended). In this scenario, we consider that someone created a repoository with a different name than the official one, and modifies the CI pipeline so that it builds the code from the malicious repository.

