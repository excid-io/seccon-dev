# Secure CI/CD using artifact attestations and container signatures w/ STaaS 

## Acknowledgements
The code provided in this repository has been created in the context of the SecCon project, which is supported and funded by [aerOS](https://aeros-project.eu). 

## Description

This repository features a pipeline for demonstrating DevPrivSecOps methodology with GitLab CI. Our focus on this repo is mainly on container signatures and artifact attestations with [STaaS](https://staas.excid.io), and how we integrate it within a pipeline. A complete DevSecOps pipeline is built to demonstrate how these security mechanisms could fit within any pipeline. Additionally, another pipeline is authored that uses `cosign` instead of `staas-cli` (the [client tool of STaaS](https://github.com/excid-io/staas-cli)).

We use a demo application which is a very simple web app written in NodeJS with express-js (prints hello world in the browser). It is packed into a container and deployed as a Kubernetes Deployment. 

Regarding **Continuous Integration (CI)**, this pipeline builds a container image and uploads it on GitLab's OCI registry, integrating at the same time multiple stages of security checks. It includes Secret Scanning, SAST (Static Application Security Testing), SCA (Software Composition Analysis), image building-singing-scanning and artifact attestations. Core tools like Gitleaks, Semgrep, Trivy, and SonarQube are used to detect vulnerabilities, misconfigurations, and secrets within the code and container images.

**Continuous Deployment (CD)** is done using FluxCD. We suppose there is a Kubernetes cluster setup somewhere, and we configure FluxCD to pull the container images from the repository and apply them into the cluster. Flux does not only monitor changes in the OCI registry, but also in k8s infrastructure files (.yaml).

Continuous Deployment is **not only** about running the containers, but for our case, for **verification** as well. When applying new images in the cluster, we want to verify their signatures, and their artifact attestations. If a malicious image tries to enter the cluster, during verification tampering is detected, and thus, reject the changes (Shift-Left Security).

This pipeline promotes a secure CI/CD process by detecting and mitigating security issues as early as possible (shift left security).

**In order to emulate**: if you want to get the full benefits out of this repo you have to:
1. follow along with the CI steps:
    - setup a secure CI pipeline (decide on some platform which suits your needs and lay out the steps/jobs, here we implement GitLab CI pipelines)
    - build and **sign** your container images
    - **use attestations** for images which will be later on verified (on the Kubernetes end)
    - store signatures and attestations on the OCI registry
    - we do not go over on setting up any CI environment, since we use GitLab hosted runners
2. setup a CD procedure:
    - decide on your gitops strategy (here we do monorepo)
    - setup a k8s cluster (in our example we setup a cluster with `minikube`)
    - install `fluxcd` in the cluster
    - installation steps on setting up minikube along with fluxcd and any other verification components are found under `opa/gatekeeper` and `kyverno` folders (we choose to implement Kyverno as a policy engine but we document other choices as well)

Artifact attestations and signatures ensure the integrity and authenticity of specific artifacts. We create container signatures plus [Provenance and SBOM](https://slsa.dev) attestations. STaaS is used to sign them. As mentioned above, [staas-cli](https://github.com/excid-io/staas-cli) is the client tool for STaaS platform. It comes with a container image containing all the runtime dependencies, which perfectly suits for GitLab CI setups (see jobs *staas-sign-container-image*, *staas-provenance*, *staas-sbom* in .gitlab-ci.yaml). 

## Folder Structure

- `apps`: contains all .yaml and `kustomization` files for our k8s cluster.
- `assets`: images and other files useful for the repo.
- `attacks`: a folder which contains more `.gitlab-ci.yaml` files. These files are prone to vulnerabilities. This is our way to demonstrate how container signatures and attestations protect from specific attacks.
- `clusters`: the folder that fluxcd monitors. The core file in there is `apps.yaml`. We modify this file to tell flux which kustomization to apply into the cluster.
- `kyverno`: contains installation instructions for minikube and kyverno, as well as some policies that validate container signatures and attestations (STaaS and cosign versions exist)
- `opa`: contains two subfolders (see the Verification chapter for more). These have to do with attestation and signature verification strategies.

There are two `.gitlab-ci.yaml` files in the **root** directory. The main one uses staas-cli for signatures and attestations while the other one uses `cosign`. This is done for completeness.

## CI/CD Architecture

![alt text](assets/pipeline.png)

We briefly describe each step:

1. Secret scanning: we use [gitleaks](https://github.com/gitleaks/gitleaks) to scan the repo for secrets uploaded
2. SAST: we do static analysis on the code
    - [SonarQube](https://www.sonarsource.com/products/sonarqube/): a widely known tool for SAST which scans the code and produces reports on security issues and code quality
    - [Semgrep](https://semgrep.dev/): a lightweight, fast static analysis tool
    - [njsscan](https://github.com/ajinabraham/njsscan): a static application testing (SAST) tool that can find insecure code patterns in your node.js applications 
3. SCA: we use [retirejs](https://github.com/RetireJS/retire.js) to scan the nodejs app for vulnerable dependencies
4. Build image: we build the image using [kaniko](https://github.com/GoogleContainerTools/kaniko), produce the provenance, and push it to GitLab's container registry
5. **Container signature**: containers are signed directly after building using STaaS
6. Scan image: we use [Trivy](https://trivy.dev/latest/) to scan the container for vulnerabilities and produce the SBOM
7. **Attestations**: here we take as input the Provenance and the SBOM and pass the to STaaS (or cosign) for signing. There is one job for each case:
    - The first attests the SLSA provenance
    - The second attests the SBOM produced by trivy
8. Deploy: supposing there is a K8s cluster running, [FluxCD](https://fluxcd.io/) monitors the OCI registry for changes and pulls the new image and applies it in the cluster
9. **Policy enforcement**: supposing your preferred policy engine is installed and configured ([Kyverno](https://kyverno.io/) or [OPA Gatekeeper](https://kubernetes.io/blog/2019/08/06/opa-gatekeeper-policy-and-governance-for-kubernetes/)), the container image undergoes some checks and if successful gets applied, otherwise gets rejected
10. DAST: ZAP is used to for dynamic testing post-deployment (it is implemented in this repo's code, but not applied as a post-deployment procedure)

Once the image is uploaded onto the OCI registry (registry.gitlab.com), it is pulled by FluxCD, and applied into the cluster.

![alt text](/assets/cicd-aeros-kyverno.jpg)


## Signatures Attestations and STaaS

Container signatures ensure the integrity and authenticity of our images. A specific trusted identity is bound to the signature. The private key is disposed to mitigate risk (this is Sigstore's "keyless" signing mechanism). All signing events are registered on a public auditable log called [Rekor](https://rekor.sigstore.dev/). Upon **verification** we can see how and when signed the image, and verify its validity.

With artifact attestations we can ensure the integrity of our artifacts by creating the so called *attestation*. This is a **signed** document which includes attributes for the subject(s) being signed. This is very good practice especially in CI/CD pipeline where signing **and verification** can be done automatically. 

When verifying, we can also set some expectations. For example, is the container image version stored in the attestation the one I built?, or is the repository url stored in the attestation the real one - or a typosquatted one? In more complicated scenarios, we can have a policy engine (like Kyverno or OPA Gatekeeper) which contains our own policy, we feed in the attestation, and based on the policy it outputs true/false, or trust/no trust.

GitLab [supports](https://about.gitlab.com/blog/2022/08/10/securing-the-software-supply-chain-through-automated-attestation/) artifact **provenance** by setting the variable `RUNNER_GENERATE_ARTIFACTS_METADATA: "true"` in the pipeline (or in a specific job). By setting this variable, all declared artifacts in a job will have their provenance generated. See [here](https://docs.gitlab.com/ci/yaml/signing_examples/#inspecting-the-provenance-metadata) for a sample GitLab provenance.

The scope of the project is to generate the provenance and SBOM attestation of a container image, plus sign the container image. 

- For the provenance this means, how the image was built, what was its build system (i.e., the GitLab runner), what was the commit id, what was the job id, what were the values for some etc. 
- For the SBOM this means, what are the dependencies of the codebase/container image
- For the signature this means, who and when signed the image (ensures integrity and authenticity) 

In order to create the attestation for this provenance we use STaaS, a Software Transparency service. Using the `staas-cli` tool we send one *digest* of the artifacts we want to sign to STaaS, and it returns a Sigstore bundle (Rekor response + signature + short-lived certificate).

![alt text](assets/diagram.jpg)

## Attack Scenarios

In this repo we present some attack scenarios. See `attacks` folder for more.

## Verification

In order to verify signatures and attestations, either Kyverno or OPA Gatekeeper can be used. Since we deal with container images we are most intrested in verifying these within the context of a Kubernetes cluster. Kyverno is the predominant policy engine for Kubernetes. OPA Gatekeeper is also a good option, but does not offer the same range of capabilities as Kyverno (even though it is powerful). 

Under the folder `kyverno` we explain how to use kyverno and provide some policies. This scenario is of most interest, because during Continuous Deployment we can verify our requirements on the fly and, exactly pre-deployment, reject malicious/non-compliant images.

Under the folder `opa` we have two distinct cases of verification.
1. One under `standalone` folder
2. One under `gatekeeper` folder

The first one is about using a standalone instance of OPA to verify attestations, and some Rego policies accompanying it. This may - or may not - be suitable for CD cases (in reality, it is not the best option).

The second one is about using OPA Gatekeeper as a K8s component for continuous deployment cases, where conitnuous verification is also required.

We implement Kyverno since it offers a robust and tested support for Sigstore and custom Sigstore setups (like STaaS). 

## Self Hosting

You can always run these pipelines using your own self-hosted GitLab runner. Try the following command to register a runner locally:
```sh
sudo gitlab-runner register \
    --non-interactive \
    --url https://gitlab.com/ \
    --token token \
    --run-untagged="true" \ 
    --executor "docker+machine" \
    --docker-image python:3.9
sudo gitlab-runner run
```

Match the settings to your preferences and security requirements.

## Work on GitHub

GitHub Actions is the CI/CD environment of GitHub. In [this repo](https://github.com/excid-io/seccon-dev) we uploaded the exact same source code as this repository but added the `.github/workflows` folder that contains one workflow. 

This workflows emulates the same pipeline as in GitLab:
- security checks
- build a conatiner image 
- container image signatures
- container image attestations

The difference is in how `staas-cli` is used as a binary (see Releases in [staas-cli repo](https://github.com/excid-io/staas-cli/releases)) instead of a container image that fits better in GitLab CI platform.

## Related Posts

1. [GitLab Artifact Attestations with STaaS](https://medium.com/@excid/gitlab-artifact-attestations-with-staas-809b4fb5a9fc)
1. [Container Signatures and Attestations with STaaS and Kyverno](https://medium.com/@excid/container-signatures-and-attestations-with-staas-and-kyverno-9336ab8800de)
