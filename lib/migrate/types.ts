export type DatasetKey = "clean" | "corrupted";

export interface LegacyLocationRow {
  /** Raw column bag as it arrived from the client export */
  raw: Record<string, string | number | null>;
}

export interface CanonicalLocation {
  locationId: string;
  locationName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  taxId: string;
  contactEmail: string;
}

export interface DatasetProfile {
  key: DatasetKey;
  label: string;
  detail: string;
  sourceFormat: "csv" | "json";
  fileName: string;
  clientName: string;
  tenantId: string;
  rowCount: number;
  /** Human-readable preview of source columns */
  sourceColumns: string[];
  rows: LegacyLocationRow[];
}

/** Target SaaS schema the pipeline maps into. */
export const TARGET_SCHEMA = {
  table: "locations",
  required: [
    "location_id",
    "location_name",
    "address",
    "city",
    "state",
    "zip",
    "tax_id",
    "contact_email",
  ] as const,
};

/** Demo tenant provisioned for Mid-West Logistics cutover. */
export const DEMO_TENANT_SCHEMA = "tenant_id_992";

/**
 * Clean export: columns already close to the target schema,
 * required fields filled, types look right.
 */
const CLEAN_ROWS: LegacyLocationRow[] = [
  {
    raw: {
      location_id: "MWL-1001",
      location_name: "Chicago Hub",
      address: "1200 W Lake St",
      city: "Chicago",
      state: "IL",
      zip: "60607",
      tax_id: "36-2847193",
      contact_email: "chicago.hub@midwestlogistics.example",
    },
  },
  {
    raw: {
      location_id: "MWL-1002",
      location_name: "Milwaukee Depot",
      address: "440 Industrial Pkwy",
      city: "Milwaukee",
      state: "WI",
      zip: "53204",
      tax_id: "36-2847193",
      contact_email: "milwaukee@midwestlogistics.example",
    },
  },
  {
    raw: {
      location_id: "MWL-1003",
      location_name: "Indianapolis Cross-Dock",
      address: "890 Commerce Dr",
      city: "Indianapolis",
      state: "IN",
      zip: "46225",
      tax_id: "36-2847193",
      contact_email: "indy@midwestlogistics.example",
    },
  },
  {
    raw: {
      location_id: "MWL-1004",
      location_name: "Detroit Yard",
      address: "55 Fort St",
      city: "Detroit",
      state: "MI",
      zip: "48226",
      tax_id: "36-2847193",
      contact_email: "detroit@midwestlogistics.example",
    },
  },
];

/**
 * Messy legacy export: odd column names, missing ZIP / tax IDs,
 * blank emails - the kind of spreadsheet ops teams inherit.
 */
const CORRUPTED_ROWS: LegacyLocationRow[] = [
  {
    raw: {
      "Loc#": "1",
      "Site Name": "Chicago Hub",
      Addr: "1200 W Lake",
      City: "Chicago",
      ST: "IL",
      ZipCode: "60607",
      EIN: "36-2847193",
      Email: "chicago.hub@midwestlogistics.example",
    },
  },
  {
    raw: {
      "Loc#": "2",
      "Site Name": "Milwaukee Depot",
      Addr: "440 Industrial Pkwy",
      City: "Milwaukee",
      ST: "wi",
      ZipCode: "", // missing ZIP - will warn / flag
      EIN: "36-2847193",
      Email: "",
    },
  },
  {
    raw: {
      "Loc#": "3",
      "Site Name": "Indy Cross Dock",
      Addr: "890 Commerce",
      City: "Indianapolis",
      ST: "IN",
      ZipCode: "4622", // truncated - auto-normalize attempt / warn
      EIN: "", // missing tax ID
      Email: "not-an-email",
    },
  },
  {
    raw: {
      "Loc#": "4",
      "Site Name": "",
      Addr: "55 Fort St",
      City: "Detroit",
      ST: "Michigan", // not a 2-letter code
      ZipCode: "48226-1234", // ZIP+4 - auto-normalize to 5-digit
      EIN: "362847193", // missing dash
      Email: "detroit@midwestlogistics.example",
    },
  },
];

export const SAMPLE_DATASETS: Record<DatasetKey, DatasetProfile> = {
  clean: {
    key: "clean",
    label: "Clean Mid-West export",
    detail:
      "Mid-West Logistics export with matching columns - should map and cut over",
    sourceFormat: "csv",
    fileName: "midwest_logistics_locations.csv",
    clientName: "Mid-West Logistics",
    tenantId: "992",
    // Demo-facing batch size (sample rows below drive validation rules)
    rowCount: 1420,
    sourceColumns: [
      "location_id",
      "location_name",
      "address",
      "city",
      "state",
      "zip",
      "tax_id",
      "contact_email",
    ],
    rows: CLEAN_ROWS,
  },
  corrupted: {
    key: "corrupted",
    label: "Corrupted legacy dataset",
    detail:
      "Odd column names, missing ZIP and tax IDs - flags issues, normalizes what it can",
    sourceFormat: "json",
    fileName: "midwest_legacy_sites.json",
    clientName: "Mid-West Logistics",
    tenantId: "992",
    rowCount: 1420,
    sourceColumns: [
      "Loc#",
      "Site Name",
      "Addr",
      "City",
      "ST",
      "ZipCode",
      "EIN",
      "Email",
    ],
    rows: CORRUPTED_ROWS,
  },
};
