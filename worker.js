export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      try {
        const result = await env.DB
          .prepare(`
            SELECT
              last_heartbeat_at,
              cycle_count,
              runtime_version
            FROM runtime_meta
            WHERE id = 1
          `)
          .first();

        return json({
          ok: true,
          service: "AI Company Core Cloud Runtime",
          runtime: "5.0-cloud-foundation",
          database: true,
          runtime_meta: result || null,
          time: new Date().toISOString()
        });
      } catch (error) {
        return json(
          {
            ok: false,
            database: false,
            error: String(error)
          },
          500
        );
      }
    }

    if (url.pathname === "/api/heartbeat") {
      return heartbeat(env);
    }

    if (url.pathname === "/api/state") {
      const key = url.searchParams.get("key");

      if (!key) {
        return json(
          {
            ok: false,
            error: "key is required"
          },
          400
        );
      }

      try {
        const row = await env.DB
          .prepare(`
            SELECT key, value_json, updated_at
            FROM company_store
            WHERE key = ?
          `)
          .bind(key)
          .first();

        return json({
          ok: true,
          data: row || null
        });
      } catch (error) {
        return json(
          {
            ok: false,
            error: String(error)
          },
          500
        );
      }
    }

    if (url.pathname === "/api/state" && request.method === "POST") {
      try {
        const body = await request.json();

        if (
          !body ||
          typeof body.key !== "string" ||
          typeof body.value !== "object"
        ) {
          return json(
            {
              ok: false,
              error: "key and value are required"
            },
            400
          );
        }

        const now = new Date().toISOString();

        await env.DB
          .prepare(`
            INSERT INTO company_store (
              key,
              value_json,
              updated_at
            )
            VALUES (?, ?, ?)
            ON CONFLICT(key)
            DO UPDATE SET
              value_json = excluded.value_json,
              updated_at = excluded.updated_at
          `)
          .bind(
            body.key,
            JSON.stringify(body.value),
            now
          )
          .run();

        return json({
          ok: true,
          key: body.key,
          updated_at: now
        });
      } catch (error) {
        return json(
          {
            ok: false,
            error: String(error)
          },
          500
        );
      }
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(heartbeat(env));
  }
};

async function heartbeat(env) {
  const now = new Date().toISOString();

  try {
    await env.DB
      .prepare(`
        UPDATE runtime_meta
        SET
          last_heartbeat_at = ?,
          cycle_count = cycle_count + 1
        WHERE id = 1
      `)
      .bind(now)
      .run();

    return json({
      ok: true,
      heartbeat: true,
      time: now
    });
  } catch (error) {
    return json(
      {
        ok: false,
        heartbeat: false,
        error: String(error)
      },
      500
    );
  }
}

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      }
    }
  );
}
