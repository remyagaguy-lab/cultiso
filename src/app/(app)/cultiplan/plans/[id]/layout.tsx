import type { ReactNode } from "react";
import { PlanProvider } from "@/components/cultiplan/plan/PlanContext";
import { ParcoursPlan } from "@/components/cultiplan/plan/ParcoursPlan";

// Composant serveur : il ne lit que l'identifiant ; le plan est chargé côté client avec le jeton de l'utilisateur (RLS).
export default async function LayoutPlan({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanProvider planId={id}>
      <ParcoursPlan>{children}</ParcoursPlan>
    </PlanProvider>
  );
}
