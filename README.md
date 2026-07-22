# AI Systems Portfolio

Glass-box enterprise AI demos for finance, operations, and data privacy. Each project uses a split view: business controls on the left, live protocol and tool traces on the right.

## Positioning

Integrations are framed as **universal enterprise architecture** - SAP, NetSuite, Salesforce, Dynamics 365, QuickBooks Enterprise, and core banking ledgers - not niche or mid-market platforms.

| System | Focus | Enterprise integration | Business impact |
|--------|-------|------------------------|-----------------|
| **PayFlow (MCP)** `/payflow` | Accounts payable & anti-fraud | SAP, NetSuite, core banking ledgers via MCP | Helps automate invoice checks and flag suspicious routing changes |
| **Self-Healing SRE (LangGraph)** `/sre` | Automated incident manager | Enterprise cloud (AWS / Kubernetes) | Helps shorten outage response with manager sign-off |
| **Enterprise Guardrails (Evals)** `/guardrails` | Data privacy & safety suite | PII redaction before LLM payloads | Helps reduce compliance and leak exposure |

## Project 1 - PayFlow (MCP)

**Positioning:** Enterprise Accounts Payable Automation & Anti-Fraud Suite.

**Business problem:** AP teams spend hours manually keying invoices, verifying vendor records, and checking bank routing - a slow process that leaves companies open to invoice spoofing and fraudulent bank account changes.

**Business outcome:** An automated AP agent that helps cut manual entry, validates vendors against core ledger systems in real time, and flags suspicious routing changes or unknown vendors before payouts are released.

### Design choice: deterministic orchestration (not an autonomous LLM)

Corporate finance cannot treat payout authorization as an open-ended LLM loop. Hallucinations, prompt injection, and non-repeatable decisions are unacceptable when funds move.

PayFlow uses a **deterministic MCP orchestrator**:

1. Verify vendor identity against the enterprise vendor registry (exact tax ID + fuzzy name matching)  
2. Check bank routing against the approved payment profile  
3. Post to the enterprise AP ledger only if both checks pass; otherwise block and escalate  

**Stack:** Python FastMCP server, JSON-RPC / MCP tools, TypeScript Next.js frontend, Server-Sent Events (SSE). Ledger tooling mirrors enterprise AP vendor-master patterns (SAP / NetSuite-style); the demo registry is in-process for glass-box replay.

**MCP** exposes explicit tools (`verify_vendor_entity`, `check_bank_routing`, `post_erp_ledger`) over Streamable HTTP. Fuzzy entity matching and deterministic anti-fraud rules stay inside those tools. Authorization and payout routing stay rule-based and fully auditable.

| Audience | How to read this |
|----------|------------------|
| Business / finance leaders | Built-in safeguards: this demo agent only releases funds after verified checks |
| Engineering leaders | Deterministic orchestrator over MCP - testable, predictable, production-shaped |

The Next.js app calls the FastMCP Python server via the MCP TypeScript SDK and streams results to the UI with SSE.

| Scenario | Outcome |
|----------|---------|
| Standard clean invoice (Acme Corp) | Vendor match, bank OK, ledger post |
| Spoofed fraud invoice (name typo + bad routing) | Fuzzy match may pass; routing mismatch escalates (no ledger) |
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
- Live path: `/api/payflow` -> MCP client -> FastMCP **or** in-project tool runtime
- Tool surface (both paths): `verify_vendor_entity`, `check_bank_routing`, `post_erp_ledger`

## Stack

- Next.js App Router, Tailwind, SSE
- FastMCP (Python), `@modelcontextprotocol/sdk`
- pytest for enterprise ledger logic and in-memory MCP client checks

## Status

PayFlow is implemented. Self-Healing SRE (`/sre`) and Enterprise Guardrails (`/guardrails`) use the same Opal split layout; live demos are next. Legacy `/evals` redirects to `/guardrails`.
