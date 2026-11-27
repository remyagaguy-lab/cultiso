/** @jest-environment node */
// R9 : le profil du porteur alimente les outils de calcul (coût de vie → M3, apport → M4 et R11), sans rien inventer.
import { calculerFinances, genererBudget } from "@/moteurs";
import type { ApportDuProfil } from "@/modules/cultiplan/profil";
import type { AccesDonnees } from "../donnees";
import { diagnostiquerPlan, enFcfa } from "../outils/calcul";
import type { ContexteOutil } from "../outils/registre";
import { fausseBase, REFERENTIEL_TEST } from "../test-utils/fausse-base";

const contexte = (surcharges: Partial<AccesDonnees>, exploitationId?: string): ContexteOutil => ({
  module: "cultiplan",
  utilisateurId: "u1",
  exploitationId,
  donnees: fausseBase(surcharges),
});

const PROFIL: ApportDuProfil = {
  hypotheses: { prelevementsAnnuels: 900_000, revenusExterieursAnnuels: 200_000 },
  financement: { apport: 350_000 },
  origines: [
    "Prélèvements du ménage : coût de vie déclaré par le porteur (900 000 FCFA par an).",
    "Revenus extérieurs au projet : 200 000 FCFA par an, déclarés par le porteur.",
    "Apport personnel : 200 000 FCFA en espèces et 150 000 FCFA en nature (valeur estimée par le porteur).",
  ],
};

const lireProfilPorteur = jest.fn(async (id: string) => (id === "exp-1" ? PROFIL : null));
beforeEach(() => lireProfilPorteur.mockClear());

function moteur(finance: Parameters<typeof calculerFinances>[0] extends infer E ? Partial<E> : never) {
  const budget = genererBudget({
    ateliers: [{ atelierId: "at-1", speculationCode: "tomate", taille: 2, cyclesParAn: 1 }],
    modelesCharges: REFERENTIEL_TEST.modelesCharges.filter((m) => m.speculationCode === "tomate"),
    modelesRevenus: REFERENTIEL_TEST.modelesRevenus.filter((m) => m.speculationCode === "tomate"),
    regles: REFERENTIEL_TEST.regles,
    contexte: { acces: "isole" },
  });
  return calculerFinances({ charges: budget.charges, revenus: budget.revenus, ...finance });
}

describe("outils de calcul et profil du porteur", () => {
  it("reprend le coût de vie, les revenus extérieurs et l'apport du profil, et en cite l'origine", async () => {
    const r = await diagnostiquerPlan.executer!({}, contexte({ lireProfilPorteur }, "exp-1"));
    const attendu = moteur({ apport: 350_000, menage: { prelevementsAnnuels: 900_000, revenusExterieursAnnuels: 200_000 } });
    expect(r.contenu).toContain(`Coût du projet : ${enFcfa(attendu.scenarios.realiste.ratios.coutProjet)}`);
    expect(r.contenu).toContain("Repris du profil du porteur : Apport personnel : 200 000 FCFA en espèces");
    expect(r.contenu).toContain("Repris du profil du porteur : Prélèvements du ménage");
    expect(r.contenu).toContain("Repris du profil du porteur : Revenus extérieurs");
    expect(r.contenu).not.toContain("coût de vie du ménage inconnu");
  });

  it("ce que la demande précise l'emporte sur le profil", async () => {
    const r = await diagnostiquerPlan.executer!({ apport: 50_000 }, contexte({ lireProfilPorteur }, "exp-1"));
    expect(r.contenu).not.toContain("Repris du profil du porteur : Apport");
    expect(r.contenu).toContain("Repris du profil du porteur : Prélèvements");
    const attendu = moteur({ apport: 50_000, menage: { prelevementsAnnuels: 900_000, revenusExterieursAnnuels: 200_000 } });
    expect(r.contenu).toContain(`Coût du projet : ${enFcfa(attendu.scenarios.realiste.ratios.coutProjet)}`);
  });

  it("sans profil ou sans exploitation, retombe sur le comportement d'avant : ménage non évalué", async () => {
    const sans = await diagnostiquerPlan.executer!({}, contexte({ lireProfilPorteur: async () => null }, "exp-1"));
    expect(sans.contenu).toContain("non évalué");
    expect(sans.contenu).not.toContain("Repris du profil du porteur");
    const autre = await diagnostiquerPlan.executer!({ ateliers: [{ speculation: "Tomate", taille: 2 }] }, contexte({ lireProfilPorteur }));
    expect(autre.contenu).not.toContain("Repris du profil du porteur");
    expect(lireProfilPorteur).not.toHaveBeenCalled();
  });
});
