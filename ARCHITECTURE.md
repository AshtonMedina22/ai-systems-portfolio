# Architecture - Mockup vs live

Two layers:

1. **What the public site runs** (Vercel / `npm run dev`)
2. **Production config in-repo** (shapes for a future live path; not executed for Migrate / Workflow mockups)

## Quick map

| Open this | Meaning |
|-----------|---------|
| `lib/migrate/runtime.ts` / `lib/workflow/runtime.ts` | `DEMO_MODE = "mockup"` |
| `lib/payflow/runtime.ts` | `DEMO_MODE = "live"` |
| `lib/migrate/engine.ts` / `lib/workflow/state-machine.ts` | Mockup runtime the site executes |
| `lib/migrate/config.ts` / `lib/workflow/config.ts` | Prod config shape - unused in mockup |
| `lib/migrate/adapter.ts` / `lib/workflow/adapter.ts` | Chooses mockup vs live engine |
| `lib/*/live-stub.ts` | Live path stub; returns NOT_WIRED if selected |
| UI eyebrow | `Interactive demo` or `Live system demo` from `DEMO_MODE` |
| How it works | Runtime excerpts first; **Config (not wired)** tabs are prod shapes |

## Mockup vs live

| System | `DEMO_MODE` | Site runtime | In-repo prod config |
|--------|-------------|--------------|---------------------|
| **PayFlow** `/payflow` | `live` | FastMCP tools (embedded or HTTP) | `mcp-server/payflow_server.py`, `erp_registry.py` |
| **Migrate** `/migrate` | `mockup` | `lib/migrate/engine.ts` via `getMigrationEngine()` | `lib/migrate/config.ts`, `mcp-server/migrate_pipeline.py` (reference; not spawned by site) |
| **Workflow** `/workflow` | `mockup` | `lib/workflow/state-machine.ts` via `getWorkflowEngine()` | `lib/workflow/config.ts`, `mcp-server/workflow_graph.py` (reference; not spawned by site) |

## Adapter pattern

```
API route  ->  getXEngine()  ->  mockup implementation (site)
                              ->  live stub / future bridge
```

Set `DEMO_MODE` to `"live"` only after the live adapter is wired. Until then stubs return `NOT_WIRED`.

## Env vars

See `.env.example`. Entries marked for `DEMO_MODE=live` are unused while Migrate/Workflow stay on mockup.
