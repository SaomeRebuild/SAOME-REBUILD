/**
 * Pass runtime value BACKFILL — one-off Worker entry.
 *
 * @module scripts/pass-runtime-values-backfill-worker
 * @description A minimal Cloudflare Worker whose ONLY job is to run
 * the Pass runtime value backfill against the production database
 * through the REAL Hyperdrive binding.
 *
 * WHY A WORKER AND NOT A LOCAL POSTGRES CONNECTION
 *
 * The production DB password lives inside the Hyperdrive configuration
 * on Cloudflare's side — it is never in `.dev.vars`, never in
 * `wrangler.jsonc`, and never in the repo. So a local `psql` /
 * `postgres.js` connection to `db.rlipsytwlyliwqifkqpb.supabase.co`
 * cannot be opened without a credential the repo deliberately does
 * not hold.
 *
 * A Worker CAN reach the database: the `HYPERDRIVE` binding carries
 * the connection string, and `wrangler dev --remote` executes the
 * Worker in Cloudflare's runtime with that binding attached. This is
 * the same route used to apply migration 028
 * (`.applied-migrations.json` → `via: "wrangler-hyperdrive-worker"`).
 *
 * THIS FILE IS NOT PART OF THE SHIPPED WORKER
 *
 * It has its own `wrangler.backfill.jsonc`; the production
 * `src/index.ts` and `wrangler.jsonc` are untouched. It is kept in the
 * repo because it is currently the ONLY way to reach the production
 * database from a workstation:
 *
 *   - The Supabase MCP requires an OAuth session that is not
 *     available to a headless script.
 *   - The DB password lives inside the Hyperdrive configuration on
 *     Cloudflare's side, so a local `postgres` / `psql` connection
 *     cannot be opened with a credential the repo does not hold.
 *
 * SAFETY
 *
 *   - `?mode=dry-run` (the DEFAULT) performs NO writes — it only
 *     prints the report.
 *   - `?mode=apply` performs the writes.
 *   - `?mode=inspect` is READ-ONLY and dumps the template settings +
 *     holder rows the report is derived from — used to verify the
 *     report against its source data.
 *   - The response body carries the report, so the operator can read
 *     the result without leaving the terminal.
 *
 * RUNBOOK
 *
 *   # 1. start the one-off worker (remote — the Hyperdrive binding
 *   #    points at the production database)
 *   npx wrangler dev --remote --config wrangler.backfill.jsonc --port 8799 --ip 127.0.0.1
 *
 *   # 2. read the report (NO writes)
 *   curl "http://127.0.0.1:8799/?mode=dry-run"
 *
 *   # 3. verify the report against its source data
 *   curl "http://127.0.0.1:8799/?mode=inspect"
 *
 *   # 4. apply
 *   curl "http://127.0.0.1:8799/?mode=apply"
 *
 *   # 5. stop the worker
 *
 * @see apps/backend/src/modules/pass-templates/services/passValueBackfill.ts
 * @see apps/backend/scripts/backfill-pass-runtime-values.cjs
 */

import { getDb } from '@/shared/db/client';
import {
  backfillPassRuntimeValues,
  planPassRuntimeValueBackfill,
} from '@/modules/pass-templates/services/passValueBackfill';
import { findPublicTemplateById } from '@/modules/pass-templates/db/templates';
import type { HonoEnv } from '@/shared/types/bindings';

export default {
  async fetch(request: Request, env: HonoEnv['Bindings']): Promise<Response> {
    const mode = new URL(request.url).searchParams.get('mode') ?? 'dry-run';

    try {
      const sql = await getDb(env.HYPERDRIVE);

      // `inspect` mode — READ-ONLY. Dumps the template settings the
      // expiry rules read, so the dry-run report can be verified
      // against the source data.
      if (mode === 'inspect') {
        const plan = await planPassRuntimeValueBackfill(sql);
        const templateIds = [...new Set(plan.map((e) => e.templateId))];
        const templates = [];
        for (const id of templateIds) {
          const t = await findPublicTemplateById(sql, id);
          templates.push({
            id,
            card_type: t?.card_type ?? null,
            settings: t?.settings ?? null,
          });
        }
        // The holder rows themselves — the tier selection + the frozen
        // tier snapshot are what decide a PAID membership's expiry.
        const holders = await sql`
          SELECT id, template_id, selected_tier_index, membership_tier_snapshot,
                 purchased_points, payment_status, created_at,
                 pass_values_snapshot
            FROM public.pass_holders
           WHERE pass_values_snapshot IS NOT NULL
             AND EXISTS (
                   SELECT 1 FROM public.pass_events e
                    WHERE e.pass_holder_id = public.pass_holders.id
                      AND e.event_type = 'registered'
                 )
           ORDER BY created_at ASC
        `;
        // Ledger totals — how many events / how many holders.
        const totals = await sql`
          SELECT
            (SELECT count(*) FROM public.pass_holders) AS holders_total,
            (SELECT count(*) FROM public.pass_events) AS events_total,
            (SELECT count(*) FROM public.pass_events WHERE event_type = 'registered') AS registered_total,
            (SELECT count(*) FROM public.pass_holders WHERE pass_values_snapshot IS NOT NULL) AS snapshot_total,
            (SELECT count(*) FROM public.pass_holders
              WHERE pass_values_snapshot IS NULL
                AND NOT EXISTS (
                      SELECT 1 FROM public.pass_events e
                       WHERE e.pass_holder_id = public.pass_holders.id
                         AND e.event_type = 'registered')) AS still_missing
        `;
        return new Response(
          JSON.stringify({ mode, templates, holders, totals }, null, 2),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const plan = await planPassRuntimeValueBackfill(sql);

      let summary: unknown = null;
      if (mode === 'apply') {
        summary = await backfillPassRuntimeValues(sql);
      }

      return new Response(
        JSON.stringify({ mode, plan, summary }, null, 2),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (err) {
      return new Response(
        JSON.stringify(
          {
            mode,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
          null,
          2,
        ),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },
};
