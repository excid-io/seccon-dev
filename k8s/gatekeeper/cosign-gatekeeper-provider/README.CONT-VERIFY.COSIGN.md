## Continious Verification of container signatures and attestations w/Cosign

Prerequisites: docker, docker-compose (or docker compose)

In this README file we see how to verify container signatures and attestations in a Kubernetes-native way. We suppose that the CI happens somewhere, and a service like ArgoCD or FluxCD do the Continious Deployment part for us. We need an automated way to perform verification over our produced signatures, namely:
1. container signature
2. sbom
3. provenance

![alt text](/assets/cicd-aeros.drawio.png)

For the last two, we need to run an extra policy which checks some of the attestation's fields against our expectations (found in the Rego policies). What the CD tool (say FluxCD) does, is bring in containers into the cluster. What OPA sees actually is mostly information about the container image.

OPA Gatekeeper supports `providers` for communicating with [external services](https://open-policy-agent.github.io/gatekeeper/website/docs/externaldata/). In order to automate the signature verification during CD, we use the [cosign gatekeeper provider](https://github.com/sigstore/cosign-gatekeeper-provider). This essentially installs a namespace with a pod in our cluster which knows how to check if a given container image is signed.

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

For ease you can add an `alias kubectl='minikube kubectl --'` to run `kubectl` directly in the terminal.

#### Helm
[Helm](https://helm.sh/) is a Kubernetes package manager. We use it to install OPA Gatekeeper, specifically version 3.10 because this version is compatible with the cosign gatekeeper provider.

```sh
### 2. Install helm
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh
```

#### OPA Gatekeeper
[OPA Gatekeeper](https://github.com/open-policy-agent/gatekeeper) is the Kubernetes version of OPA. It replaces the default admission controller, and replaces it with a custom one which knows how to run Rego policies. It provides CRDs to write our own constraints for .yaml files applied in the cluster, that enforce policies on them.

```sh
### 3. Install OPA Gatekeeper in cluster
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm install gatekeeper/gatekeeper  \
    --name-template=gatekeeper \
    --namespace gatekeeper-system --create-namespace \
    --set enableExternalData=true \
    --set controllerManager.dnsPolicy=ClusterFirst,audit.dnsPolicy=ClusterFirst \
    --version 3.10.0
```

#### Cosign Gatekeeper Provider
For multiple reasons - and as stated above - OPA Gatekeeper cannot directly use the `http.send` function to acquire data that lives outside the cluster. This is why there this `external data` feature. Cosign gatekeeper provider is such a plugin. OPA Gatekeeper relays the signature verification to some pods installed on the cluster which exist specifically for this purpose.

```sh
### 4. Clone the cosign-gatekeeper-provider and apply the manifest files
git clone https://github.com/sigstore/cosign-gatekeeper-provider
cd cosign-gatekeeper-provider
kubectl apply -f manifest
kubectl apply -f manifest/provider.yaml
```

### Test time

Create some test cases for deploying. Try one container which is not signed, and a signed one. 

The cosign gatekeeper repo features some .yaml files which are a template+constraint for `Deployments` in the cluster. For ease, you modify them by changing the container field to point to your OCI registry.


