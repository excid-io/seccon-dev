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
2. Kyverno
3. We write .yaml configurations for policies, valid and invalid container images.

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

#### Kyverno
[Kyverno](https://kyverno.io/docs/introduction/) is a cloud native policy engine. It was originally built for Kubernetes and now can also be used outside of Kubernetes clusters as a unified policy language.

We will use it to write our own custom policies that verify container image signatures and their attestations. To install run:
```sh
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update
helm install kyverno kyverno/kyverno -n kyverno --create-namespace  #check their website for HA installation
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



