// Serveur de développement branché sur la base Supabase LOCALE (npm run db:start avant), sur le port 3100,
// avec son propre dossier de build : il peut tourner à côté d'un `next dev` branché sur la base en ligne.
// Rien n'est écrit en ligne : les adresses et clés locales viennent de `supabase status` et ne sont jamais affichées.
import { execSync, spawn } from "node:child_process";

const statut = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
if (!/127\.0\.0\.1|localhost/.test(statut.API_URL)) {
  console.error("Refus : la base n'est pas locale.");
  process.exit(1);
}
const port = process.env.PORT_LOCAL ?? "3100";
const enfant = spawn("npx", ["next", "dev", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    NEXT_DIST_DIR: ".next-local",
    NEXT_PUBLIC_SUPABASE_URL: statut.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: statut.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: statut.SERVICE_ROLE_KEY,
  },
});
enfant.on("exit", (code) => process.exit(code ?? 0));
