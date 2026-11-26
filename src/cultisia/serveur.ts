/**
 * Traitement HTTP commun aux routes `/api/cultisia` et `/api/chat` (adaptateur).
 * Authentifie, valide le corps, vérifie les crédits, rattache la session, puis diffuse le flux SSE.
 * Les dépendances concrètes (Supabase, OpenRouter) viennent d'une fabrique injectable, remplacée dans les tests.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSystemPrompt } from "@/lib/personas";
import { CreditsEpuises } from "./credits";
import { ENTETES_SSE, fluxSSE, type EvenementCultisia } from "./evenements";
import { creerModeleConfigure } from "./llm/compatible-openai";
import { rattacherSession, schemaMessageClient, type StockageSessions } from "./memoire";
import { MODULES, type Module } from "./modules";
import { lancerCultisia, type DependancesCultisia } from "./orchestrateur";
import { registreParDefaut } from "./outils";
import { CreditsSupabase } from "./supabase/credits";
import { DonneesSupabase } from "./supabase/donnees";
import { EmbeddeurHuggingFace } from "./supabase/embeddings";

export const schemaCorpsCultisia = z.object({
  module: z.enum(MODULES),
  ecran: z.string().max(100).optional(),
  exploitationId: z.uuid().optional(),
  sessionId: z.uuid().optional(),
  messages: z.array(schemaMessageClient).min(1).max(200),
});
export type CorpsCultisia = z.infer<typeof schemaCorpsCultisia>;

export interface FabriqueCultisia {
  /** Renvoie l'identifiant de l'utilisateur du jeton, ou null s'il est invalide. */
  authentifier(jeton: string): Promise<string | null>;
  dependances(jeton: string): DependancesCultisia;
  sessions(jeton: string): StockageSessions;
}

export interface OptionsTraitement {
  fabrique?: FabriqueCultisia;
  /** Transforme le flux avant diffusion (l'adaptateur `/api/chat` traduit les nouveaux événements). */
  transformer?: (flux: AsyncIterable<EvenementCultisia>) => AsyncIterable<EvenementCultisia>;
}

function json(corps: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Contrat de sortie transitoire : le module Cultiplan garde le prompt v1.2 (format JSON lu par le canevas)
 * jusqu'au chantier Cultiplan, qui le remplacera par les moteurs de calcul.
 */
export function contratTransitoire(module: Module): string | undefined {
  return module === "cultiplan" ? getSystemPrompt("Chat", "cultiplan", "", "") : undefined;
}

export async function traiterCultisia(
  req: Request,
  lireCorps: (brut: unknown) => unknown,
  { fabrique = fabriqueSupabase(), transformer }: OptionsTraitement = {},
): Promise<Response> {
  const entete = req.headers.get("Authorization");
  if (!entete?.startsWith("Bearer ")) return json({ error: "Non autorisé" }, 401);
  const jeton = entete.slice("Bearer ".length).trim();

  let utilisateurId: string | null;
  try {
    utilisateurId = await fabrique.authentifier(jeton);
  } catch (erreur) {
    console.error("[cultisia] authentification impossible", erreur);
    return json({ error: "Service indisponible" }, 503);
  }
  if (!utilisateurId) return json({ error: "Token invalide" }, 401);

  let brut: unknown;
  try {
    brut = await req.json();
  } catch {
    return json({ error: "Corps de requête illisible" }, 400);
  }
  const corps = schemaCorpsCultisia.safeParse(lireCorps(brut));
  if (!corps.success) return json({ error: "Requête invalide", details: z.treeifyError(corps.error) }, 400);
  const { module, ecran, exploitationId, sessionId, messages } = corps.data;

  try {
    await rattacherSession(fabrique.sessions(jeton), sessionId, module, exploitationId);
    const flux = await lancerCultisia(
      {
        module,
        utilisateurId,
        messages,
        ecran,
        exploitation: exploitationId ? { id: exploitationId } : undefined,
        contratModule: contratTransitoire(module),
      },
      fabrique.dependances(jeton),
    );
    return new Response(fluxSSE(transformer ? transformer(flux) : flux), { headers: ENTETES_SSE });
  } catch (erreur) {
    if (erreur instanceof CreditsEpuises) {
      return json({ error: "CREDITS_EMPTY", message: "Tes crédits Cultisia sont épuisés." }, 402);
    }
    console.error("[cultisia] erreur avant la génération", erreur);
    return json({ error: "Désolé, le service est temporairement indisponible." }, 500);
  }
}

function variable(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) throw new Error(`${nom} n'est pas définie sur le serveur.`);
  return valeur;
}

/** Fabrique de production : Supabase (droits de l'utilisateur pour les données, clé de service pour les crédits) et le fournisseur de modèle configuré. */
export function fabriqueSupabase(): FabriqueCultisia {
  let admin: SupabaseClient | null = null;
  const clientAdmin = () =>
    (admin ??= createClient(variable("NEXT_PUBLIC_SUPABASE_URL"), variable("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    }));
  const clientUtilisateur = (jeton: string) =>
    createClient(variable("NEXT_PUBLIC_SUPABASE_URL"), variable("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: `Bearer ${jeton}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

  return {
    async authentifier(jeton) {
      const { data, error } = await clientAdmin().auth.getUser(jeton);
      return error || !data.user ? null : data.user.id;
    },
    dependances(jeton) {
      const { modele, nomModele } = creerModeleConfigure();
      return {
        modele,
        nomModele,
        registre: registreParDefaut(),
        credits: new CreditsSupabase(clientAdmin()),
        donnees: new DonneesSupabase(clientUtilisateur(jeton), new EmbeddeurHuggingFace(process.env.HUGGINGFACE_API_KEY)),
      };
    },
    sessions(jeton) {
      const client = clientUtilisateur(jeton);
      return {
        async rattacher(sessionId, rattachement) {
          const { error } = await client.from("chat_sessions").update(rattachement).eq("id", sessionId);
          if (error) throw error;
        },
      };
    },
  };
}
