import type { ReactNode } from "react";
import { ParcoursProjet } from "@/components/cultiplan/projet/ParcoursProjet";

export default async function LayoutProjet({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ParcoursProjet exploitationId={id}>{children}</ParcoursProjet>;
}
