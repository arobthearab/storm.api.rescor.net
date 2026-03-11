# STORM API — Configuration Guide

> Complete reference for environment variables, Infisical secrets, and phase
> management in the STORM API.

---

## Overview

The STORM API follows the **Configuration-First Runtime Policy**: all runtime
configuration is loaded from [Infisical](https://infisical.com/) at startup via
`@rescor/core-config`.  The only environment variables permitted in the `.env`
file are the **Infisical bootstrap credentials** needed to establish that
initial connection.

```
.env  →  Infisical bootstrap  →  @rescor/core-config  →  runtime configuration
```

See the [cross-project patterns](../../core.rescor.net/docs/PROJECT-PATTERNS.md)
for the policy definition.

---

## Bootstrap Environment Variables

These are the **only** environment variables read from `.env`.
Copy `.env.example` → `.env` and fill in the credentials.

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `INFISICAL_HOST` | Yes | Infisical server URL | `http://localhost:3000` |
| `INFISICAL_CLIENT_ID` | Yes | Machine identity client ID | *(from Infisical)* |
| `INFISICAL_CLIENT_SECRET` | Yes | Machine identity client secret | *(from Infisical)* |
| `INFISICAL_CORE_PROJECT_ID` | Yes | Core project ID (shared across RESCOR) | `31ce7b6b-24ac-441f-ae3e-d47a13719238` |
| `INFISICAL_PROJECT_ID` | Yes | STORM-specific project ID | *(from Infisical)* |
| `INFISICAL_ENVIRONMENT` | Yes | Infisical environment slug | `dev`, `staging`, `prod` |

### Where to obtain values

1. Log in to the Infisical dashboard.
2. Navigate to **Project Settings → Machine Identities** for your
   `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET`.
3. The project ID is shown in **Project Settings → General**.
4. The core project ID is shared across all RESCOR projects and is
   pre-populated in `.env.example`.

---

## Phase Override

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PHASE` | No | Deployment phase override | `development` |

The `PhaseManager` (from `@rescor/core-db`) resolves the active phase in this
order:

1. Explicit option passed to constructor
2. Configuration store (Infisical)
3. `PHASE` environment variable
4. `NODE_ENV` environment variable
5. Default: `development`

| Phase | Authentication | Description |
|-------|---------------|-------------|
| `development` | **Bypassed** | Synthetic admin user injected; no token required |
| `uat` | **Enforced** | Valid JWT required for all `/v1/*` endpoints |
| `production` | **Enforced** | Valid JWT required for all `/v1/*` endpoints |

See [AUTHENTICATION.md](AUTHENTICATION.md) for full phase-specific behavior.

---

## Runtime Configuration (Infisical)

Once the bootstrap connection is established, all runtime configuration is
loaded from Infisical via `configuration.getConfig(section, key)`.  The table
below lists each key, the Infisical section, and the fallback default used
when Infisical is unreachable (development only).

### Neo4j Database

| Section | Key | Description | Dev Fallback |
|---------|-----|-------------|--------------|
| `neo4j` | `uri` | Bolt connection URI | `bolt://localhost:17787` |
| `neo4j` | `database` | Database name | `neo4j` |
| `neo4j` | `password` | Authentication password | *(none)* |

### Identity Provider (Keycloak / OIDC)

| Section | Key | Description | Dev Fallback |
|---------|-----|-------------|--------------|
| `idp` | `base_url` | Keycloak base URL | `http://localhost:8080` |
| `idp` | `realm` | OIDC realm | `rescor` |
| `idp` | `client_id` | OIDC client ID (audience) | `storm-api` |
| `idp` | `client_secret` | OIDC client secret | *(none)* |

### OIDC / JWT Validation

| Section | Key | Description | Dev Fallback |
|---------|-----|-------------|--------------|
| `oidc` | `issuer_url` | OIDC issuer URL | *(derived from idp.base_url + idp.realm)* |
| `oidc` | `audience` | Expected JWT audience | *(idp.client_id)* |
| `oidc` | `jwks_uri` | Explicit JWKS URI override | *(auto-discovered)* |

### mTLS (Service-to-Service)

| Section | Key | Description | Dev Fallback |
|---------|-----|-------------|--------------|
| `mtls` | `enabled` | Enable mTLS validation | `false` |
| `mtls` | `allowed_cns` | Comma-separated allowed certificate CNs | *(none)* |

---

## Adding a New Configuration Key

1. Add the key/value in the Infisical dashboard under the appropriate section.
2. Read it in code via `await configuration.getConfig('section', 'key')`.
3. Add a row to the appropriate table in this document.
4. **Never** add a new `process.env` read — all runtime config goes through
   Infisical.

---

## Credential Rotation

### Infisical Bootstrap Credentials

1. Generate a new machine identity in the Infisical dashboard.
2. Update `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET` in `.env`.
3. **Restart the API** — bootstrap credentials are read once at startup.

### Neo4j Password

1. Update the password in the Infisical dashboard (`neo4j` section, `password`
   key).
2. Update the Neo4j server to accept the new password.
3. **Restart the API** — the Neo4j driver is created once at startup.

### Keycloak / IDP Client Secret

1. Rotate the secret in Keycloak (Clients → storm-api → Credentials).
2. Update the value in Infisical (`idp` section, `client_secret` key).
3. **Restart the API** — IDP config is loaded once at startup.

### mTLS Certificate CN Allowlist

1. Update `mtls.allowed_cns` in Infisical.
2. **Restart the API** — the allowlist is loaded once at startup.

> **Note:** All runtime configuration is loaded once during startup.  Changes
> in Infisical take effect only after a restart.  A future enhancement may add
> hot-reload support.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Configuration: Infisical connection failed` | Missing or invalid bootstrap creds | Verify `.env` values match Infisical dashboard |
| `Neo4j: ServiceUnavailable` | Wrong URI or Neo4j not running | Check `neo4j.uri` in Infisical; run `docker compose up -d` |
| `401 Unauthorized` in production | IDP misconfiguration | Verify `idp.*` keys in Infisical; check Keycloak is running |
| `PHASE not recognized` | Typo in PHASE env var | Use one of: `development`, `uat`, `production` |

---

## References

- [.env.example](../.env.example) — Bootstrap credential template
- [AUTHENTICATION.md](AUTHENTICATION.md) — Token acquisition, RBAC, dev-mode bypass
- [SECURITY.md](SECURITY.md) — Auth architecture, gateway integration
- [Cross-Project Patterns](../../core.rescor.net/docs/PROJECT-PATTERNS.md) — Configuration-First Runtime Policy
