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
1. OPA Gatekeeper
2. Cosign gatekeeper provider
3. FluxCD
4. We write .yaml configurations for valid and invalid container images.

#### Minikube
[Minikube](https://minikube.sigs.k8s.io/docs/start/?arch=%2Fwindows%2Fx86-64%2Fstable%2F.exe+download) is a very simple solution to create demo/testing cluster easily and quickly. We use the default `--driver=docker` parameter but you can change this according to your needs. The example should work anyway with any cluster setup tool (microk8s, kind, kubeadmn etc.)

```sh
# 1. Install minikube
curl -LO https://github.com/kubernetes/minikube/releases/latest/download/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube && rm minikube-linux-amd64
minikube start
```

For ease you can add an `alias kubectl='minikube kubectl --'` to run `kubectl` directly in the terminal. Or, for better overall compatibility, make link like this `ln -s $(which minikube) /usr/local/bin/kubectl`. The latter is the preferred way.

#### Helm
[Helm](https://helm.sh/) is a Kubernetes package manager. We use it to install OPA Gatekeeper, specifically version 3.10 because this version is compatible with the cosign gatekeeper provider.

```sh
### 2. Install helm
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh

### 2. Install helmfile
curl -O https://github.com/helmfile/helmfile/releases/download/v1.0.0-rc.12/helmfile_1.0.0-rc.12_linux_arm64.tar.gz
tar -xvf helmfile_1.0.0-rc.12_linux_arm64.tar.gz
sudo mv helmfile /usr/bin/helmfile  #this is optional
```

#### Ratify & OPA Gatekeeper
[OPA Gatekeeper](https://github.com/open-policy-agent/gatekeeper) is the Kubernetes version of OPA. It replaces the default admission controller, and replaces it with a custom one which knows how to run Rego policies. It provides CRDs to write our own constraints for .yaml files applied in the cluster, that enforce policies on them. Ratify connects with OPA Gatekeeper as an external provider, and runs some checks on the constraints set by Gatekeeper.

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