/**
 * Production config for Workflow & Approvals.
 * Unused while DEMO_MODE === "mockup". See ARCHITECTURE.md.
 */

export type CheckpointBackend = "memory" | "sqlite" | "postgres";

export const workflowProductionConfig = {
  graphEntrypoint: "mcp-server/workflow_graph.py",
  checkpointBackend: "postgres" as CheckpointBackend,
  checkpointUrlEnv: "WORKFLOW_CHECKPOINT_URL",
  exampleCheckpointUrl:
    "postgres://workflow_user:SECRET@db.example:5432/workflow_ckpt",
  interruptThresholdUsd: 10_000,
  approvalTimeoutMs: 15 * 60 * 1000,
  resumeQueueEnv: "WORKFLOW_RESUME_QUEUE_URL",
} as const;

export type WorkflowProductionConfig = typeof workflowProductionConfig;
