import { membresDepuisProfil, schemaDemandeMainOeuvre } from "../main-oeuvre";
import { ProfilPorteurVide } from "../test-utils/profil-vide";

describe("main d'oeuvre d'une exploitation (R2)", () => {
  it("lit la famille dans le profil : actifs et heures par semaine, converties en heures par mois", () => {
    const { membres, origine } = membresDepuisProfil(ProfilPorteurVide({ familleActifs: 2, familleHeuresSemaine: 60 }));
    expect(membres).toHaveLength(2);
    expect(membres[0].heuresParMois).toBe(130); // 30 h par semaine × 52 / 12
    expect(membres[0].type).toBe("famille");
    expect(origine).toContain("2 actif(s)");
  });

  it("profil sans réponse : aucun membre inventé", () => {
    expect(membresDepuisProfil(ProfilPorteurVide()).membres).toEqual([]);
    expect(membresDepuisProfil(ProfilPorteurVide({ familleActifs: 0, familleHeuresSemaine: 10 })).membres).toEqual([]);
    expect(membresDepuisProfil(ProfilPorteurVide({ familleActifs: 2 })).membres).toEqual([]);
  });

  it("le corps accepte l'absence de membres, pas l'absence de besoins", () => {
    expect(schemaDemandeMainOeuvre.safeParse({ besoinsHeuresParMois: Array(12).fill(10) }).success).toBe(true);
    expect(schemaDemandeMainOeuvre.safeParse({}).success).toBe(false);
  });
});
