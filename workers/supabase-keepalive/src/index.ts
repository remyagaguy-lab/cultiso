export interface Env {
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
}

async function pingSupabase(env: Env) {
  const supabaseUrl =
    env.SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://redtuedpnhbqziqmyyjc.supabase.co";
  const anonKey = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  // Endpoint officiel de santé Supabase (accessible avec la clé anon, retourne 200 OK)
  const targetUrl = `${supabaseUrl}/auth/v1/health`;

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`,
      },
    });

    const isOk = response.ok;
    console.log(`[Supabase Keep-Alive] Statut HTTP: ${response.status}`);

    return {
      success: isOk,
      statusCode: response.status,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error("[Supabase Keep-Alive] Erreur lors du ping:", err);
    return {
      success: false,
      error: err?.message || String(err),
      timestamp: new Date().toISOString(),
    };
  }
}

export default {
  // Déclenché automatiquement par le Cron Trigger de Cloudflare
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(pingSupabase(env));
  },

  // Permet de tester le Worker manuellement via le navigateur ou curl
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const result = await pingSupabase(env);
    return new Response(JSON.stringify(result, null, 2), {
      status: result.success ? 200 : 502,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    });
  },
};
