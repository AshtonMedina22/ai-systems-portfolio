"""Tests for real pandas migration ETL + SQL tenant isolation."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

os.environ["MIGRATE_SQLITE_MEMORY"] = "1"

from migrate_pipeline import (  # noqa: E402
    DEMO_TENANT_SCHEMA,
    TenantStore,
    apply_column_map,
    map_columns,
    normalize_tax_id,
    normalize_zip,
    run_migration,
    sanitize_frame,
)


def _actions(events: list[dict]) -> list[str]:
    out = []
    for e in events:
        action = (e.get("data") or {}).get("action")
        if action:
            out.append(action)
    return out


class TestPandasHelpers:
    def test_map_messy_headers(self):
        mapping, unmapped = map_columns(
            ["Loc#", "Site Name", "ZipCode", "EIN", "Email", "junk"]
        )
        assert mapping["Loc#"] == "location_id"
        assert mapping["Site Name"] == "location_name"
        assert mapping["ZipCode"] == "zip"
        assert "junk" in unmapped

    def test_normalize_zip_plus4(self):
        value, normalized, warning = normalize_zip("48226-1234")
        assert value == "48226"
        assert normalized is True
        assert warning is not None

    def test_normalize_tax_id_digits(self):
        value, warning = normalize_tax_id("362847193")
        assert value == "36-2847193"
        assert warning is not None

    def test_sanitize_flags_missing_email(self):
        df = pd.DataFrame(
            [
                {
                    "location_id": "1",
                    "location_name": "Hub",
                    "address": "1 Main",
                    "city": "Chicago",
                    "state": "IL",
                    "zip": "60607",
                    "tax_id": "36-2847193",
                    "contact_email": "",
                }
            ]
        )
        cleaned, issues, _, _ = sanitize_frame(df)
        assert any("contact email missing" in i for i in issues)
        assert cleaned.iloc[0]["contact_email"] == ""


class TestMigrationPipeline:
    def test_clean_cutover_writes_sqlite_schema(self):
        events = list(
            run_migration(dataset_key="clean", row_count=12)
        )
        assert "CUTOVER_COMPLETE" in _actions(events)
        backends = [
            (e.get("data") or {}).get("backend")
            for e in events
            if (e.get("data") or {}).get("backend")
        ]
        assert "sqlite" in backends

        # Verify rows landed in attached tenant schema
        store = TenantStore()
        assert store.backend == "sqlite"
        meta = store.provision_and_write(
            DEMO_TENANT_SCHEMA,
            pd.DataFrame(
                [
                    {
                        "location_id": "T-1",
                        "location_name": "Test",
                        "address": "1",
                        "city": "X",
                        "state": "IL",
                        "zip": "60607",
                        "tax_id": "36-2847193",
                        "contact_email": "a@b.co",
                    }
                ]
            ),
            "Test Client",
        )
        assert meta["inserted"] == 1
        assert meta["backend"] == "sqlite"
        store.close()

    def test_corrupted_blocks_cutover(self):
        events = list(
            run_migration(dataset_key="corrupted", row_count=8)
        )
        assert "CUTOVER_BLOCKED" in _actions(events)
        assert "CUTOVER_COMPLETE" not in _actions(events)
        assert any(
            e.get("data", {}).get("method") == "pandas.DataFrame"
            or "pandas" in str(e.get("data", {}).get("method", "")).lower()
            for e in events
        )

    def test_csv_upload_path(self):
        csv_text = (
            "location_id,location_name,address,city,state,zip,tax_id,contact_email\n"
            "U-1,Upload Hub,1 Lake,Chicago,IL,60607,36-2847193,hub@example.com\n"
        )
        events = list(
            run_migration(csv_text=csv_text, client_name="Upload Co")
        )
        assert "CUTOVER_COMPLETE" in _actions(events)
        complete = next(
            e for e in events if e.get("data", {}).get("action") == "CUTOVER_COMPLETE"
        )
        assert complete["data"]["rowCount"] == 1

    def test_apply_column_map_uses_aliases(self):
        df = pd.DataFrame([{"Loc#": "9", "Site Name": "X", "ZipCode": "60607"}])
        mapping, _ = map_columns(df.columns)
        mapped = apply_column_map(df, mapping)
        assert "location_id" in mapped.columns
        assert mapped.iloc[0]["location_id"] == "9"


class TestStartEventStack:
    def test_start_event_lists_python_pandas_sqlite(self):
        events = list(run_migration(dataset_key="clean", row_count=4))
        start = events[0]
        stack = start["data"]["stack"]
        assert "Python" in stack
        assert "Pandas" in stack
        assert "SQLite" in stack or "PostgreSQL" in stack
