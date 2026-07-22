# AI Systems Portfolio

Glass-box enterprise AI demos for finance, operations, and data privacy. Each project uses a split view: business controls on the left, live protocol and tool traces on the right.

## Positioning

Integrations are framed as **universal enterprise architecture** - SAP, NetSuite, Salesforce, Dynamics 365, QuickBooks Enterprise, and core banking ledgers - not niche or mid-market platforms.

| System | Focus | Enterprise integration | Business impact |
|--------|-------|------------------------|-----------------|
| **PayFlow (MCP)** `/payflow` | Accounts payable & anti-fraud | SAP, NetSuite, core banking ledgers via MCP | Automates invoice checks; blocks fraudulent routing changes |
| **Self-Healing SRE (LangGraph)** `/sre` | Automated incident manager | Enterprise cloud (AWS / Kubernetes) | Cuts outage downtime with mandatory manager sign-off |
| **Enterprise Guardrails (Evals)** `/guardrails` | Data privacy & safety suite | PII redaction before LLM payloads | Eliminates compliance and leak risk |

## Project 1 - PayFlow (MCP)

PayFlow is an accounts-payable and anti-fraud agent. It verifies vendor identity, checks bank routing against approved profiles, and posts to the enterprise AP ledger only when both checks pass. Clean invoices can auto-pay; fraud or unknown-vendor cases escalate or halt before money moves.

### Design choice: deterministic orchestration (not an autonomous LLM)

Corporate finance cannot treat payout authorization as an open-ended LLM loop. Hallucinations, prompt injection, and non-repeatable decisions are unacceptable when funds move.

PayFlow uses a **deterministic MCP orchestrator**:

1. Verify vendor identity against the enterprise vendor registry  
2. Check bank routing against the approved payment profile  
3. Post to the enterprise AP ledger only if both checks pass; otherwise block and escalate  

**MCP** exposes explicit tools (`verify_vendor_entity`, `check_bank_routing`, `post_erp_ledger`) over Streamable HTTP. Language heuristics (for example fuzzy vendor matching) stay inside those tools. Authorization and payout routing stay rule-based and fully auditable.

| Audience | How to read this |
|----------|------------------|
| Business / finance leaders | Built-in safeguards: the system cannot release funds without verified checks |
| Engineering leaders | Deterministic orchestrator over MCP - testable, predictable, production-shaped |

The Next.js app calls the FastMCP Python server via the MCP TypeScript SDK and streams results to the UI with SSE.

| Scenario | Outcome |
|----------|---------|
| Clean invoice | Vendor match, bank OK, ledger post |
| Spoofed bank | Fraud escalate (no ledger) |
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

- Live path: `/api/payflow` -> MCP client -> `http://127.0.0.1:8000/mcp`
- Optional fallback: `PAYFLOW_ALLOW_LOCAL_FALLBACK=1` uses local TypeScript tool mirrors when the MCP server is down (labeled `local:fallback_tools` in the stream)

## Stack

- Next.js App Router, Tailwind, SSE
- FastMCP (Python), `@modelcontextprotocol/sdk`
- pytest for enterprise ledger logic and in-memory MCP client checks

## Status

PayFlow is implemented. Self-Healing SRE (`/sre`) and Enterprise Guardrails (`/guardrails`) use the same Opal split layout; live demos are next. Legacy `/evals` redirects to `/guardrails`.
