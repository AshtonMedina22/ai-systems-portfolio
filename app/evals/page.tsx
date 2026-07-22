import { redirect } from "next/navigation";

/** Legacy path - Enterprise Guardrails now lives at /guardrails. */
export default function EvalsRedirectPage() {
  redirect("/guardrails");
}
