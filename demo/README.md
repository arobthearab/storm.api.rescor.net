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
