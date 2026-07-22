"""Shared ERP vendor registry and anti-fraud business logic for PayFlow MCP tools."""

from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any


@dataclass(frozen=True)
class VendorRecord:
    vendor_id: str
    official_name: str
    tax_id: str
    approved_routing_number: str
    approved_account_number: str
    status: str


ERP_VENDOR_REGISTRY: list[VendorRecord] = [
    VendorRecord(
        vendor_id="VEND-001",
        official_name="Acme Global Enterprise Inc.",
        tax_id="XX-XXX4910",
        approved_routing_number="021000021",
        approved_account_number="*****4321",
        status="ACTIVE_VERIFIED",
    ),
    VendorRecord(
        vendor_id="VEND-002",
        official_name="Nexus Logistics Corp",
        tax_id="XX-XXX8812",
        approved_routing_number="121000358",
        approved_account_number="*****1102",
        status="ACTIVE_VERIFIED",
    ),
]

# In-memory ledger for demo postings (reset per process)
_LEDGER_ENTRIES: list[dict[str, Any]] = []

FUZZY_NAME_THRESHOLD = 0.82


def fuzzy_name_score(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def verify_vendor_entity(vendor_name: str, tax_id: str) -> dict[str, Any]:
    """Exact tax-ID match or fuzzy official-name match against ERP registry."""
    tax_match = next((v for v in ERP_VENDOR_REGISTRY if v.tax_id == tax_id), None)
    if tax_match:
        name_score = fuzzy_name_score(vendor_name, tax_match.official_name)
        return {
            "status": "MATCH_FOUND",
            "vendorId": tax_match.vendor_id,
            "officialName": tax_match.official_name,
            "confidenceScore": round(max(0.95, name_score), 2),
            "matchMethod": "TAX_ID_EXACT",
            "nameSimilarity": round(name_score, 3),
            "registryStatus": tax_match.status,
        }

    scored = [
        (v, fuzzy_name_score(vendor_name, v.official_name))
        for v in ERP_VENDOR_REGISTRY
    ]
    scored.sort(key=lambda item: item[1], reverse=True)
    best, score = scored[0]

    if score >= FUZZY_NAME_THRESHOLD:
        return {
            "status": "MATCH_FOUND",
            "vendorId": best.vendor_id,
            "officialName": best.official_name,
            "confidenceScore": round(score, 2),
            "matchMethod": "FUZZY_NAME",
            "nameSimilarity": round(score, 3),
            "registryStatus": best.status,
        }

    return {
        "status": "UNREGISTERED_ENTITY",
        "confidenceScore": round(score, 2),
        "matchMethod": "NO_MATCH",
        "nameSimilarity": round(score, 3),
        "closestCandidate": best.official_name,
        "recommendation": "REJECT_PAYMENT_AND_FLAG",
    }


def check_bank_routing(
    vendor_id: str, routing_number: str, account_number: str
) -> dict[str, Any]:
    record = next(
        (v for v in ERP_VENDOR_REGISTRY if v.vendor_id == vendor_id), None
    )
    if record is None:
        return {
            "error": True,
            "code": -32602,
            "message": f"Vendor ID {vendor_id} not found in ERP.",
        }

    is_routing_match = record.approved_routing_number == routing_number
    is_account_match = record.approved_account_number == account_number

    if is_routing_match and is_account_match:
        return {
            "isMatch": True,
            "riskLevel": "LOW",
            "riskScore": 0.02,
            "message": "Bank details match verified primary ERP account profile.",
        }

    return {
        "isMatch": False,
        "riskLevel": "CRITICAL_FRAUD_ALERT",
        "riskScore": 0.96,
        "expectedRouting": record.approved_routing_number,
        "providedRouting": routing_number,
        "message": (
            "UNAUTHORIZED BANK ROUTING DETECTED: Bank routing number does not "
            "match registered vendor profile."
        ),
    }


def post_erp_ledger(
    invoice_id: str,
    vendor_id: str,
    amount: float,
    currency: str = "USD",
) -> dict[str, Any]:
    entry = {
        "ledgerEntryId": f"LED-{len(_LEDGER_ENTRIES) + 1001}",
        "invoiceId": invoice_id,
        "vendorId": vendor_id,
        "amount": amount,
        "currency": currency,
        "status": "PAYMENT_SCHEDULED",
        "glAccount": "2100-AP-TRADE",
    }
    _LEDGER_ENTRIES.append(entry)
    return {
        "posted": True,
        "action": "POST_TO_ERP_LEDGER",
        **entry,
    }


def reset_ledger_for_tests() -> None:
    _LEDGER_ENTRIES.clear()
