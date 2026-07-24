"""
Reference LangGraph workflow. Not what the public site runs.

Site: DEMO_MODE=mockup -> lib/workflow/state-machine.ts via getWorkflowEngine()
Prod config shape: lib/workflow/config.ts

Graph:
  intake -> compliance_check -> financial_threshold
         -> [if over threshold] request_approval -> await_manager
         -> final_execution -> END

await_manager uses langgraph.types.interrupt(); CLI resumes via stdin JSON.
Emits NDJSON LogEntry lines on stdout for a future Next.js SSE bridge.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Literal, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

FINANCIAL_THRESHOLD_USD = 10_000

SCENARIOS: dict[str, dict[str, Any]] = {
    "contract_payout": {
        "requestId": "WF-2026-0887",
        "title": "Approve Vendor Contract & Payout",
        "subject": "Lone Star Event Partners",
        "site": "San Antonio - West",
        "amount": 24_500,
        "category": "Contract payout",
        "scenario": "contract_payout",
    },
    "inventory_realloc": {
        "requestId": "WF-2026-0531",
        "title": "Initiate Automated Inventory Re-allocation",
        "subject": "Cooler units - Austin North to Dallas Metro",
        "site": "Multi-site (Austin -> Dallas)",
        "amount": None,
        "category": "Inventory move",
        "scenario": "inventory_realloc",
    },
}

EmitFn = Callable[[dict[str, Any]], None]
_EMITTER: EmitFn | None = None


def set_emitter(fn: EmitFn | None) -> None:
    global _EMITTER
    _EMITTER = fn


class WorkflowState(TypedDict, total=False):
    session_id: str
    scenario: str
    request_id: str
    title: str
    subject: str
    site: str
    amount: float | None
    category: str
    trail: list[dict[str, Any]]
    decision: str | None
    over_threshold: bool
    events: list[dict[str, Any]]


def _now_ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def create_log_entry(
    level: str,
    source: str,
    message: str,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "id": f"log-{int(time.time() * 1000)}-{uuid.uuid4().hex[:5]}",
        "timestamp": _now_ts(),
        "level": level,
        "source": source,
        "message": message,
        "data": data or {},
    }


def _audit(trail: list[dict[str, Any]], node: str, detail: str) -> dict[str, Any]:
    entry = {
        "node": node,
        "at": datetime.now(timezone.utc).isoformat(),
        "detail": detail,
    }
    trail.append(entry)
    return entry


def _emit(state: WorkflowState, entry: dict[str, Any]) -> WorkflowState:
    events = list(state.get("events") or [])
    events.append(entry)
    state = {**state, "events": events}
    if _EMITTER is not None:
        _EMITTER(entry)
    return state


def node_intake(state: WorkflowState) -> WorkflowState:
    trail = list(state.get("trail") or [])
    entry = _audit(
        trail,
        "intake",
        f"Intake recorded for {state['subject']} at {state['site']}.",
    )
    state = {**state, "trail": trail}
    state = _emit(
        state,
        create_log_entry(
            "info",
            "step:intake->intake",
            entry["detail"],
            {
                "node": "intake",
                "from": "intake",
                "to": "intake",
                "audit": entry,
                "pattern": "langgraph-checkpoint",
            },
        ),
    )
    state = _emit(
        state,
        create_log_entry(
            "tool_call",
            "node:intake",
            "Pulling request packet and routing to the next step...",
            {
                "method": "graph.invoke",
                "node": "intake",
                "edges": ["compliance_check"],
                "payload": {
                    "requestId": state["request_id"],
                    "category": state["category"],
                },
            },
        ),
    )
    state = _emit(
        state,
        create_log_entry(
            "tool_result",
            "node:intake",
            "Intake complete. Handing off to compliance check.",
            {"node": "intake", "status": "ok"},
        ),
    )
    return state


def node_compliance(state: WorkflowState) -> WorkflowState:
    trail = list(state.get("trail") or [])
    entry = _audit(
        trail,
        "compliance_check",
        "Compliance check started - confirming site policy and required fields.",
    )
    state = {**state, "trail": trail}
    state = _emit(
        state,
        create_log_entry(
            "info",
            "step:intake->compliance_check",
            entry["detail"],
            {
                "node": "compliance_check",
                "from": "intake",
                "to": "compliance_check",
                "audit": entry,
                "pattern": "langgraph-checkpoint",
            },
        ),
    )
    state = _emit(
        state,
        create_log_entry(
            "tool_call",
            "node:compliance_check",
            "Running compliance checklist for this request type...",
            {
                "method": "graph.invoke",
                "node": "compliance_check",
                "checks": ["site_policy", "required_fields", "vendor_or_sku_present"],
            },
        ),
    )
    if state.get("scenario") == "inventory_realloc":
        msg = "Inventory move is within site transfer policy. No blocked items."
        policy = "auto_transfer"
    else:
        msg = "Vendor contract packet looks complete. Compliance fields passed."
        policy = "vendor_contract"
    state = _emit(
        state,
        create_log_entry(
            "tool_result",
            "node:compliance_check",
            msg,
            {"node": "compliance_check", "status": "ok", "policy": policy},
        ),
    )
    return state


def node_financial_threshold(state: WorkflowState) -> WorkflowState:
    trail = list(state.get("trail") or [])
    amount = state.get("amount")
    over = isinstance(amount, (int, float)) and float(amount) > FINANCIAL_THRESHOLD_USD
    entry = _audit(
        trail,
        "financial_threshold",
        f"Checking financial threshold (pause if amount > ${FINANCIAL_THRESHOLD_USD:,}).",
    )
    state = {**state, "trail": trail, "over_threshold": over}

    state = _emit(
        state,
        create_log_entry(
            "info",
            "step:compliance_check->financial_threshold",
            entry["detail"],
            {
                "node": "financial_threshold",
                "from": "compliance_check",
                "to": "financial_threshold",
                "audit": entry,
                "pattern": "langgraph-checkpoint",
            },
        ),
    )

    if over:
        detail = (
            f"Amount ${float(amount):,.0f} is over ${FINANCIAL_THRESHOLD_USD:,} - "
            "checkpoint required."
        )
    elif amount is None:
        detail = "No cash payout on this path - threshold check skipped."
    else:
        detail = (
            f"Amount ${float(amount):,.0f} is under the "
            f"${FINANCIAL_THRESHOLD_USD:,} limit."
        )

    state = _emit(
        state,
        create_log_entry(
            "tool_call",
            "node:financial_threshold",
            detail,
            {
                "method": "graph.invoke",
                "node": "financial_threshold",
                "amount": amount,
                "threshold": FINANCIAL_THRESHOLD_USD,
                "overThreshold": over,
            },
        ),
    )

    if not over:
        state = _emit(
            state,
            create_log_entry(
                "tool_result",
                "node:financial_threshold",
                "Threshold clear - no manager pause on this path.",
                {
                    "node": "financial_threshold",
                    "status": "ok",
                    "amount": amount,
                    "threshold": FINANCIAL_THRESHOLD_USD,
                },
            ),
        )
    return state


def node_request_approval(state: WorkflowState) -> WorkflowState:
    """Emit pause events BEFORE interrupt so the UI can show Approve / Reject."""
    trail = list(state.get("trail") or [])
    amount = state.get("amount") or 0
    _audit(
        trail,
        "awaiting_approval",
        f"Paused for manager sign-off on ${float(amount):,.0f} payout.",
    )
    state = {**state, "trail": trail}
    state = _emit(
        state,
        create_log_entry(
            "warning",
            "node:awaiting_approval",
            (
                f"Workflow paused. Manager sign-off needed before the "
                f"${float(amount):,.0f} payout can run."
            ),
            {
                "action": "AWAITING_APPROVAL",
                "sessionId": state["session_id"],
                "amount": amount,
                "threshold": FINANCIAL_THRESHOLD_USD,
                "checkpoint": True,
                "node": "awaiting_approval",
                "auditTrail": trail,
                "runtime": "langgraph",
            },
        ),
    )
    return state


def node_await_manager(state: WorkflowState) -> WorkflowState:
    """LangGraph interrupt checkpoint - blocks until Command(resume=...)."""
    amount = state.get("amount")
    decision = interrupt(
        {
            "type": "manager_approval",
            "sessionId": state["session_id"],
            "amount": amount,
            "threshold": FINANCIAL_THRESHOLD_USD,
        }
    )
    trail = list(state.get("trail") or [])

    if decision == "reject":
        _audit(trail, "rejected", "Manager rejected the payout. Workflow stopped.")
        state = {**state, "trail": trail, "decision": "reject"}
        state = _emit(
            state,
            create_log_entry(
                "error",
                "workflow:checkpoint",
                f"Manager rejected {state['request_id']}. Payout did not run.",
                {
                    "action": "REJECTED",
                    "sessionId": state["session_id"],
                    "node": "rejected",
                    "auditTrail": trail,
                },
            ),
        )
        return state

    state = {**state, "trail": trail, "decision": "approve"}
    state = _emit(
        state,
        create_log_entry(
            "success",
            "workflow:checkpoint",
            "Manager approved. Resuming from checkpoint toward final execution.",
            {
                "action": "APPROVED",
                "sessionId": state["session_id"],
                "node": "financial_threshold",
            },
        ),
    )
    return state


def node_final_execution(state: WorkflowState) -> WorkflowState:
    if state.get("decision") == "reject":
        return state

    trail = list(state.get("trail") or [])
    from_node = (
        "awaiting_approval" if state.get("over_threshold") else "financial_threshold"
    )
    entry = _audit(trail, "final_execution", "Final execution node started.")
    state = {**state, "trail": trail}
    state = _emit(
        state,
        create_log_entry(
            "info",
            f"step:{from_node}->final_execution",
            entry["detail"],
            {
                "node": "final_execution",
                "from": from_node,
                "to": "final_execution",
                "audit": entry,
                "pattern": "langgraph-checkpoint",
            },
        ),
    )

    amount = state.get("amount")
    if state.get("scenario") == "inventory_realloc":
        state = _emit(
            state,
            create_log_entry(
                "tool_call",
                "node:final_execution",
                "Scheduling inventory transfer between sites...",
                {
                    "method": "graph.invoke",
                    "node": "final_execution",
                    "operation": "inventory_reallocation",
                    "subject": state["subject"],
                },
            ),
        )
        state = _emit(
            state,
            create_log_entry(
                "tool_result",
                "node:final_execution",
                "Transfer ticket opened. Stock move queued for warehouse pick.",
                {
                    "node": "final_execution",
                    "ticketId": f"INV-XFER-{state['request_id'][-4:]}",
                    "status": "queued",
                },
            ),
        )
        done_msg = (
            f"Inventory re-allocation {state['request_id']} finished. "
            "Handoffs stayed visible end to end."
        )
    else:
        state = _emit(
            state,
            create_log_entry(
                "tool_call",
                "node:final_execution",
                f"Releasing ${float(amount or 0):,.0f} contract payout...",
                {
                    "method": "graph.invoke",
                    "node": "final_execution",
                    "operation": "contract_payout",
                    "amount": amount,
                    "vendor": state["subject"],
                },
            ),
        )
        state = _emit(
            state,
            create_log_entry(
                "tool_result",
                "node:final_execution",
                "Payout instruction posted to the payment queue.",
                {
                    "node": "final_execution",
                    "paymentRef": f"PAY-{state['request_id'][-4:]}",
                    "status": "queued",
                    "amount": amount,
                },
            ),
        )
        done_msg = (
            f"Vendor contract payout {state['request_id']} finished "
            "after manager sign-off."
        )

    _audit(trail, "completed", "Workflow finished successfully.")
    state = {**state, "trail": trail}
    graph_nodes = [
        "intake",
        "compliance_check",
        "financial_threshold",
        *(["awaiting_approval"] if state.get("over_threshold") else []),
        "final_execution",
        "completed",
    ]
    state = _emit(
        state,
        create_log_entry(
            "success",
            "workflow:engine",
            done_msg,
            {
                "action": "COMPLETED",
                "sessionId": state["session_id"],
                "node": "completed",
                "auditTrail": trail,
                "graph": graph_nodes,
                "runtime": "langgraph",
            },
        ),
    )
    return state


def _after_threshold(
    state: WorkflowState,
) -> Literal["request_approval", "final_execution"]:
    if state.get("over_threshold"):
        return "request_approval"
    return "final_execution"


def _after_manager(state: WorkflowState) -> Literal["final_execution", "__end__"]:
    if state.get("decision") == "reject":
        return "__end__"
    return "final_execution"


def build_graph():
    graph = StateGraph(WorkflowState)
    graph.add_node("intake", node_intake)
    graph.add_node("compliance_check", node_compliance)
    graph.add_node("financial_threshold", node_financial_threshold)
    graph.add_node("request_approval", node_request_approval)
    graph.add_node("await_manager", node_await_manager)
    graph.add_node("final_execution", node_final_execution)

    graph.add_edge(START, "intake")
    graph.add_edge("intake", "compliance_check")
    graph.add_edge("compliance_check", "financial_threshold")
    graph.add_conditional_edges(
        "financial_threshold",
        _after_threshold,
        {
            "request_approval": "request_approval",
            "final_execution": "final_execution",
        },
    )
    graph.add_edge("request_approval", "await_manager")
    graph.add_conditional_edges(
        "await_manager",
        _after_manager,
        {"final_execution": "final_execution", "__end__": END},
    )
    graph.add_edge("final_execution", END)

    return graph.compile(checkpointer=MemorySaver())


def initial_state(scenario_key: str, session_id: str | None = None) -> WorkflowState:
    if scenario_key not in SCENARIOS:
        raise ValueError(f"Unknown scenario: {scenario_key}")
    req = SCENARIOS[scenario_key]
    sid = session_id or f"wf-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}"
    return {
        "session_id": sid,
        "scenario": scenario_key,
        "request_id": req["requestId"],
        "title": req["title"],
        "subject": req["subject"],
        "site": req["site"],
        "amount": req["amount"],
        "category": req["category"],
        "trail": [],
        "decision": None,
        "over_threshold": False,
        "events": [],
    }


def drain_events(state: WorkflowState) -> list[dict[str, Any]]:
    events = list(state.get("events") or [])
    state["events"] = []
    return events


def _stdout_emitter(entry: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(entry, ensure_ascii=True) + "\n")
    sys.stdout.flush()


def run_workflow_cli(scenario_key: str, session_id: str | None = None) -> int:
    set_emitter(_stdout_emitter)
    app = build_graph()
    state = initial_state(scenario_key, session_id)
    config = {"configurable": {"thread_id": state["session_id"]}}

    _stdout_emitter(
        create_log_entry(
            "info",
            "workflow:session",
            f"Started workflow {state['request_id']} ({state['title']}).",
            {
                "sessionId": state["session_id"],
                "scenario": scenario_key,
                "requestId": state["request_id"],
                "amount": state.get("amount"),
                "site": state["site"],
                "runtime": "langgraph",
                "note": (
                    "Python LangGraph state machine with interrupt() checkpoint "
                    "for manager approval."
                ),
                "stack": ["Python", "LangGraph", "Next.js"],
            },
        )
    )

    try:
        app.invoke(state, config)
    except Exception:
        # Some langgraph versions surface interrupt differently; inspect state.
        pass

    snap = app.get_state(config)
    interrupted = bool(snap.next)

    if interrupted:
        line = sys.stdin.readline()
        if not line.strip():
            _stdout_emitter(
                create_log_entry(
                    "error",
                    "workflow:engine",
                    "No manager decision received on stdin.",
                    {
                        "action": "REJECTED",
                        "sessionId": state["session_id"],
                        "node": "rejected",
                    },
                )
            )
            set_emitter(None)
            return 1

        payload = json.loads(line)
        decision = payload.get("decision")
        if decision not in ("approve", "reject"):
            _stdout_emitter(
                create_log_entry(
                    "error",
                    "workflow:engine",
                    f"Invalid decision: {decision!r}",
                    {"sessionId": state["session_id"]},
                )
            )
            set_emitter(None)
            return 1

        app.invoke(Command(resume=decision), config)

    set_emitter(None)
    return 0


def run_workflow_collect(
    scenario_key: str,
    *,
    session_id: str | None = None,
    decision: str | None = None,
) -> list[dict[str, Any]]:
    """In-process helper for pytest."""
    collected: list[dict[str, Any]] = []

    def _collect(entry: dict[str, Any]) -> None:
        collected.append(entry)

    set_emitter(_collect)
    app = build_graph()
    state = initial_state(scenario_key, session_id)
    config = {"configurable": {"thread_id": state["session_id"]}}

    _collect(
        create_log_entry(
            "info",
            "workflow:session",
            f"Started workflow {state['request_id']} ({state['title']}).",
            {
                "sessionId": state["session_id"],
                "scenario": scenario_key,
                "runtime": "langgraph",
            },
        )
    )

    try:
        app.invoke(state, config)
    except Exception:
        pass

    snap = app.get_state(config)
    if snap.next:
        if decision not in ("approve", "reject"):
            set_emitter(None)
            return collected
        app.invoke(Command(resume=decision), config)

    set_emitter(None)
    return collected


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="LangGraph workflow demo")
    parser.add_argument(
        "--scenario",
        choices=list(SCENARIOS.keys()),
        default="contract_payout",
    )
    parser.add_argument("--session-id", type=str, default=None)
    args = parser.parse_args(argv)
    return run_workflow_cli(args.scenario, args.session_id)


if __name__ == "__main__":
    raise SystemExit(main())
