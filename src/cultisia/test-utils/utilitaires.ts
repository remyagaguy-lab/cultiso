import type { EvenementCultisia } from "../evenements";

export async function collecter(flux: AsyncIterable<EvenementCultisia>): Promise<EvenementCultisia[]> {
  const evenements: EvenementCultisia[] = [];
  for await (const e of flux) evenements.push(e);
  return evenements;
}

export function texteDe(evenements: EvenementCultisia[]): string {
  return evenements.map((e) => (e.type === "token" ? e.content : "")).join("");
}

/** Lit un corps SSE et renvoie les objets `data:`. */
export async function lireSSE(corps: ReadableStream<Uint8Array>): Promise<Record<string, unknown>[]> {
  const texte = await new Response(corps).text();
  return texte
    .split("\n\n")
    .filter((bloc) => bloc.startsWith("data: "))
    .map((bloc) => JSON.parse(bloc.slice(6)) as Record<string, unknown>);
}
