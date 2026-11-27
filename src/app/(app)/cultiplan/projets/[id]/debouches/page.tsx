import { Debouches } from "@/components/cultiplan/projet/Debouches";

// Composant serveur : il ne lit que l'identifiant ; les données sont chargées côté client avec le jeton de l'utilisateur (RLS).
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Debouches exploitationId={id} />;
}
