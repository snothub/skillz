# Claude .NET Template

A Claude-integrated template for building modern .NET 10 backends with built-in AI agents, skills, and architecture guidelines baked in.

## Kubernetes Deployment

The project includes a Helm chart and ArgoCD Application manifest for production deployment.

### Architecture

```
Client → Traefik IngressRoute → ForwardAuth Middleware → auth-verifier (OpenResty)
                                       ↓ (200 OK)
                                  MCP Service → MCP Pods
```

Authentication is handled entirely at the infrastructure layer by Traefik. The MCP server contains zero auth code and only receives pre-authenticated traffic.

### Helm Chart

The chart is located at `helm/mcpcoder/` and deploys:

- **MCP server** — the application pods with health probes and HPA autoscaling
- **Auth verifier** — an OpenResty sidecar that validates Bearer tokens against a Kubernetes Secret
- **Traefik IngressRoute** — routes external traffic through ForwardAuth before reaching the MCP service

#### Install

```bash
helm install mcpcoder helm/mcpcoder -f helm/mcpcoder/values.yaml
```

#### Override with production values

```bash
helm install mcpcoder helm/mcpcoder \
  -f helm/mcpcoder/values.yaml \
  -f helm/mcpcoder/values-prod.yaml
```

`values-prod.yaml` contains the pinned `image.tag` and is automatically updated by the release workflow.

#### Key configuration (`values.yaml`)

| Value | Default | Description |
|---|---|---|
| `image.repository` | `ghcr.io/snothub/skillz` | Container image |
| `image.tag` | `latest` | Image tag (overridden by `values-prod.yaml`) |
| `replicaCount` | `2` | Initial replica count |
| `hpa.minReplicas` / `hpa.maxReplicas` | `2` / `10` | Autoscaling bounds |
| `hpa.targetCPUUtilizationPercentage` | `70` | Scale-up CPU threshold |
| `ingress.host` | `mcpcoder.forteapps.net` | Traefik route hostname |
| `auth.tokens` | placeholder list | Valid bearer tokens |

### ArgoCD Deployment

The ArgoCD Application manifest is at `argocd/mcpcoder.yaml`. It points to the Helm chart in this repo and uses both `values.yaml` and `values-prod.yaml`.

```bash
kubectl apply -f argocd/mcpcoder.yaml
```

ArgoCD is configured with automated sync, self-heal, and pruning. When the release workflow pushes an updated `values-prod.yaml` to main, ArgoCD detects the change and rolls out the new image version automatically.

#### Release flow

1. Push a semver tag (e.g. `git tag v1.2.3 && git push origin v1.2.3`)
2. GitHub Actions builds and pushes the Docker image to GHCR
3. The workflow updates `image.tag` in `helm/mcpcoder/values-prod.yaml` and commits to main
4. ArgoCD syncs the new tag and rolls out the updated pods

### Authentication

All requests to the MCP server must include a valid `Authorization: Bearer <token>` header. Tokens are stored in a Kubernetes Secret and validated by the auth-verifier pod before traffic reaches the application.

#### How it works

1. Traefik receives the request and forwards it to the ForwardAuth middleware
2. The auth-verifier (OpenResty + Lua) extracts the Bearer token from the `Authorization` header
3. The token is checked against a list loaded from the mounted Kubernetes Secret
4. If valid, the request is proxied to the MCP service. If invalid or missing, a `401` is returned

#### Adding tokens

Add tokens to the `auth.tokens` list in `values.yaml` (or a separate secret-values file):

```yaml
auth:
  tokens:
    - my-secure-token-abc123
    - another-token-def456
```

Then upgrade the release:

```bash
helm upgrade mcpcoder helm/mcpcoder -f helm/mcpcoder/values.yaml
```

The auth-verifier pods will restart and pick up the new token list.

#### Distributing tokens to clients

Tokens are opaque strings. Generate them with any secure random method:

```bash
openssl rand -hex 32
```

Distribute tokens to clients through a secure channel (e.g. a secrets manager, encrypted message, or team vault). Each client should receive a unique token so that individual access can be revoked by removing a single entry from the list.

#### Revoking access

Remove the token from `auth.tokens` and run `helm upgrade`. The token is immediately invalidated on the next pod rollout.

#### Testing connectivity

```bash
# Should return 401
curl -s -o /dev/null -w "%{http_code}" https://mcpcoder.forteapps.net/health

# Should return 200
curl -H "Authorization: Bearer <token>" https://mcpcoder.forteapps.net/health
```
