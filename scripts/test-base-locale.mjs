// Lance le test d'intégration Cultisia sur la base Supabase LOCALE (npm run db:start avant).
import { spawnSync } from "node:child_process";

const resultat = spawnSync("npx", ["jest", "src/cultisia/__tests__/base-locale", "src/core/__tests__/exploitation-base-locale", "src/referentiel/__tests__/referentiel-base-locale", "src/referentiel/__tests__/financeurs-base-locale", "src/modules/cultiplan/__tests__/plans-base-locale"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, CULTISIA_BASE_LOCALE: "1" },
});
process.exit(resultat.status ?? 1);
