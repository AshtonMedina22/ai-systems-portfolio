# AI Systems Portfolio

Interactive demos for finance, migrations, and multi-site ops. Each project uses a split view: business controls on the left, live tool activity on the right.

## Positioning

| System | Focus | Integration | Business impact |
|--------|-------|-------------|-----------------|
| **PayFlow** `/payflow` | Accounts payable & anti-fraud | SAP / NetSuite-style ledgers via FastMCP | Helps catch bad routing and unknown vendors before payout |
| **Client Migration Pipeline** `/migrate` | Schema mapping before cutover | SQL / PostgreSQL-style location schema | Flags messy rows and keeps an error trail |
| **Workflow & Approvals** `/workflow` | Multi-step ops with review gates | Async workflow + manager approve / reject | Pauses high-dollar payouts for sign-off |

Legacy routes `/sre` → `/migrate`, and `/guardrails` + `/evals` → `/workflow` (permanent redirects).

## Project 1 - PayFlow (MCP)

**Business problem:** AP teams still key invoices by hand, look up vendors, and check bank routing - slow work that leaves room for invoice spoofing and fake account changes.

**Business outcome:** An AP check that validates vendors against a ledger-style registry and flags suspicious routing or unknown vendors before money moves.

### Design choice: deterministic orchestration (not an open-ended LLM loop)

Corporate finance cannot treat payout authorization as a free-form model conversation. PayFlow runs fixed steps:

1. Verify vendor identity against the vendor registry (exact tax ID + fuzzy name matching)
2. Check bank routing against the approved payment profile
3. Post to the AP ledger only if both checks pass; otherwise block and escalate

**Stack:** Python FastMCP server, JSON-RPC / MCP tools, TypeScript Next.js frontend, Server-Sent Events (SSE).

**MCP tools:** `verify_vendor_entity`, `check_bank_routing`, `post_erp_ledger`

| Scenario | Outcome |
|----------|---------|
| Clean Acme invoice | Vendor match, bank OK, ledger post |
| Spoofed fraud invoice (name typo + bad routing) | Routing mismatch escalates (no ledger) |
| Unknown vendor | Registry reject, halt |

### Run locally

```bash
# Terminal 1 - FastMCP server
npm run dev:mcp

# Terminal 2 - Next.js
npm run dev
```

Open http://localhost:3000/payflow

### Tests

```bash
npm run test:mcp
```

### Notes

- **Hosted demos (Vercel):** set `PAYFLOW_MCP_MODE=embedded` (or leave `auto`). The Next.js API runs the same MCP tool schemas in-process - no separate Python server required.
- **Local credibility path:** `npm run dev:mcp` + `PAYFLOW_MCP_MODE=auto|http` connects to live FastMCP at `http://127.0.0.1:8000/mcp`.

## Project 2 - Client Migration Pipeline

Live demo at `/migrate`: pick a clean or messy Mid-West Logistics export, run the mapping, and watch schema checks and tenant cutover in the right-hand log.

## Project 3 - Workflow & Approvals

Live demo at `/workflow`: start a multi-step ops request, pause high-dollar payouts for Approve / Reject, and watch state transitions in the right-hand log.

## Stack

- Next.js App Router, Tailwind, SSE
- FastMCP (Python), `@modelcontextprotocol/sdk`
- pytest for ledger logic and MCP client checks
