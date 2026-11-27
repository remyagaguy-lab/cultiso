import { PlanDiagnostic } from "@/components/cultiplan/PlanDiagnostic";

// Composant serveur : il ne lit que l'identifiant ; le plan est chargé côté client avec le jeton de l'utilisateur (RLS).
export default async function PagePlan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanDiagnostic planId={id} />;
}
