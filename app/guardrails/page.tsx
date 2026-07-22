import { redirect } from "next/navigation";

/** Legacy path - Project 3 now lives at /workflow. */
export default function GuardrailsRedirectPage() {
  redirect("/workflow");
}
