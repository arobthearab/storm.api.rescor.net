# STORM Tree Calculation Demo

Standalone program that processes a TestingCenter-shaped findings tree
using the STORM RSK/VM engine — **no inline calculations, no database,
no network**.

## Usage

```bash
# Built-in sample data (6 findings, 4 hosts, 2 horizons)
node demo/storm-tree-demo.mjs

# Custom tree JSON file
node demo/storm-tree-demo.mjs path/to/tree.json

# Authenticate via Keycloak before running (built-in data)
node demo/storm-tree-demo.mjs --auth

# Authenticate + custom tree
node demo/storm-tree-demo.mjs --auth path/to/tree.json
```

## Authentication (--auth)

When `--auth` is specified, the demo acquires a JWT from Keycloak before
running calculations.  The decoded token claims are included in the
JSON output under the `auth` key.

Credentials are read from environment variables:

| Variable | Default | Required |
|---|---|---|
| `KEYCLOAK_URL` | `http://localhost:8080` | No |
| `KEYCLOAK_REALM` | `rescor` | No |
| `KEYCLOAK_CLIENT_ID` | — | Yes |
| `KEYCLOAK_CLIENT_SECRET` | — | For client_credentials grant |
| `KEYCLOAK_USERNAME` | — | For password grant |
| `KEYCLOAK_PASSWORD` | — | For password grant |

Grant type is auto-selected:
- If `KEYCLOAK_USERNAME` + `KEYCLOAK_PASSWORD` are set → **password grant** (user context)
- Otherwise with `KEYCLOAK_CLIENT_SECRET` → **client_credentials grant** (service account)

Example:

```bash
KEYCLOAK_CLIENT_ID=storm-api \
KEYCLOAK_USERNAME=testuser \
KEYCLOAK_PASSWORD=testpass \
  node demo/storm-tree-demo.mjs --auth
```

## What It Does

1. Reads a 5-level tree: **Test → Horizon → Host → Finding → Annotation**
2. Walks bottom-up applying STORM calculations at each level:
   - **Annotations** — record correction values (0–1)
   - **Findings** — apply weighted diminishing-returns correction:
     `effective = original × (1 − min(1, Σ correction_j / 4^j))`
   - **Hosts** — RSK aggregate of direct findings:
     `⌈Σ V_j / 4^j⌉` (sorted descending)
   - **Horizons** — RSK aggregate of all findings within
   - **Test** — RSK aggregate of all findings, plus normalized score & rating
3. Outputs enriched JSON with `_storm` metadata on every node, plus a
   flat `summary` array.

## Input Format

```json
{
  "id": 1,
  "type": "test",
  "name": "...",
  "children": [
    {
      "type": "horizon", "name": "...",
      "children": [
        {
          "type": "host", "name": "...",
          "children": [
            {
              "type": "finding", "measurement": 75,
              "children": [
                { "type": "annotation", "measurement": 0.35 }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## IP Classification

**PROPRIETARY** — this program and the STORM engines it imports
contain trade-secret scoring algorithms.  Do not redistribute.
