export type WorkflowScenarioKey = "contract_payout" | "inventory_realloc";

export type WorkflowNodeId =
  | "intake"
  | "compliance_check"
  | "financial_threshold"
  | "awaiting_approval"
  | "final_execution"
  | "completed"
  | "rejected";

export type WorkflowDecision = "approve" | "reject";

export interface WorkflowRequest {
  requestId: string;
  title: string;
  subject: string;
  site: string;
  amount: number | null;
  category: string;
  requiresManagerSignOff: boolean;
  scenario: WorkflowScenarioKey;
  summary: string;
}

export interface WorkflowAuditEntry {
  node: WorkflowNodeId;
  at: string;
  detail: string;
}

/** Payouts above this amount pause for manager sign-off. */
export const FINANCIAL_THRESHOLD_USD = 10_000;

export const SAMPLE_WORKFLOWS: Record<WorkflowScenarioKey, WorkflowRequest> = {
  contract_payout: {
    requestId: "WF-2026-0887",
    title: "Approve Vendor Contract & Payout",
    subject: "Lone Star Event Partners",
    site: "San Antonio - West",
    amount: 24_500,
    category: "Contract payout",
    requiresManagerSignOff: true,
    scenario: "contract_payout",
    summary:
      "Vendor contract payout over $10,000 - should pause for manager sign-off before money moves.",
  },
  inventory_realloc: {
    requestId: "WF-2026-0531",
    title: "Initiate Automated Inventory Re-allocation",
    subject: "Cooler units - Austin North to Dallas Metro",
    site: "Multi-site (Austin -> Dallas)",
    amount: null,
    category: "Inventory move",
    requiresManagerSignOff: false,
    scenario: "inventory_realloc",
    summary:
      "Moves stock between sites under the auto-transfer limit - should finish without a manager pause.",
  },
};
