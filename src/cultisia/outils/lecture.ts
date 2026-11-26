/**
 * Outils de lecture (couche 2) : Cultisia répond avec des données datées et sourcées.
 * Chaque outil renvoie ses sources ; une erreur d'accès est dite honnêtement au modèle.
 */
import { z } from "zod";
import type { Source } from "../evenements";
import { normaliser } from "../donnees";
import { definirOutil, type ResultatOutil } from "./registre";

const AUCUNE_DONNEE = "AUCUNE DONNÉE TROUVÉE. Dis-le clairement à l'utilisateur, n'invente aucun chiffre.";
const ERREUR_ACCES = "ERREUR D'ACCÈS AUX DONNÉES. Dis à l'utilisateur que la donnée est momentanément indisponible, n'invente rien.";

async function protege(lecture: () => Promise<ResultatOutil>): Promise<ResultatOutil> {
  try {
    return await lecture();
  } catch (erreur) {
    console.error("[cultisia] outil de lecture en échec", erreur);
    return { contenu: ERREUR_ACCES };
  }
}

export const lirePrix = definirOutil({
  nom: "lire_prix",
  description:
    "Lit les prix de marché enregistrés dans Cultiso (base Cours des prix) pour un ou plusieurs produits agricoles. " +
    "À utiliser dès qu'une réponse dépend d'un prix. Renvoie prix, unité, lieu, date et source.",
  famille: "lecture",
  modules: "tous",
  schema: z.object({
    produits: z.array(z.string().min(2).max(60)).min(1).max(5).describe("Noms de produits, par exemple ['maïs', 'tomate']"),
    lieu: z.string().max(60).optional().describe("Marché ou ville, si l'utilisateur en cite un"),
  }),
  executer: (args, { donnees }) =>
    protege(async () => {
      const lignes = (await Promise.all(args.produits.map((p) => donnees.chercherPrix(normaliser(p))))).flat();
      const lieu = args.lieu ? normaliser(args.lieu) : null;
      const filtrees = lieu ? lignes.filter((l) => l.lieu && normaliser(l.lieu).includes(lieu)) : lignes;
      const retenues = (filtrees.length > 0 ? filtrees : lignes).slice(0, 15);
      if (retenues.length === 0) return { contenu: AUCUNE_DONNEE };

      const avertissementLieu =
        lieu && filtrees.length === 0 ? `Aucun prix relevé à ${args.lieu} ; voici les prix relevés ailleurs.\n` : "";
      const contenu =
        avertissementLieu +
        retenues
          .map(
            (l) =>
              `- ${l.produit} : ${l.prix} ${l.devise} / ${l.unite ?? "unité non précisée"} ; lieu : ${l.lieu ?? "non précisé"} ; ` +
              `date : ${l.date} ; source : ${l.source ?? "Cours des prix Cultiso"}`,
          )
          .join("\n");
      const sources: Source[] = dedoublonner(
        retenues.map((l) => ({ file_name: `Cours des prix Cultiso : ${l.produit} (${l.date})`, origine: "prix", date: l.date })),
      );
      return { contenu, sources };
    }),
});

export const lireExploitation = definirOutil({
  nom: "lire_exploitation",
  description:
    "Lit l'exploitation active de l'utilisateur : nom, domaine, surface, lieu, plans et dernières opérations. " +
    "À utiliser quand la question porte sur sa ferme, son projet ou ses comptes.",
  famille: "lecture",
  modules: "tous",
  schema: z.object({}),
  executer: (_args, { donnees, exploitationId }) =>
    protege(async () => {
      if (!exploitationId) {
        return { contenu: "AUCUNE EXPLOITATION ACTIVE. Propose à l'utilisateur de choisir ou de créer son exploitation." };
      }
      const e = await donnees.lireExploitation(exploitationId);
      if (!e) return { contenu: "EXPLOITATION INTROUVABLE ou inaccessible pour cet utilisateur." };

      const lignes = [
        `Exploitation : ${e.nom}`,
        `Domaine : ${e.domaine ?? "non précisé"} ; statut : ${e.statut ?? "non précisé"}`,
        `Surface : ${e.surface !== null ? `${e.surface} ${e.uniteSurface ?? ""}`.trim() : "non précisée"} ; lieu : ${e.localisation ?? "non précisé"}`,
        `Plans : ${e.plans.length > 0 ? e.plans.map((p) => `${p.titre} (mis à jour le ${p.misAJour})`).join(" ; ") : "aucun"}`,
        "Dernières opérations :",
        ...(e.operations.length > 0
          ? e.operations.map(
              (o) => `- ${o.date} ; ${o.type === "income" ? "recette" : "dépense"} ; ${o.categorie} ; ${o.montant} FCFA${o.description ? ` ; ${o.description}` : ""}`,
            )
          : ["- aucune"]),
      ];
      return { contenu: lignes.join("\n"), sources: [{ file_name: `Ton exploitation : ${e.nom}`, origine: "exploitation" }] };
    }),
});

export const lireReferentiel = definirOutil({
  nom: "lire_referentiel",
  description:
    "Lit le référentiel agronomique de Cultiso : paramètres des cultures, propriétés des sols, zones agroécologiques du Togo " +
    "(pluviométrie). À utiliser pour une question sur une culture, un sol ou une zone.",
  famille: "lecture",
  modules: "tous",
  schema: z.object({
    type: z.enum(["culture", "sol", "zone"]).describe("Ce que l'on cherche"),
    terme: z.string().max(60).optional().describe("Nom de la culture ou du sol ; pour une zone, laisser vide ou donner le nom"),
  }),
  executer: (args, { donnees }) =>
    protege(async () => {
      const terme = normaliser(args.terme ?? "");
      const source: Source = { file_name: "Référentiel agronomique Cultiso", origine: "referentiel" };

      if (args.type === "zone") {
        const zones = (await donnees.listerZones()).filter(
          (z) => !terme || normaliser(`${z.code} ${z.nom}`).includes(terme),
        );
        if (zones.length === 0) return { contenu: AUCUNE_DONNEE };
        const contenu = zones
          .map((z) => `- ${z.nom} (${z.code}) : ${z.description ?? ""} Pluie annuelle ${z.pluieMinMm ?? "?"} à ${z.pluieMaxMm ?? "?"} mm.`)
          .join("\n");
        return { contenu, sources: [{ ...source, file_name: "Zones agroécologiques du Togo (référentiel Cultiso)" }] };
      }

      if (!terme) return { contenu: "Précise le nom de la culture ou du sol." };

      if (args.type === "culture") {
        const cultures = (await donnees.chercherCultures(traduire(terme, CULTURES_EN))).sort(
          (a, b) => Number(a.slug.endsWith("gdd")) - Number(b.slug.endsWith("gdd")),
        );
        if (cultures.length === 0) return { contenu: AUCUNE_DONNEE };
        const contenu = cultures
          .slice(0, 3)
          .map(
            (c) =>
              `- ${c.nom} : température de base ${c.temperatureBaseC ?? "?"} °C, maximale ${c.temperatureMaxC ?? "?"} °C, ` +
              `indice de récolte de référence ${c.indiceRecoltePct ?? "?"} %`,
          )
          .join("\n");
        return { contenu, sources: [{ ...source, file_name: "Paramètres des cultures (référentiel Cultiso, base AquaCrop)" }] };
      }

      const sols = await donnees.chercherSols(traduire(terme, SOLS_EN));
      if (sols.length === 0) return { contenu: AUCUNE_DONNEE };
      const contenu = sols
        .slice(0, 5)
        .map(
          (s) =>
            `- ${s.nom} : capacité au champ ${s.capaciteChampPct ?? "?"} %, point de flétrissement ${s.pointFletrissementPct ?? "?"} %, ` +
            `conductivité à saturation ${s.ksatMmJour ?? "?"} mm/jour`,
        )
        .join("\n");
      return { contenu, sources: [{ ...source, file_name: "Propriétés des sols (référentiel Cultiso, base AquaCrop)" }] };
    }),
});

export const chercherSavoir = definirOutil({
  nom: "chercher_savoir",
  description:
    "Cherche des extraits dans la base documentaire de Cultiso (guides techniques dont la licence est autorisée). " +
    "À utiliser pour appuyer un conseil technique sur une source écrite.",
  famille: "lecture",
  modules: "tous",
  schema: z.object({ question: z.string().min(3).max(300).describe("La question reformulée, en français") }),
  executer: (args, { donnees }) =>
    protege(async () => {
      const extraits = await donnees.chercherSavoir(args.question);
      if (extraits.length === 0) {
        return {
          contenu:
            "AUCUNE SOURCE DOCUMENTAIRE AUTORISÉE pour cette question. Réponds avec tes connaissances générales en le disant, " +
            "avec ton niveau de certitude, sans citer de document.",
        };
      }
      const contenu = extraits.map((x) => `[${x.document}]\n${x.contenu}`).join("\n\n---\n\n");
      const sources = dedoublonner(extraits.map((x) => ({ file_name: x.document, origine: "savoir" as const })));
      return { contenu, sources };
    }),
});

/**
 * Le référentiel actuel vient d'AquaCrop (noms anglais). En attendant le schéma `ref` du chantier Cultiplan,
 * on traduit les noms français courants. Les expressions de plusieurs mots passent en premier.
 */
export const CULTURES_EN: [string, string][] = [
  ["pomme de terre", "potato"],
  ["canne a sucre", "sugarcane"],
  ["betterave", "sugar beet"],
  ["manioc", "cassava"],
  ["mais", "maize"],
  ["riz", "rice"],
  ["tomate", "tomato"],
  ["soja", "soybean"],
  ["sorgho", "sorghum"],
  ["coton", "cotton"],
  ["haricot", "bean"],
  ["niebe", "bean"],
  ["ble", "wheat"],
  ["orge", "barley"],
  ["tournesol", "sunflower"],
];
const SOLS_EN: [string, string][] = [
  ["limon sableux", "sandy loam"],
  ["sablo-limoneux", "sandy loam"],
  ["sable limoneux", "loamy sand"],
  ["argile sableuse", "sandy clay"],
  ["argilo-sableux", "sandy clay"],
  ["limon argileux", "clay loam"],
  ["argilo-limoneux", "clay loam"],
  ["argile limoneuse", "silty clay"],
  ["bas-fond", "paddy"],
  ["riziere", "paddy"],
  ["argileux", "clay"],
  ["argile", "clay"],
  ["limoneux", "silt"],
  ["limon", "loam"],
  ["sableux", "sand"],
  ["sable", "sand"],
];

export function traduire(terme: string, table: [string, string][]): string {
  return table.find(([fr]) => terme.includes(fr))?.[1] ?? terme;
}

function dedoublonner(sources: Source[]): Source[] {
  const vus = new Set<string>();
  return sources.filter((s) => (vus.has(s.file_name) ? false : (vus.add(s.file_name), true)));
}

export const OUTILS_LECTURE = [lirePrix, lireExploitation, lireReferentiel, chercherSavoir];
