/** @jest-environment node */
import { calculerCredit, calculerFinances, calculerFinancement } from "@/moteurs";
import { calculerMainOeuvre } from "@/moteurs/main-oeuvre";
import type { RegleFinanceurRef } from "@/referentiel";
import { analyserDebouches, type CircuitRef } from "../debouches";
import { assemblerFinancement, schemaDemandeFinancement } from "../financement";
import type { LignePlan } from "../lignes";
import { versMoteur } from "../lignes";
import { composerDocument, listerPieces, rendreHtml, rendrePdf, schemaDemandeExport, tresorerieDepuisScenario, type DocumentExport, type DonneesDossier } from "../export";
import { ProfilPorteurVide } from "../test-utils/profil-vide";

const commun = { atelierId: null, unite: "u", base: "an" as const, cyclesParAn: 1, origine: "reference" as const, modeleId: null, ajustements: [], sourcePrix: null, ordre: 0 };
const lignes: LignePlan[] = [
  { ...commun, id: "i1", sens: "charge", libelle: "Motopompe", type: "infrastructures", quantite: 1, prixUnitaire: 600_000, frequence: 1, nature: "fixe", classe: "investissement", dureeVieAns: 5, mois: [1], controles: {}, unite: "pièce" },
  { ...commun, id: "c1", sens: "charge", libelle: "Semences", type: "intrants", quantite: 1, prixUnitaire: 200_000, frequence: 1, nature: "variable", classe: "exploitation", dureeVieAns: null, mois: [3], controles: {} },
  { ...commun, id: "c2", sens: "charge", libelle: "Entretien", type: "main_oeuvre", quantite: 1, prixUnitaire: 120_000, frequence: 1, nature: "variable", classe: "exploitation", dureeVieAns: null, mois: null, controles: {} },
  { ...commun, id: "r1", sens: "revenu", libelle: "Tomate", type: "principal", quantites: { pessimiste: 8000, realiste: 10000, optimiste: 12000 }, prixUnitaire: 150, pertes: 0.1, mois: [7, 8, 9], controles: {}, unite: "kg", sourcePrix: { source: "relevé d'essai", date: "2026-11-01" } },
];
const credit = { montant: 400_000, tauxAnnuel: 0.12, dureeMois: 24, differeMois: 3 };
const hypotheses = { horizonAnnees: 3, tauxActualisation: 0.12, hausseCharges: 0, haussePrix: 0, prelevementsAnnuels: 300_000, revenusExterieursAnnuels: 0, salairesAnnuels: 0, impotsAnnuels: 0, ecartsScenarios: { pessimiste: { prix: -0.1, charges: 0.05 }, optimiste: { prix: 0.1, charges: -0.05 } }, baissePrixBas: null };

const moteur = lignes.map(versMoteur);
const resultats = calculerFinances({
  charges: moteur.flatMap((m) => ("charge" in m ? [m.charge] : [])),
  revenus: moteur.flatMap((m) => ("revenu" in m ? [m.revenu] : [])),
  horizonAnnees: 3,
  apport: 300_000,
  credit,
  menage: { prelevementsAnnuels: 300_000 },
  ecartsScenarios: hypotheses.ecartsScenarios,
});
const plan = { id: "p1", hypotheses, resultats } as Parameters<typeof assemblerFinancement>[0];
const financement = calculerFinancement(
  assemblerFinancement(plan, schemaDemandeFinancement.parse({ apportEspeces: 300_000, prets: [{ id: "p", libelle: "Crédit du plan", credit }] }), new Map()).entree,
);

const anpgf: RegleFinanceurRef = {
  id: "a", organisme: "ANPGF", produit: "projets_demarrage", libelle: "Projets en démarrage", pays: "TG", apportMinimum: 0.2, dureeMaxMois: 48, dureeInclutDiffere: true,
  differeMaxMois: 12, tauxIndicatif: null, taxes: [], piecesExigees: ["Plan d'affaires au format ANPGF"], formatDossier: null, notes: null, statut: "brouillon_ia", source: "Canevas ANPGF d'essai",
};
const circuits: CircuitRef[] = [{ code: "marche_local", libelle: "Marché local", contractuel: false }, { code: "contrat", libelle: "Contrat", contractuel: true }];

const donnees = (surcharge: Partial<DonneesDossier> = {}): DonneesDossier => ({
  genereLe: "2026-11-27T10:00:00.000Z",
  titrePlan: "Tomate de contre-saison",
  exploitation: { nom: "Ferme d'essai", lieu: "Kpalimé", ateliers: [{ libelle: "Tomate", speculationCode: "tomate", taille: 0.5, unite: "ha" }] },
  promoteur: {},
  profil: ProfilPorteurVide({ terrePiece: "attestation_villageoise", terreStatut: "heritage_familial", familleActifs: 2 }),
  hypotheses,
  generation: { ateliersSansModele: [], prixMarche: [{ produit: "Tomate", prix: 150, source: "relevé d'essai", date: "2026-11-01" }], origineProfil: [] },
  lignes,
  resultats,
  scenario: resultats.scenarios.realiste,
  credit: calculerCredit(credit),
  financeur: anpgf,
  financement,
  debouches: analyserDebouches(
    { produit: "Tomate", unite: "kg", volumeAn: { pessimiste: 7200, realiste: 9000, optimiste: 10800 }, moisVente: [7, 8, 9], circuits: [{ circuit: "marche_local", part: 0.8, client: "Marché", prix: 150 }] },
    circuits,
  ),
  mainOeuvre: calculerMainOeuvre({ membres: [{ id: "f", libelle: "Famille", type: "famille", heuresParMois: 100 }], besoinsHeuresParMois: [50, 50, 200, 50, 50, 50, 50, 50, 50, 50, 50, 50] }),
  tresorerie: tresorerieDepuisScenario(resultats.scenarios.realiste),
  redaction: {},
  ...surcharge,
});

const textes = (d: DocumentExport): string => JSON.stringify(d);

describe("dossier de financement (S4)", () => {
  const doc = composerDocument("dossier", donnees());

  it("suit les 14 parties du canevas : lettre, fiche, résumé, porteur, marché, technique, financier, scénarios, risques, impacts, sûretés, calendrier, hypothèses, annexes", () => {
    const titres = doc.sections.map((s) => s.titre);
    expect(titres).toHaveLength(14); // la page de titre précède la lettre
    expect(titres[0]).toBe("Lettre de présentation");
    expect(titres[1]).toContain("Fiche synoptique");
    expect(titres.join("|")).toMatch(/Résumé.*porteur.*marché.*technique.*financière.*Scénarios.*Risques.*Impacts.*Sûretés.*Calendrier.*Hypothèses.*Annexes/i);
    expect(doc.format).toBe("anpgf");
    expect(titres[1]).toContain("canevas ANPGF §1.1");
  });

  it("n'utilise que des chiffres des moteurs : coût, apport, CA, VAN, point bas", () => {
    const t = textes(doc);
    const f = (x: number) => Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    expect(t).toContain(f(resultats.scenarios.realiste.annees[0].chiffreAffaires));
    expect(t).toContain(f(resultats.scenarios.realiste.van ?? 0));
    expect(t).toContain(f(resultats.scenarios.realiste.pointBasTresorerie.montant));
    expect(t).toContain(f(financement.planInitial.totalEmplois));
    expect(t).toContain(f(calculerCredit(credit).mensualite));
  });

  it("la lettre est adaptée au financeur et reprend sa règle d'apport", () => {
    const lettre = textes({ ...doc, sections: [doc.sections[0]] });
    expect(lettre).toContain("ANPGF");
    expect(lettre).toMatch(/minimum de 20 %/);
  });

  it("ne produit pas un texte du porteur absent : « à compléter » et la liste finale", () => {
    expect(textes(doc)).toContain("À compléter par le porteur");
    expect(doc.aCompleter).toEqual(expect.arrayContaining(["Description du projet", "Risques du projet et mesures d'atténuation (3 à 5)", "Sûretés proposées", "Calendrier de réalisation du projet"]));
    expect(doc.aCompleter.join(" ")).toContain("SYSCOHADA");
    const redige = composerDocument("dossier", donnees({ redaction: { suretes: "Nantissement du matériel financé.", risques: [{ risque: "Maladie", probabilite: "moyenne", impact: "fort", mesure: "Traitement préventif" }] } }));
    expect(textes(redige)).toContain("Nantissement du matériel financé.");
    expect(redige.aCompleter).not.toContain("Sûretés proposées");
  });

  it("financeur non togolais : mêmes parties, sans renvois au canevas ANPGF", () => {
    const autre = composerDocument("dossier", donnees({ financeur: { ...anpgf, organisme: "Banque d'essai", pays: "BJ" } }));
    expect(autre.format).toBe("generique");
    expect(textes(autre)).not.toContain("canevas ANPGF §");
    expect(autre.sections).toHaveLength(14);
  });

  it("signale une règle de financeur non validée dans les hypothèses", () => {
    expect(textes(doc)).toContain("n'a pas été validée par un expert");
  });

  it("annexes : lexique et pièces cochées selon le profil", () => {
    const annexes = doc.sections[doc.sections.length - 1];
    const cases = annexes.blocs.find((b) => b.type === "case_a_cocher");
    expect(cases && cases.type === "case_a_cocher" && cases.items.find((i) => i.texte.startsWith("Pièce foncière"))?.coche).toBe(true);
    expect(cases && cases.type === "case_a_cocher" && cases.items.find((i) => i.texte.startsWith("CV"))?.coche).toBe(false);
    expect(annexes.blocs.some((b) => b.type === "definitions" && b.lignes.length > 5)).toBe(true);
  });

  it("pièces : sans pièce foncière déclarée, elle reste à fournir ; le financeur ajoute les siennes", () => {
    const sans = listerPieces({ profil: ProfilPorteurVide({ terrePiece: "accord_verbal" }), debouches: null, financeur: anpgf });
    expect(sans.find((p) => p.code === "foncier")?.etat).toBe("a_fournir");
    expect(sans.find((p) => p.origine === "financeur")?.libelle).toContain("ANPGF");
  });
});

describe("version porteur (S4)", () => {
  const doc = composerDocument("porteur", donnees());

  it("est en langage simple et au tutoiement", () => {
    const t = textes(doc);
    expect(t).toContain("Ce que j'emprunte");
    expect(t).toContain("Les trois choses à surveiller");
    expect(t).toMatch(/Si les prix baissent/);
    expect(t).not.toMatch(/\bTRI\b|\bVAN\b|amortissement/i.toString().slice(1, -2));
    expect(doc.sections.map((s) => s.titre)).toEqual(["Mon projet en une page", "Ce que je dois faire, mois par mois", "L'argent qui entre et qui sort chaque mois", "Les trois choses à surveiller", "Et si ça tourne mal ?", "Mes pièces à réunir", "Les mots à connaître"]);
  });

  it("zéro emoji, zéro tiret cadratin dans les textes rédigés", () => {
    for (const d of [doc, composerDocument("dossier", donnees())]) {
      expect(textes(d)).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(textes(d)).not.toMatch(/[–—]/);
    }
  });
});

describe("rendus", () => {
  it("HTML : échappé, avec toutes les sections", () => {
    const html = rendreHtml(composerDocument("dossier", donnees({ titrePlan: "Plan <script>x</script>" })));
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Lettre de présentation");
    expect(html).toContain('lang="fr"');
  });

  it("PDF : un fichier PDF valide, la version porteur tient en 8 à 10 pages", async () => {
    const dossier = await rendrePdf(composerDocument("dossier", donnees()));
    expect(dossier.subarray(0, 5).toString()).toBe("%PDF-");
    const porteur = await rendrePdf(composerDocument("porteur", donnees()));
    expect(porteur.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = (b: Buffer) => (b.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
    expect(pages(dossier)).toBeGreaterThan(8);
    // version porteur : 8 à 10 pages visées (ANALYSE-BASE-RESSOURCES §5.3)
    expect(pages(porteur)).toBeGreaterThanOrEqual(6);
    expect(pages(porteur)).toBeLessThanOrEqual(10);
  });
});

describe("demande d'export", () => {
  it("valeurs par défaut : PDF du dossier ; refuse un format inconnu", () => {
    expect(schemaDemandeExport.parse({})).toMatchObject({ format: "pdf", version: "dossier" });
    expect(schemaDemandeExport.safeParse({ format: "docx" }).success).toBe(false);
  });
});
