"""
PayFlow FastMCP Server - Enterprise Accounts Payable & Anti-Fraud tools.

Exposes MCP tools over Streamable HTTP at http://127.0.0.1:8000/mcp
"""

from __future__ import annotations

import json
import os
from typing import Any

from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from erp_registry import (
    check_bank_routing,
    post_erp_ledger,
    verify_vendor_entity,
)

mcp = FastMCP(
    name="payflow-ap-agent",
    instructions=(
        "Enterprise AP MCP server. Use tools/list, then "
        "verify_vendor_entity, check_bank_routing, and post_erp_ledger."
    ),
)


@mcp.tool(name="verify_vendor_entity")
def tool_verify_vendor_entity(vendorName: str, taxId: str) -> dict[str, Any]:
    """Resolve vendor identity against the enterprise vendor registry (exact tax ID + fuzzy name)."""
    return verify_vendor_entity(vendorName, taxId)


@mcp.tool(name="check_bank_routing")
def tool_check_bank_routing(
    vendorId: str, routingNumber: str, accountNumber: str
) -> dict[str, Any]:
    """Compare submitted bank details to the authorized enterprise payment profile."""
    result = check_bank_routing(vendorId, routingNumber, accountNumber)
    if result.get("error"):
        raise ValueError(result["message"])
    return result


@mcp.tool(name="post_erp_ledger")
def tool_post_erp_ledger(
    invoiceId: str, vendorId: str, amount: float, currency: str = "USD"
) -> dict[str, Any]:
    """Post an approved invoice to the enterprise accounts-payable ledger."""
    return post_erp_ledger(invoiceId, vendorId, amount, currency)


@mcp.custom_route("/health", methods=["GET"])
async def health_check(_request: Request) -> Response:
    return JSONResponse(
        {
            "status": "ok",
            "server": "payflow-ap-agent",
            "transport": "streamable-http",
            "mcpEndpoint": "/mcp",
            "tools": [
                "verify_vendor_entity",
                "check_bank_routing",
                "post_erp_ledger",
            ],
        }
    )


@mcp.custom_route("/tools/manifest", methods=["GET"])
async def tools_manifest(_request: Request) -> Response:
    """Non-MCP convenience endpoint for portfolio docs / health dashboards."""
    return JSONResponse(
        {
            "protocol": "MCP",
            "jsonrpc": "2.0",
            "methods": ["tools/list", "tools/call"],
            "tools": [
                {
                    "name": "verify_vendor_entity",
                    "description": "Enterprise vendor identity resolution",
                },
                {
                    "name": "check_bank_routing",
                    "description": "Anti-fraud bank profile verification",
                },
                {
                    "name": "post_erp_ledger",
                    "description": "Post approved invoice to AP ledger",
                },
            ],
        }
    )


if __name__ == "__main__":
    host = os.getenv("MCP_HOST", "127.0.0.1")
    port = int(os.getenv("MCP_PORT", "8000"))
    print(
        json.dumps(
            {
                "event": "payflow_mcp_starting",
                "host": host,
                "port": port,
                "mcpUrl": f"http://{host}:{port}/mcp",
            }
        )
    )
    mcp.run(transport="http", host=host, port=port)
