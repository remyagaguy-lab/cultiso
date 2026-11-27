/** @jest-environment node */
import { ErreurMoteur } from "..";
import { simulerTroupeau } from "../troupeau";

describe("cheptel en flux (M14)", () => {
  const base = {
    horizonMois: 6,
    categories: [
      { code: "brebis", libelle: "Brebis", effectifInitial: 10 },
      { code: "agneaux", libelle: "Agneaux", effectifInitial: 0 },
    ],
    mouvements: [
      { mois: 1, categorie: "brebis", type: "achat" as const, effectif: 5, prixUnitaire: 40000 },
      { mois: 2, categorie: "agneaux", type: "naissance" as const, effectif: 8 },
      { mois: 3, categorie: "agneaux", type: "mortalite" as const, effectif: 1 },
      { mois: 5, categorie: "agneaux", type: "vente" as const, effectif: 4, prixUnitaire: 30000 },
      { mois: 6, categorie: "brebis", type: "vente" as const, effectif: 2, prixUnitaire: 45000 },
      { mois: 6, categorie: "brebis", type: "autoconsommation" as const, effectif: 1 },
    ],
  };

  it("tient les comptes de chaque catégorie : entrées, sorties, effectif de fin et croît (fin − début)", () => {
    const r = simulerTroupeau(base);
    const brebis = r.categories.find((c) => c.code === "brebis")!;
    expect(brebis).toMatchObject({ debut: 10, totalEntrees: 5, totalSorties: 3, fin: 12, croit: 2 });
    const agneaux = r.categories.find((c) => c.code === "agneaux")!;
    expect(agneaux).toMatchObject({ debut: 0, totalEntrees: 8, totalSorties: 5, fin: 3, croit: 3 });
    expect(agneaux.mois[1]).toMatchObject({ mois: 2, debut: 0, fin: 8, croit: 8, entrees: { naissance: 8 } });
    expect(agneaux.mois[2].sorties).toEqual({ mortalite: 1 });
    expect(brebis.mois[5].sorties).toEqual({ vente: 2, autoconsommation: 1 });
  });

  it("trésorerie : achats et ventes au prix donné, mouvements sans prix signalés au lieu d'être valorisés", () => {
    const r = simulerTroupeau({ ...base, mouvements: [...base.mouvements, { mois: 4, categorie: "agneaux", type: "vente" as const, effectif: 1 }] });
    expect(r.tresorerie[0]).toMatchObject({ mois: 1, achats: 200000, ventes: 0, solde: -200000 });
    expect(r.tresorerie[4]).toMatchObject({ mois: 5, ventes: 120000 });
    expect(r.tresorerie[5]).toMatchObject({ mois: 6, ventes: 90000, solde: 90000 });
    expect(r.tresorerie[3].ventes).toBe(0);
    expect(r.mouvementsSansPrix).toBe(1);
  });

  it("une entrée du mois peut ressortir le même mois ; sortir plus qu'on n'a est refusé avec le mois et la catégorie", () => {
    const ok = simulerTroupeau({
      horizonMois: 1,
      categories: [{ code: "a", effectifInitial: 0 }],
      mouvements: [{ mois: 1, categorie: "a", type: "vente", effectif: 2 }, { mois: 1, categorie: "a", type: "achat", effectif: 2 }],
    });
    expect(ok.categories[0].fin).toBe(0);
    expect(() => simulerTroupeau({ ...base, mouvements: [{ mois: 2, categorie: "agneaux", type: "vente", effectif: 1 }] })).toThrow(/Au mois 2.*Agneaux.*n'en compte que 0/);
  });

  it("refuse une catégorie inconnue, un mois hors horizon et des codes en double", () => {
    expect(() => simulerTroupeau({ ...base, mouvements: [{ mois: 1, categorie: "boucs", type: "achat", effectif: 1 }] })).toThrow(/catégorie inconnue/);
    expect(() => simulerTroupeau({ ...base, mouvements: [{ mois: 7, categorie: "brebis", type: "achat", effectif: 1 }] })).toThrow(/dépasse l'horizon/);
    expect(() => simulerTroupeau({ ...base, categories: [base.categories[0], base.categories[0]] })).toThrow(ErreurMoteur);
  });
});
