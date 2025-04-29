## Attack scenarios & Mitigations using Open Policy Agent

In this repo we also consider how attestations protect from specific attack scenarios. This is why we showcase two different yaml files:
- one for normal operating conditions (devprivsecops.gitlab-ci.yml)
- one which is vulnerable (.gitlab-ci.yml)

*Note*: GitLab CI can only have **one** `.gitlab-ci.yml` file in the repo which runs the pipeline, so rename the file you want to run accordingly.

The purpose is to show how a vulnerable `.gitlab-ci.yml` file can be exploited by an adversary. By doing this, we emphasize the importance of the verification of attestations. We use `Open Policy Agent (OPA)` and write policies in REGO to verify the attestations. More details about `opa` and its functionality see the `policy` folder in the repo.

For example, if our repo's name is `excid-cicd-demo-project`, the attacker can create another repo which is typosquatted, like `excid-civd-demo-project`, and upload a pipeline which executes `docker build excid-civd-demo-project`, and thus, builds and pushes a malicious copy of our project.

Attacks covered in this repo are related to the threats mentioned in the [SLSA specification threat list](https://slsa.dev/spec/v1.0/threats-overview), plus some dependency attacks just to showcase how the SBOM attestation can protect from vulnerable dependencies, typosquatted dependencies etc.

Scenarios:

| Scenario                                         | Description                                                                                                                                                            | Remediation                                                                                                                 |
|--------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| Build from malicious source (another repository) | We have a typosquatted version of the project as mentioned above, which just disables the https server (only serves http) and output a message "Malicious" in the HTML | In the verification policy, we need to explicitly check if the repo in the predicate is equal to the official repo          |
| Build from previous commit hash                  | Instead of building from the current commit, the pipeline builds from a previous version which is vulnerable.                                                          | Always check that the package/container image built, corresponds to the latest commit hash                                  |
| Build from non-registered/malicious runner       | Build with a runner that is not registered in my infrastructure (mostly for cases including self-hosted runners)                                                       | Give OPA some data input, which is a list of registered runners (their tokens)                                              |
| Build with compromised dependency                | Import a malicious dependency                                                                                                                                          | Generate SBOM attestation, and check against names and versions of dependencies that are highly significant for the project |


Other possible scenarios (out of scope):

- Submit unauthorized changes in source code -> two-person review
- Compromise source repo -> branch protection, harden VCS

### Scenario 1

Build from malicious source (different repository than the intended). In this scenario, we consider that someone created a repoository with a different name than the official one, and modifies the CI pipeline so that it builds the code from the malicious repository.

![alt text](assets/attack1_mal_repo.png)

Now, because SLSA defines that the **build platform is trusted**, we consider the attestation produced as an **honest** document. 
<ins>Remember</ins>, attestations are signed documents, which means that if someone tampered with it (e.g., change `subject` field in the attestation) this will be visible.

Next, imagine the CD process which runs after the CI. These are two independent procedures. Within the CD, we use tools like `cosign` to verify the authenticity and integrity of the attestation. After this, we use `opa` to verify fields of the attestation against our own expectations.

What we can do with OPA is load it with our own custom data:

![alt text](assets/attack1_mal_repo_opa.png)

When verifying, we can run some checks like the following: 

![alt text](assets/attack1_mal_repo_opa2.png)

If the check above succeeds, then the repo is the original one. Otherwise, we fail the CD and do not deploy the container image.

### Scenario 2

Contrary to the previous one, now the attackers builds the same project - the official one - but from a previous version which is known to have vulnerabilities.

![alt text](assets/attack2_old_version.png)

OPA will pull the attestation and check against the commit hash. <ins>*Note*</ins> that OPA has the [capability](https://www.openpolicyagent.org/docs/latest/policy-reference/#http) to make HTTP requests to external services and ask for data.

![alt text](assets/attack1_mal_repo_opa2.png)

### Scenario 3

Another threat is building from an unknown build system. If an adversary writes a malicious GitLab runner, run it within the infrastructure and register it in the repository, then this runner can take on jobs submitted by legit users and act illegally.

Why is there a need to worry for that? Don't we trust the build platform? Yes, but, it has been [reported](https://frichetten.com/blog/abusing-gitlab-runners/) for GitLab runners that there is a race condition vulnerability where malicious runners can request to run submitted pipelines before legit ones. Obviously, this runner can then run whatever pipeline it wants, and upload a malicious container image.

Having that in mind, we can verify two things:
1. verify all binaries pre-installation (out of scope for artifact attestations)
2. verifying that the GitLab runner token is indeed created by a trusted entity, and OPA knows about this token


### Scenario 4

Another way attestations can protect from attacks, is by creating the SBOM attestation. This way, we have an authenticated document stating that some dependencies exist in our codebase.

If some dependency is known to be vulnerable or malicious, we can capture it in the SBOM and drop CD.

![alt text](assets/attack4_sbom.png)

We can load a CVE database into OPA and check the SBOM against this knowledge base.