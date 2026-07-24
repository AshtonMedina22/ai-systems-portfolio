# Ashton Medina - Systems Portfolio

Portfolio for Ashton Medina, Systems Architect & Operations Consultant.

Three demos. Split UI: controls on the left, tool/console activity on the right.

## Mockup vs live

| System | Mode | What the site runs | Prod config (not wired on site for mockups) |
|--------|------|--------------------|---------------------------------------------|
| **PayFlow** `/payflow` | `live` | FastMCP tools (embedded or HTTP) | `mcp-server/payflow_server.py` |
| **Client Migration** `/migrate` | `mockup` | `lib/migrate/engine.ts` | `lib/migrate/config.ts`, `mcp-server/migrate_pipeline.py` |
| **Workflow & Approvals** `/workflow` | `mockup` | `lib/workflow/state-machine.ts` | `lib/workflow/config.ts`, `mcp-server/workflow_graph.py` |

UI labels (`Interactive demo` / `Live system demo`) come from `DEMO_MODE` in `lib/*/runtime.ts`. Full map: [ARCHITECTURE.md](./ARCHITECTURE.md).

## PayFlow `/payflow` - Live system demo

Real Python FastMCP AP / fraud checks.

1. Verify vendor against the registry (tax ID + fuzzy name)
2. Check bank routing against the approved payment profile
3. Post to the AP ledger only if both pass; otherwise block

**Stack:** Python FastMCP, MCP tools, Next.js, SSE

**Tools:** `verify_vendor_entity`, `check_bank_routing`, `post_erp_ledger`

| Scenario | Outcome |
|----------|---------|
| Clean Acme invoice | Vendor match, bank OK, ledger post |
| Spoofed fraud invoice | Routing mismatch escalates (no ledger) |
| Unknown vendor | Registry reject, halt |

```bash
# Terminal 1 - FastMCP server (local HTTP path)
npm run dev:mcp

# Terminal 2 - Next.js
npm run dev
```

Open http://localhost:3000/payflow

```bash
npm run test:mcp
```

- **Hosted (Vercel):** `PAYFLOW_MCP_MODE=embedded` (or `auto`). Same MCP tool schemas run in-process - no separate Python process required.
- **Local HTTP:** `npm run dev:mcp` + `PAYFLOW_MCP_MODE=auto|http` talks to FastMCP at `http://127.0.0.1:8000/mcp`.

## Client Migration `/migrate` - Interactive demo (mockup)

TypeScript / Next.js walkthrough. `DEMO_MODE=mockup`. Pick a clean or messy export, run mapping, watch schema checks and a simulated tenant cutover in the console.

**Site runs:** `lib/migrate/engine.ts` via `getMigrationEngine()`, streamed over SSE. No live database.

**In-repo only (not wired on the site):** `lib/migrate/config.ts` and reference ETL `mcp-server/migrate_pipeline.py`.

```bash
npm run dev
# http://localhost:3000/migrate
```

## Workflow & Approvals `/workflow` - Interactive demo (mockup)

TypeScript state machine. `DEMO_MODE=mockup`. Start a multi-step request, pause high-dollar payouts for Approve / Reject, watch transitions in the console.

**Site runs:** `lib/workflow/state-machine.ts` via `getWorkflowEngine()`, in-memory checkpoint in `sessions.ts`, SSE.

**In-repo only (not wired on the site):** `lib/workflow/config.ts` and reference graph `mcp-server/workflow_graph.py`.

```bash
npm run dev
# http://localhost:3000/workflow
```

## Stack

- Next.js App Router, Tailwind, SSE
- Python FastMCP for PayFlow only (`@modelcontextprotocol/sdk`)
- TypeScript mockups for migrate and workflow
- pytest for PayFlow ledger logic

```bash
npm run test:python
```
