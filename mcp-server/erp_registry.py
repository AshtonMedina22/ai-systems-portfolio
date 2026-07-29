"""Shared enterprise vendor registry and anti-fraud logic for PayFlow MCP tools."""

from __future__ import annotations

import secrets
import time
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

# Server-owned verification evidence (TTL + single-use)
EVIDENCE_TTL_SECONDS = 300
FUZZY_NAME_THRESHOLD = 0.82


@dataclass
class EvidenceRecord:
    token: str
    kind: str  # "vendor" | "bank"
    passed: bool
    bound: dict[str, Any]
    created_at: float
    expires_at: float
    consumed: bool = False


_EVIDENCE_STORE: dict[str, EvidenceRecord] = {}


def fuzzy_name_score(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _issue_evidence(
    kind: str, passed: bool, bound: dict[str, Any]
) -> str:
    token = f"ev_{kind}_{secrets.token_urlsafe(18)}"
    now = time.time()
    _EVIDENCE_STORE[token] = EvidenceRecord(
        token=token,
        kind=kind,
        passed=passed,
        bound=dict(bound),
        created_at=now,
        expires_at=now + EVIDENCE_TTL_SECONDS,
        consumed=False,
    )
    return token


def _validate_evidence(
    token: str | None,
    *,
    expected_kind: str,
    required_bound: dict[str, Any],
) -> dict[str, Any] | None:
    """Return an error dict if invalid; None if the token may be consumed."""
    if not token:
        return {
            "posted": False,
            "error": True,
            "code": "EVIDENCE_ABSENT",
            "message": (
                f"Ledger post rejected: missing {expected_kind} verification "
                "evidence. Both vendor and bank checks must pass on the server "
                "before posting."
            ),
        }

    record = _EVIDENCE_STORE.get(token)
    if record is None:
        return {
            "posted": False,
            "error": True,
            "code": "EVIDENCE_UNKNOWN",
            "message": "Ledger post rejected: verification evidence is unknown.",
        }

    if record.kind != expected_kind:
        return {
            "posted": False,
            "error": True,
            "code": "EVIDENCE_KIND_MISMATCH",
            "message": (
                f"Ledger post rejected: expected {expected_kind} evidence, "
                f"got {record.kind}."
            ),
        }

    if not record.passed:
        return {
            "posted": False,
            "error": True,
            "code": "EVIDENCE_FAILED_CHECK",
            "message": (
                "Ledger post rejected: evidence belongs to a failed check."
            ),
        }

    if record.consumed:
        return {
            "posted": False,
            "error": True,
            "code": "EVIDENCE_REPLAY",
            "message": (
                "Ledger post rejected: verification evidence was already used."
            ),
        }

    if time.time() > record.expires_at:
        return {
            "posted": False,
            "error": True,
            "code": "EVIDENCE_STALE",
            "message": (
                "Ledger post rejected: verification evidence has expired."
            ),
        }

    for key, expected in required_bound.items():
        actual = record.bound.get(key)
        if actual != expected:
            return {
                "posted": False,
                "error": True,
                "code": "EVIDENCE_DATA_MISMATCH",
                "message": (
                    "Ledger post rejected: evidence does not bind to the "
                    f"submitted {key}."
                ),
                "field": key,
            }

    return None


def verify_vendor_entity(vendor_name: str, tax_id: str) -> dict[str, Any]:
    """Exact tax-ID match or fuzzy official-name match against enterprise registry."""
    tax_match = next((v for v in ERP_VENDOR_REGISTRY if v.tax_id == tax_id), None)
    if tax_match:
        name_score = fuzzy_name_score(vendor_name, tax_match.official_name)
        token = _issue_evidence(
            "vendor",
            True,
            {
                "vendorName": vendor_name,
                "taxId": tax_id,
                "vendorId": tax_match.vendor_id,
            },
        )
        return {
            "status": "MATCH_FOUND",
            "vendorId": tax_match.vendor_id,
            "officialName": tax_match.official_name,
            "confidenceScore": round(max(0.95, name_score), 2),
            "matchMethod": "TAX_ID_EXACT",
            "nameSimilarity": round(name_score, 3),
            "registryStatus": tax_match.status,
            "evidenceToken": token,
            "evidenceKind": "vendor",
            "evidenceExpiresInSeconds": EVIDENCE_TTL_SECONDS,
        }

    scored = [
        (v, fuzzy_name_score(vendor_name, v.official_name))
        for v in ERP_VENDOR_REGISTRY
    ]
    scored.sort(key=lambda item: item[1], reverse=True)
    best, score = scored[0]

    if score >= FUZZY_NAME_THRESHOLD:
        token = _issue_evidence(
            "vendor",
            True,
            {
                "vendorName": vendor_name,
                "taxId": tax_id,
                "vendorId": best.vendor_id,
            },
        )
        return {
            "status": "MATCH_FOUND",
            "vendorId": best.vendor_id,
            "officialName": best.official_name,
            "confidenceScore": round(score, 2),
            "matchMethod": "FUZZY_NAME",
            "nameSimilarity": round(score, 3),
            "registryStatus": best.status,
            "evidenceToken": token,
            "evidenceKind": "vendor",
            "evidenceExpiresInSeconds": EVIDENCE_TTL_SECONDS,
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
            "message": f"Vendor ID {vendor_id} not found in the enterprise registry.",
        }

    is_routing_match = record.approved_routing_number == routing_number
    is_account_match = record.approved_account_number == account_number

    if is_routing_match and is_account_match:
        token = _issue_evidence(
            "bank",
            True,
            {
                "vendorId": vendor_id,
                "routingNumber": routing_number,
                "accountNumber": account_number,
            },
        )
        return {
            "isMatch": True,
            "riskLevel": "LOW",
            "riskScore": 0.02,
            "message": "Bank details match the verified primary enterprise payment profile.",
            "evidenceToken": token,
            "evidenceKind": "bank",
            "evidenceExpiresInSeconds": EVIDENCE_TTL_SECONDS,
        }

    return {
        "isMatch": False,
        "riskLevel": "CRITICAL_FRAUD_ALERT",
        "riskScore": 0.96,
        "expectedRouting": record.approved_routing_number,
        "expectedAccount": record.approved_account_number,
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
    *,
    vendor_evidence_token: str | None = None,
    bank_evidence_token: str | None = None,
    vendor_name: str | None = None,
    tax_id: str | None = None,
    routing_number: str | None = None,
    account_number: str | None = None,
) -> dict[str, Any]:
    """Post only when both server-owned check evidences are valid and bound."""
    if not vendor_name or not tax_id or not routing_number or not account_number:
        return {
            "posted": False,
            "error": True,
            "code": "POST_PAYLOAD_INCOMPLETE",
            "message": (
                "Ledger post rejected: invoice, vendor, and bank fields are "
                "required so evidence can be bound to the submitted data."
            ),
        }

    vendor_err = _validate_evidence(
        vendor_evidence_token,
        expected_kind="vendor",
        required_bound={
            "vendorName": vendor_name,
            "taxId": tax_id,
            "vendorId": vendor_id,
        },
    )
    if vendor_err:
        return vendor_err

    bank_err = _validate_evidence(
        bank_evidence_token,
        expected_kind="bank",
        required_bound={
            "vendorId": vendor_id,
            "routingNumber": routing_number,
            "accountNumber": account_number,
        },
    )
    if bank_err:
        return bank_err

    # Consume both tokens before appending the ledger row (replay-resistant).
    assert vendor_evidence_token is not None
    assert bank_evidence_token is not None
    _EVIDENCE_STORE[vendor_evidence_token].consumed = True
    _EVIDENCE_STORE[bank_evidence_token].consumed = True

    entry = {
        "ledgerEntryId": f"LED-{len(_LEDGER_ENTRIES) + 1001}",
        "invoiceId": invoice_id,
        "vendorId": vendor_id,
        "amount": amount,
        "currency": currency,
        "status": "PAYMENT_SCHEDULED",
        "glAccount": "2100-AP-TRADE",
        "evidenceConsumed": {
            "vendor": vendor_evidence_token,
            "bank": bank_evidence_token,
        },
    }
    _LEDGER_ENTRIES.append(entry)
    return {
        "posted": True,
        "action": "POST_TO_ERP_LEDGER",
        **entry,
    }


def get_vendor_approved_profile(vendor_id: str) -> dict[str, Any] | None:
    record = next(
        (v for v in ERP_VENDOR_REGISTRY if v.vendor_id == vendor_id), None
    )
    if record is None:
        return None
    return {
        "vendorId": record.vendor_id,
        "officialName": record.official_name,
        "approvedRoutingNumber": record.approved_routing_number,
        "approvedAccountNumber": record.approved_account_number,
        "status": record.status,
    }


def expire_evidence_for_tests(token: str) -> None:
    """Force an evidence token past TTL (tests only)."""
    record = _EVIDENCE_STORE.get(token)
    if record:
        record.expires_at = time.time() - 1


def mark_evidence_failed_for_tests(token: str) -> None:
    """Flip passed=False on stored evidence (tests only)."""
    record = _EVIDENCE_STORE.get(token)
    if record:
        record.passed = False


def reset_ledger_for_tests() -> None:
    _LEDGER_ENTRIES.clear()
    _EVIDENCE_STORE.clear()
