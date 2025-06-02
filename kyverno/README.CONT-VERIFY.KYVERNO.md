## Continuous Verification of container signatures and attestations w/Kyverno

Prerequisites: docker, docker-compose (or docker compose)

In this README file we see how to verify container signatures and attestations in a Kubernetes-native way. We suppose that the CI happens within a GitLab runner, and a service like ArgoCD or FluxCD does the continuous Deployment part for us. FluxCD is used in our case. We need an automated way to perform verification over our produced signatures, namely:
1. container signature
2. sbom attestation
3. provenance attestation

![alt text](/assets/cicd-aeros-kyverno.jpg)

For the last two, we need to run an extra policy which checks some of the attestation's fields against our expectations (found in the .yaml policies). What the Continuous Deployment tool (FluxCD) does, is bring in containers into the cluster. It is the responsibility of the policy engine to enforce a policy on the image pulled by FluxCD.

Kyverno, the policy engine discussed in this README file, is the predominant policy engine for Kubernetes. It is quick to make decisions, and policy authoring is as simple as it gets. We create one policy under `policies` folder that runs all three aforementioned checks (container signature + provenance attestation + sbom attestation).

We create a very simple demo. We have a `minikube` cluster in which we add:
1. Kyverno
2. FluxCD
3. We write .yaml configurations for policies, as well as valid and invalid .yaml Deployments for container images.

#### Minikube
[Minikube](https://minikube.sigs.k8s.io/docs/) is a very simple solution to create demo/testing clusters easily and quickly. We use the default `--driver=docker` parameter but you can change this according to your needs. The example should work anyway with any cluster setup tool (microk8s, kind, kubeadmn etc.)

```sh
# Install minikube
curl -LO https://github.com/kubernetes/minikube/releases/latest/download/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube && rm minikube-linux-amd64
minikube start
```

For ease you can add an `alias kubectl='minikube kubectl --'` to run `kubectl` directly in the terminal.

#### Helm
[Helm](https://helm.sh/) is a Kubernetes package manager. We use it to install Kyverno.

```sh
# Install helm
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh
```

#### Kyverno
[Kyverno](https://kyverno.io/docs/introduction/) is a cloud native policy engine. It was originally built for Kubernetes and now can also be used outside of Kubernetes clusters as a unified policy language. To install run:

```sh
# Install Kyverno
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update
helm install kyverno kyverno/kyverno -n kyverno --create-namespace  #check kyverno's website for HA installation
```

Afterwards, we need to write a policy for each verification we want to run. We want to verify:
1. container signature
2. sbom attestation
3. slsa provenance attestation

For this reason, we write a .yaml file found under `kyverno/policies` that includes one policy for each of the aforementioned bullet points.

According to the documentation, we can have a policies that verify the image signature and attestations. This is done using the `verifyImages` option in the .yaml file. More specifically, one rule is for verifying the image signature alone (rule *verify-image-signature-keyless*). There we define under the `attestors` field that the verification should be done in a keyless way. 

The next rule, verifies the SBOM. Under the `attestations` field we declare some `conditions`, **PLUS** the way we want to verify the attestation, that is, in a keyless way. Since attestations are signed in-toto statements, we want to:
1. verify the signature
2. verify some expectations found in the payload

**Note**: Kyverno uses **JMESPath** as a JSON parser. All conditions are written using this parser's syntax.

Last rule verifies the SLSA provenance attestation. Similarly to the SBOM attestation, we define how the attestation signature should be verified, plus some conditions.

**If and only if** all policies evaluate to **true** - i.e., there are no false conditions or signatures that could not be verified - will a container image Deployment (or whatever else match is specified in the policy) be accepted in the cluster. 


#### FluxCD
[FluxCD](https://fluxcd.io/) is a continuous Deployment tool. When we make changes to OCI container images or their corresponding .yaml files in a git repo, these changes are automatically detected by Flux. It pulls the new changes and applies them to the cluster. The git repo is the source of truth. Whatever configuration exists in the git repo, is applied in the cluster.

```sh
# Install FluxCD
export GITLAB_TOKEN=<gl-token>
# Then install flux cli
curl -s https://fluxcd.io/install.sh | sudo bash
# The following command bootstraps FluxCD in a cluster which is controlled by a personal project in GitLab, not a group project (see flux documentation for more on that)
flux bootstrap gitlab \
  --token-auth  \
  --owner=lefosg  \
  --repository=excid-cicd-demo-project  \
  --branch=main \
  --path=clusters/my-cluster  \
  --personal \
  --components-extra=image-reflector-controller,image-automation-controller
```

The k8s and kustomization files exist under the `apps` folder. We create a base kustomization which is just a Deployment with one replica for the image we build in our `.gitlab-ci.yaml` pipeline. 
Then, there are two extra kustomizations under the `environments` folder:
- the `development` kustomization which only patches the kustomization to use 2 replicas
- the `production` kustomization which similarly applies 6 replicas

In a more complex use case, we could have many deployments under many k8s namespaces. In the `apps/base` folder, we only consider the `default` namespace, where our Deploymet will exist.
 
We configure FluxCD to:
1. apply the development kustomization in the cluster. See file *clusters/my-cluster/apps.yaml*
2. configure the way FluxCD monitors and pulls the images in the development kustomzation .yaml file. We have three files under *clusters/my-cluster* for this:
  - image-repo.yaml
  - image-policy.yaml
  - image-update.yaml

Whenever a new tag is uploaded on the GitLab container registry, FluxCD detects the new tag and applies it to the cluster (policy can vary according to organization needs). We manually build images with new tags through the `.gitlab-ci.yaml` pipeline and sign them.


### Test time

In the `.gitlab-ci.yaml` file we create a signature and two attestations in the steps:
- cosign-sign-container-image
- cosign-attest-sbom
- cosign-attest-provenance

We will take things one by one, starting from the container image signature. The image is signed using `cosign sign`. A signature is uploaded on the OCI registry (the layer ending in *.sig*). This is also verified within the CI just to ensure it was done correctly. Using the keyless attestor of Kyverno, we declare that we want to perform keyless verification on the image referenced.
```yaml
- keyless:
    subject: "https://gitlab.com/lefosg/excid-cicd-demo-project//.gitlab-ci.yml@refs/heads/main"
    issuer: "https://gitlab.com"
  rekor:
  url: https://rekor.sigstore.dev
```

Then for the SBOM attestation, we declare under the `attestations.conditions` field, what conditions must be met in order to accept this SBOM. Here, our application (which is the `server.js` file in the root directory of the project) uses the express-js library. We want to make sure that the version being used is greater or equal than 4.0.0, say, because older versions have known vulnerabilities and exploits.
```yaml
conditions:
- all:
  - key: "{{ bomFormat }}"
    operator: Equals
    value: "CycloneDX"
  - key: "{{ components[?name == 'express'].version | [0] }}"
    operator: GreaterThanOrEquals
    value: "4.0.0" 
```

Similarly for the SLSA provenance, we want to make sure that the image being deployed is exactly the one that was built by the GitLab runner.
```yaml
conditions:
- all:
  - key: "{{ predicate.buildDefinition.resolvedDependencies[0].uri }}"
    operator: Equals
    value: "https://gitlab.com/lefosg/excid-cicd-demo-project"
```