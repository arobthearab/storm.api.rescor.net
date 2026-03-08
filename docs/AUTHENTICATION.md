# STORM API — Authentication Guide

> Practical guide for obtaining and using JWT tokens with the STORM API.
> For architecture and gateway integration details, see [SECURITY.md](SECURITY.md).

---

## Phase Behavior

The STORM API uses `PhaseManager` to determine the deployment phase.
Authentication behavior changes based on the active phase:

| Phase | Auth Behavior | How to Set |
|-------|---------------|------------|
| `development` (default) | **Bypassed** — a synthetic admin user is injected automatically | No `PHASE` env var, or `PHASE=development` |
| `uat` | Enforced — valid JWT required | `PHASE=uat` |
| `production` | Enforced — valid JWT required | `PHASE=production` |

In **development** phase, every request is automatically authenticated as:

```json
{
  "sub": "dev-user-0000",
  "preferred_username": "developer",
  "email": "dev@rescor.local",
  "roles": ["admin"],
  "iss": "storm-dev",
  "aud": "storm-api"
}
```

No `Authorization` header is needed. This allows local development and manual
testing without running Keycloak.

> **Note:** `PhaseManager` resolves the phase in order: explicit option →
> configuration store → `PHASE` environment variable → `NODE_ENV` →
> default (`development`).

---

## Identity Provider (Keycloak)

The STORM API validates JWTs against a Keycloak realm via JWKS.
IDP configuration is loaded from Infisical at startup:

| Infisical Key | Description | Dev Value |
|---------------|-------------|-----------|
| `IDP_BASE_URL` | Keycloak base URL | `http://localhost:8080` |
| `IDP_REALM` | Keycloak realm name | `rescor` |
| `IDP_CLIENT_ID` | OIDC client ID (used as `audience`) | `storm-api` |

---

## Obtaining a Token

### 1. Resource Owner Password Grant

Direct username/password exchange. Suitable for **development and testing only**
— not recommended for production user-facing flows.

```bash
curl -s -X POST \
  http://localhost:8080/realms/rescor/protocol/openid-connect/token \
  -d "grant_type=password" \
  -d "client_id=storm-api" \
  -d "client_secret=storm-api-secret" \
  -d "username=stormdev" \
  -d "password=stormdev123"
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "expires_in": 300,
  "refresh_expires_in": 1800,
  "refresh_token": "eyJhbGciOiJIUzUxMiIs...",
  "token_type": "Bearer",
  "scope": "openid profile email"
}
```

Extract the token for use:

```bash
TOKEN=$(curl -s -X POST \
  http://localhost:8080/realms/rescor/protocol/openid-connect/token \
  -d "grant_type=password" \
  -d "client_id=storm-api" \
  -d "client_secret=storm-api-secret" \
  -d "username=stormdev" \
  -d "password=stormdev123" \
  | jq -r '.access_token')
```

### 2. Authorization Code Flow (+ PKCE)

Standard OIDC flow for **browser-based applications**. This is the recommended
production pattern for interactive users.

**Step 1 — Redirect to Keycloak login:**

```
GET http://localhost:8080/realms/rescor/protocol/openid-connect/auth
  ?client_id=storm-api
  &response_type=code
  &redirect_uri=http://localhost:5174/callback
  &scope=openid profile email
  &code_challenge=<S256_CHALLENGE>
  &code_challenge_method=S256
```

The user authenticates via the Keycloak login page.

**Step 2 — Exchange authorization code for tokens:**

```bash
curl -s -X POST \
  http://localhost:8080/realms/rescor/protocol/openid-connect/token \
  -d "grant_type=authorization_code" \
  -d "client_id=storm-api" \
  -d "client_secret=storm-api-secret" \
  -d "code=<AUTH_CODE>" \
  -d "redirect_uri=http://localhost:5174/callback" \
  -d "code_verifier=<ORIGINAL_VERIFIER>"
```

> **Note:** The `redirect_uri` must be registered in the Keycloak client
> configuration. Update it via the Keycloak Admin Console or Admin API.

### 3. Client Credentials Grant

For **service-to-service** communication where no human user is involved.
The resulting JWT represents the service account, not a person.

```bash
curl -s -X POST \
  http://localhost:8080/realms/rescor/protocol/openid-connect/token \
  -d "grant_type=client_credentials" \
  -d "client_id=storm-api" \
  -d "client_secret=storm-api-secret"
```

Roles must be assigned to the service account separately via the Keycloak Admin
Console (Service Account Roles tab on the client). Without STORM roles
(`assessor`, `reviewer`, etc.), the token will authenticate successfully but
receive **403 Forbidden** from the RBAC middleware.

The dev Keycloak instance has `admin` and `assessor` pre-assigned to the
`service-account-storm-api` user.

---

## Using the Token

Pass the `access_token` value as a Bearer token in the `Authorization` header:

```bash
curl -X POST http://localhost:3200/v1/rsk/vm/aggregate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"measurements": [20, 5, 5, 5], "alpha": 4}'
```

### Error Responses

| HTTP Status | Meaning | Common Cause |
|-------------|---------|--------------|
| 401 | Unauthorized | Missing header, expired token, invalid signature, issuer/audience mismatch |
| 403 | Forbidden | Token is valid but the user lacks the required role |

**401 example:**

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Invalid token" } }
```

**403 example:**

```json
{ "error": { "code": "FORBIDDEN", "message": "Insufficient permissions" } }
```

---

## Refreshing an Expired Token

Access tokens expire (default: 5 minutes). Use the `refresh_token` from the
original token response to obtain a new access token without re-authenticating:

```bash
curl -s -X POST \
  http://localhost:8080/realms/rescor/protocol/openid-connect/token \
  -d "grant_type=refresh_token" \
  -d "client_id=storm-api" \
  -d "client_secret=storm-api-secret" \
  -d "refresh_token=<REFRESH_TOKEN>"
```

Refresh tokens have a longer lifetime (default: 30 minutes) and can be used
once. Each refresh response includes a new refresh token.

---

## RBAC Roles

Roles are extracted from the JWT `realm_access.roles` claim and normalised
to a flat array. The `authorize()` middleware checks that the user holds
**at least one** of the required roles. `admin` implicitly grants access
to all endpoints.

| Role | Description |
|------|-------------|
| `admin` | Full access to all endpoints |
| `assessor` | All computation and measurement endpoints |
| `reviewer` | Read-only computation (RSK/VM, IAP, NIST) |
| `auditor` | Audit trail and configuration endpoints |

### Endpoint Role Requirements

| Endpoint | Required Role(s) |
|----------|-------------------|
| `GET /health` | Public (no auth) |
| `POST /v1/measurements/**` | `assessor` |
| `POST /v1/rsk/vm/*` | `assessor` or `reviewer` |
| `POST /v1/rsk/rm/*` | `assessor` |
| `POST /v1/iap/*` | `assessor` or `reviewer` |
| `POST /v1/nist/*` | `assessor` or `reviewer` |

---

## OIDC Discovery

The Keycloak OIDC discovery endpoint provides all standard metadata
(token endpoint, JWKS URI, supported grant types, etc.):

```
GET http://localhost:8080/realms/rescor/.well-known/openid-configuration
```

The STORM API uses this internally to locate the JWKS endpoint for
signature verification.

---

## Development Setup — Keycloak

The local Keycloak instance (started via the `core.rescor.net` Docker Compose)
is pre-configured with:

| Setting | Value |
|---------|-------|
| Realm | `rescor` |
| Client ID | `storm-api` |
| Client type | Confidential (`client_secret` required) |
| Client secret | `storm-api-secret` |
| Service accounts | Enabled |
| Direct access grants | Enabled (allows password grant) |
| Test user | `stormdev` / `stormdev123` |
| Test user roles | `admin`, `assessor`, `reviewer`, `auditor` |

### Quick-Start (no auth, dev mode)

```bash
npm run dev                # starts API in development phase
curl http://localhost:3200/v1/rsk/vm/aggregate \
  -X POST -H "Content-Type: application/json" \
  -d '{"measurements": [20, 5, 5, 5], "alpha": 4}'
# → 200 OK, no token needed
```

### Quick-Start (with auth, production mode)

```bash
# 1. Start API in production mode (requires Infisical + Keycloak running)
env -u NODE_OPTIONS PHASE=production node --env-file=.env src/index.mjs

# 2. Obtain a token
TOKEN=$(curl -s -X POST \
  http://localhost:8080/realms/rescor/protocol/openid-connect/token \
  -d "grant_type=password" \
  -d "client_id=storm-api" \
  -d "client_secret=storm-api-secret" \
  -d "username=stormdev" \
  -d "password=stormdev123" \
  | jq -r '.access_token')

# 3. Call the API
curl -X POST http://localhost:3200/v1/rsk/vm/aggregate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"measurements": [20, 5, 5, 5], "alpha": 4}'
```

---

## References

- [API Reference](API-REFERENCE.md) — endpoint documentation
- [Security Architecture](SECURITY.md) — mTLS, gateway integration, rate limiting
- [OpenAPI Spec](openapi.yaml) — machine-readable API definition
