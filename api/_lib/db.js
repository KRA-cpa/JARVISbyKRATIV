/**
 * api/_lib/db.js - the Postgres (Neon) access layer for /api/rpc handlers (migration step 0.6, 14 Nov 2026).
 *
 * Driver: `pg` (node-postgres) - a normal TCP Pool over Neon's DIRECT connection string, because Cloud Run is a
 * long-running container (docs/reference/PRODUCTION_REQUIREMENTS.md). No ORM: handlers write plain SQL so every query
 * is visible against the Claude.md query budgets (simple read <= 3, list <= 5, workflow write <= 10 in one transaction).
 *
 * Every request gets its own view (forRequest) that counts its queries; rpcCore.js writes the count into the request's
 * log line as query_count. Connection strings never reach a log or an error message (redact()).
 */

const DEFAULT_POOL_MAX = 5; // Neon Free: few connections; one Cloud Run instance needs only a handful

/** Hide any postgres URL (and its password) inside a message. */
function redact(message) {
  return String(message == null ? '' : message).replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://***');
}

/**
 * pg 8.x already treats sslmode=require as verify-full (certificate + host checked) and warns that this will change;
 * say verify-full explicitly so the behaviour stays the strict one after a pg upgrade (Neon serves valid certificates).
 */
function strictSsl(connectionString) {
  return String(connectionString || '').replace(/([?&]sslmode=)(require|prefer|verify-ca)(?=&|$)/i, '$1verify-full');
}

function poolSize(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 50 ? n : DEFAULT_POOL_MAX;
}

/**
 * @param {Object} options
 * @param {string} [options.connectionString] - DATABASE_URL; empty -> null (no database: /api/rpc sends every action
 *   to Apps Script)
 * @param {number|string} [options.max] - pool size (env DB_POOL_MAX), default 5
 * @param {Function} [options.poolFactory] - () => pool with query / connect / end (tests inject a fake)
 * @param {Function} [options.log] - where pool errors go
 * @returns {null | { forRequest: Function, end: Function }}
 */
function createDb({ connectionString = '', max, poolFactory = null, log = console.error } = {}) {
  if (!connectionString) return null;
  let pool = null;

  function getPool() {
    if (!pool) {
      if (poolFactory) {
        pool = poolFactory();
      } else {
        // Required here, not at the top: the Apps Script-only paths never load the driver
        const { Pool } = require('pg');
        pool = new Pool({ connectionString: strictSsl(connectionString), max: poolSize(max), idleTimeoutMillis: 30000, connectionTimeoutMillis: 15000 });
      }
      // An idle client losing its connection (Neon suspends after 5 min idle) must not crash the server
      if (typeof pool.on === 'function') pool.on('error', error => log(JSON.stringify({ db_pool_error: redact(error.message) })));
    }
    return pool;
  }

  return {
    /**
     * A per-request view of the database.
     * @returns {{ query: Function, transaction: Function, count: Function }}
     *   query(text, params) -> pg result; transaction(async tx => ...) runs BEGIN / COMMIT on one connection and
     *   ROLLBACK on any error (all-or-nothing writes); count() = queries run so far (BEGIN / COMMIT not counted)
     */
    forRequest() {
      let count = 0;
      const query = async (text, params) => {
        count += 1;
        return getPool().query(text, params);
      };
      const transaction = async fn => {
        const client = await getPool().connect();
        const tx = {
          query: async (text, params) => {
            count += 1;
            return client.query(text, params);
          }
        };
        try {
          await client.query('begin');
          const result = await fn(tx);
          await client.query('commit');
          return result;
        } catch (error) {
          try {
            await client.query('rollback');
          } catch (rollbackError) {
            log(JSON.stringify({ db_rollback_error: redact(rollbackError.message) }));
          }
          throw error;
        } finally {
          client.release();
        }
      };
      return { query, transaction, count: () => count };
    },
    async end() {
      if (pool) await pool.end();
      pool = null;
    }
  };
}

module.exports = { createDb, redact, strictSsl, poolSize, DEFAULT_POOL_MAX };
