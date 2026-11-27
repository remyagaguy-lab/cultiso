// Version porteur (S4) : « mon projet », courte (8 à 10 pages), en langage simple et au tutoiement. Elle sert aussi de plan de campagne.
// Mêmes données que le dossier de financement (jamais d'autres chiffres), sans jargon : chaque terme technique est expliqué ou renvoyé au lexique.
import { lexique } from "@/moteurs";
import { fcfa, nombre, nomMois, moisN, pct, dateFr } from "./format";
import { listerPieces } from "./pieces";
import type { Bloc, DocumentExport, DonneesDossier, SectionDocument } from "./types";

const A_COMPLETER = "À compléter avec toi.";

export function construirePorteur(d: DonneesDossier): DocumentExport {
  const r = d.scenario;
  const an1 = r.annees[0];
  const sections: SectionDocument[] = [];
  const manques: string[] = [];

  // 1. Mon projet en une page
  const phraseVerdict =
    r.statut === "rentable"
      ? "D'après les calculs, ton projet est rentable et ta caisse reste positive."
      : r.statut === "limite"
        ? "D'après les calculs, ton projet est à la limite : il peut marcher, mais il y a des points faibles à régler avant de te lancer."
        : "D'après les calculs, ton projet perd de l'argent tel qu'il est construit : il faut le revoir avant de te lancer.";
  sections.push({
    numero: "1",
    titre: "Mon projet en une page",
    blocs: [
      { type: "paragraphe", texte: phraseVerdict },
      {
        type: "cle_valeur",
        lignes: [
          ["Ce que je fais", d.exploitation.ateliers.map((a) => `${a.libelle ?? a.speculationCode} (${nombre(a.taille, 2)} ${a.unite})`).join(", ") || "à préciser"],
          ["Où", d.exploitation.lieu ?? "à préciser"],
          ["Ce que ça coûte au départ", `${fcfa(d.financement.planInitial.totalEmplois)} : ${fcfa(d.financement.planInitial.emplois[0]?.montant)} de matériel et d'installations, ${fcfa(d.financement.planInitial.emplois[1]?.montant)} pour tenir avant les premières ventes`],
          ["Ce que j'apporte", `${fcfa(d.financement.apport.total)}${d.financement.apport.partApport !== null ? ` (${pct(d.financement.apport.partApport, 0)} du coût)` : ""}`],
          ["Ce que j'emprunte", d.credit ? `${fcfa(d.financement.planInitial.ressources.find((x) => x.libelle === "Prêts")?.montant ?? 0)}, ${fcfa(d.credit.mensualite)} par mois` : "rien"],
          ["Ce que je vends la première année", fcfa(an1.chiffreAffaires)],
          ["Ce qu'il me reste après toutes les dépenses", fcfa(an1.resultat)],
          ["Pour ma famille", r.verdict.menageCouvert === null ? "Tu n'as pas dit combien ta famille a besoin chaque année : on ne peut pas dire si le projet la fait vivre." : r.verdict.menageCouvert ? `Après les échéances et ce que ta famille prélève, il te reste ${fcfa(an1.soldeResiduel)} la première année.` : `Après les échéances, ce que ta famille prélève n'est pas couvert toutes les années : il manque jusqu'à ${fcfa(Math.min(...r.annees.map((a) => a.soldeResiduel)))}.`],
        ],
      },
      ...r.controles.filter((c) => c.niveau === "bloquant" || c.niveau === "alerte").slice(0, 3).map((c) => ({ type: "alerte" as const, niveau: c.niveau === "bloquant" ? ("bloquant" as const) : ("alerte" as const), texte: c.message })),
    ],
  });

  // 2. Ce que je dois faire, mois par mois
  const postes = (sens: "charge" | "revenu", m: number): string[] =>
    d.lignes.filter((l) => l.sens === sens && l.mois !== null && l.mois.includes(m) && (l.sens === "revenu" || l.classe === "exploitation")).map((l) => l.libelle);
  const toutesAnnee = (sens: "charge" | "revenu") => d.lignes.filter((l) => l.sens === sens && l.mois === null && (l.sens === "revenu" || l.classe === "exploitation")).map((l) => l.libelle);
  sections.push({
    numero: "2",
    titre: "Ce que je dois faire, mois par mois",
    nouvellePage: true,
    blocs: [
      { type: "paragraphe", texte: "Voici, pour chaque mois, ce que tu achètes (ou payes) et ce que tu vends. Garde cette page : c'est ton plan de campagne." },
      {
        type: "tableau",
        entetes: ["Mois", "J'achète ou je paie", "Je vends"],
        lignes: Array.from({ length: 12 }, (_, i) => i + 1).map((m) => [nomMois(m), postes("charge", m).join(", ") || "-", postes("revenu", m).join(", ") || "-"]),
      },
      ...(toutesAnnee("charge").length + toutesAnnee("revenu").length > 0
        ? [
            { type: "paragraphe" as const, texte: `Toute l'année, sans mois précis : ${[...toutesAnnee("charge").map((x) => `dépense : ${x}`), ...toutesAnnee("revenu").map((x) => `vente : ${x}`)].join(" ; ")}.` },
          ]
        : []),
      ...(d.mainOeuvre
        ? [
            {
              type: "paragraphe" as const,
              texte: `Le travail : il faut environ ${nombre(d.mainOeuvre.totaux.besoinHeures)} heures dans l'année. Le mois le plus chargé est ${nomMois(d.mainOeuvre.moisLePlusCharge.mois)}.${d.mainOeuvre.pointes.length > 0 ? ` Attention : aux mois ${d.mainOeuvre.pointes.map((p) => p.mois).join(", ")}, tu n'as pas assez de bras. Prévois de l'aide à l'avance.` : " Tu as assez de bras tous les mois."}`,
            },
          ]
        : []),
    ],
  });

  // 3. L'argent qui entre et qui sort
  sections.push({
    numero: "3",
    titre: "L'argent qui entre et qui sort chaque mois",
    nouvellePage: true,
    blocs: [
      { type: "paragraphe", texte: "Cette page suit ta caisse, mois par mois, la première année. « Pour la famille » est ce que ta famille prend pour vivre. « Cumul » est l'argent qu'il te reste en caisse : s'il devient négatif, tu manques d'argent ce mois-là." },
      {
        type: "tableau",
        entetes: ["Mois", "Entre", "Sort", "Pour la famille", "En caisse", "Je peux retirer"],
        lignes: d.tresorerie.mois.filter((m) => m.mois <= 12).map((m) => [m.mois === 0 ? "Démarrage" : nomMois(m.mois), fcfa(m.entrees), fcfa(m.sorties), fcfa(m.prelevementsNets), fcfa(m.cumul), fcfa(m.retraitPossible)]),
      },
      {
        type: "paragraphe",
        texte: `Le moment le plus difficile est ${moisN(d.tresorerie.pointBas.mois)} : ta caisse tombe à ${fcfa(d.tresorerie.pointBas.montant)}. ${d.tresorerie.pointBas.montant < 0 ? "C'est négatif : il te manque cet argent. Il faut le trouver avant de commencer (apport, crédit de campagne, vente à l'avance)." : "C'est positif : tu tiens sans argent en plus."}`,
      },
      ...(d.tresorerie.moisDeficitaires.length > 0 ? [{ type: "paragraphe" as const, texte: `Les mois où tu dépenses plus que tu ne reçois : ${d.tresorerie.moisDeficitaires.filter((m) => m <= 12).map((m) => `mois ${m}`).join(", ")}.` }] : []),
      ...(d.credit
        ? [{ type: "paragraphe" as const, texte: `Ton crédit : tu rembourses ${fcfa(d.credit.mensualite)} par mois. Au total tu rends ${fcfa(d.credit.totalRembourse)}, dont ${fcfa(d.credit.coutTotal)} d'intérêts.` }]
        : []),
    ],
  });

  // 4. Les trois choses à surveiller
  const eq = d.resultats.sensibilite.equilibre;
  const surveiller: string[] = [];
  const sc = r.seuilCommercialisation;
  if (sc.coefficientPrix !== null) {
    surveiller.push(
      sc.coefficientPrix <= 1
        ? `Le prix de vente : tu couvres toutes tes dépenses, tes échéances et ta famille tant que tu ne vends pas en dessous de ${pct(sc.coefficientPrix, 0)} des prix prévus. ${sc.parLigne.map((l) => `Pour ${l.libelle}, ne descends pas sous ${fcfa(l.prixSeuil)} l'unité (prévu : ${fcfa(l.prixActuel)}).`).join(" ")}`
        : `Le prix de vente : avec les prix prévus, tu ne couvres pas tout. Il faut vendre ${pct(sc.coefficientPrix - 1, 0)} plus cher que prévu. ${sc.parLigne.map((l) => `Pour ${l.libelle}, vise au moins ${fcfa(l.prixSeuil)} l'unité (prévu : ${fcfa(l.prixActuel)}).`).join(" ")}`,
    );
  }
  surveiller.push(`Ta caisse : son point le plus bas est ${fcfa(d.tresorerie.pointBas.montant)}, ${d.tresorerie.pointBas.mois === 0 ? "au démarrage" : `au mois ${d.tresorerie.pointBas.mois}`}. Surveille-la chaque mois.`);
  if (eq.parLigne.length > 0) {
    const l = eq.parLigne[0];
    surveiller.push(`La récolte : pour ne pas perdre d'argent, il te faut au moins ${nombre(l.quantiteEquilibre, 2)} pour « ${l.libelle} » (prévu : ${nombre(l.quantiteActuelle, 2)}).`);
  }
  sections.push({
    numero: "4",
    titre: "Les trois choses à surveiller",
    blocs: [{ type: "liste", items: surveiller.slice(0, 3) }, ...(surveiller.length > 3 ? [{ type: "liste" as const, items: surveiller.slice(3) }] : [])],
  });

  // 5. Et si ça tourne mal ?
  const sens = d.resultats.sensibilite;
  const planB: Bloc[] = [
    { type: "paragraphe", texte: `Ce qui pèse le plus sur ton résultat : ${sens.classement.slice(0, 3).join(", ")}.` },
    {
      type: "paragraphe",
      texte: `Si les prix baissent de ${pct(Math.abs(sens.testPrixBas.baisse), 0)}, ton projet devient « ${sens.testPrixBas.statut === "rentable" ? "rentable" : sens.testPrixBas.statut === "limite" ? "limite" : "déficitaire"} » et ta caisse tombe à ${fcfa(sens.testPrixBas.pointBasTresorerie)}.`,
    },
  ];
  if (d.redaction.planB && d.redaction.planB.trim()) planB.push({ type: "paragraphe", texte: d.redaction.planB.trim() });
  else {
    manques.push("Ton plan B");
    planB.push({ type: "alerte", niveau: "info", texte: `${A_COMPLETER} Écris ce que tu ferais si les prix baissent, si la récolte est mauvaise ou si un acheteur ne paie pas.` });
  }
  if (d.debouches && d.debouches.volumeNonVendu > 0) planB.push({ type: "alerte", niveau: "alerte", texte: `${nombre(d.debouches.volumeNonVendu)} ${d.debouches.unite} n'ont pas d'acheteur dans ton plan. Cherche des acheteurs pour cette part ou produis moins.` });
  sections.push({ numero: "5", titre: "Et si ça tourne mal ?", blocs: planB });

  // 6. Mes pièces
  const pieces = listerPieces(d);
  sections.push({
    numero: "6",
    titre: "Mes pièces à réunir",
    nouvellePage: true,
    blocs: [
      { type: "paragraphe", texte: "Une case cochée veut dire que tu as dit avoir la pièce. Les autres sont à réunir avant de déposer ta demande." },
      { type: "case_a_cocher", items: pieces.map((p) => ({ coche: p.etat === "declaree", texte: p.libelle, detail: p.detail })) },
    ],
  });

  // 7. Lexique
  sections.push({ numero: "7", titre: "Les mots à connaître", nouvellePage: true, blocs: [{ type: "definitions", lignes: lexique().map((e) => ({ terme: e.terme, definition: e.definition })) }] });

  return {
    version: "porteur",
    format: "generique",
    titre: `Mon projet : ${d.titrePlan}`,
    sousTitre: "Ma version simple, pour décider et pour me suivre",
    pageDeTitre: [
      ["Projet", d.titrePlan],
      ["Date", dateFr(d.genereLe)],
    ],
    sections,
    aCompleter: manques,
    pied: `Cultiso : ton projet, généré le ${dateFr(d.genereLe)}`,
  };
}
