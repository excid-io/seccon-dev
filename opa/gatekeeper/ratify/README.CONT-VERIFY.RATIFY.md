## Continious Verification of container signatures and attestations w/Ratify

Prerequisites: docker, docker-compose (or docker compose)

In this README file we see how to verify container signatures and attestations in a Kubernetes-native way. We suppose that the CI happens within a GitLab runner, and a service like ArgoCD or FluxCD do the Continious Deployment part for us. FluxCD is used in our case. We need an automated way to perform verification over our produced signatures, namely:
1. container signature
2. sbom
3. provenance

![alt text](/assets/cicd-aeros.drawio.png)

For the last two, we need to run an extra policy which checks some of the attestation's fields against our expectations (found in the Rego policies). What the CD tool (say FluxCD) does, is bring in containers into the cluster. What OPA sees actually is mostly information about the container image.

OPA Gatekeeper supports `providers` for communicating with [external services](https://open-policy-agent.github.io/gatekeeper/website/docs/externaldata/). In order to automate the signature verification during CD, we use the [ratify](https://ratify.dev/docs/what-is-ratify). Ratify is a verification engine as a binary executable and on Kubernetes which enables verification of artifact security metadata and admits for deployment only those that comply with policies you create.

We create a very simple evaluation. We have a `minikube` cluster in which we add:
1. FluxCD
2. OPA Gatekeeper w/ Ratify
3. We write .yaml configurations for valid and invalid container images.

#### Minikube
[Minikube](https://minikube.sigs.k8s.io/docs/start/?arch=%2Fwindows%2Fx86-64%2Fstable%2F.exe+download) is a very simple solution to create demo/testing cluster easily and quickly. We use the default `--driver=docker` parameter but you can change this according to your needs. The example should work anyway with any cluster setup tool (microk8s, kind, kubeadmn etc.)

```sh
# 1. Install minikube
curl -LO https://github.com/kubernetes/minikube/releases/latest/download/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube && rm minikube-linux-amd64
minikube start
```

For ease you can add an `alias kubectl='minikube kubectl --'` to run `kubectl` directly in the terminal.

#### Helm & Helmfile
[Helm](https://helm.sh/) is a Kubernetes package manager. We use it to install OPA Gatekeeper, specifically version 3.10 because this version is compatible with the cosign gatekeeper provider.

```sh
### 2. Install helm
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh

# to install helmfile please download a release < 1.0.0 from this link: https://github.com/helmfile/helmfile
```

#### Ratify & OPA Gatekeeper
[OPA Gatekeeper](https://github.com/open-policy-agent/gatekeeper) is the Kubernetes version of OPA. It replaces the default admission controller, with a custom one which knows how to run Rego policies. It provides CRDs to write our own constraints for .yaml files applied in the cluster, that enforce policies on them. Ratify connects with OPA Gatekeeper as an external provider, and runs some checks on the constraints set by Gatekeeper. In reality, ratify itself runs as a Pod in the gatekeeper-system namespace.

```sh
### 3. Quick install OPA Gatekeeper and Ratify in cluster, along with some demo policies (all in one - not preferred)
helmfile sync -f git::https://github.com/ratify-project/ratify.git@helmfile.yaml
```

If this doesn't work or you just dont want the all-in-one installation, you can manually install Gatekeeper and Ratify which is actually the preferred way (https://ratify.dev/docs/quickstarts/quickstart-manual):

```sh
# To install Gatekeeper
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm install gatekeeper/gatekeeper  \
  --name-template=gatekeeper \
  --namespace gatekeeper-system --create-namespace \
  --set enableExternalData=true \
  --set validatingWebhookTimeoutSeconds=5 \
  --set mutatingWebhookTimeoutSeconds=2 \
  --set externaldataProviderResponseCacheTTL=10s


# To install Ratify 
helm repo add ratify https://ratify-project.github.io/ratify
# download the notary verification certificate
curl -sSLO https://raw.githubusercontent.com/deislabs/ratify/main/test/testdata/notation.crt
helm install ratify \
  ratify/ratify --atomic \
  --namespace gatekeeper-system \
  --set sbom.enabled=true \
  --set-file notationCerts={./notation.crt} \
  --set featureFlags.RATIFY_CERT_ROTATION=true \
  --set policy.useRego=true
rm notation.crt
```
In order to verify signatures produced by cosign in keyless mode, delete the default cosign verifier crd that comes with Ratify, and apply the `cosign-verifier.yaml` file found in the policies folder. Similarly for SBOM validation, delete the existing SBOM verifier and replace it with our custom one.
```sh
kubectl delete verifier verifier-cosign 
kubectl apply -f opa/gatekeeper/ratify/policies/cosign-verifier.yaml 
kubectl delete verifier verifier-sbom 
kubectl apply -f opa/gatekeeper/ratify/policies/sbom-verifier.yaml 
```

Create some test cases for deploying. Try one container which is not signed, and a signed one. 
First we need to set some policies that implement this logic. There are some in the Ratify Quick Start page:
```sh
kubectl apply -f opa/gatekeeper/ratify/policies/constraint-verify.yaml
kubectl apply -f opa/gatekeeper/ratify/policies/template-verify-sig-ratify.yaml
```

Whenever **FluxCD** reconciles, it will pull the .yaml files or new container image version, apply them to the cluster, and in order for a Deployment or Pod to pass (according to the policies found in this repo), they have to undergo these signatures checks. 

To uninstall Ratify run:
```sh
kubectl delete -f https://ratify-project.github.io/ratify/library/default/template.yaml
kubectl delete -f https://ratify-project.github.io/ratify/library/default/samples/constraint.yaml
helm delete ratify --namespace gatekeeper-system
kubectl delete crd stores.config.ratify.deislabs.io verifiers.config.ratify.deislabs.io certificatestores.config.ratify.deislabs.io policies.config.ratify.deislabs.io
```

To uninstall Gatekeeper run:
```sh
helm delete gatekeeper --namespace gatekeeper-system
# Helm v3 will not cleanup Gatekeeper installed CRDs. Run the following to uninstall Gatekeeper CRDs:
kubectl delete crd -l gatekeeper.sh/system=yes
```

The namespace `gatekeeper-system` will still exist after uninstalling both Ratify and Gatekeeper, so run:
```sh
kubectl delete ns gatekeeper-system
```

#### FluxCD
[FluxCD](https://fluxcd.io/) is a Continious Deployment tool. When we make changes to OCI container images or their corresponding .yaml files in a git repo, these changes are automatically detected by Flux. It pulls the new changes and applies them to the cluster. The git repo is the source of truth. Whatever configuration exists in the git repo, is applied in the cluster.

```sh
### 3. Install FluxCD in cluster
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

The k8s files exist under the `apps` folder. In there, there are the .yaml and kustomization file. We create a base kustomization which just applies a Deployment with one replica for the image we build in our `.gitlab-ci.yaml` pipeline. 
Then, there are two extra kustomizations under the `environments` folder:
- the `development` kustomization which only patches the kustomization to use 2 replicas
- the `production` kustomization which similarly applies 6 replicas

In a more complex use case, we could have many deployments under many namespaces. In the `base` folder, we only consider the `default` namespace, where our Deploymet will exist.
 
What we need to properly configure FluxCD is the above kustomization (or kustomizations) and some .yaml files that tell flux to monitor the OCI registry for new tags. We have three files for this:
- image-repo.yaml
- image-policy.yaml
- image-update.yaml

Whenever a new tag is uploaded on the GitLab container registry, flux detects the new tag and applies it to the cluster (policy can vary according to organization needs). We manually build images with new tags through the `.gitlab-ci.yaml` pipeline and sign them.



### Test time

The documentation of Ratify provides some demo images, a singed and an unsigned one.

```sh
kubectl run demo --image=ghcr.io/deislabs/ratify/notary-image:signed -n default
kubectl get pods demo -n default
```

This should effectively create a container in the cluster.

```sh
kubectl run demo1 --image=ghcr.io/deislabs/ratify/notary-image:unsigned -n default
```
This should throw an error.

Additionally, try running our own images:
```sh
kubectl run demo2 --image=registry.gitlab.com/lefosg/excid-cicd-demo-project:1.0.5 -n default  # pass
kubectl run demo3 --image=registry.gitlab.com/lefosg/excid-cicd-demo-project:unsigned -n default  # fail
```

Then, you can try applying Deployment files, like the ones found in `apps/base/default`.
```sh
kubectl apply -f apps/base/default/image.yaml  # pass
kubectl apply -f apps/base/default/unsigned-image.yaml  # fail
```

## Manual verification with Ratify CLI

You can use Ratify CLI to verify the images too, for testing purposes, and emulate the Pod behavior locally. There are two json files in this directory:
- ratify-cosign-keyless.json
- ratify-cosign-keypair.json

We run the command as `ratify verify -c conf.json -s image-uri`. For example:
```sh
ratify verify -c ratify-cosign-keyless.json -s registry.gitlab.com/lefosg/excid-cicd-demo-project:1.0.5
```

In the scenario where you want to verify using your public key, go to the `ratify-cosign-keypair.json` and change the line which contains the path of the key (and delete the comment too).