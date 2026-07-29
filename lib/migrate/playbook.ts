import type { MappingChoice } from "./types";

export interface MappingPlaybook {
  name: string;
  sourceSignature: string[];
  mappings: Record<string, MappingChoice>;
  savedAt: string;
}

const STORAGE_KEY = "migrate-mapping-playbook-v1";

export function signatureForColumns(columns: string[]): string[] {
  return [...columns].map((column) => column.trim()).sort();
}

export function playbookMatches(
  playbook: MappingPlaybook | null,
  columns: string[]
): boolean {
  if (!playbook) return false;
  const expected = signatureForColumns(columns).join("|");
  const actual = signatureForColumns(playbook.sourceSignature).join("|");
  return expected === actual;
}

export function loadPlaybook(): MappingPlaybook | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MappingPlaybook;
    if (
      !parsed ||
      typeof parsed.name !== "string" ||
      !Array.isArray(parsed.sourceSignature) ||
      !parsed.mappings ||
      typeof parsed.mappings !== "object"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePlaybook(playbook: MappingPlaybook): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(playbook));
}

export function clearPlaybook(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
