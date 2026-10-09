import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/auth/permissions";
import { TITULO } from "@/components/ui";
import { NovaObraForm } from "./form";

export const metadata: Metadata = { title: "Nova obra" };

export default async function NovaObra() {
  const user = await requireUser();
  if (!can(user.role, "obra", "criar")) notFound();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className={TITULO}>Nova obra</h1>
      <NovaObraForm />
    </div>
  );
}
