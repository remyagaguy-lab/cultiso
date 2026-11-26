/** @jest-environment node */
import annonces from "@/data/prix_extraits_togo.json";
import { annoncesVersReleves, lireDateAnnonce, lirePrixAnnonce, SOURCE_ANNONCES } from "../prix/annonces";

describe("import des annonces de prix WhatsApp", () => {
  it("lit les montants courants", () => {
    expect(lirePrixAnnonce("1000 fcfa")).toEqual({ prix: 1000, unite: null });
    expect(lirePrixAnnonce("6 000 FCFA par guide")).toEqual({ prix: 6000, unite: "guide" });
    expect(lirePrixAnnonce("5000 fr")).toEqual({ prix: 5000, unite: null });
    expect(lirePrixAnnonce("25.000 F le sac de 50 kg")).toEqual({ prix: 25000, unite: "sac de 50 kg" });
    expect(lirePrixAnnonce("35.000 FCFA/mois")).toEqual({ prix: 35000, unite: "mois" });
    expect(lirePrixAnnonce("500f l'unité")).toEqual({ prix: 500, unite: "unité" });
    expect(lirePrixAnnonce("1200 le kg")).toEqual({ prix: 1200, unite: "kg" });
    expect(lirePrixAnnonce("150 f kg")).toEqual({ prix: 150, unite: "kg" });
    expect(lirePrixAnnonce("Inbox pour ton prix")).toBeNull();
    expect(lirePrixAnnonce("bon prix")).toBeNull();
    expect(lirePrixAnnonce(null)).toBeNull();
  });

  it("convertit les dates", () => {
    expect(lireDateAnnonce("02/01/2026")).toBe("2026-01-02");
    expect(lireDateAnnonce("2026-01-02")).toBeNull();
  });

  it("ne garde jamais le vendeur et écarte les annonces sans prix", () => {
    const releves = annoncesVersReleves([
      { date: "06/01/2026", produit: "Poules Goliath", prix: "5000 fr", vendeur: "+228 96 24 80 95", localisation: "Legbassito" },
      { date: "06/01/2026", produit: "Poussins", prix: "Inbox pour ton prix", vendeur: "+228 00 00 00 00" },
      { date: "06/01/2026", produit: "Piment", prix: null },
    ]);
    expect(releves).toEqual([
      { produit: "Poules Goliath", prix: 5000, unite: null, lieu: "Legbassito", date: "2026-01-06", source: SOURCE_ANNONCES },
    ]);
    expect(JSON.stringify(releves)).not.toMatch(/\+228/);
  });

  it("traite le fichier réel sans exposer de numéro de téléphone", () => {
    const releves = annoncesVersReleves(annonces);
    expect(releves.length).toBeGreaterThan(0);
    expect(releves.length).toBeLessThanOrEqual(annonces.length);
    expect(JSON.stringify(releves)).not.toMatch(/\+228|\b9\d \d\d \d\d \d\d\b/);
    for (const r of releves) {
      expect(r.prix).toBeGreaterThan(0);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
