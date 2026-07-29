/**
 * Production reference config for a privacy proxy deployment.
 * Unused while DEMO_MODE is mockup.
 */
export const privacyProductionConfig = {
  mode: "edge_middleware",
  persistence: "none",
  note: "Stateless scan at the network boundary; durable audit would ship to a separate log store.",
} as const;
