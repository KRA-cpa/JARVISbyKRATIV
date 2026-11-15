#!/usr/bin/env node
/**
 * db-export-company.js v1.0 (15 Nov 2026, session 461f9ea9) - tool T1: every row of ONE organization (company) as one
 * JSON file, for returning its data (docs/guides/GUIDE_DataReturnDeletion_20261115.md §3) or a data-subject request.
 * Changes nothing: one transaction that is always rolled back (the scope lives in a temp table, which a READ ONLY
 * transaction can't create).
 *
 * Usage:
 *   node scripts/db-export-company.js --company <id> --out <file.json>   (Neon dev by default - secret daloy-db-dev-url)
 *   --secret / --project / --allow-non-dev   as scripts/db-migrate.js (DATABASE_URL wins when set)
 * The output file must be OUTSIDE the repository (it holds personal data); the script refuses a path inside it.
 * Contents: the company's rows from every table in scope (scripts/lib/companyScope.js), its companies row and billing /
 * contract rows (kept tables, for the record), and a summary. Prints counts only - never row contents.
 * Exit: 0 = written, 1 = error, 2 = bad arguments.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const migrate = require('./db-migrate');
const { strictSsl, redact } = require('../api/_lib/db');
const { buildScope, scopedRows, q } = require('./lib/companyScope');

const ROOT = path.resolve(__dirname, '..');
// Kept tables whose rows for this company still belong in the organization's copy of its data
const KEPT_WITH_COMPANY = ['company_subscriptions', 'contract_acceptances'];

function parseArgs(argv) {
  const opts = { secret: migrate.DEFAULT_SECRET, project: migrate.DEFAULT_PROJECT, allowNonDev: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--company') opts.company = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--secret') opts.secret = argv[++i];
    else if (a === '--project') opts.project = argv[++i];
    else if (a === '--allow-non-dev') opts.allowNonDev = true;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!opts.company) throw new Error('--company <id> is required');
  if (!opts.out) throw new Error('--out <file.json> is required');
  return opts;
}

/** The output path, refused when it is inside the repository. */
function safeOutPath(out, root = ROOT) {
  const full = path.resolve(out);
  const rel = path.relative(root, full);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) throw new Error('--out must be outside the repository (the export holds personal data)');
  return full;
}

/**
 * @param {Object} client - query(text, params) on one connection
 * @returns {Promise<{ meta, tables: Object<string, Array> }>}
 */
async function runExport(client, companyId, now = new Date()) {
  await client.query('begin'); // always rolled back below
  try {
    const scope = await buildScope(client, companyId);
    const tables = {};
    for (const t of Object.keys(scope.counts).sort()) tables[t] = await scopedRows(client, t);
    tables.companies = (await client.query('select * from companies where id = $1', [companyId])).rows;
    for (const t of KEPT_WITH_COMPANY) {
      if (scope.columns[t] && scope.columns[t].company_id) {
        tables[t] = (await client.query(`select * from ${q(t)} where company_id = $1`, [companyId])).rows;
      }
    }
    const counts = Object.fromEntries(Object.entries(tables).map(([t, rows]) => [t, rows.length]));
    return {
      meta: {
        kind: 'daloy-company-export', version: 1, company_id: companyId, exported_at: now.toISOString(),
        users_only_in_this_company: scope.users.length, counts,
        cross_company_references: scope.crossCompany.map(({ child, col, parent, rows }) => ({ child, col, parent, rows }))
      },
      tables
    };
  } finally {
    await client.query('rollback');
  }
}

async function main(argv) {
  const opts = parseArgs(argv);
  const out = safeOutPath(opts.out);
  const { url, source } = migrate.resolveConnection(opts);
  const { Client } = require('pg');
  const client = new Client({ connectionString: strictSsl(url), connectionTimeoutMillis: 20000, application_name: 'daloy-db-export-company' });
  await client.connect();
  console.log(`Connected: ${migrate.describeTarget(url)} (${source}; password hidden)`);
  try {
    const result = await runExport(migrate.pgAdapter(client), opts.company);
    fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf8');
    console.log(`Written: ${out}`);
    Object.entries(result.meta.counts).forEach(([t, c]) => console.log(`  ${t}: ${c}`));
    if (result.meta.cross_company_references.length) console.log('  Cross-company references (not exported):', result.meta.cross_company_references.length);
  } finally {
    await client.end();
  }
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => process.exit(code)).catch(error => {
    console.error(`db-export-company: ${redact(error.message)}`);
    process.exit(/required|unknown argument|outside the repository/.test(error.message) ? 2 : 1);
  });
}

module.exports = { runExport, parseArgs, safeOutPath };
