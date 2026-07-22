"""Unit + in-memory MCP protocol tests for PayFlow FastMCP tools."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

# Ensure mcp-server/ is importable when pytest is run from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent))

from erp_registry import (  # noqa: E402
    check_bank_routing,
    post_erp_ledger,
    reset_ledger_for_tests,
    verify_vendor_entity,
)
from payflow_server import mcp  # noqa: E402


@pytest.fixture(autouse=True)
def _clean_ledger():
    reset_ledger_for_tests()
    yield
    reset_ledger_for_tests()


class TestErpRegistryLogic:
    def test_verify_vendor_exact_tax_id(self):
        result = verify_vendor_entity(
            "Acme Global Enterprise Inc.", "XX-XXX4910"
        )
        assert result["status"] == "MATCH_FOUND"
        assert result["vendorId"] == "VEND-001"
        assert result["matchMethod"] == "TAX_ID_EXACT"
        assert result["confidenceScore"] >= 0.95

    def test_verify_vendor_fuzzy_name(self):
        # Typo / short name should still fuzzy-match
        result = verify_vendor_entity("Acme Global Enterprise", "XX-UNKNOWN")
        assert result["status"] == "MATCH_FOUND"
        assert result["vendorId"] == "VEND-001"
        assert result["matchMethod"] == "FUZZY_NAME"

    def test_verify_vendor_unknown(self):
        result = verify_vendor_entity("Shadow Vendor LLC", "ZZ-9999999")
        assert result["status"] == "UNREGISTERED_ENTITY"
        assert result["recommendation"] == "REJECT_PAYMENT_AND_FLAG"

    def test_bank_routing_match(self):
        result = check_bank_routing("VEND-001", "021000021", "*****4321")
        assert result["isMatch"] is True
        assert result["riskLevel"] == "LOW"

    def test_bank_routing_spoof_detected(self):
        result = check_bank_routing("VEND-001", "990011223", "*****9912")
        assert result["isMatch"] is False
        assert result["riskLevel"] == "CRITICAL_FRAUD_ALERT"
        assert result["expectedRouting"] == "021000021"

    def test_bank_routing_unknown_vendor_error(self):
        result = check_bank_routing("VEND-999", "021000021", "*****4321")
        assert result.get("error") is True
        assert result["code"] == -32602

    def test_post_erp_ledger(self):
        result = post_erp_ledger("INV-1", "VEND-001", 14500.0)
        assert result["posted"] is True
        assert result["action"] == "POST_TO_ERP_LEDGER"
        assert result["status"] == "PAYMENT_SCHEDULED"
        assert result["ledgerEntryId"].startswith("LED-")


class TestFastMcpProtocol:
    def test_list_and_call_tools_in_memory(self):
        async def _run():
            from fastmcp import Client

            async with Client(mcp) as client:
                tools = await client.list_tools()
                names = sorted(t.name for t in tools)
                assert names == [
                    "check_bank_routing",
                    "post_erp_ledger",
                    "verify_vendor_entity",
                ]

                vendor = await client.call_tool(
                    "verify_vendor_entity",
                    {
                        "vendorName": "Acme Global Enterprise Inc.",
                        "taxId": "XX-XXX4910",
                    },
                )
                vendor_data = vendor.data
                assert vendor_data["status"] == "MATCH_FOUND"
                assert vendor_data["vendorId"] == "VEND-001"

                bank = await client.call_tool(
                    "check_bank_routing",
                    {
                        "vendorId": "VEND-001",
                        "routingNumber": "021000021",
                        "accountNumber": "*****4321",
                    },
                )
                assert bank.data["isMatch"] is True

                ledger = await client.call_tool(
                    "post_erp_ledger",
                    {
                        "invoiceId": "INV-2026-1042",
                        "vendorId": "VEND-001",
                        "amount": 14500.0,
                    },
                )
                assert ledger.data["posted"] is True

                spoof = await client.call_tool(
                    "check_bank_routing",
                    {
                        "vendorId": "VEND-001",
                        "routingNumber": "990011223",
                        "accountNumber": "*****9912",
                    },
                )
                assert spoof.data["isMatch"] is False
                assert spoof.data["riskLevel"] == "CRITICAL_FRAUD_ALERT"

        asyncio.run(_run())
