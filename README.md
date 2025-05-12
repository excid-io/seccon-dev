# Secure CI/CD using artifact attestations and container signatures w/ STaaS 

## Description

A demo pipeline for demonstrating DevPrivSecOps methodology with GitLab CI. Our focus on this repo is mainly on container signatures and artifact attestations and how we use them with STaaS within a pipeline, but a more complete pipeline is built to demonstrate how these attestations could fit within any pipeline.

We use a demo application which is a very simple web written in NodeJS with express-js (prints hello world in the browser). It is packed into a container and deployed on a machine which runs Docker. 

Regarding Continious Integration (CI), this pipeline automates security checks in the software development lifecycle, integrating multiple stages of security testing. It includes Secret Scanning, SAST (Static Application Security Testing), SCA (Software Composition Analysis), image building-singing -and scanning, and artifact attestations. Core tools like Gitleaks, Semgrep, Trivy, and SonarQube are used to detect vulnerabilities, misconfigurations, and secrets within the code and container images.

Continious Deployment (CD) is done using FluxCD. We suppose there is a cluster setup somewhere, and we configure FluxCD to pull the container images from the repository and apply them into the cluster. Flux does not only monitor changes in the OCI registry, but also in k8s infrastructure files (.yaml).

Continuous Deployment is not only about running the containers, but for our case, verification as well. When applying new images in the cluster, we want to verify their signatures, and their artifact attestations. If a malicious image/artifact tries to enter the cluster, during verification tampering should be detected, and thus, reject the changes.

This pipeline promotes a secure CI/CD process by detecting and mitigating security issues as early as possible.

**Note**: if you want to get the full benefits out of this repo you have to:
1. follow along with the CI steps:
    - setup a secure CI pipeline (decide on some platform which suits your needs and lay out the steps/jobs)
    - build and **sign** your container images
    - **use attestations** for specific artifacts (like images) which will be later on verified 
    - store signatures and attestations
    - we do not go over on setting up any CI environment, since we use GitLab hosted runners
2. setup a CD procedure:
    - decide on your gitops strategy (here we do monorepo)
    - setup a k8s cluster (in our example we setup a cluster with `minikube`)
    - install `fluxcd` in the cluster (installation steps for that will be shown)
    - we provide installation steps on setting up a minikube along with fluxcd and any other verification components (under `opa/gatekeeper` folder)

Artifact attestations and signatures ensure the integrity of specific artifacts. We create [Provenance and SBOM](https://slsa.dev) statements and use [STaaS](http://staas.excid.io) to sign them. The provenance is produced for the container, and then the SBOM. At the `attestations` step of the pipeline, these are signed by sending the digest of the two files mentioned to STaaS (we have a specific python script for that).

At the same time, we sign containers again using STaaS, to ensure their integrity and authenticity.

![alt text](assets/pipeline.png)

## Folder structure

- `apps`: contains all .yaml files and `kustomization` files for our k8s cluster.
- `assets`: images and other files useful for the repo.
- `attacks`: a folder which contains another `.gitlab-ci.yaml` file. This file is prone to vulnerabilities. This is our way to demonstrate how artifact attestations and container signatures protect from specific attacks.
- `clusters`: the folder that fluxcd monitors. The core file in there is `apps.yaml`. We modify this file to tell flux which kustomization to apply into the cluster.
- `opa`: contains two subfolders (explained later on). These have to do with attestation and signature verification strategies.

## Steps

We briefly describe each step:

1. Secret scanning: we use gitleaks to scan the repo for secrets uploaded
2. SAST: we do static analysis on the code
    - SonarQube: a widely known tool for SAST which scans the code and produces reports on security issues and code quality
    - Semgrep: a lightweight, fast static analysis tool
    - njsscan: a static application testing (SAST) tool that can find insecure code patterns in your node.js applications 
3. SCA: we use retirejs to scan the nodejs app for vulnerable dependencies
4. Docker build: we build the image using docker, produce the provenance, and push it to GitLab's container registry
4. Container signature: containers are signed directly after building using STaaS
5. Scan image: we use Trivy to scan the container for vulnerabilities and produce the SBOM
6. Attestations: here we take as input the Provenance and the SBOM and pass the to STaaS for signing. There is a python script in the repo which takes as input the file to attest, and right after it **verify** the attestation
    - One job is to attest the Provenance
    - The second job is to attest the SBOM
<!-- 7. Deploy: we deploy the container built to a machine using ssh and a simple docker run command
8. DAST: ZAP is used to for dynamic testing post-deployment -->

Once the image is uploaded onto the OCI registry (registry.gitlab.com), it is pulled by FluxCD, and applied into the cluster.

![alt text](/assets/cicd-aeros.drawio.png)


## Attestations and STaaS

With artifact attestations we can ensure the integrity of our artifacts by creating the so called *attestation*. This is a **signed** document (signed using [Sigstore](https://www.sigstore.dev/)) which includes attributes for the subject(s) being signed. This is very good practice especially in CI/CD pipeline where signing **and verification** can be done automatically. 

When verifying, we can also set some expectations. For example, is the version stored in the attestation the one I built?, or is the repository url stored in the attestation the real one? In more complicated scenarios, we can have a policy engine (like OPA) which contains our own policy, we feed in the attestation, and based on the policy it outputs true/false, or trust/no trust.

GitLab [supports](https://about.gitlab.com/blog/2022/08/10/securing-the-software-supply-chain-through-automated-attestation/) artifact **provenance** by setting the variable `RUNNER_GENERATE_ARTIFACTS_METADATA: "true"` in the pipeline (or in a specific job). By setting this variable, all declared artifacts in a job will have their provenance generated. See [here](https://docs.gitlab.com/ci/yaml/signing_examples/#inspecting-the-provenance-metadata) for a sample GitLab provenance.

The purpose here is to generate the provenance and SBOM attestation of a container image. 

- For the provenance: this means, how the image was built, what was its build system (i.e., the GitLab runner), what was the commit id, what was the job id, what were the values for some etc. 
- For the SBOM: this means that the SBOM is tied to the corresponding container image

In order to create the attestation for this provenance we use STaaS, a Software Transparency service. Using the script `staas-upload.py` we send one digest for the provenance file and one for the SBOM to STaaS, and for each one of them it signs the digest digest.

![alt text](assets/diagram.png)


<!-- ## Project Components

Here we outline what components we used for running this PoC.

1. **GitLab**
    - We use GitLab to upload our code and version control it online.
2. **GitLab CI**
    - We use GitLab CI to run our DevPrivSecOps pipelines. We use the GitLab hosted runners (we do not install our own) to execute the pipeline.
3. **STaaS**
    - We use STaaS to sign our documents. -->

## Attack scenarios

In this repo we present some attack scenarios. See `README.ATTACKS.md` for more.

## Verification

We have two distinct cases of verification in this repo explained under `opa` folder.
1. One under `standalone` folder
2. One under `gatekeeper` folder

The first one is about using a standalone instance of OPA to verify attestations, and some Rego policies accompanying it. This may - or may not - be suitable for CD cases.

The second one - and of most interest - is about using OPA Gatekeeper as a K8s component for continious deployment cases, where conitnious verification is also required.