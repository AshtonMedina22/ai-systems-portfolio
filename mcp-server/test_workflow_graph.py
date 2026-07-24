"""Tests for LangGraph workflow with manager interrupt."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from workflow_graph import (  # noqa: E402
    FINANCIAL_THRESHOLD_USD,
    build_graph,
    initial_state,
    run_workflow_collect,
)


def _actions(events: list[dict]) -> list[str]:
    out = []
    for e in events:
        action = (e.get("data") or {}).get("action")
        if action:
            out.append(action)
    return out


class TestWorkflowGraph:
    def test_inventory_completes_without_pause(self):
        events = run_workflow_collect("inventory_realloc")
        actions = _actions(events)
        assert "AWAITING_APPROVAL" not in actions
        assert "COMPLETED" in actions
        assert any(e.get("data", {}).get("runtime") == "langgraph" for e in events)

    def test_contract_payout_pauses_for_approval(self):
        events = run_workflow_collect("contract_payout")
        actions = _actions(events)
        assert "AWAITING_APPROVAL" in actions
        assert "COMPLETED" not in actions
        pause = next(
            e
            for e in events
            if e.get("data", {}).get("action") == "AWAITING_APPROVAL"
        )
        assert pause["data"]["amount"] > FINANCIAL_THRESHOLD_USD
        assert pause["data"]["checkpoint"] is True

    def test_contract_payout_approve_resumes(self):
        events = run_workflow_collect("contract_payout", decision="approve")
        actions = _actions(events)
        assert "AWAITING_APPROVAL" in actions
        assert "APPROVED" in actions
        assert "COMPLETED" in actions
        assert "REJECTED" not in actions

    def test_contract_payout_reject_stops(self):
        events = run_workflow_collect("contract_payout", decision="reject")
        actions = _actions(events)
        assert "AWAITING_APPROVAL" in actions
        assert "REJECTED" in actions
        assert "COMPLETED" not in actions

    def test_graph_builds_with_checkpointer(self):
        app = build_graph()
        state = initial_state("inventory_realloc", session_id="test-thread-1")
        result = app.invoke(
            state, {"configurable": {"thread_id": "test-thread-1"}}
        )
        assert result.get("request_id") == "WF-2026-0531"
