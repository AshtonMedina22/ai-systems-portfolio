import { redirect } from "next/navigation";

/** Legacy path - Project 2 is now the Client Migration Pipeline at /migrate. */
export default function SreRedirectPage() {
  redirect("/migrate");
}
