#!/usr/bin/env node
/**
 * db-explain.js v1.0 (15 Nov 2026) - EXPLAIN for the hot paths (migration step 0.7 part 2; Claude.md non-functional
 * rule "every new query on a table that can exceed 10k rows must use an index; show EXPLAIN for hot paths").
 *
 *   npm run db:explain                       Neon dev (secret daloy-db-dev-url) → docs/perf/EXPLAIN_HotPaths_<yyyymmdd>.md
 *   npm run db:explain -- --out <file.md>    another output file
 *   npm run db:explain -- --no-write         print the summary only
 *   --secret / --project / --allow-non-dev   as scripts/db-migrate.js (DATABASE_URL wins when set)
 *
 * For every hot path it runs two plans inside one transaction that is rolled back:
 *   1. "at scale" - EXPLAIN with enable_seqscan = off: proves an index can serve the query. On today's few hundred rows
 *      Postgres rightly prefers a sequential scan, so the natural plan says nothing about 10k+ rows.
 *   2. "today"    - EXPLAIN (ANALYZE) as the planner chooses, with the server execution time.
 * With seq scans off, Postgres still picks a Seq Scan only when no index can serve the query - so a path FAILS on a
 * Seq Scan in the at-scale plan. A plan that uses another index than the one named is "alt": fine for now (on tiny
 * tables the costs barely differ), to recheck at volume (Phase 1 load test). Exit 1 on any failure.
 * The queries use made-up ids ('co_x', 'u_x', ...): the plans and the written file hold no company data.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const migrate = require('./db-migrate');
const { redact, strictSsl } = require('../api/_lib/db');

const ROOT = path.resolve(__dirname, '..');
const OPEN = "('Completed', 'Rejected', 'Cancelled')";

/**
 * The hot paths: the reads behind every screen + the per-request lookups of the workflow engine.
 * `expect` names the indexes meant for the path; see the header for ok / alt / FAIL.
 */
const HOT_PATHS = [
  { name: 'ticket by id', action: 'getTicket', expect: ['pk_tickets'],
    sql: "select * from tickets where id = 't_x'" },
  { name: 'ticket by number', action: 'getTicket (number)', expect: ['uq_tickets_number'],
    sql: "select * from tickets where ticket_number = 'XX-PR-2026-00000001'" },
  { name: 'ticket list - company + type, keyset page', action: 'getTickets', expect: ['idx_tickets_company_type_created'],
    sql: "select id, ticket_number, title, status, created_at from tickets where company_id = 'co_x' and ticket_type_id = 'tt_x' " +
      "and (created_at, id) < ('2026-11-15T00:00:00Z'::timestamptz, 't_x') order by created_at desc, id desc limit 51" },
  { name: 'ticket list - company + status', action: 'getTickets (status filter)', expect: ['idx_tickets_company_status'],
    sql: "select id, ticket_number, title, created_at from tickets where company_id = 'co_x' and status = 'Pending' limit 51" },
  { name: 'my tickets', action: 'getTickets (mine) / getDashboard', expect: ['idx_tickets_requester_created'],
    sql: "select id, ticket_number, status, created_at from tickets where requester_id = 'u_x' order by created_at desc, id desc limit 51" },
  { name: 'search - words', action: 'getTickets (q)', expect: ['idx_tickets_search'],
    sql: "select id, ticket_number, title from tickets where search @@ plainto_tsquery('simple', 'laptop') limit 51" },
  { name: 'search - part of a ticket number', action: 'getTickets (q)', expect: ['idx_tickets_number_trgm'],
    sql: "select id, ticket_number from tickets where ticket_number ilike '%00000123%' limit 51" },
  { name: 'approval inbox', action: 'getTicketsForApproval', expect: ['idx_user_role_assignments_user', 'idx_tickets_open_step'],
    sql: "select t.id, t.ticket_number, t.status, t.step_due_date from user_role_assignments ura " +
      "join step_approvers sa on sa.role_id = ura.role_id " +
      `join tickets t on t.current_step_id = sa.step_id and t.status not in ${OPEN} ` +
      "where ura.user_id = 'u_x' and ura.is_active limit 100" },
  { name: 'tickets I take part in', action: 'canViewTicket / getTickets (visibility)', expect: ['idx_ticket_participants_user_ticket'],
    sql: "select ticket_id from ticket_participants where user_id = 'u_x' and is_active" },
  { name: 'ticket history', action: 'getTicketHistory', expect: ['idx_ticket_history_ticket_time'],
    sql: "select * from ticket_history where ticket_id = 't_x' order by \"timestamp\"" },
  { name: 'ticket action log', action: 'getTicket (audit)', expect: ['idx_ticket_action_logs_ticket_time'],
    sql: "select * from ticket_action_logs where ticket_id = 't_x' order by \"timestamp\"" },
  { name: 'custom field values of a ticket', action: 'getTicket', expect: ['idx_custom_field_values_entity'],
    sql: "select * from custom_field_values where ticket_id = 't_x' and entity_category = 'ticket'" },
  { name: 'workflow steps of a type', action: 'createTicket / approve', expect: ['idx_workflow_steps_type_company_order'],
    sql: "select * from workflow_steps where ticket_type_id = 'tt_x' and company_id = 'co_x' and is_active order by sort_order" },
  { name: 'my roles', action: 'every request (permissions)', expect: ['idx_user_role_assignments_user'],
    sql: "select role_id, ticket_type_id, company_id from user_role_assignments where user_id = 'u_x' and is_active" },
  { name: 'unread notifications', action: 'getNotifications (header bell)', expect: ['idx_notifications_user_unread'],
    sql: "select * from notifications where user_id = 'u_x' and is_read = false order by created_at desc limit 20" },
  { name: 'SLA run - open tickets past due', action: 'runSLAEscalations', expect: ['idx_tickets_open_due'],
    sql: `select id, current_step_id, step_due_date from tickets where status not in ${OPEN} and step_due_date < '2026-11-15T00:00:00Z'` },
  { name: 'ticket number sequence (row lock)', action: 'createTicket', expect: ['pk_sequence_counters'],
    sql: "select last_number from sequence_counters where sequence_name = 'XX-PR' for update" },
];

const planText = rows => rows.map(r => r['QUERY PLAN']).join('\n');
/** The plan's first node, without costs: 'Index Scan using idx_x on tickets'. */
const topNode = text => (text.split('\n')[0] || '').replace(/\s*\(.*$/, '').replace(/^->\s*/, '').trim();
const execMs = text => {
  const m = /Execution Time: ([\d.]+) ms/.exec(text);
  return m ? Number(m[1]) : null;
};

/**
 * Run every hot path on a client ({ query(text) → { rows } }), inside one transaction that is rolled back.
 * @returns {Promise<Array<{ name, action, expect, sql, scalePlan, todayPlan, missing: string[], execution_ms }>>}
 */
async function runExplain(client, paths = HOT_PATHS) {
  const results = [];
  await client.query('begin');
  try {
    for (const p of paths) {
      await client.query('set local enable_seqscan = off');
      const scalePlan = planText((await client.query(`explain (costs off) ${p.sql}`)).rows);
      await client.query('set local enable_seqscan = on');
      const todayPlan = planText((await client.query(`explain (analyze, costs off, timing off, summary on) ${p.sql}`)).rows);
      const missing = p.expect.filter(index => !new RegExp(`\\b${index}\\b`).test(scalePlan));
      const seqScans = [...scalePlan.matchAll(/Seq Scan on (\w+)/g)].map(x => x[1]);
      const status = seqScans.length ? 'FAIL' : (missing.length ? 'alt' : 'ok');
      results.push({ ...p, scalePlan, todayPlan, missing, seqScans, status, execution_ms: execMs(todayPlan) });
    }
  } finally {
    await client.query('rollback');
  }
  return results;
}

function formatSummary(results) {
  const lines = results.map(r => `${r.status.padEnd(4)}  ${r.name.padEnd(42)} ${r.expect.join(' + ')}` +
    (r.status === 'FAIL' ? `  (full read of: ${r.seqScans.join(', ')})` : '') +
    (r.status === 'alt' ? `  (planner chose another index for: ${r.missing.join(', ')})` : '') +
    (r.execution_ms !== null ? `  today ${r.execution_ms} ms` : ''));
  const failed = results.filter(r => r.status === 'FAIL').length;
  const alt = results.filter(r => r.status === 'alt').length;
  lines.push(`\n${results.length - failed}/${results.length} hot paths can use an index at scale (${alt} chose another index than the one named)`);
  return lines.join('\n');
}

function formatMarkdown(results, { date, target, counts }) {
  const failed = results.filter(r => r.status === 'FAIL').length;
  const alt = results.filter(r => r.status === 'alt');
  const out = [
    '# JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM',
    '',
    `## EXPLAIN — hot paths (${date})`,
    '',
    `Generated by \`npm run db:explain\` (\`scripts/db-explain.js\`) on ${target}. Migration step 0.7 part 2; rule: every`,
    'query on a table that can pass 10k rows uses an index (Claude.md, non-functional requirements).',
    '',
    '- **At scale** = `EXPLAIN` with `enable_seqscan = off`: Postgres then reads a whole table (Seq Scan) only when no',
    '  index can serve the query. **ok** = the named index is used; **alt** = another index serves it (on tiny tables',
    '  the costs barely differ - recheck at volume); **FAIL** = a whole-table read, an index is missing.',
    '- **Today** = the plan Postgres picks now, with `EXPLAIN ANALYZE` execution time on the server (no network).',
    '  With a few hundred rows a sequential scan is the right choice, so "Seq Scan" today is expected.',
    '- The queries use made-up ids; nothing here comes from company data.',
    '',
    `Rows today: ${counts}.`,
    '',
    `**Result: ${results.length - failed} / ${results.length} hot paths can use an index at scale` +
      ` (${alt.length} through another index than the one named).**`,
    '',
    '| # | Hot path | Action | Index meant for it | At scale | Today: top node | Today ms |',
    '|---|---|---|---|---|---|---|',
    ...results.map((r, i) => `| ${i + 1} | ${r.name} | \`${r.action}\` | ${r.expect.map(x => `\`${x}\``).join(' + ')} | ` +
      `${r.status === 'FAIL' ? '**FAIL**' : r.status} | ${topNode(r.todayPlan)} | ${r.execution_ms === null ? '' : r.execution_ms} |`),
    '',
    ...(alt.length ? ['### Watch at volume (alt)', '', ...alt.map(r => {
      const used = [...new Set([...r.scalePlan.matchAll(/(?:using|on) ((?:idx|uq|pk)_\w+)/g)].map(x => x[1]))];
      return `- **${r.name}**: named ${r.missing.map(x => `\`${x}\``).join(', ')}; the planner used ${used.map(x => `\`${x}\``).join(', ')}.`;
    }), ''] : []),
    '## Plans',
    ''
  ];
  results.forEach((r, i) => {
    out.push(`### ${i + 1}. ${r.name}`, '', '```sql', r.sql, '```', '', 'At scale:', '', '```', r.scalePlan, '```', '',
      'Today:', '', '```', r.todayPlan, '```', '');
  });
  return out.join('\n');
}

/** yyyymmdd in UTC+8 (file names follow the UTC+8 stamp rule). */
function stampDate(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit',
    day: '2-digit' }).formatToParts(now).map(x => [x.type, x.value]));
  return { compact: `${p.year}${p.month}${p.day}`, iso: `${p.year}-${p.month}-${p.day}` };
}

function parseArgs(argv) {
  const opts = { secret: migrate.DEFAULT_SECRET, project: migrate.DEFAULT_PROJECT, allowNonDev: false, out: null, write: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      if (!argv[i + 1]) throw new Error(`${arg} needs a value`);
      i += 1;
      return argv[i];
    };
    if (arg === '--secret') opts.secret = value();
    else if (arg === '--project') opts.project = value();
    else if (arg === '--allow-non-dev') opts.allowNonDev = true;
    else if (arg === '--out') opts.out = value();
    else if (arg === '--no-write') opts.write = false;
    else throw new Error(`unknown option ${arg}`);
  }
  return opts;
}

async function main(argv) {
  const opts = parseArgs(argv);
  const { url, source } = migrate.resolveConnection(opts);
  const { Client } = require('pg');
  const client = new Client({ connectionString: strictSsl(url), connectionTimeoutMillis: 20000, application_name: 'daloy-db-explain' });
  await client.connect();
  try {
    const target = source === 'DATABASE_URL' ? 'DATABASE_URL' : `Neon (${source})`;
    console.log(`Connected: ${migrate.describeTarget(url)} (${source}; password hidden)`);
    const sizes = (await client.query(
      "select 'tickets' as t, count(*)::int as n from tickets union all select 'ticket_history', count(*)::int from ticket_history " +
      "union all select 'user_role_assignments', count(*)::int from user_role_assignments")).rows;
    const results = await runExplain(client);
    console.log(formatSummary(results));
    if (opts.write) {
      const date = stampDate();
      const file = path.resolve(opts.out || path.join(ROOT, 'docs', 'perf', `EXPLAIN_HotPaths_${date.compact}.md`));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, formatMarkdown(results, { date: date.iso, target, counts: sizes.map(s => `${s.t} ${s.n}`).join(', ') }));
      console.log(`Written: ${path.relative(ROOT, file)}`);
    }
    return results.some(r => r.status === 'FAIL') ? 1 : 0;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => process.exit(code), error => {
    console.error(`db-explain: ${redact(String(error && error.message))}`);
    process.exit(2);
  });
}

module.exports = { HOT_PATHS, runExplain, formatSummary, formatMarkdown, topNode, parseArgs };
