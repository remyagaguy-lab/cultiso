/**
 * Orchestrateur de Cultisia : compose le prompt, appelle le modèle, exécute les outils, diffuse le flux.
 * Ne dépend ni du réseau ni de la base : tout est injecté (`DependancesCultisia`).
 */
import { verifierSolde, type ServiceCredits } from "./credits";
import type { AccesDonnees } from "./donnees";
import type { EvenementCultisia } from "./evenements";
import { modeleConfigure, type AppelOutilModele, type MessageModele, type ModeleLangage } from "./llm/client";
import { derniereQuestion, fenetreGlissante, type MessageClient } from "./memoire";
import { versModule, type Module } from "./modules";
import { composerPrompt } from "./noyau/composer";
import type { RegistreOutils } from "./outils/registre";

export const TOURS_MAX = 4;

export const MESSAGE_PLAFOND =
  "\n\nJe n'ai pas pu terminer cette recherche en une seule fois. Reformule ta question de façon plus précise, s'il te plaît.";

export interface RequeteCultisia {
  module: Module;
  utilisateurId: string;
  messages: MessageClient[];
  ecran?: string;
  exploitation?: { id: string; nom?: string };
  /** Contrat de sortie transitoire du module (voir `composerPrompt`). */
  contratModule?: string;
}

export interface DependancesCultisia {
  modele: ModeleLangage;
  registre: RegistreOutils;
  credits: ServiceCredits;
  donnees: AccesDonnees;
  nomModele?: string;
  toursMax?: number;
}

/**
 * Vérifie le solde (lève `CreditsEpuises` avant tout appel au modèle), puis renvoie le flux d'événements.
 */
export async function lancerCultisia(
  requete: RequeteCultisia,
  dependances: DependancesCultisia,
): Promise<AsyncGenerator<EvenementCultisia>> {
  await verifierSolde(dependances.credits, requete.utilisateurId);
  return executerCultisia(requete, dependances);
}

async function* executerCultisia(
  requete: RequeteCultisia,
  { modele, registre, credits, donnees, nomModele, toursMax = TOURS_MAX }: DependancesCultisia,
): AsyncGenerator<EvenementCultisia> {
  const { prompt } = composerPrompt({
    module: requete.module,
    question: derniereQuestion(requete.messages),
    ecran: requete.ecran,
    exploitation: requete.exploitation,
    contratModule: requete.contratModule,
  });
  const historique: MessageModele[] = [{ role: "system", content: prompt }, ...fenetreGlissante(requete.messages)];
  const outils = registre.versFormatModele(requete.module);
  const contexteOutil = {
    module: requete.module,
    utilisateurId: requete.utilisateurId,
    exploitationId: requete.exploitation?.id,
    donnees,
  };

  let jetons = 0;
  let erreur = false;

  try {
    for (let tour = 0; tour < toursMax; tour++) {
      const appels = new Map<number, { id: string; nom: string; arguments: string }>();

      for await (const morceau of modele.generer({
        modele: nomModele ?? modeleConfigure(),
        messages: historique,
        outils: outils.length > 0 ? outils : undefined,
        temperature: 0.3,
      })) {
        if (morceau.type === "texte") {
          yield { type: "token", content: morceau.contenu };
        } else if (morceau.type === "usage") {
          jetons += morceau.jetons;
        } else {
          const courant = appels.get(morceau.index) ?? { id: `appel_${tour}_${morceau.index}`, nom: "", arguments: "" };
          if (morceau.id) courant.id = morceau.id;
          if (morceau.nom) courant.nom = morceau.nom;
          if (morceau.arguments) courant.arguments += morceau.arguments;
          appels.set(morceau.index, courant);
        }
      }

      if (appels.size === 0) break;
      if (tour === toursMax - 1) {
        yield { type: "token", content: MESSAGE_PLAFOND };
        break;
      }

      const appelsModele: AppelOutilModele[] = [...appels.values()].map((a) => ({
        id: a.id,
        type: "function",
        function: { name: a.nom, arguments: a.arguments },
      }));
      historique.push({ role: "assistant", content: null, tool_calls: appelsModele });

      let propositionFaite = false;
      for (const appel of appelsModele) {
        const repondre = (contenu: string) =>
          historique.push({ role: "tool", tool_call_id: appel.id, content: contenu });

        const validation = registre.valider(appel.function.name, appel.function.arguments, requete.module);
        if (!validation.ok) {
          repondre(`ERREUR : ${validation.erreur} Corrige l'appel ou réponds sans cet outil.`);
          continue;
        }
        const { outil, args } = validation;

        if (outil.famille === "action") {
          yield {
            type: "action_proposee",
            outil: outil.nom,
            arguments: outil.preparer ? outil.preparer(args) : (args as Record<string, unknown>),
            message: outil.messagePropose?.(args) ?? "Action proposée : confirme-la dans l'interface.",
          };
          repondre("Proposition transmise à l'utilisateur, en attente de sa confirmation. Rien n'est enregistré.");
          propositionFaite = true;
        } else if (outil.famille === "orientation") {
          const { module, raison } = args as { module: string; raison: string };
          yield { type: "orientation", module: versModule(module), raison };
          repondre("Orientation proposée à l'utilisateur.");
          propositionFaite = true;
        } else {
          const resultat = await outil.executer!(args, contexteOutil);
          if (resultat.sources && resultat.sources.length > 0) yield { type: "sources", sources: resultat.sources };
          repondre(resultat.contenu);
        }
      }

      // Une action ou une orientation clôt le tour : l'interface prend le relais.
      if (propositionFaite) break;
    }
  } catch (cause) {
    console.error("[cultisia] erreur pendant la génération", cause);
    erreur = true;
    yield { type: "error", content: "Cultisia n'a pas pu répondre. Réessaie dans un instant." };
  }

  let solde: number | undefined;
  if (jetons > 0) {
    try {
      solde = await credits.debiter(requete.utilisateurId, jetons);
    } catch (cause) {
      console.error("[cultisia] débit des crédits impossible", cause);
    }
  }
  if (!erreur) yield { type: "done", jetons, ...(solde !== undefined ? { solde } : {}) };
}
