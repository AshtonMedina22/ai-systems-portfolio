// lib/payflow/types.ts

export interface InvoicePayload {
  invoiceId: string;
  vendorName: string;
  vendorTaxId: string;
  invoiceAmount: number;
  bankDetails: {
    bankName: string;
    accountNumber: string; // e.g. "*****8891"
    routingNumber: string;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  submittedAt: string;
  metadata?: {
    isTestScenario?: "clean" | "spoofed_bank" | "unknown_vendor";
  };
}

export interface MCPToolCall {
  jsonrpc: "2.0";
  id: string | number;
  method: "tools/call";
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface MCPToolResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: {
    content: Array<{
      type: "text" | "json";
      text?: string;
      json?: Record<string, unknown>;
    }>;
    isError?: boolean;
  };
  error?: {
    code: number;
    message: string;
  };
}

// Preset invoice payloads for the control panel
export const SAMPLE_INVOICES: Record<string, InvoicePayload> = {
  clean: {
    invoiceId: "INV-2026-1042",
    vendorName: "Acme Global Enterprise Inc.",
    vendorTaxId: "XX-XXX4910",
    invoiceAmount: 14500.0,
    bankDetails: {
      bankName: "JPMorgan Chase",
      accountNumber: "*****4321",
      routingNumber: "021000021",
    },
    lineItems: [
      {
        description: "Enterprise Cloud Hosting - Q2",
        quantity: 1,
        unitPrice: 14500.0,
      },
    ],
    submittedAt: "2026-07-22T08:30:00Z",
    metadata: { isTestScenario: "clean" },
  },
  spoofed_bank: {
    invoiceId: "INV-2026-9904",
    vendorName: "Acme Global Enterprize Inc.",
    vendorTaxId: "XX-XXX4910",
    invoiceAmount: 68250.0,
    bankDetails: {
      bankName: "Offshore Horizon Bank",
      accountNumber: "*****9912",
      routingNumber: "990011223", // Fraudulent Routing Number
    },
    lineItems: [
      {
        description: "Legacy Database Migration Retainer",
        quantity: 1,
        unitPrice: 68250.0,
      },
    ],
    submittedAt: "2026-07-22T09:12:00Z",
    metadata: { isTestScenario: "spoofed_bank" },
  },
  unknown_vendor: {
    invoiceId: "INV-2026-5510",
    vendorName: "Shadow Vendor LLC",
    vendorTaxId: "ZZ-9999999",
    invoiceAmount: 22400.0,
    bankDetails: {
      bankName: "First National Shell",
      accountNumber: "*****0007",
      routingNumber: "111000025",
    },
    lineItems: [
      {
        description: "Urgent Infrastructure Support",
        quantity: 1,
        unitPrice: 22400.0,
      },
    ],
    submittedAt: "2026-07-22T10:05:00Z",
    metadata: { isTestScenario: "unknown_vendor" },
  },
};
