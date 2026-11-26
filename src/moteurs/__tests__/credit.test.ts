/** @jest-environment node */
import { ErreurMoteur } from "../commun";
import { calculerCredit } from "../credit";

describe("moteur de crédit", () => {
  it("1 000 000 FCFA à 24 % sur 12 mois : mensualité de 94 560 FCFA", () => {
    const r = calculerCredit({ montant: 1_000_000, tauxAnnuel: 0.24, dureeMois: 12 });
    expect(r.mensualite).toBe(94_560);
    expect(r.coutTotal).toBe(134_715);
    expect(r.totalRembourse).toBe(1_134_715);
    expect(r.echeancier).toHaveLength(12);
    expect(r.echeancier[0]).toEqual({
      mois: 1,
      capitalRestantDebut: 1_000_000,
      interets: 20_000,
      amortissement: 74_560,
      echeance: 94_560,
    });
    // Le capital est entièrement remboursé.
    const amorti = r.echeancier.reduce((s, e) => s + e.amortissement, 0);
    expect(Math.abs(amorti - 1_000_000)).toBeLessThanOrEqual(12);
    expect(r.tauxEndettement).toBeNull();
  });

  it("taux nul : le capital est divisé par la durée, sans coût", () => {
    const r = calculerCredit({ montant: 600_000, tauxAnnuel: 0, dureeMois: 6 });
    expect(r.mensualite).toBe(100_000);
    expect(r.coutTotal).toBe(0);
  });

  it("différé partiel de 3 mois : on paie les intérêts, puis 9 mensualités", () => {
    const r = calculerCredit({ montant: 1_000_000, tauxAnnuel: 0.24, dureeMois: 12, differeMois: 3 });
    expect(r.echeancier.slice(0, 3).map((e) => e.echeance)).toEqual([20_000, 20_000, 20_000]);
    expect(r.echeancier.slice(0, 3).every((e) => e.amortissement === 0)).toBe(true);
    expect(r.mensualite).toBe(122_515);
    expect(r.coutTotal).toBe(162_639);
  });

  it("différé total de 3 mois : les intérêts s'ajoutent au capital", () => {
    const r = calculerCredit({
      montant: 1_000_000,
      tauxAnnuel: 0.24,
      dureeMois: 12,
      differeMois: 3,
      typeDiffere: "total",
    });
    expect(r.echeancier.slice(0, 3).every((e) => e.echeance === 0)).toBe(true);
    expect(r.echeancier[3].capitalRestantDebut).toBe(1_061_208);
    expect(r.mensualite).toBe(130_014);
    expect(r.coutTotal).toBe(170_129);
  });

  it("taux d'endettement : mensualité rapportée au revenu mensuel net", () => {
    const r = calculerCredit({ montant: 1_000_000, tauxAnnuel: 0.24, dureeMois: 12, revenuMensuelNet: 300_000 });
    expect(r.tauxEndettement).toBeCloseTo(0.3152, 4);
  });

  it("refuse une entrée invalide avec un message en français", () => {
    expect(() => calculerCredit({ montant: -5, tauxAnnuel: 0.24, dureeMois: 12 })).toThrow(ErreurMoteur);
    try {
      calculerCredit({ montant: 1000, tauxAnnuel: 0.24, dureeMois: 6, differeMois: 6 });
      throw new Error("aurait dû échouer");
    } catch (e) {
      expect(e).toBeInstanceOf(ErreurMoteur);
      expect((e as ErreurMoteur).details.join(" ")).toContain("différé");
    }
  });
});
