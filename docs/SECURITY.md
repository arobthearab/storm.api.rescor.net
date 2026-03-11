# STORM API — Security Architecture

## Authentication

The STORM API supports a layered authentication model designed for API Gateway
deployment:

### 1. OAuth 2.0 / OIDC — User Authentication

**Flow:** Authorization Code + PKCE (for web clients) or Client Credentials (for service-to-service).

- Identity Provider: Configurable (Azure AD, Okta, Auth0, Cognito)
- Token type: JWT (RS256 or ES256)
- Token validation: JWKS endpoint discovery via `.well-known/openid-configuration`
- Required claims: `sub`, `iss`, `aud`, `exp`, `iat`
- Custom claims: `roles` (array of RBAC roles), `tenant` (multi-tenant isolation)

**Configuration (via Infisical — not environment variables):**

| Infisical Section | Key | Description |
|-------------------|-----|-------------|
| `oidc` | `issuer_url` | e.g., `https://login.microsoftonline.com/{tenant}/v2.0` |
| `oidc` | `audience` | e.g., `api://storm.api.rescor.net` |
| `oidc` | `jwks_uri` | Auto-discovered from issuer, or explicit override |

See [CONFIGURATION.md](CONFIGURATION.md) for full details.

### 2. JWT Validation

All `/v1/*` endpoints require a valid JWT bearer token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

**Validation steps:**
1. Extract token from `Authorization: Bearer <token>`
2. Decode header → fetch signing key from JWKS cache
3. Verify signature (RS256 / ES256)
4. Validate `iss`, `aud`, `exp`, `iat`, `nbf`
5. Extract `roles` claim for RBAC
6. Attach decoded token to request context

**Rejected with 401:**
- Missing or malformed `Authorization` header
- Expired token (`exp` in the past)
- Invalid signature
- Issuer or audience mismatch

### 3. mTLS — Service-to-Service

For internal service mesh communication (e.g., ASR API → STORM API):

- Client certificate required at TLS layer
- Certificate CN or SAN validated against allowlist
- Typically terminated at the API Gateway or load balancer
- Application receives `x-client-cert-cn` header from gateway

**Configuration (via Infisical — not environment variables):**

| Infisical Section | Key | Description |
|-------------------|-----|-------------|
| `mtls` | `enabled` | `true` / `false` |
| `mtls` | `allowed_cns` | Comma-separated list of allowed certificate CNs |

See [CONFIGURATION.md](CONFIGURATION.md) for full details.

### 4. API Key — Gateway-Level Rate Limiting

Optional API key for usage tracking and rate limiting at the gateway layer:

```
x-api-key: <key>
```

This is **not** an authentication mechanism — it supplements OAuth/JWT for metering.

---

## Authorization — RBAC

Role-Based Access Control using JWT `roles` claim:

| Role | Description | Permissions |
|------|-------------|-------------|
| `admin` | System administrator | All endpoints, configuration management |
| `assessor` | Risk assessor | All computation endpoints, vector management |
| `reviewer` | Review / read-only | Read-only computation (score existing vectors), no mutations |
| `auditor` | Compliance auditor | Read-only access to computation logs, audit trail endpoints |

### Endpoint Permissions

| Endpoint Group | admin | assessor | reviewer | auditor |
|----------------|-------|----------|----------|---------|
| `POST /v1/measurements/*` | Yes | Yes | No | No |
| `POST /v1/rsk/vm/*` | Yes | Yes | Yes | No |
| `POST /v1/rsk/rm/*` | Yes | Yes | No | No |
| `POST /v1/iap/*` | Yes | Yes | Yes | No |
| `POST /v1/nist/*` | Yes | Yes | Yes | No |
| `GET /v1/frameworks/*` | Yes | Yes | Yes | No |
| `/v1/assets, threats, vulnerabilities, controls` | Yes | Yes | No | No |
| `/v1/linkages, suggestions` | Yes | Yes | No | No |
| `GET /health` | Public | Public | Public | Public |

### Role Enforcement

Roles are extracted from the JWT `roles` claim (array of strings) and checked
by the `authorize()` middleware:

```javascript
// Usage in route definition
router.post('/rsk/vm/aggregate', authorize('assessor'), handleAggregate);
```

The middleware checks that the authenticated user has **at least one** of the
specified roles. `admin` implicitly has access to everything.

---

## Gateway Integration

### AWS API Gateway

```yaml
# API Gateway configuration pattern
x-amazon-apigateway-auth:
  type: AWS_IAM        # or COGNITO_USER_POOLS
x-amazon-apigateway-integration:
  type: HTTP_PROXY
  uri: "http://{ecs-service}:3200/{proxy}"
```

- Cognito User Pool authorizer for JWT validation
- Lambda authorizer for custom RBAC logic
- Usage plans + API keys for rate limiting
- WAF integration for DDoS protection

### Azure API Management

```xml
<!-- Inbound policy for JWT validation -->
<validate-jwt header-name="Authorization" require-scheme="Bearer">
    <openid-config url="https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration" />
    <required-claims>
        <claim name="aud" match="all">
            <value>api://storm.api.rescor.net</value>
        </claim>
    </required-claims>
</validate-jwt>
```

### GCP API Gateway

```yaml
# OpenAPI security scheme
securityDefinitions:
  firebase:
    authorizationUrl: ""
    flow: "implicit"
    type: "oauth2"
    x-google-issuer: "https://securetoken.google.com/{project}"
    x-google-jwks_uri: "https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    x-google-audiences: "{project}"
```

---

## Request Tracing

All requests carry correlation IDs for distributed tracing:

| Header | Purpose |
|--------|---------|
| `x-request-id` | Unique request identifier (generated if absent) |
| `x-correlation-id` | Cross-service correlation (propagated from caller) |
| `x-client-cert-cn` | mTLS client certificate CN (set by gateway) |

These headers are:
1. Propagated to all downstream calls
2. Included in all log entries
3. Returned in all response headers

---

## Rate Limiting

Rate limits are enforced at the gateway level, not in the application:

| Tier | Requests/second | Burst |
|------|-----------------|-------|
| Free | 10 | 20 |
| Standard | 100 | 200 |
| Enterprise | 1000 | 2000 |

The Express application includes a lightweight fallback rate limiter for
direct-access scenarios (no gateway).

---

## Security Headers

Applied by middleware on all responses:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Cache-Control: no-store
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

## Secrets Management

The STORM API follows the **Configuration-First Runtime Policy** defined in the
[core project patterns](../../core.rescor.net/docs/PROJECT-PATTERNS.md).  All
secrets and runtime configuration are stored in **Infisical** and loaded at
startup via `@rescor/core-config`.  The `.env` file contains only the
Infisical bootstrap credentials.

See [CONFIGURATION.md](CONFIGURATION.md) for the full list of Infisical keys,
credential rotation procedures, and troubleshooting.

---

## References

- [Configuration Guide](CONFIGURATION.md) — bootstrap credentials, Infisical keys, rotation
- [Authentication Guide](AUTHENTICATION.md) — obtaining tokens, dev bypass, RBAC roles
- [Core Security Principles](../../core.rescor.net/docs/PROJECT-PATTERNS.md#security-principles)
- [API Reference](API-REFERENCE.md)
- [OpenAPI Spec](openapi.yaml)
