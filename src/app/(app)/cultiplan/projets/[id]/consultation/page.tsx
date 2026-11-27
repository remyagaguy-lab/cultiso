import { ConsultationPorteur } from "@/components/cultiplan/consultation/ConsultationPorteur";

// Composant serveur : il ne lit que l'identifiant ; la consultation est chargée côté client avec le jeton de l'utilisateur (RLS).
export default async function PageConsultation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConsultationPorteur exploitationId={id} />;
}
