import { configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { QuestionAffichee } from "@/modules/cultiplan";
import { ConsultationPorteur, type VueConsultation } from "./ConsultationPorteur";

// Ant Design s'appuie sur ces deux API du navigateur, absentes de jsdom.
class ResizeObserverFactice {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverFactice;
window.matchMedia ??= ((requete: string) => ({ matches: false, media: requete, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;

// Ant Design est lent à s'afficher dans jsdom : on laisse du temps aux attentes.
jest.setTimeout(90000);
configure({ asyncUtilTimeout: 30000 });

jest.mock("./api", () => ({ appeler: jest.fn(), ErreurApi: class extends Error {} }));

const temps = (cle: string, titre: string) => ({ cle, titre, traitees: 0, total: 2 });
const q = (s: Partial<QuestionAffichee>): QuestionAffichee => ({
  cle: "idee", temps: "idee", tempsTitre: "Ton idée et toi", libelle: "Dis-moi ce que tu veux produire.", aide: "Pas besoin de chiffres.", type: "texte", unite: null, reponses: [], cible: "contexte", champ: "idee", valeur: null, etat: "a_poser", ...s,
});

function vue(courante: QuestionAffichee | null, plus: Partial<VueConsultation> = {}): VueConsultation {
  return {
    prochaine: { fini: courante === null, question: null, temps: courante ? { cle: "idee", ordre: 1, titre: "Ton idée et toi", intro: "On commence." } : null, introTemps: courante ? "On commence par comprendre ton idée." : null, avancement: [temps("idee", "Ton idée et toi"), temps("existant", "Ce que tu as déjà")] },
    manques: [],
    point: { dimensions: [{ dimension: "eau", libelle: "L'eau", feu: "rouge", phrase: "Tu n'as pas d'eau.", points: [], manques: [], inconnus: [] }, { dimension: "terre", libelle: "La terre", feu: "gris", phrase: "Il manque encore ta terre.", points: [], manques: ["ta terre"], inconnus: [] }], feuGlobal: "rouge", essentielles: { traitees: 3, total: 10 }, aValider: true },
    questions: courante ? [courante] : [],
    ...plus,
  } as unknown as VueConsultation;
}
const profilVide = { existe: false, valeurs: {}, existant: [], credits: [], sansExistant: false, sansCredit: false, inconnus: [] };

function api(reponses: Record<string, unknown>) {
  return jest.fn(async (chemin: string, init?: RequestInit) => {
    if (init?.method === "POST") return { ok: true };
    const cle = chemin.includes("/profil") ? "profil" : "entretien";
    const r = reponses[cle];
    return typeof r === "function" ? (r as () => unknown)() : r;
  });
}

describe("consultation du porteur", () => {
  it("pose la question avec « Je ne sais pas » toujours visible, et envoie la réponse", async () => {
    const courante = q({});
    const premiere = vue(courante);
    premiere.prochaine.question = { cle: "idee" } as never;
    const apres = vue(null);
    const appels = [premiere, apres];
    const mock = api({ entretien: () => appels.shift() ?? apres, profil: profilVide });
    render(<ConsultationPorteur exploitationId="exp-1" api={mock as never} />);
    expect(await screen.findByRole("heading", { name: "Dis-moi ce que tu veux produire." })).toBeInTheDocument();
    expect(screen.getByText("Pas besoin de chiffres.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Je ne sais pas" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Plus tard" })).toBeEnabled();
    expect(screen.getByText("On commence par comprendre ton idée.")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "des tomates" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    await waitFor(() => expect(mock).toHaveBeenCalledWith("/api/cultiplan/exploitations/exp-1/entretien", { method: "POST", body: JSON.stringify({ reponses: [{ question: "idee", valeur: "des tomates" }] }) }));
    // Plus de question : on passe au point sur le projet.
    expect(await screen.findByText("Le point sur ton projet")).toBeInTheDocument();
  });

  it("refuse une saisie vide avec une phrase simple, sans appeler le serveur", async () => {
    const premiere = vue(q({}));
    premiere.prochaine.question = { cle: "idee" } as never;
    const mock = api({ entretien: premiere, profil: profilVide });
    render(<ConsultationPorteur exploitationId="exp-1" api={mock as never} />);
    fireEvent.click(await screen.findByRole("button", { name: "Valider" }));
    expect(await screen.findByText("Écris quelques mots, ou dis que tu ne sais pas.")).toHaveAttribute("role", "alert");
    expect(mock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });

  it("envoie « je ne sais pas » sans valeur", async () => {
    const premiere = vue(q({}));
    premiere.prochaine.question = { cle: "idee" } as never;
    const mock = api({ entretien: premiere, profil: profilVide });
    render(<ConsultationPorteur exploitationId="exp-1" api={mock as never} />);
    fireEvent.click(await screen.findByRole("button", { name: "Je ne sais pas" }));
    await waitFor(() => expect(mock).toHaveBeenCalledWith("/api/cultiplan/exploitations/exp-1/entretien", { method: "POST", body: JSON.stringify({ reponses: [{ question: "idee", neSaitPas: true }] }) }));
  });

  it("« Plus tard » recharge en laissant la question de côté", async () => {
    const premiere = vue(q({}));
    premiere.prochaine.question = { cle: "idee" } as never;
    const mock = api({ entretien: premiere, profil: profilVide });
    render(<ConsultationPorteur exploitationId="exp-1" api={mock as never} />);
    fireEvent.click(await screen.findByRole("button", { name: "Plus tard" }));
    await waitFor(() => expect(mock).toHaveBeenCalledWith("/api/cultiplan/exploitations/exp-1/entretien?reportees=idee"));
  });

  it("montre le point de faisabilité avec le mot du feu, pas seulement une couleur", async () => {
    const mock = api({ entretien: vue(null), profil: profilVide });
    render(<ConsultationPorteur exploitationId="exp-1" api={mock as never} />);
    const eau = (await screen.findByRole("heading", { name: "L'eau" })).closest("li") as HTMLElement;
    expect(within(eau).getByText(/Rouge : ça bloque/)).toBeInTheDocument();
    expect(within(eau).getByText("Tu n'as pas d'eau.")).toBeInTheDocument();
    const terre = screen.getByRole("heading", { name: "La terre" }).closest("li") as HTMLElement;
    expect(within(terre).getByText(/Gris : on ne sait pas encore/)).toBeInTheDocument();
    expect(screen.getByText(/brouillons en cours de relecture/)).toBeInTheDocument();
  });

  it("affiche l'erreur du serveur en phrase lisible", async () => {
    const mock = jest.fn(async () => {
      throw new Error("Connecte-toi pour continuer ta consultation.");
    });
    render(<ConsultationPorteur exploitationId="exp-1" api={mock as never} />);
    expect(await screen.findByText("Connecte-toi pour continuer ta consultation.")).toBeInTheDocument();
  });
});
