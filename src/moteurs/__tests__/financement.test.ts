import { calculerFinancement, plafondCampagne, ErreurMoteur, type EntreeFinancement } from "..";

const base: EntreeFinancement = { horizonMois: 36, emploisInitiaux: { investissement: 800_000, bfr: 200_000 } };
const pret = { id: "p1", libelle: "Prêt matériel", moisTirage: 0, credit: { montant: 600_000, tauxAnnuel: 0.12, dureeMois: 24, differeMois: 0 } };

describe("financement (M6)", () => {
  it("plusieurs prêts datés : tirage et échéances décalés selon le mois de tirage", () => {
    const r = calculerFinancement({
      ...base,
      prets: [pret, { id: "p2", libelle: "Second prêt", moisTirage: 12, credit: { montant: 100_000, tauxAnnuel: 0, dureeMois: 10, differeMois: 0 } }],
    });
    expect(r.mois[0].tiragesPrets).toBe(600_000);
    expect(r.mois[12].tiragesPrets).toBe(100_000);
    // second prêt à 0 % : 10 échéances de 10 000 à partir du mois 13
    expect(r.mois[13].capitalPrets).toBeGreaterThanOrEqual(10_000);
    expect(r.mois[22].capitalPrets).toBeGreaterThanOrEqual(10_000);
    const capitalTotal = r.mois.reduce((s, m) => s + m.capitalPrets, 0);
    expect(Math.abs(capitalTotal - 700_000)).toBeLessThanOrEqual(2);
    expect(r.mois[r.mois.length - 1].encours).toBe(0);
  });

  it("différé total : pas d'intérêt payé, l'encours grossit", () => {
    const r = calculerFinancement({ ...base, prets: [{ ...pret, credit: { ...pret.credit, differeMois: 6, typeDiffere: "total" } }] });
    expect(r.mois[3].interetsPrets).toBe(0);
    expect(r.mois[6].encours).toBeGreaterThan(600_000);
    expect(r.mois[7].interetsPrets).toBeGreaterThan(0);
  });

  it("la taxe sur les intérêts vient du paramètre, jamais d'une valeur par défaut", () => {
    const sans = calculerFinancement({ ...base, prets: [pret] });
    expect(sans.mois.every((m) => m.taxeInterets === 0)).toBe(true);
    expect(sans.controles.map((c) => c.code)).toContain("TAXE_INTERETS_NON_RENSEIGNEE");
    const avec = calculerFinancement({ ...base, prets: [pret], taxeInterets: { taux: 0.1, nom: "taxe d'essai", source: "paramètre du test" } });
    const interets = avec.mois.reduce((s, m) => s + m.interetsPrets, 0);
    const taxe = avec.mois.reduce((s, m) => s + m.taxeInterets, 0);
    expect(Math.abs(taxe - interets * 0.1)).toBeLessThanOrEqual(25);
    expect(avec.annees[0].fraisFinanciers).toBe(avec.annees[0].interets + avec.annees[0].taxeInterets);
  });

  it("crédit de campagne : renouvelable, plafonné par le barème, intérêts au remboursement", () => {
    const plafond = plafondCampagne({ plafondParUnite: 200_000, source: "barème d'essai", statut: "brouillon_ia" }, 2);
    expect(plafond.montant).toBe(400_000);
    const r = calculerFinancement({
      ...base,
      creditsCampagne: [
        {
          id: "c1",
          libelle: "Campagne maïs",
          tauxAnnuel: 0.12,
          plafond,
          campagnes: [
            { montantDemande: 500_000, moisTirage: 1, moisRemboursement: 7 },
            { montantDemande: 300_000, moisTirage: 13, moisRemboursement: 19 },
          ],
        },
      ],
    });
    expect(r.mois[1].tiragesCampagne).toBe(400_000);
    expect(r.mois[7].remboursementsCampagne).toBe(400_000);
    expect(r.mois[7].interetsCampagne).toBe(24_000); // 400 000 × 12 % × 6/12
    expect(r.mois[13].tiragesCampagne).toBe(300_000); // la campagne se renouvelle
    expect(r.controles.find((c) => c.code === "PLAFOND_CAMPAGNE_DEPASSE")?.valeurs.autorise).toBe(400_000);
  });

  it("deux campagnes qui se chevauchent partagent le plafond", () => {
    const r = calculerFinancement({
      ...base,
      creditsCampagne: [
        {
          id: "c1", libelle: "Deux cultures", tauxAnnuel: 0, plafond: { montant: 500_000, source: "barème d'essai" },
          campagnes: [
            { montantDemande: 300_000, moisTirage: 1, moisRemboursement: 8 },
            { montantDemande: 300_000, moisTirage: 4, moisRemboursement: 10 },
          ],
        },
      ],
    });
    expect(r.mois[4].tiragesCampagne).toBe(200_000);
  });

  it("sans plafond connu, le tirage n'est pas vérifié et le dit", () => {
    const r = calculerFinancement({ ...base, creditsCampagne: [{ id: "c", libelle: "Campagne", tauxAnnuel: 0.1, campagnes: [{ montantDemande: 100_000, moisTirage: 1, moisRemboursement: 6 }] }] });
    expect(r.mois[1].tiragesCampagne).toBe(100_000);
    expect(r.controles.map((c) => c.code)).toContain("PLAFOND_CAMPAGNE_NON_VERIFIE");
  });

  it("crédit tripartite : l'acheteur rembourse la banque sur le paiement ; alerte si le paiement ne couvre pas", () => {
    const chaine = { id: "t1", libelle: "Préfinancement", acheteur: "Coopérative", montant: 1_000_000, tauxAnnuel: 0.12, moisTirage: 2, moisPaiementAcheteur: 8 };
    const r = calculerFinancement({ ...base, creditsChaine: [{ ...chaine, paiementPrevuAcheteur: 2_000_000 }] });
    expect(r.mois[2].tiragesChaine).toBe(1_000_000);
    expect(r.mois[8].retenuesAcheteur).toBe(1_060_000);
    expect(r.chaines[0].retenue).toBe(1_060_000);
    expect(r.controles.map((c) => c.code)).not.toContain("RETENUE_ACHETEUR_NON_COUVERTE");
    const court = calculerFinancement({ ...base, creditsChaine: [{ ...chaine, paiementPrevuAcheteur: 900_000 }] });
    expect(court.controles.find((c) => c.code === "RETENUE_ACHETEUR_NON_COUVERTE")?.niveau).toBe("bloquant");
  });

  it("apport en nature : retenu avec sa pièce, écarté sans pièce", () => {
    const r = calculerFinancement({
      ...base,
      apportEspeces: 100_000,
      apportsNature: [
        { libelle: "Terrain 2 ha", valeur: 300_000, piece: "attestation villageoise" },
        { libelle: "Motopompe", valeur: 150_000 },
      ],
    });
    expect(r.apport.natureRetenu).toBe(300_000);
    expect(r.apport.natureNonRetenu).toBe(150_000);
    expect(r.apport.total).toBe(400_000);
    expect(r.apport.partApport).toBe(0.4);
    expect(r.apport.sansPiece).toEqual(["Motopompe"]);
    expect(r.controles.map((c) => c.code)).toContain("APPORT_NATURE_SANS_PIECE");
  });

  it("subvention d'investissement : reprise au résultat sur la durée donnée ; d'exploitation : étalée", () => {
    const r = calculerFinancement({
      ...base,
      subventions: [
        { id: "s1", libelle: "Équipement", type: "investissement", montant: 240_000, moisEncaissement: 0, dureeRepriseAns: 2 },
        { id: "s2", libelle: "Appui", type: "exploitation", montant: 120_000, moisEncaissement: 6, etalementMois: 12 },
      ],
    });
    expect(r.mois[0].subventionsEncaissees).toBe(240_000);
    expect(r.mois[1].repriseSubventions).toBe(10_000); // 240 000 / 24
    expect(r.mois[7].repriseSubventions).toBe(20_000); // + 120 000 / 12
    const reprises = r.mois.reduce((s, m) => s + m.repriseSubventions, 0);
    expect(Math.abs(reprises - 360_000)).toBeLessThanOrEqual(36);
  });

  it("subvention d'investissement sans durée de reprise : refusée", () => {
    expect(() => calculerFinancement({ ...base, subventions: [{ id: "s", libelle: "x", type: "investissement", montant: 1, moisEncaissement: 0 }] })).toThrow(ErreurMoteur);
  });

  it("avance sur subvention : entre avant, se rembourse sur la subvention (encaissement net)", () => {
    const r = calculerFinancement({
      ...base,
      subventions: [{ id: "s", libelle: "Appui", type: "exploitation", montant: 500_000, moisEncaissement: 9, avance: { montant: 300_000, moisAvance: 2 } }],
    });
    expect(r.mois[2].avancesRecues).toBe(300_000);
    expect(r.mois[2].encours).toBe(300_000);
    expect(r.mois[9].subventionsEncaissees).toBe(200_000);
    expect(r.mois[9].remboursementsAvances).toBe(300_000);
    expect(r.mois[9].encours).toBe(0);
    const entrees = r.mois.reduce((s, m) => s + m.entrees, 0);
    const sorties = r.mois.reduce((s, m) => s + m.sorties, 0);
    expect(entrees - sorties).toBe(200_000); // le net final est la subvention moins l'avance déjà reçue puis rendue
  });

  it("plan de financement initial : équilibré ou bloquant s'il manque", () => {
    const ok = calculerFinancement({ ...base, apportEspeces: 400_000, prets: [pret] });
    expect(ok.planInitial.equilibre).toBe(true);
    expect(ok.planInitial.totalRessources).toBe(1_000_000);
    expect(ok.planInitial.partsRessources.reduce((s, p) => s + p.part, 0)).toBeCloseTo(1, 3);
    const trop = calculerFinancement({ ...base, apportEspeces: 100_000, prets: [pret] });
    expect(trop.planInitial.equilibre).toBe(false);
    expect(trop.controles.find((c) => c.code === "PLAN_FINANCEMENT_DESEQUILIBRE")?.niveau).toBe("bloquant");
  });

  it("plan de financement annuel : complet quand l'exploitation est fournie, partiel sinon", () => {
    const partiel = calculerFinancement({ ...base, apportEspeces: 400_000, prets: [pret] });
    expect(partiel.planAnnuel[0].ressources.caf).toBeNull();
    expect(partiel.planAnnuel[0].variationTresorerie).toBeNull();
    expect(partiel.lecture.join(" ")).toContain("partiel");
    const complet = calculerFinancement({
      ...base,
      apportEspeces: 400_000,
      prets: [pret],
      exploitation: { tresorerieInitiale: 0, cafParAn: [300_000, 400_000, 400_000], investissementsParAn: [1_000_000, 0, 0], variationBfrParAn: [0, 0, 0] },
    });
    const a1 = complet.planAnnuel[0];
    expect(a1.ressources.total).toBe(300_000 + 400_000 + 600_000);
    expect(a1.emplois.total).toBe(1_000_000 + (complet.annees[0].capitalRembourse));
    expect(a1.tresorerieFinale).toBe(a1.variationTresorerie);
    expect(complet.planAnnuel[1].tresorerieInitiale).toBe(a1.tresorerieFinale);
  });

  it("refuse un remboursement avant le tirage et une entrée incomplète", () => {
    expect(() => calculerFinancement({ ...base, creditsCampagne: [{ id: "c", libelle: "x", tauxAnnuel: 0, campagnes: [{ montantDemande: 1, moisTirage: 5, moisRemboursement: 3 }] }] })).toThrow(ErreurMoteur);
    expect(() => calculerFinancement({} as EntreeFinancement)).toThrow(ErreurMoteur);
  });
});
