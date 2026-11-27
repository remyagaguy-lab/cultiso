import { calculerFinances, calculerFinancement, ErreurMoteur } from "@/moteurs";
import { choisirBareme, versBareme, type BaremeCampagne } from "@/referentiel/financement";
import { ErreurReferentiel } from "@/referentiel";
import { assemblerFinancement, schemaDemandeFinancement } from "../financement";
import type { Plan } from "../service";

const resultats = calculerFinances({
  charges: [
    { id: "i1", libelle: "Matériel", typeCharge: "equipement", quantite: 1, prixUnitaire: 600_000, nature: "fixe", classe: "investissement", dureeVieAns: 5 },
    { id: "c1", libelle: "Semences", typeCharge: "intrants", quantite: 1, prixUnitaire: 200_000, nature: "variable", classe: "exploitation" },
  ],
  revenus: [{ id: "r1", libelle: "Maïs", typeRevenu: "principal", quantite: { pessimiste: 8, realiste: 10, optimiste: 12 }, prixUnitaire: 100_000 }],
  horizonAnnees: 3,
});
const plan = { id: "p1", hypotheses: { horizonAnnees: 3 } as Plan["hypotheses"], resultats } as Pick<Plan, "id" | "hypotheses" | "resultats">;

const bareme = (o: Partial<BaremeCampagne>): BaremeCampagne => ({
  id: "b", speculationCode: "mais", organisme: null, produit: null, plafondParUnite: 150_000, dureeMaxMois: null, tauxIndicatif: null,
  source: "barème d'essai", dateSource: "2026-11-27", statut: "brouillon_ia", ...o,
});

describe("financement d'un plan (M6)", () => {
  it("reprend investissement, BFR et CAF du moteur financier, et lit le barème de campagne", () => {
    const demande = schemaDemandeFinancement.parse({
      apportEspeces: 300_000,
      creditsCampagne: [
        { id: "c", libelle: "Campagne maïs", tauxAnnuel: 0.1, baremeDe: { speculationCode: "mais", tailleAtelier: 2 }, campagnes: [{ montantDemande: 500_000, moisTirage: 1, moisRemboursement: 7 }] },
      ],
    });
    const { entree, origines, manques } = assemblerFinancement(plan, demande, new Map([["c", { plafondParUnite: 150_000, source: "barème d'essai", statut: "brouillon_ia", organisme: null }]]));
    expect(entree.emploisInitiaux?.investissement).toBe(600_000);
    expect(entree.horizonMois).toBe(36);
    expect(entree.exploitation?.cafParAn).toHaveLength(3);
    expect(manques).toEqual([]);
    expect(origines.join(" ")).toContain("barème général");
    const r = calculerFinancement(entree);
    expect(r.campagnes[0].plafond).toBe(300_000);
    expect(r.mois[1].tiragesCampagne).toBe(300_000);
    expect(r.controles.map((c) => c.code)).toContain("PLAFOND_CAMPAGNE_DEPASSE");
    expect(r.planAnnuel[0].ressources.caf).toBe(resultats.scenarios.realiste.annees[0].cafNette);
  });

  it("sans barème dans le référentiel : plafond inconnu, dit dans les manques", () => {
    const demande = schemaDemandeFinancement.parse({
      creditsCampagne: [{ id: "c", libelle: "Campagne", tauxAnnuel: 0.1, baremeDe: { speculationCode: "tilapia", tailleAtelier: 1 }, campagnes: [{ montantDemande: 100_000, moisTirage: 1, moisRemboursement: 5 }] }],
    });
    const { entree, manques } = assemblerFinancement(plan, demande, new Map());
    expect(manques[0]).toContain("tilapia");
    expect(entree.creditsCampagne?.[0].plafond).toBeUndefined();
    expect(calculerFinancement(entree).controles.map((c) => c.code)).toContain("PLAFOND_CAMPAGNE_NON_VERIFIE");
  });

  it("refuse un plan sans résultat", () => {
    expect(() => assemblerFinancement({ ...plan, resultats: null }, schemaDemandeFinancement.parse({}), new Map())).toThrow(/pas encore de résultat/);
  });

  it("refuse un corps invalide : la source de la taxe est obligatoire", () => {
    expect(schemaDemandeFinancement.safeParse({ taxeInterets: { taux: 0.1, nom: "taxe", source: "" } }).success).toBe(false);
    expect(() => calculerFinancement({ horizonMois: 12, emploisInitiaux: { investissement: 1, bfr: 0 }, taxeInterets: { taux: 0.1, nom: "t", source: "" } })).toThrow(ErreurMoteur);
  });
});

describe("barèmes de campagne du référentiel", () => {
  it("le barème du financeur passe avant le barème général ; deux au même rang : ambigu", () => {
    const general = bareme({ id: "g" });
    const anpgf = bareme({ id: "a", organisme: "ANPGF" });
    expect(choisirBareme([general, anpgf], "anpgf").bareme?.id).toBe("a");
    expect(choisirBareme([general, anpgf]).bareme?.id).toBe("g");
    expect(choisirBareme([bareme({ id: "g1" }), bareme({ id: "g2" })]).ambigus).toHaveLength(2);
    expect(choisirBareme([]).bareme).toBeNull();
  });

  it("une ligne sans source est refusée, jamais ignorée", () => {
    const ligne = {
      id: "x", speculation_code: "mais", organisme: null, produit: null, plafond_par_unite: 1, duree_max_mois: null, taux_indicatif: null,
      source: "", date_source: "2026-11-27", notes: null, statut: "brouillon_ia", valide_le: null, valide_par: null, created_at: "", updated_at: "",
    };
    expect(() => versBareme(ligne)).toThrow(ErreurReferentiel);
    expect(versBareme({ ...ligne, source: "document d'essai p. 3" }).plafondParUnite).toBe(1);
  });
});
