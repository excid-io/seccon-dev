## Continious Verification of container signatures and attestations w/Ratify

Prerequisites: docker, docker-compose (or docker compose)

In this README file we see how to verify container signatures and attestations in a Kubernetes-native way. We suppose that the CI happens somewhere, and a service like ArgoCD or FluxCD do the Continious Deployment part for us. We need an automated way to perform verification over our produced signatures, namely:
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

#### FluxCD
[FluxCD](https://fluxcd.io/) is a Continious Deployment tool. When we make changes to OCI container images or their corresponding .yaml files in a git repo, these changes are automatically detected by Flux. It pulls the new changes and applies them to the cluster. The git repo is the source of truth. Whatever configuration exists in the git repo, is applied in the cluster.

```sh
### 3. Install FluxCD in cluster
export GITLAB_TOKEN=<gl-token>
# Then install flux cli
curl -s https://fluxcd.io/install.sh | sudo bash
# The following command bootstraps FluxCD in a cluster which is controlled by a personal project in GitLab, not a group project (see flux documentation for more on that)
flux bootstrap gitlab \  
  --deploy-token-auth \
  --owner=my-gitlab-username \
  --repository=my-project \
  --branch=main \
  --path=cluster/my-cluster \
  --personal
```

The k8s files exist under the `apps` folder. In there, there are the .yaml and kustomization file. We create a base kustomization which just applies a Deployment with one replica for the image we build in our `.gitlab-ci.yaml` pipeline. 
Then, there are two extra kustomizations under the `environments` folder:
- the `development` kustomization which only patches the kustomization to use 2 replicas
- the `production` kustomization which similarly applies 6 replicas

In a more complex use case, we could have many deployments under many namespaces. In the `base` folder, we only consider the `default` namespace, where our Deploymet will exist.
 

#### Ratify & OPA Gatekeeper
[OPA Gatekeeper](https://github.com/open-policy-agent/gatekeeper) is the Kubernetes version of OPA. It replaces the default admission controller, with a custom one which knows how to run Rego policies. It provides CRDs to write our own constraints for .yaml files applied in the cluster, that enforce policies on them. Ratify connects with OPA Gatekeeper as an external provider, and runs some checks on the constraints set by Gatekeeper. In reality, ratify itself runs as a Pod in the gatekeeper-system namespace.

```sh
### 3. Install OPA Gatekeeper in cluster
helmfile sync -f git::https://github.com/ratify-project/ratify.git@helmfile.yaml
```

### Test time

Create some test cases for deploying. Try one container which is not signed, and a signed one. 

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