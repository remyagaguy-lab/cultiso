// POST /api/cultiplan/plans/:id/export : dossier de financement ou version porteur (S4), en PDF (par défaut), HTML ou JSON.
// Corps (tout est facultatif) :
//   { format?: "pdf" | "html" | "json", version?: "dossier" | "porteur",
//     financeur?: { organisme, produit? }            // règle de ref.regles_financeurs ; pays TG : format du canevas ANPGF
//     financement?: <corps de POST /plans/:id/financement>,  // sinon l'apport et le crédit du plan
//     debouches?: <corps de POST /exploitations/:id/debouches>, mainOeuvre?: <corps de POST /exploitations/:id/main-oeuvre>,
//     promoteur?: { nom, adresse, contacts, rccm, effectif },
//     redaction?: { contexteEtJustification, descriptionEntreprise, formeJuridique, objectif, descriptionProjet, produitsEtServices, concurrence,
//                   positionnement, strategieCommerciale, risques[{ risque, probabilite, impact, mesure }], impacts{ economiques, environnementaux, sociaux },
//                   suretes, calendrier[{ etape, debutMois, finMois }], planB } }
// Réponse : le fichier (Content-Type application/pdf ou text/html, Content-Disposition) ; avec format "json", le document { titre, sections[], aCompleter[] }.
// Un texte non fourni est marqué « à compléter » et listé dans `aCompleter` ; les chiffres viennent uniquement des moteurs. Rien n'est enregistré.
// Le plan doit avoir été calculé (sinon 400).
import { lireCorps, traiter, type Parametres } from "@/modules/cultiplan/http";
import { exporterPlan } from "@/modules/cultiplan/export";

export async function POST(req: Request, { params }: Parametres<"id">): Promise<Response> {
  const { id } = await params;
  return traiter(req, async (client) => {
    const fichier = await exporterPlan(client, id, await lireCorps(req));
    if (typeof fichier.contenu === "object" && !Buffer.isBuffer(fichier.contenu)) return fichier.contenu;
    const entetes = { "Content-Type": fichier.contentType, "Content-Disposition": `attachment; filename="${fichier.nomFichier}"` };
    return new Response(typeof fichier.contenu === "string" ? fichier.contenu : new Uint8Array(fichier.contenu), { status: 200, headers: entetes });
  });
}
