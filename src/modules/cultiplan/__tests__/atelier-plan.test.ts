/** @jest-environment node */
import { calculerFinances, simulerBandes, simulerTroupeau, lignesDepuisBandes, lignesDepuisTroupeau } from "@/moteurs";
import { choisirDureeVie } from "@/referentiel/duree-vie";
import { additionnerFinancement } from "../financement";
import { depuisSaisie, versLigne, versMoteur, type LignePlan } from "../lignes";
import { lignesDePlan, retenirDureeVie, schemaDemandeAtelierPlan } from "../atelier-plan";
import { entreeFinance } from "../service";

// Courbes et prix d'ESSAI, inventés pour ce test seulement.
const courbe = (v: number[]) => v.map((valeur, i) => ({ age: i + 1, valeur }));
const bandes = simulerBandes({
  courbes: { mortalite: courbe([0.1, 0, 0, 0, 0]), consommation: courbe([20, 50, 100, 100, 100]), production: courbe([0, 0, 0.5, 0.5, 0.5]) },
  joursParMois: 30,
  dureeBandeMois: 5,
  bandes: [{ debutMois: 1, effectif: 100 }],
  prix: { animal: 1000, aliment: 200, produit: 100, reforme: 2000 },
  chargesFixesMensuelles: [{ libelle: "Gardien", montant: 20_000 }],
  investissement: 600_000,
});

/** Passe par le chemin du service : ligne de plan → rangée de base → ligne de plan → ligne du moteur. */
function entreePlan(l: ReturnType<typeof lignesDePlan>) {
  const lignes: LignePlan[] = l.map((n, i) => {
    const r = depuisSaisie("p1", n, "utilisateur", i);
    return versLigne({ ...r, id: `l${i}`, created_at: "", updated_at: "" } as Parameters<typeof versLigne>[0]);
  });
  const hyp = { horizonAnnees: 3, horizonMois: 12, horizonCycles: null, montee: [], tauxActualisation: 0.12, hausseCharges: 0, haussePrix: 0, prelevementsAnnuels: null, revenusExterieursAnnuels: 0, salairesAnnuels: 0, impotsAnnuels: 0, ecartsScenarios: {}, baissePrixBas: null };
  return entreeFinance({ lignes, hypotheses: hyp as never, financement: { apport: 0, credit: null, moisTirageCredit: 0, regleFinanceur: null } });
}

describe("atelier animal raccordé au plan", () => {
  it("la trésorerie du plan est celle du moteur à bandes, mois par mois, en passant par les lignes de plan", () => {
    const r = lignesDepuisBandes(bandes, { prefixe: "Pondeuses", dureeVieAns: 10 });
    const f = calculerFinances(entreePlan(lignesDePlan(r, "Pondeuses"))).scenarios.realiste;
    for (const m of bandes.mois.slice(1)) expect(f.tresorerieMensuelle[m.mois].solde).toBe(m.solde);
    expect(f.investissementsDates[0]).toMatchObject({ mois: 0 });
  });

  it("les lignes portent le nom de l'atelier en préfixe et la série mensuelle dans les contrôles", () => {
    const r = lignesDepuisBandes(bandes, { prefixe: "P", dureeVieAns: 10 });
    const l = lignesDePlan(r, "Pondeuses A");
    expect(l.every((x) => x.libelle.startsWith("Pondeuses A : "))).toBe(true);
    const aliment = l.find((x) => x.libelle.endsWith("Aliment"));
    expect(aliment?.controles?.serieMensuelle?.origine).toBe("bandes");
  });

  it("sans durée de vie : l'achat reste une charge du mois 1 et l'avertissement est conservé", () => {
    const r = lignesDepuisBandes(bandes, { prefixe: "P" });
    expect(r.avertissements[0]).toContain("aucune durée de vie");
    const inv = lignesDePlan(r, "A").find((x) => x.libelle.endsWith("(non amorti)"));
    expect(inv).toMatchObject({ classe: "exploitation" });
  });

  it("le cheptel passe aussi par le plan", () => {
    const t = simulerTroupeau({
      horizonMois: 6,
      categories: [{ code: "femelles", effectifInitial: 10 }],
      mouvements: [{ mois: 3, categorie: "femelles", type: "vente", effectif: 2, prixUnitaire: 50_000 }],
    });
    const f = calculerFinances(entreePlan(lignesDePlan(lignesDepuisTroupeau(t, { prefixe: "T" }), "Cheptel"))).scenarios.realiste;
    expect(f.tresorerieMensuelle[3].solde).toBe(100_000);
  });

  it("une ligne de plan revient au moteur avec la même série (aller-retour de la base)", () => {
    const l = lignesDePlan(lignesDepuisBandes(bandes, { prefixe: "P", dureeVieAns: 10 }), "A");
    const rangee = depuisSaisie("p1", l[0], "utilisateur", 0);
    const m = versMoteur(versLigne({ ...rangee, id: "x", created_at: "", updated_at: "" } as Parameters<typeof versLigne>[0]));
    expect("charge" in m ? m.charge.serieMensuelle?.montants.length : 0).toBeGreaterThan(0);
  });

  it("refuse un type inconnu et une source de durée de vie vide", () => {
    expect(schemaDemandeAtelierPlan.safeParse({ type: "autre", nom: "x" }).success).toBe(false);
    expect(schemaDemandeAtelierPlan.safeParse({ type: "bandes", nom: "Pondeuses", speculation: "poule pondeuse", bandes: [{ debutMois: 1, effectif: 10 }], prix: { animal: 1, aliment: 1, produit: 1, reforme: 1 }, dureeVieInvestissement: { valeur: 10, source: "" } }).success).toBe(false);
  });
});

describe("durée de vie de l'investissement d'une bande", () => {
  const inv = (libelle: string, dureeVieAns: number) => ({ libelle, dureeVieAns, source: "doc d'essai", statut: "brouillon_ia" as const });
  it("une seule durée dans le référentiel : reprise, avec sa source et son statut", () => {
    const r = choisirDureeVie("X", [inv("Bâtiment", 10), inv("Bâtiment 2", 10)]);
    expect(retenirDureeVie(undefined, r)).toMatchObject({ dureeVie: { valeur: 10, origine: "referentiel", statut: "brouillon_ia" }, manque: null });
  });
  it("plusieurs durées ou aucune : demandée, jamais moyennée ni devinée", () => {
    const amb = choisirDureeVie("X", [inv("Bâtiment", 10), inv("Matériel", 5)]);
    expect(amb.statut).toBe("ambigue");
    expect(retenirDureeVie(undefined, amb)).toMatchObject({ dureeVie: null });
    expect(retenirDureeVie(undefined, amb).manque).toContain("10 ans");
    expect(choisirDureeVie("Y", []).statut).toBe("absente");
  });
  it("la durée de l'appelant l'emporte sur le référentiel", () => {
    const r = choisirDureeVie("X", [inv("Bâtiment", 10)]);
    expect(retenirDureeVie({ valeur: 7, source: "devis" }, r).dureeVie).toMatchObject({ valeur: 7, origine: "appelant", source: "devis" });
  });
});

describe("financement détaillé additionné à la trésorerie du plan (M6)", () => {
  it("exploitation + flux − retenues de l'acheteur, cumul et point bas", () => {
    const t = additionnerFinancement(
      [{ mois: 0, solde: -1000 }, { mois: 1, solde: -200 }, { mois: 2, solde: 500 }],
      [{ mois: 0, flux: 1500, retenuesAcheteur: 0 }, { mois: 1, flux: -100, retenuesAcheteur: 0 }, { mois: 2, flux: 0, retenuesAcheteur: 300 }],
    );
    expect(t.mois.map((m) => m.solde)).toEqual([500, -300, 200]);
    expect(t.mois.map((m) => m.cumul)).toEqual([500, 200, 400]);
    expect(t.pointBas).toEqual({ montant: 200, mois: 1 });
    expect(t.moisTresorerieNegative).toEqual([]);
    expect(t.notes).toEqual([]);
  });
  it("horizons différents : partie commune et note, rien n'est comblé", () => {
    const t = additionnerFinancement([{ mois: 0, solde: -5 }, { mois: 1, solde: 1 }], [{ mois: 0, flux: 0, retenuesAcheteur: 0 }]);
    expect(t.mois).toHaveLength(1);
    expect(t.notes[0]).toContain("seuls");
    expect(t.moisTresorerieNegative).toEqual([0]);
  });
});
