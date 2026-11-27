/** @jest-environment node */
import { calculerCredit, calculerFinances, genererBudget, VERSION_MOTEURS } from "@/moteurs";
import { CreditsEnMemoire } from "../credits";
import type { AccesDonnees } from "../donnees";
import { appel, FauxModele, texte, usage } from "../llm/faux-modele";
import { lancerCultisia } from "../orchestrateur";
import { registreParDefaut } from "../outils";
import { calculerCreditOutil, calculerPlan, comparerFilieres, enFcfa, enFcfaPrix, enPourcent, trouverSpeculation } from "../outils/calcul";
import type { ContexteOutil } from "../outils/registre";
import { fausseBase, REFERENTIEL_TEST } from "../test-utils/fausse-base";
import { collecter, texteDe } from "../test-utils/utilitaires";

const contexte = (surcharges: Partial<AccesDonnees> = {}, exploitationId?: string, module: ContexteOutil["module"] = "cultiplan"): ContexteOutil => ({
  module,
  utilisateurId: "u1",
  exploitationId,
  donnees: fausseBase(surcharges),
});

/** Ce que les moteurs donnent directement, sans passer par l'outil. */
function attendu(ateliers: { id: string; speculationCode: string; taille: number; cyclesParAn: number }[], contexteTerrain: Record<string, string> = {}, finance = {}) {
  const codes = new Set(ateliers.map((a) => a.speculationCode));
  const budget = genererBudget({
    ateliers: ateliers.map((a) => ({ atelierId: a.id, speculationCode: a.speculationCode, taille: a.taille, cyclesParAn: a.cyclesParAn })),
    modelesCharges: REFERENTIEL_TEST.modelesCharges.filter((m) => codes.has(m.speculationCode)),
    modelesRevenus: REFERENTIEL_TEST.modelesRevenus.filter((m) => codes.has(m.speculationCode)),
    regles: REFERENTIEL_TEST.regles,
    contexte: contexteTerrain,
  });
  return calculerFinances({ charges: budget.charges, revenus: budget.revenus, ...finance });
}

let espion: jest.SpyInstance;
beforeEach(() => (espion = jest.spyOn(console, "error").mockImplementation(() => {})));
afterEach(() => espion.mockRestore());

describe("calculer_credit", () => {
  it("restitue exactement le calcul du moteur de crédit", async () => {
    const entree = { montant: 1_000_000, tauxAnnuel: 0.24, dureeMois: 12, revenuMensuelNet: 300_000 };
    const moteur = calculerCredit(entree);
    const r = await calculerCreditOutil.executer!(entree, contexte());
    expect(r.contenu).toContain(`mensualité : ${enFcfa(moteur.mensualite)}`);
    expect(r.contenu).toContain(`coût du crédit (intérêts) : ${enFcfa(moteur.coutTotal)}`);
    expect(r.contenu).toContain(`taux d'endettement : ${enPourcent(moteur.tauxEndettement)}`);
    expect(r.contenu).toContain("mensualité : 94 560 FCFA");
    expect(r.sources).toEqual([{ file_name: `Moteur de crédit Cultiso (version ${VERSION_MOTEURS})`, origine: "moteur" }]);
  });

  it("renvoie au modèle le refus du moteur, sans chiffre", async () => {
    const r = await calculerCreditOutil.executer!({ montant: 500_000, tauxAnnuel: 0.2, dureeMois: 6, differeMois: 6 }, contexte());
    expect(r.contenu).toMatch(/^ENTRÉE REFUSÉE PAR LE MOTEUR/);
    expect(r.contenu).toContain("différé");
    expect(r.sources).toBeUndefined();
  });

  it("le registre refuse un taux en pourcentage entier", () => {
    const v = registreParDefaut().valider("calculer_credit", JSON.stringify({ montant: 1e6, tauxAnnuel: 24, dureeMois: 12 }), "cultima");
    expect(v.ok).toBe(false);
  });
});

describe("calculer_plan", () => {
  it("calcule des ateliers donnés : les chiffres sont ceux des moteurs", async () => {
    const moteur = attendu([{ id: "atelier_1", speculationCode: "tomate", taille: 2, cyclesParAn: 2 }], {}, { apport: 100_000 });
    const r = await calculerPlan.executer!({ ateliers: [{ speculation: "Tomate", taille: 2 }], apport: 100_000 }, contexte());
    const re = moteur.scenarios.realiste;
    expect(r.contenu).toContain("Plan calculé pour Tomate : 2 ha (horizon 3 ans)");
    expect(r.contenu).toContain(`investissement total : ${enFcfa(moteur.investissementTotal)}`);
    expect(r.contenu).toContain(`besoin de financement (investissement + fonds de roulement − apport) : ${enFcfa(moteur.besoinFinancement)}`);
    expect(r.contenu).toContain(`- realiste : chiffre d'affaires an 1 ${enFcfa(re.annees[0].chiffreAffaires)}, résultat an 1 ${enFcfa(re.annees[0].resultat)}, VAN ${enFcfa(re.van)}, TRI ${enPourcent(re.tri)}`);
    expect(r.contenu).toContain("chiffre d'affaires an 1 3 840 000 FCFA");
    expect(r.contenu).toContain("ATTENTION : une partie des données sont des estimations");
    expect(r.sources?.map((s) => s.origine)).toEqual(["moteur", "referentiel"]);
  });

  it("M3 : revenu du ménage, point bas et seuil de commercialisation, tels que calculés par le moteur", async () => {
    const finance = { apport: 100_000, coutVieAnnuel: 900_000, revenusExterieursAnnuels: 300_000 };
    const moteur = attendu([{ id: "atelier_1", speculationCode: "tomate", taille: 2, cyclesParAn: 2 }], {}, {
      apport: 100_000,
      menage: { prelevementsAnnuels: 900_000, revenusExterieursAnnuels: 300_000 },
    });
    const r = await calculerPlan.executer!({ ateliers: [{ speculation: "Tomate", taille: 2 }], ...finance }, contexte());
    const re = moteur.scenarios.realiste;
    const a1 = re.annees[0];
    expect(a1.prelevementsNets).toBe(600_000);
    expect(r.contenu).toContain(`- an 1 : capacité de remboursement ${enFcfa(a1.capaciteRemboursement)}, annuités ${enFcfa(a1.annuites)}, solde résiduel ${enFcfa(a1.soldeResiduel)}`);
    expect(r.contenu).toContain(`ménage couvert chaque année : ${re.verdict.menageCouvert ? "oui" : "non"}`);
    expect(r.contenu).toContain(`point bas de trésorerie (an 1, scénario réaliste) : ${enFcfa(re.pointBasTresorerie.montant)}`);
    expect(r.contenu).toContain(`${enFcfaPrix(re.seuilCommercialisation.parLigne[0].prixSeuil)} par unité vendue`);
    const sansMenage = await calculerPlan.executer!({ ateliers: [{ speculation: "Tomate", taille: 2 }] }, contexte());
    expect(sansMenage.contenu).toContain("revenu du ménage : non évalué");
    expect(enFcfaPrix(91.43)).toBe("91,43 FCFA");
  });

  it("M4 : restitue les contrôles du moteur à signaler, avec leur phrase", async () => {
    const moteur = attendu([{ id: "atelier_1", speculationCode: "tomate", taille: 2, cyclesParAn: 2 }]);
    const r = await calculerPlan.executer!({ ateliers: [{ speculation: "Tomate", taille: 2 }] }, contexte());
    const aSignaler = moteur.scenarios.realiste.controles.filter((c) => c.niveau !== "ok");
    expect(aSignaler.length).toBeGreaterThan(0);
    for (const c of aSignaler) expect(r.contenu).toContain(`- [${c.niveau}] ${c.code} : ${c.message}`);
    expect(r.contenu).not.toContain("[ok]");
  });

  it("sans ateliers, calcule l'exploitation active avec son contexte terrain", async () => {
    const moteur = attendu([{ id: "at-1", speculationCode: "tomate", taille: 2, cyclesParAn: 2 }], { acces: "isole" });
    const r = await calculerPlan.executer!({}, contexte({}, "exp-1"));
    expect(r.contenu).toContain(`résultat an 1 ${enFcfa(moteur.scenarios.realiste.annees[0].resultat)}`);
    // La règle « zone isolée » (main-d'œuvre × 1,5) a bien été appliquée.
    expect(moteur.scenarios.realiste.annees[0].resultat).toBeLessThan(attendu([{ id: "x", speculationCode: "tomate", taille: 2, cyclesParAn: 2 }]).scenarios.realiste.annees[0].resultat);
  });

  it("dit honnêtement ce qui manque", async () => {
    expect((await calculerPlan.executer!({}, contexte())).contenu).toMatch(/^AUCUN ATELIER/);
    expect((await calculerPlan.executer!({}, contexte({}, "exp-x"))).contenu).toMatch(/^EXPLOITATION INTROUVABLE/);
    const inconnue = await calculerPlan.executer!({ ateliers: [{ speculation: "cacao", taille: 1 }] }, contexte());
    expect(inconnue.contenu).toMatch(/^SPÉCULATION INCONNUE DU RÉFÉRENTIEL : cacao/);
    expect(inconnue.contenu).toContain("Poulet de chair (poulet_chair, par sujets)");
    const panne = await calculerPlan.executer!({ ateliers: [{ speculation: "tomate", taille: 1 }] }, contexte({ preparerBudget: async () => { throw new Error("base injoignable"); } }));
    expect(panne.contenu).toMatch(/^ERREUR D'ACCÈS/);
  });

  it("n'est permis que dans Cultisia et Cultiplan", () => {
    const registre = registreParDefaut();
    expect(registre.pour("cultima").map((o) => o.nom)).toContain("calculer_credit");
    expect(registre.pour("cultima").map((o) => o.nom)).not.toContain("calculer_plan");
    expect(registre.pour("cultiplan").map((o) => o.nom)).toEqual(expect.arrayContaining(["calculer_plan", "comparer_filieres", "calculer_credit"]));
  });
});

describe("comparer_filieres", () => {
  it("compare chaque spéculation avec les moteurs, à sa taille", async () => {
    const tomate = attendu([{ id: "tomate", speculationCode: "tomate", taille: 1, cyclesParAn: 2 }]);
    const poulet = attendu([{ id: "poulet_chair", speculationCode: "poulet_chair", taille: 500, cyclesParAn: 4 }]);
    const r = await comparerFilieres.executer!({ speculations: [{ speculation: "tomate" }, { speculation: "poulet de chair", taille: 500 }] }, contexte());
    expect(r.contenu).toContain(`- Tomate (1 ha) : investissement ${enFcfa(tomate.investissementTotal)}, chiffre d'affaires an 1 ${enFcfa(tomate.scenarios.realiste.annees[0].chiffreAffaires)}`);
    expect(r.contenu).toContain(`- Poulet de chair (500 sujets) : investissement ${enFcfa(poulet.investissementTotal)}`);
    expect(r.contenu).toContain(`VAN ${enFcfa(poulet.scenarios.realiste.van)}`);
    expect(r.contenu).toContain(`statut pessimiste ${poulet.scenarios.pessimiste.statut}`);
  });

  it("signale une spéculation sans données de référence", async () => {
    const r = await comparerFilieres.executer!({ speculations: [{ speculation: "vanille" }, { speculation: "tomate" }] }, contexte());
    expect(r.contenu).toContain("- Vanille (1 ha) : aucune donnée de référence, non chiffré");
  });

  it("retrouve une spéculation par son nom ou son code", async () => {
    const catalogue = await fausseBase().listerSpeculations();
    expect(trouverSpeculation(catalogue, "Poulet de chair")?.code).toBe("poulet_chair");
    expect(trouverSpeculation(catalogue, "poulet_chair")?.code).toBe("poulet_chair");
    expect(trouverSpeculation(catalogue, "tomates")?.code).toBe("tomate");
    expect(trouverSpeculation(catalogue, "igname")).toBeUndefined();
  });
});

describe("orchestrateur avec un faux modèle : l'IA ne calcule jamais", () => {
  it("appelle calculer_plan, reçoit les chiffres du moteur et les cite", async () => {
    const moteur = attendu([{ id: "atelier_1", speculationCode: "tomate", taille: 2, cyclesParAn: 2 }]);
    const ca = enFcfa(moteur.scenarios.realiste.annees[0].chiffreAffaires);
    const modele = new FauxModele([
      [appel("calculer_plan", { ateliers: [{ speculation: "tomate", taille: 2 }] }), usage(40)],
      [texte(`D'après le moteur financier de Cultiso, ton chiffre d'affaires réaliste en an 1 serait de ${ca}.`), usage(60)],
    ]);
    const evenements = await collecter(
      await lancerCultisia(
        { module: "cultiplan", utilisateurId: "u1", messages: [{ role: "user", content: "Combien rapportent 2 ha de tomate ?" }] },
        { modele, registre: registreParDefaut(), credits: new CreditsEnMemoire(new Map()), donnees: fausseBase(), nomModele: "faux/modele" },
      ),
    );
    expect(modele.requetes[0].outils?.map((o) => o.function.name)).toEqual(expect.arrayContaining(["calculer_plan", "comparer_filieres", "calculer_credit"]));
    const resultatOutil = modele.requetes[1].messages.at(-1);
    expect(resultatOutil).toMatchObject({ role: "tool", tool_call_id: "appel_calculer_plan_0" });
    expect(resultatOutil?.content).toContain(`chiffre d'affaires an 1 ${ca}`);
    expect(evenements.find((e) => e.type === "sources")).toEqual({
      type: "sources",
      sources: [
        { file_name: `Moteur financier Cultiso (version ${VERSION_MOTEURS})`, origine: "moteur" },
        { file_name: "Référentiel agricole Cultiso", origine: "referentiel" },
      ],
    });
    expect(texteDe(evenements)).toContain(ca);
  });

  it("l'expertise agroéconomiste impose les outils de calcul", async () => {
    const modele = new FauxModele([[texte("Dis-moi la taille de ton projet."), usage(10)]]);
    await collecter(
      await lancerCultisia(
        { module: "cultiplan", utilisateurId: "u1", messages: [{ role: "user", content: "Mon projet de tomate est-il rentable ?" }] },
        { modele, registre: registreParDefaut(), credits: new CreditsEnMemoire(new Map()), donnees: fausseBase(), nomModele: "faux/modele" },
      ),
    );
    const systeme = String(modele.requetes[0].messages[0].content);
    expect(systeme).toContain("calculer_plan");
    expect(systeme).toContain("Restitue les chiffres de l'outil tels quels");
  });
});
