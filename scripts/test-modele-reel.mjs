// Essai de Cultisia avec le vrai modèle configuré dans .env.local (CULTISIA_FOURNISSEUR), sur une fausse base.
import { spawnSync } from "node:child_process";

// En mode test, Next ne lit pas .env.local : on le charge ici.
process.loadEnvFile(".env.local");

const resultat = spawnSync("npx", ["jest", "src/cultisia/__tests__/modele-reel"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, CULTISIA_MODELE_REEL: "1" },
});
process.exit(resultat.status ?? 1);
