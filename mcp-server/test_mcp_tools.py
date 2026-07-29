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
    expire_evidence_for_tests,
    mark_evidence_failed_for_tests,
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


def _passing_pair():
    vendor = verify_vendor_entity(
        "Acme Global Enterprise Inc.", "XX-XXX4910"
    )
    bank = check_bank_routing("VEND-001", "021000021", "*****4321")
    return vendor, bank


class TestErpRegistryLogic:
    def test_verify_vendor_exact_tax_id(self):
        result = verify_vendor_entity(
            "Acme Global Enterprise Inc.", "XX-XXX4910"
        )
        assert result["status"] == "MATCH_FOUND"
        assert result["vendorId"] == "VEND-001"
        assert result["matchMethod"] == "TAX_ID_EXACT"
        assert result["confidenceScore"] >= 0.95
        assert result["evidenceToken"].startswith("ev_vendor_")

    def test_verify_vendor_fuzzy_name(self):
        # Typo / short name should still fuzzy-match
        result = verify_vendor_entity("Acme Global Enterprise", "XX-UNKNOWN")
        assert result["status"] == "MATCH_FOUND"
        assert result["vendorId"] == "VEND-001"
        assert result["matchMethod"] == "FUZZY_NAME"
        assert "evidenceToken" in result

    def test_verify_vendor_tax_id_allows_name_variation(self):
        # Exact tax ID match can allow a mistyped vendor name
        result = verify_vendor_entity(
            "Acme Global Enterprize Inc.", "XX-XXX4910"
        )
        assert result["status"] == "MATCH_FOUND"
        assert result["matchMethod"] == "TAX_ID_EXACT"
        assert result["vendorId"] == "VEND-001"

    def test_verify_vendor_unknown(self):
        result = verify_vendor_entity("Shadow Vendor LLC", "ZZ-9999999")
        assert result["status"] == "UNREGISTERED_ENTITY"
        assert result["recommendation"] == "REJECT_PAYMENT_AND_FLAG"
        assert "evidenceToken" not in result

    def test_bank_routing_match(self):
        result = check_bank_routing("VEND-001", "021000021", "*****4321")
        assert result["isMatch"] is True
        assert result["riskLevel"] == "LOW"
        assert result["evidenceToken"].startswith("ev_bank_")

    def test_bank_routing_spoof_detected(self):
        result = check_bank_routing("VEND-001", "990011223", "*****9912")
        assert result["isMatch"] is False
        assert result["riskLevel"] == "CRITICAL_FRAUD_ALERT"
        assert result["expectedRouting"] == "021000021"
        assert "evidenceToken" not in result

    def test_bank_routing_unknown_vendor_error(self):
        result = check_bank_routing("VEND-999", "021000021", "*****4321")
        assert result.get("error") is True
        assert result["code"] == -32602


class TestEvidenceGatedLedger:
    def test_post_with_valid_evidence(self):
        vendor, bank = _passing_pair()
        result = post_erp_ledger(
            "INV-1",
            "VEND-001",
            14500.0,
            vendor_evidence_token=vendor["evidenceToken"],
            bank_evidence_token=bank["evidenceToken"],
            vendor_name="Acme Global Enterprise Inc.",
            tax_id="XX-XXX4910",
            routing_number="021000021",
            account_number="*****4321",
        )
        assert result["posted"] is True
        assert result["action"] == "POST_TO_ERP_LEDGER"
        assert result["status"] == "PAYMENT_SCHEDULED"
        assert result["ledgerEntryId"].startswith("LED-")

    def test_post_rejects_absent_evidence(self):
        result = post_erp_ledger(
            "INV-1",
            "VEND-001",
            14500.0,
            vendor_name="Acme Global Enterprise Inc.",
            tax_id="XX-XXX4910",
            routing_number="021000021",
            account_number="*****4321",
        )
        assert result["posted"] is False
        assert result["code"] == "EVIDENCE_ABSENT"

    def test_post_rejects_incomplete_payload(self):
        vendor, bank = _passing_pair()
        result = post_erp_ledger(
            "INV-1",
            "VEND-001",
            14500.0,
            vendor_evidence_token=vendor["evidenceToken"],
            bank_evidence_token=bank["evidenceToken"],
        )
        assert result["posted"] is False
        assert result["code"] == "POST_PAYLOAD_INCOMPLETE"

    def test_post_rejects_replayed_evidence(self):
        vendor, bank = _passing_pair()
        args = dict(
            invoice_id="INV-1",
            vendor_id="VEND-001",
            amount=14500.0,
            vendor_evidence_token=vendor["evidenceToken"],
            bank_evidence_token=bank["evidenceToken"],
            vendor_name="Acme Global Enterprise Inc.",
            tax_id="XX-XXX4910",
            routing_number="021000021",
            account_number="*****4321",
        )
        first = post_erp_ledger(**args)
        assert first["posted"] is True
        second = post_erp_ledger(**args)
        assert second["posted"] is False
        assert second["code"] == "EVIDENCE_REPLAY"

    def test_post_rejects_stale_evidence(self):
        vendor, bank = _passing_pair()
        expire_evidence_for_tests(vendor["evidenceToken"])
        result = post_erp_ledger(
            "INV-1",
            "VEND-001",
            14500.0,
            vendor_evidence_token=vendor["evidenceToken"],
            bank_evidence_token=bank["evidenceToken"],
            vendor_name="Acme Global Enterprise Inc.",
            tax_id="XX-XXX4910",
            routing_number="021000021",
            account_number="*****4321",
        )
        assert result["posted"] is False
        assert result["code"] == "EVIDENCE_STALE"

    def test_post_rejects_mismatched_bound_data(self):
        vendor, bank = _passing_pair()
        result = post_erp_ledger(
            "INV-1",
            "VEND-001",
            14500.0,
            vendor_evidence_token=vendor["evidenceToken"],
            bank_evidence_token=bank["evidenceToken"],
            vendor_name="Acme Global Enterprise Inc.",
            tax_id="XX-XXX4910",
            routing_number="990011223",  # not what bank evidence bound
            account_number="*****4321",
        )
        assert result["posted"] is False
        assert result["code"] == "EVIDENCE_DATA_MISMATCH"

    def test_post_rejects_failed_check_evidence(self):
        vendor, bank = _passing_pair()
        mark_evidence_failed_for_tests(bank["evidenceToken"])
        result = post_erp_ledger(
            "INV-1",
            "VEND-001",
            14500.0,
            vendor_evidence_token=vendor["evidenceToken"],
            bank_evidence_token=bank["evidenceToken"],
            vendor_name="Acme Global Enterprise Inc.",
            tax_id="XX-XXX4910",
            routing_number="021000021",
            account_number="*****4321",
        )
        assert result["posted"] is False
        assert result["code"] == "EVIDENCE_FAILED_CHECK"

    def test_post_rejects_unknown_evidence_token(self):
        vendor, bank = _passing_pair()
        result = post_erp_ledger(
            "INV-1",
            "VEND-001",
            14500.0,
            vendor_evidence_token=vendor["evidenceToken"],
            bank_evidence_token="ev_bank_not-real",
            vendor_name="Acme Global Enterprise Inc.",
            tax_id="XX-XXX4910",
            routing_number="021000021",
            account_number="*****4321",
        )
        assert result["posted"] is False
        assert result["code"] == "EVIDENCE_UNKNOWN"

    def test_post_rejects_swapped_evidence_kinds(self):
        vendor, bank = _passing_pair()
        result = post_erp_ledger(
            "INV-1",
            "VEND-001",
            14500.0,
            vendor_evidence_token=bank["evidenceToken"],
            bank_evidence_token=vendor["evidenceToken"],
            vendor_name="Acme Global Enterprise Inc.",
            tax_id="XX-XXX4910",
            routing_number="021000021",
            account_number="*****4321",
        )
        assert result["posted"] is False
        assert result["code"] == "EVIDENCE_KIND_MISMATCH"


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
                assert "evidenceToken" in vendor_data

                bank = await client.call_tool(
                    "check_bank_routing",
                    {
                        "vendorId": "VEND-001",
                        "routingNumber": "021000021",
                        "accountNumber": "*****4321",
                    },
                )
                assert bank.data["isMatch"] is True
                assert "evidenceToken" in bank.data

                ledger = await client.call_tool(
                    "post_erp_ledger",
                    {
                        "invoiceId": "INV-2026-1042",
                        "vendorId": "VEND-001",
                        "amount": 14500.0,
                        "vendorEvidenceToken": vendor_data["evidenceToken"],
                        "bankEvidenceToken": bank.data["evidenceToken"],
                        "vendorName": "Acme Global Enterprise Inc.",
                        "taxId": "XX-XXX4910",
                        "routingNumber": "021000021",
                        "accountNumber": "*****4321",
                    },
                )
                assert ledger.data["posted"] is True

                # Direct post without evidence must fail at the tool layer
                with pytest.raises(Exception) as exc_info:
                    await client.call_tool(
                        "post_erp_ledger",
                        {
                            "invoiceId": "INV-BARE",
                            "vendorId": "VEND-001",
                            "amount": 100.0,
                        },
                    )
                assert "evidence" in str(exc_info.value).lower() or "rejected" in str(
                    exc_info.value
                ).lower()

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
