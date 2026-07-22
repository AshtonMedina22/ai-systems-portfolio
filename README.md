# AI Systems Portfolio

Interactive demos of MCP tool use, multi-agent workflows, and evaluation gates. Each project uses a split view: controls on the left, live protocol/trace output on the right.

## Project 1 - PayFlow (FastMCP)

FastMCP Python server with `verify_vendor_entity`, `check_bank_routing`, and `post_erp_ledger`. The Next.js app calls those tools over Streamable HTTP via the MCP TypeScript SDK and streams results to the UI with SSE.

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
- Tool sequence is fixed (not an LLM planner)

## Stack

- Next.js App Router, Tailwind, SSE
- FastMCP (Python), `@modelcontextprotocol/sdk`
- pytest for ERP logic and in-memory MCP client checks

## Status

PayFlow is implemented. SRE (LangGraph) and Evals (Promptfoo) routes are stubs.
