/**
 * api/_lib/handlers/system.js - platform checks on Postgres (migration step 0.6).
 *
 * dbHealth: proves the /api/rpc -> Neon path end to end and measures the Cloud Run <-> Neon round trip
 * (PLAN_Migration_NeonVercel_20261030.md §2: "measure it in Phase 0, not assumed").
 *   Query budget: 2 (1 when schema_migrations does not exist yet). Indexes: none needed - the catalog lookup and the
 *   primary key of the tiny schema_migrations table.
 */

const { requireUser } = require('../rpcErrors');

module.exports = {
  /**
   * @returns {{ db: 'ok', server_version: string, db_time: string, round_trip_ms: number,
   *   latest_migration: { version: string, name: string, applied_at: string } | null }}
   */
  async dbHealth(payload, ctx) {
    requireUser(ctx);
    const started = Date.now();
    const { rows } = await ctx.db.query(
      "select current_setting('server_version') as server_version, now() as db_time, " +
      "to_regclass('public.schema_migrations') is not null as has_migrations"
    );
    const roundTripMs = Date.now() - started;
    const info = rows[0] || {};
    let latest = null;
    if (info.has_migrations) {
      const result = await ctx.db.query(
        'select version, name, applied_at from schema_migrations order by version desc limit 1'
      );
      latest = result.rows[0] || null;
    }
    return {
      db: 'ok',
      server_version: String(info.server_version || ''),
      db_time: info.db_time instanceof Date ? info.db_time.toISOString() : String(info.db_time || ''),
      round_trip_ms: roundTripMs,
      latest_migration: latest && {
        version: latest.version,
        name: latest.name,
        applied_at: latest.applied_at instanceof Date ? latest.applied_at.toISOString() : String(latest.applied_at)
      }
    };
  }
};
